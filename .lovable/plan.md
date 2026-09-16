# Conciliação entre Pagamentos e Gestão Financeira

Cada empresa habilitada (só pelo Modo Administrativo) passa a ter uma "Conta Pagando" na Gestão Financeira, e toda cobrança emitida no módulo de Pagamentos vira automaticamente recebível e lançamento nessa conta.

## Como vai funcionar

**1. Habilitação (só no Modo Administrativo)**
- Nas configurações da empresa, no Modo Administrativo, um novo interruptor: "Conciliar Pagamentos com a Gestão Financeira".
- No Modo Normal a empresa apenas vê se está habilitada ou não, sem poder ligar/desligar.
- Ao ligar, o sistema cria (se ainda não existir) para aquela empresa:
  - a conta **Conta Pagando**, dentro de um grupo "Ativo";
  - a categoria de receita **Recebimentos Pagando** com as subcategorias Boleto, PIX e Cartão;
  - a categoria de despesa **Taxas Pagando** com a subcategoria Taxa de cobrança.
- Desligar não apaga nada: só para de gerar novos lançamentos.

**2. Cobrança emitida → Contas a Receber**
- Toda cobrança criada já nasce vinculada à Conta Pagando e às categorias acima; o usuário não precisa escolher conta na tela de Cobranças (o campo passa a mostrar a Conta Pagando fixa quando a empresa é habilitada).
- Enquanto não está liquidada, a cobrança fica como **recebível pendente** em Contas a Pagar/Receber, com vencimento, descrição, pagador e valor vindos da cobrança.
- Quando a Necta confirma o pagamento, o recebível é baixado e entra na Conta Pagando **o valor líquido** (valor recebido menos a taxa da Necta), na data da liquidação. A taxa não gera lançamento separado.
- Estorno ou cancelamento não desfaz nada sozinho: marca a cobrança para revisão (comportamento já existente).

**3. Atualização automática de hora em hora**
- Uma verificação automática a cada hora consulta na Necta as cobranças ainda em aberto e atualiza vencimento, dados do pagador, status e liquidação — inclusive quando o aviso automático da Necta (webhook) não chega.
- São 24 verificações por dia. Isso mantém o banco de dados ativo mesmo quando não há cobrança em aberto, o que aumenta um pouco o custo do Cloud; a alternativa mais simples seria confiar apenas no aviso da Necta, mas aí uma liquidação perdida poderia demorar dias para aparecer. Mantendo a verificação por hora, o atraso máximo é de 1 hora.

**4. Extrato da conta Necta**
- Nova aba "Extrato Pagando" dentro do módulo de Pagamentos: traz os repasses/liquidações da Necta e marca cada linha como "já lançado" (quando existe cobrança correspondente) ou "não lançado".
- As linhas sem correspondência (ex.: repasses, taxas avulsas, ajustes) podem ser lançadas na Conta Pagando com um clique, com opção de lançar em lote.
- Nada é lançado automaticamente a partir do extrato, evitando duplicidade: o casamento é feito pelo identificador da venda/liquidação da Necta, e uma linha já lançada nunca é oferecida de novo.

**5. Versão do aplicativo**
- Passa a existir uma versão visível do app (canto do menu lateral e na tela de perfil), que eu incremento a cada alteração entregue. Começa em 1.1.0.

## Detalhes técnicos

- `companies`: nova coluna `payments_finance_sync_enabled boolean default false`.
- `necta_sales`: colunas novas `settlement_reference text`, `finance_synced_at timestamptz`.
- `necta_settlements` já existe e passa a ser preenchida pela sincronização; nova coluna `transaction_id uuid` para marcar linhas já lançadas + índice único em (`company_id`, `necta_settlement_id`).
- Provisionamento da Conta Pagando: função SECURITY DEFINER `public.ensure_payments_finance_setup(_company_id uuid)` idempotente (grupo, conta, categorias e subcategorias), chamada pela edge function ao habilitar o interruptor. Retorna os ids para gravar em `companies` (`payments_account_id`, `payments_income_category_id`, `payments_fee_category_id`).
- `necta-sale`: `mirrorFinance` passa a resolver conta/categoria pelo setup da empresa quando `payments_finance_sync_enabled`; ao liquidar, usa `net_amount` (fallback `amount`) na transação.
- `necta-webhook`: mesma resolução de conta/categoria e uso de `net_amount` no lançamento; hoje usa `sale.amount` e só lança se `sale.account_id` estiver preenchido.
- `necta-api`: nova ação `sync_settlements` (GET de liquidações/repasses por empresa, upsert em `necta_settlements` com casamento por `necta_sale_id`) e ação `enable_finance_sync` (admin-only, chama a função de provisionamento).
- Cron horário via `pg_cron` + `pg_net` chamando `necta-sale` na ação `sync` para vendas em `pending|issued|overdue`, seguido de `sync_settlements`.
- Front: `usePaymentsFinance.ts` (flag + ids da conta/categorias), ajustes em `CompanySettingsDialog.tsx` (interruptor admin-only), `NectaChargesPage.tsx` (conta fixa), nova `NectaSettlementsMirrorPage.tsx` + item no grupo Pagamentos do `FinanceSidebar.tsx`, chave `pagamentos.extrato` em `src/lib/permissions.ts`.
- Versão: `src/lib/appVersion.ts` exportando `APP_VERSION`, exibido no `FinanceSidebar` e no `ProfileDialog`; `package.json` acompanha o mesmo número.
