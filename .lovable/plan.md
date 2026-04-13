

## Plano Completo: Cobrança PIX + Notificações WhatsApp (Contas a Pagar/Receber)

### Resumo

Implementar três funcionalidades integradas: (1) geração de cobrança PIX com QR Code nas contas a receber, (2) configuração de notificações WhatsApp por empresa para lembretes de contas a pagar/receber, e (3) campo WhatsApp no cadastro de clientes/fornecedores.

---

### 1. Migração do Banco de Dados

**Tabela `companies`** — adicionar campos:
- `pix_key` (text, nullable)
- `pix_key_type` (text, nullable) — cpf, cnpj, email, phone, random
- `pix_holder_name` (text, nullable)
- `pix_city` (text, nullable)
- `whatsapp_notify_enabled` (boolean, default false)
- `whatsapp_notify_days_before` (integer[], default '{0}')
- `whatsapp_notify_time` (text, default '08:00')

**Tabela `clients_suppliers`** — adicionar campo:
- `whatsapp_phone` (text, nullable)

---

### 2. Cadastro de Clientes/Fornecedores — Campo WhatsApp

Adicionar campo "WhatsApp" no formulário de criação/edição em `ClientsSuppliersPage.tsx`. Atualizar o hook `useClientsSuppliers` para incluir o novo campo.

---

### 3. Configurações da Empresa — PIX + Notificações WhatsApp

Criar novo componente `CompanySettingsDialog.tsx` com duas seções:

**Seção PIX:**
- Tipo da chave PIX (select: CPF, CNPJ, E-mail, Telefone, Aleatória)
- Chave PIX (input)
- Nome do titular (input)
- Cidade (input)

**Seção Notificações WhatsApp:**
- Toggle ativar/desativar notificações
- Checkboxes para dias de antecedência: "No dia do vencimento", "1 dia antes", "2 dias antes", "3 dias antes", "5 dias antes", "7 dias antes"
- Campo de horário (input time HH:mm) para definir quando as mensagens são enviadas

Acessível via sidebar em Configurações ou via ícone na página de Contas a Pagar/Receber.

---

### 4. Gerador de Payload PIX (BR Code EMV)

Criar `src/lib/pixUtils.ts` com:
- Função `generatePixPayload()` que monta o payload EMV padrão do BACEN (tags 00, 01, 26, 52, 53, 54, 58, 59, 60, 62, 63)
- Cálculo CRC16-CCITT em TypeScript puro
- Retorna string "Pix Copia e Cola" pronta para QR Code

---

### 5. Botão "Gerar PIX" nas Contas a Receber

Na tabela de Contas a Pagar/Receber (`PayablesReceivablesPage.tsx`):
- Botão/ícone "Gerar PIX" nas linhas do tipo "receivable" (a receber) com status pendente
- Dialog com:
  - QR Code renderizado (instalar `qrcode.react`)
  - Código "Pix Copia e Cola" copiável
  - Dados do pagamento (valor, descrição, beneficiário)
  - Botão "Copiar código"
  - Botão "Enviar por WhatsApp" (se cliente tem WhatsApp cadastrado) — envia mensagem com dados da cobrança e código Pix via edge function

---

### 6. Edge Function `send-pix-whatsapp`

Nova edge function que recebe: phone, pixCode, description, amount, companyName. Envia mensagem formatada via Evolution API com dados da cobrança e o código "Pix Copia e Cola".

---

### 7. Atualizar Edge Function `notify-whatsapp`

Modificar a função existente para:
- Ler configurações de cada empresa (`whatsapp_notify_enabled`, `whatsapp_notify_days_before`, `whatsapp_notify_time`)
- Para cada empresa com notificações ativas, buscar contas a pagar/receber pendentes cujo vencimento coincida com os dias configurados
- Enviar notificação para o WhatsApp do cliente/fornecedor vinculado (campo `whatsapp_phone` da tabela `clients_suppliers`)
- Respeitar o horário configurado (comparar hora atual com `whatsapp_notify_time`)
- Mensagens diferenciadas: lembrete de vencimento para contas a pagar, cobrança para contas a receber

---

### 8. Instalar Dependência

- `qrcode.react` para renderizar QR Codes no frontend

---

### Limitações

- QR Code PIX estático: sem confirmação automática de pagamento
- O cron job existente deve rodar a cada hora; a função verifica se está na janela de horário configurada
- Sem rastreamento individual de pagamentos sem PSP

