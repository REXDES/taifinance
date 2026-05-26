
# Módulo de Gestão de Crédito (com integração RedeBE confirmada)

Novo módulo opcional por empresa (toggle em CompanySettings → Módulos, mesmo padrão de Máquinas & Locação). Integra RedeBE (Crédito Essencial Positivo), Lovable AI Gemini Vision (biometria/OCR), PIX/WhatsApp já existentes.

> ⚠️ **Rotacione o token `ctk_073...` agora no painel RedeBE** — ele foi exposto. Gere um novo e me envie depois via o formulário seguro de secret.

---

## 1. Integração RedeBE — mapeamento confirmado

**Endpoint:** `POST https://consultas.redebe.com.br/api/v1/credito/credito-essencial-positivo`
**Auth:** `Authorization: Bearer ctk_...`
**Body:** `{ "documento": "<CPF ou CNPJ só dígitos>" }`

Campos que o motor vai consumir (do `RedeBE.resumo` + `retorno.principal`):

| Campo motor | Caminho na resposta |
|---|---|
| Score (0–1000) | `RedeBE.resumo.score` |
| Classificação A–H | `RedeBE.resumo.classificacao_score` |
| % inadimplência | `RedeBE.resumo.probabilidade_inadimplencia` |
| Nome / Razão Social | `resumo.nome` ou `CREDCADASTRAL.INFORMACOES_DA_EMPRESA.RAZAO_SOCIAL` |
| Situação CPF/CNPJ | `resumo.situacao_cpf` ou `INFORMACOES_DA_EMPRESA.SITUACAO` |
| Qtd / Valor pendências financeiras | `resumo.quantidade_pendencias_financeiras` / `valor_total_pendencias_financeiras` |
| Qtd / Valor protestos | `resumo.quantidade_protestos` / `valor_total_protestos` |
| Qtd ações cíveis | `resumo.quantidade_acoes_civeis` |
| Qtd alertas/restrições | `resumo.quantidade_alertas_restricoes` |
| CCF Bacen / Varejo | `resumo.quantidade_ccf_bacen` / `quantidade_ccf_varejo` |
| Endereço | `CREDCADASTRAL.ENDERECO` |
| Data fundação (PJ) | `INFORMACOES_DA_EMPRESA.DATA_FUNDACAO` |
| Sócios (PJ) | `QUADRO_SOCIETARIO.OCORRENCIAS[]` |

A resposta vem como **array** — sempre pegar `[0]`.

Secret a cadastrar: **`REDEBE_API_TOKEN`** (vou solicitar via tool de secrets na implementação).

---

## 2. Motor de Decisão (regra forte, baseada em práticas de bureau)

Para tickets até R$10k, lógica em 3 camadas:

### Camada A — Knock-outs (reprova imediata)
- `INFORMACOES_DA_EMPRESA.SITUACAO` ≠ `ATIVO` (PJ) ou CPF irregular (PF)
- `quantidade_protestos` > limite admin (default: 0)
- `quantidade_pendencias_financeiras` > limite admin (default: 0)
- `quantidade_ccf_bacen` + `quantidade_ccf_varejo` > 0
- Inadimplente interno (parcelas vencidas > X dias na própria base Tai Finance)
- PJ com fundação < N meses (default: 6) ou PF idade < 18

### Camada B — Faixa de score (classificação RedeBE A–H + score numérico)
Tabela editável pelo admin com defaults conservadores:

| Score | Classe | Decisão | % do teto | Parcelas máx |
|---|---|---|---|---|
| ≥ 700 | A/B | Aprovado | 100% | 12x |
| 550–699 | C | Aprovado | 60% | 6x |
| 400–549 | D | Análise manual | 30% | 3x |
| < 400 | E–H | Recusado | — | — |

Teto absoluto da empresa configurável (ex.: R$10.000).

### Camada C — Ajuste fino
- Penalidade por % inadimplência alto (subtrai do limite)
- Bônus por tempo de CNPJ ativo > 24 meses
- Bônus por histórico interno positivo (parcelas pagas em dia)

Toda decisão fica auditada em `credit_decision_log` (input bruto + score calculado + regra aplicada).

### Encargos (configuráveis)
- Juros mensais compostos (default 3,5% a.m.) — cálculo PMT (Price)
- Multa por atraso 2%
- Mora 0,033%/dia
- Valor mínimo de parcela (default R$ 50)

---

## 3. Banco de dados (novas tabelas, RLS por `company_id`)

| Tabela | Propósito |
|---|---|
| `credit_rules` | Pesos, faixas, teto, juros, multa, mora, knock-outs por empresa |
| `credit_applications` | Proposta: cliente, documento, etapa atual, status, score, limite aprovado |
| `credit_consultations` | Snapshot bruto da resposta RedeBE + decisão calculada |
| `credit_qualifications` | Dados complementares coletados (renda, profissão, endereço entrega) |
| `credit_biometry` | URLs selfie/doc, OCR, score similaridade facial, status, token público |
| `credit_contracts` | Contrato: descrição, valor, juros, parcelas, PDF URL, vínculo `payables_receivables` |
| `credit_decision_log` | Auditoria de cada decisão automática |

