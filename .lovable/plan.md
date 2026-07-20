# Módulo Pagamentos (Cappta White Label)

Novo módulo opcional por empresa (toggle em **Configurações → Módulos**, igual aos módulos Máquinas, Crédito e Banco Digital). Mapeia as áreas da API Cappta em telas nativas do sistema.

## Áreas da API mapeadas → Telas

Baseado nos grupos da documentação Cappta: **AUTH, CREDENCIAMENTO, POS, PLANOS, TRANSAÇÕES, GESTÃO FINANCEIRA, GESTÃO DE COBRANÇA, WEBHOOK**.


| Área Cappta        | Tela no Tai Finance             | Função                                                                               |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------ |
| AUTH               | (background)                    | Login automático via `POST /connect/token`, cache do JWT em edge function            |
| CREDENCIAMENTO     | **Estabelecimentos**            | Listar/criar/editar merchants, consultar status de credenciamento                    |
| POS                | **Terminais (POS)**             | Listar terminais, vincular a estabelecimento, ativar/desativar, consultar status     |
| PLANOS             | **Planos & Taxas**              | Cadastro de planos comerciais (MDR por bandeira/produto), vincular a estabelecimento |
| TRANSAÇÕES         | **Transações**                  | Listar vendas com filtros (data, bandeira, status, terminal), detalhe, estorno       |
| GESTÃO FINANCEIRA  | **Recebíveis & Liquidação**     | Agenda de recebíveis, liquidações do dia, extrato de repasses                        |
| GESTÃO DE COBRANÇA | **Cobranças (Link/Boleto/PIX)** | Gerar link de pagamento, boleto ou PIX Cappta; listar cobranças e status             |
| WEBHOOK            | **Webhooks**                    | Configurar URL, ver eventos recebidos, reprocessar                                   |


## Sidebar — grupo "Pagamentos"

Aparece só quando o módulo está habilitado para a empresa.

```text
Pagamentos
├── Dashboard              (KPIs: vendas do dia/mês, ticket médio, a receber, taxas)
├── Transações
├── Cobranças
├── Recebíveis
├── Terminais (POS)
├── Estabelecimentos
├── Planos & Taxas
└── Webhooks & Config
```

## Backend

**Migração** (uma migração, com GRANTs completos):

- `companies.payments_enabled boolean default false`
- `cappta_merchants` — mirror local de estabelecimentos credenciados (company_id, cappta_merchant_id, document, status, plan_id, criado em)
- `cappta_terminals` — POS (company_id, merchant_id, cappta_terminal_id, serial, model, status)
- `cappta_plans` — planos/taxas por bandeira/produto
- `cappta_transactions` — cache local de transações (id, merchant_id, terminal_id, brand, amount, net_amount, mdr, installments, status, captured_at, settlement_date, payload jsonb)
- `cappta_charges` — cobranças (id, merchant_id, type: link/boleto/pix, amount, status, due_date, payer, url, criado em)
- `cappta_settlements` — liquidações diárias
- `cappta_webhook_events` — log de eventos recebidos (event_type, payload, processed_at)

Todas com RLS por `has_company_access` e GRANTs para `authenticated` + `service_role`.

**Edge functions** (com `verify_jwt = false` para o webhook; demais autenticadas):

- `cappta-auth` — obtém e cacheia JWT (usa `CAPPTA_CLIENT_ID`/`CAPPTA_CLIENT_SECRET`)
- `cappta-api` — proxy genérico que injeta o Bearer token e faz forward para a Cappta (GET/POST/PUT/DELETE em qualquer path da API)
- `cappta-sync` — sincroniza transações/recebíveis do dia para o cache local
- `cappta-webhook` — recebe callbacks, grava em `cappta_webhook_events` e atualiza tabelas afetadas (transação estornada, cobrança paga, liquidação, etc.)

**Secrets a solicitar via `add_secret`:** `CAPPTA_CLIENT_ID`, `CAPPTA_CLIENT_SECRET`, `CAPPTA_BASE_URL` (produção vs sandbox), `CAPPTA_WEBHOOK_SECRET`.

## Integração com o resto do sistema

- Cobrança paga (webhook) → cria automaticamente um recebimento em `transactions` (na conta selecionada) e baixa qualquer `payable_receivable` vinculado.
- Transação de POS liquidada → cria transação de receita com desconto das taxas (MDR) categorizada em "Taxas de cartão".
- Split PIX existente continua separado (é do sistema PIX estático). O split via Cappta usa a estrutura de planos/repasses da própria Cappta.

## Arquivos

**Criar:**

- `src/hooks/usePaymentsModule.ts` — hook `useCompanyPaymentsFlag`
- `src/hooks/useCappta*.ts` — hooks por recurso (merchants, terminals, transactions, charges, settlements)
- `src/components/payments/PaymentsDashboardPage.tsx`
- `src/components/payments/CapptaTransactionsPage.tsx`
- `src/components/payments/CapptaChargesPage.tsx` (+ dialog criar cobrança link/boleto/pix)
- `src/components/payments/CapptaSettlementsPage.tsx`
- `src/components/payments/CapptaTerminalsPage.tsx`
- `src/components/payments/CapptaMerchantsPage.tsx`
- `src/components/payments/CapptaPlansPage.tsx`
- `src/components/payments/CapptaWebhooksPage.tsx`
- `supabase/functions/cappta-auth/index.ts`
- `supabase/functions/cappta-api/index.ts`
- `supabase/functions/cappta-sync/index.ts`
- `supabase/functions/cappta-webhook/index.ts`
- Migração completa com tabelas + RLS + GRANTs

**Editar:**

- `src/pages/Finance.tsx` — novas views `payments-*` no `FinanceView`
- `src/components/finance/FinanceSidebar.tsx` — novo grupo "Pagamentos" (condicional ao flag)
- `src/components/finance/CompanySettingsDialog.tsx` — toggle "Pagamentos (Cappta)" na aba Módulos
- `supabase/config.toml` — declarar `[functions.cappta-webhook] verify_jwt = false`

## Perguntas antes de implementar

1. **Ambiente**: começo apontando para **sandbox** ou **produção** da Cappta? (você me passa a `base_url` correspondente e o par de credenciais desse ambiente via secure form)

**A URL que possuimos é essa: [https://portal.nectaco.com.br/dashboard](https://portal.nectaco.com.br/dashboard). Me passe o secureform para colocar os secrets da pagina quando implementar.**

1. **Escopo v1**: entrego tudo (todas as 8 telas + sync + webhook) numa entrega só, ou prefere que eu comece só por **Transações + Cobranças + Dashboard** e as demais (Terminais, Planos, Estabelecimentos, Webhooks) numa segunda fase?

**Entregue tudo, para podermos ver uma maquete das funcionalidades que possamos mexer, e daí nos aprofundamos.**

1. **Cobranças criadas na Cappta**: quando forem pagas, elas devem **virar automaticamente** um recebimento em Transações do Tai Finance (baixa em conta escolhida), ou apenas ficar como registro no módulo Pagamentos sem tocar o financeiro?

**A ideia seria integração total de sistemas entre nossos módulos, mas deve ser feito um controle de acesso, pois nem todos irão ter acesso à essa funcionalidade. A tela será entregue para o usuário final apenas.**