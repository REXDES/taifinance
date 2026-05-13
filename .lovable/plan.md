# Migração WhatsApp: Evolution API → Cloud API oficial (Meta)

Substituir completamente a Evolution API pela WhatsApp Cloud API oficial em todos os fluxos (PIX, lembretes de vencimento, notificações de teste), usando uma única conta Meta global para todas as empresas.

## Pré-requisitos (responsabilidade do usuário, fora do código)

1. Criar/verificar conta no **Meta Business Manager** (CNPJ).
2. Criar app em **developers.facebook.com** e adicionar produto **WhatsApp**.
3. Cadastrar um **número dedicado** (não pode estar ativo no app WhatsApp normal).
4. Gerar um **System User Access Token permanente** (sem expiração).
5. Submeter e aguardar aprovação dos **templates** (24h em média):
   - `lembrete_vencimento` (utility) — variáveis: nome, valor, vencimento, link
   - `cobranca_pix` (utility) — variáveis: nome, valor, descrição
   - `notificacao_pagamento_recebido` (utility) — variáveis: nome, valor

## Secrets a adicionar (globais)

- `WHATSAPP_CLOUD_TOKEN` — System User Access Token permanente
- `WHATSAPP_CLOUD_PHONE_NUMBER_ID` — ID do número emissor
- `WHATSAPP_CLOUD_BUSINESS_ACCOUNT_ID` — WABA ID (opcional, para gerenciar templates)

## Mudanças no backend (edge functions)

Reescrever as 3 funções para chamar `https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`:

- **`send-pix-whatsapp`**: envia template `cobranca_pix` + imagem do QR Code (upload de mídia → media ID → mensagem image) + texto livre com PIX copia-e-cola.
- **`notify-whatsapp`** (lembretes agendados de payables/receivables): envia template `lembrete_vencimento` com variáveis preenchidas.
- **`test-whatsapp`**: envia template simples (`hello_world` ou um template de teste aprovado) para validar credenciais.

Manter a interface (parâmetros de entrada) idêntica para não quebrar os chamadores existentes.

## Mudanças na UI

- **Configurações da empresa → aba WhatsApp**: simplificar — remover campos de Evolution API por empresa. Mostrar apenas:
  - Número do WhatsApp do remetente (somente leitura, vindo de configuração global)
  - Status da conexão (botão "Testar conexão" → chama `test-whatsapp`)
  - Lista dos templates disponíveis e seu status de aprovação
- **Página de configurações globais (admin)**: nova seção "WhatsApp Cloud API" com:
  - Indicador se as 3 secrets estão configuradas
  - Mapeamento template-name por tipo de mensagem (caso o nome aprovado pela Meta seja diferente do default)

## Limpeza

- Remover variáveis e código relacionados a `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` das 3 funções.
- Manter o secret `EVOLUTION_API_KEY` no Supabase por enquanto (sem uso) para rollback rápido caso necessário; remover em segunda fase.
- Atualizar memória `mem://integrations/evolution-api-status` substituindo por `mem://integrations/whatsapp-cloud-api`.

## Detalhes técnicos

**Endpoint base**: `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`

**Headers**:
```
Authorization: Bearer ${WHATSAPP_CLOUD_TOKEN}
Content-Type: application/json
```

**Payload — template com variáveis**:
```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "lembrete_vencimento",
    "language": { "code": "pt_BR" },
    "components": [
      { "type": "body", "parameters": [
        { "type": "text", "text": "João" },
        { "type": "text", "text": "R$ 1.250,00" },
        { "type": "text", "text": "15/05/2026" }
      ]}
    ]
  }
}
```

**Payload — texto livre (só dentro de janela de 24h após resposta)**:
```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text",
  "text": { "body": "..." }
}
```

**Upload de QR Code (PIX)**:
1. POST `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/media` com form-data (file + messaging_product=whatsapp) → retorna `media_id`
2. POST `/messages` com `type: "image"` e `image: { id: media_id, caption: "..." }`

**Tratamento de erros**: a Meta retorna códigos específicos (131026 = number not on WhatsApp, 132001 = template não aprovado, 131047 = fora da janela de 24h). Mapear esses códigos para mensagens claras no toast.

## Ordem de execução

1. Adicionar as 3 secrets via `secrets--add_secret` (bloqueia até usuário preencher).
2. Reescrever `send-pix-whatsapp/index.ts`.
3. Reescrever `notify-whatsapp/index.ts`.
4. Reescrever `test-whatsapp/index.ts`.
5. Ajustar UI da aba WhatsApp em `CompanySettingsDialog.tsx`.
6. Atualizar memórias de WhatsApp.
7. Validar com botão "Testar conexão".

## Observação sobre custo

Cada conversa "utility" iniciada custa ~US$ 0,008 a US$ 0,03 (Brasil). Lembretes diários de vencimento podem virar volume — vale considerar uma agregação (1 mensagem por cliente/dia somando todos os títulos vencendo) em vez de 1 mensagem por título. Não está incluído neste plano, mas é uma otimização recomendada como segundo passo.