Bucket Storage: `credit-documents` (privado, RLS).

Status do `credit_applications`:
`draft → consulted → qualifying → biometry_pending → biometry_ok → simulated → contracted → cancelled / rejected`

---

## 4. UI Administrativa (`/credito/admin`, só modo admin)

Abas:
1. **Provedor RedeBE** — botão "Configurar token" (abre form de secret), botão "Testar consulta" com CPF/CNPJ.
2. **Motor de decisão** — knock-outs, faixas (slider+tabela), teto, ajustes.
3. **Encargos** — juros, multa, mora, parcela mínima.
4. **Identidade & IA** — modelo Gemini (default `google/gemini-2.5-pro`), threshold similaridade (default 80%), exigir liveness.
5. **Contrato** — template de cláusulas, dados da empresa que aparecem no PDF.

---

## 5. UI Operacional (`/credito`, modo normal) — Timeline 6 etapas

```text
[1 Consulta] → [2 Qualificação] → [3 Biometria] → [4 Simulação] → [5 Contrato] → [6 Boletos]
```

### Etapa 1 — Consulta CPF/CNPJ
Input com máscara → edge `credit-consult` chama RedeBE → roda motor → mostra card com:
- Nome/Razão social, situação
- Score + classificação + barra colorida
- Lista de restrições (protestos, pendências, CCF)
- **Decisão**: ✅ Aprovado até R$X (Xx) / ⚠️ Análise manual / ❌ Recusado + motivo

### Etapa 2 — Qualificação
Form com dados já preenchidos da RedeBE + renda/profissão/endereço entrega/WhatsApp.

### Etapa 3 — Biometria (link público pro cliente)
Gera URL `/credito/identidade/:token` (rota pública, sem JWT) — envia via WhatsApp. Cliente:
1. Selfie com webcam/câmera mobile
2. Foto do doc (frente + verso)

Edge `credit-verify-identity` envia ao Lovable AI Gemini Vision:
- OCR do doc (nome, CPF, nascimento)
- Comparação facial selfie × doc
- Confronto com CPF da consulta

Auto-aprovado se similaridade ≥ threshold E CPF do doc = CPF da consulta.

### Etapa 4 — Simulação
Operador escolhe nº parcelas (limitado pela camada B) → calcula PMT → mostra parcela, total, CET, datas. Bloqueada se biometria não OK.

### Etapa 5 — Contrato
Form: descrição da mercadoria/serviço. Edge `credit-generate-contract` monta PDF com jsPDF (cláusulas + dados + cronograma) → salva em Storage → mostra preview.

### Etapa 6 — Boletos PIX + WhatsApp
- Cria N `payables_receivables` (receivable) vinculados ao contrato
- Cada parcela vira um PIX (reusa `pixUtils`) + mensagem WhatsApp via template aprovado
- Contrato PDF também vai via WhatsApp

---

## 6. Relatório (`/credito/relatorio`)

Lista contratos com filtros (período, cliente, status). Status derivado das parcelas:
- **A vencer** — nenhuma paga
- **Recebimento parcial** — algumas pagas
- **Quitado** — todas pagas
- **Inadimplente** — alguma vencida > 0 dias

Ações: ver detalhes, baixar PDF, editar descrição (com auditoria), cancelar (estorna se nenhuma paga).

---

## 7. Edge Functions a criar

| Função | verify_jwt | Função |
|---|---|---|
| `credit-consult` | true | Proxy RedeBE + motor de decisão |
| `credit-verify-identity` | false (link público) | Lovable AI Gemini Vision (OCR + facial) |
| `credit-public-upload` | false | Upload selfie/docs via token público |
| `credit-generate-contract` | true | PDF + cria parcelas + dispara WhatsApp |

---

## 8. Itens que ainda precisam confirmação

1. **Assinatura do contrato** — aceite por WhatsApp + biometria (suficiente p/ até R$10k juridicamente) ou quer integração com D4Sign/Clicksign no futuro? *Sugestão MVP: aceite WhatsApp.*
2. **Conta de recebimento PIX** — sempre a conta PIX padrão da empresa ou permitir escolher por contrato?
3. **Aprovação por classe**: a tabela default (A/B aprovado, C aprovado parcial, D manual, E-H recusado) está OK ou quer ajustar?

Se confirmar essas 3 e aprovar o plano, eu parto pra implementação. A ordem será:
1. Migrações de tabelas + bucket
2. Edge `credit-consult` + tela admin de regras + tela de Consulta (etapa 1)
3. Qualificação + biometria + IA
4. Simulação + contrato + boletos
5. Relatório
