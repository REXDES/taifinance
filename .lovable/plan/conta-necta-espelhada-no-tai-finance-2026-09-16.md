# Conta Necta espelhada no Tai Finance

É viável, sim, e é mais simples do que conciliar. A ressalva: para o saldo e o extrato abrirem rápido e os relatórios funcionarem, os dados da Necta precisam ficar guardados aqui numa cópia atualizada periodicamente (não dá para consultar a Necta a cada clique). Essa cópia é marcada como "espelho": ela nunca vira lançamento normal, nunca entra duas vezes e não pode ser editada à mão — só categorizada.

## Como vai funcionar

**1. Habilitação (só no Modo Administrativo)**
- Ao ligar o módulo Pagamentos para uma empresa, ela ganha automaticamente a conta **Conta Necta**, marcada como conta espelho.
- A conta aparece nas telas de saldo, extrato, balancete e fluxo de caixa junto com as demais, com um selo indicando que vem da Necta.
- Ninguém lança, edita ou exclui movimento nessa conta pelo app: o conteúdo é o que a Necta informa.

**2. Movimentações e saldo**
- O saldo e o extrato da Conta Necta vêm da própria Necta (liquidações, taxas, repasses, estornos), atualizados de hora em hora e também quando a Necta avisa um pagamento.
- Nada é copiado para lançamentos comuns: o extrato mostra as linhas da Necta como são, com data, descrição, pagador e valor.

**3. Contas a Receber**
- Em Contas a Pagar/Receber, além dos registros do app, aparecem as cobranças em aberto da Necta, também marcadas como Necta.
- Elas mudam de status sozinhas quando a Necta liquida — sem baixa manual, sem recebível duplicado.
- Cobranças criadas no app que geram boleto/PIX pela Necta aparecem uma única vez (a origem é sempre a Necta).

**4. Categorização com memória**
- Cada linha da Necta (no extrato e nos recebíveis) pode ser categorizada a qualquer momento, pelas mesmas telas de categorização que o app já tem, incluindo tags.
- Ao categorizar, o sistema guarda uma regra de memória a partir do texto da linha (pagador, descrição, tipo de cobrança).
- Nas próximas atualizações, linhas parecidas são categorizadas sozinhas: primeiro pela memória (correspondência direta), e quando não há regra, pela IA, do mesmo jeito que já acontece nos comprovantes do Lançamento Rápido.
- Sugestão automática vem marcada como "sugerida" até o usuário confirmar, e ele pode confirmar em lote.

**5. Versão do aplicativo**
- Passa a existir uma versão visível (menu lateral e tela de perfil), incrementada a cada alteração entregue. Começa em 1.1.0.

## Detalhes técnicos

- `accounts`: nova coluna `source text default 'manual'` (`'necta'` para a conta espelho) e `is_mirror boolean default false`. Contas espelho ficam somente-leitura na UI e nos hooks de criação de lançamento/transferência.
- Provisionamento: função SECURITY DEFINER `public.ensure_necta_mirror_account(_company_id uuid)`, idempotente, chamada ao ligar `payments_module_enabled`; guarda o id em `companies.necta_account_id`.
- Nova tabela `necta_ledger_entries` (espelho do extrato): `company_id`, `account_id`, `necta_entry_id` (único por empresa), `entry_type` (settlement/fee/refund/transfer), `date`, `description`, `counterparty`, `amount`, `direction`, `necta_sale_id`, `category_id`, `subcategory_id`, `category_source` (`auto`|`memory`|`manual`), `raw jsonb`. GRANTs para `authenticated`/`service_role`, RLS por `has_company_access`.
- Nova tabela `finance_categorization_memory`: `company_id`, `scope` (`ledger`|`receivable`), `pattern` (texto normalizado do pagador/descrição), `category_id`, `subcategory_id`, `tag_ids uuid[]`, `hits int`, único por (`company_id`,`scope`,`pattern`).
- `necta_sales` continua sendo a fonte dos recebíveis Necta; nenhuma linha nova em `payables_receivables`. As telas de Contas a Pagar/Receber passam a unir as duas fontes (hook `usePayablesReceivables` recebe as cobranças Necta abertas como itens somente-leitura marcados com origem).
- Saldo/extrato: `useAccounts` soma o saldo espelho a partir de `necta_ledger_entries`; `useAccountStatement` lê dessa tabela quando a conta é espelho. Balancete, fluxo de caixa e relatórios de categoria incluem as linhas espelho pela mesma união.
- `necta-api`: nova ação `sync_ledger` — busca liquidações/movimentos da empresa na Necta, faz upsert por `necta_entry_id`, e para cada linha nova aplica memória (match normalizado) e, se não houver, chama a IA (mesma rota de `suggest-category`, modelo padrão do gateway) gravando `category_source='auto'`.
- Cron horário (`pg_cron` + `pg_net`) chamando `sync_ledger` por empresa habilitada; o webhook da Necta também dispara a atualização da venda afetada. São 24 execuções por dia; mantém o banco ativo mesmo sem movimento, com custo pequeno, e garante atraso máximo de 1 hora quando o aviso da Necta não chega.
- Front: `useNectaLedger.ts`, `useCategorizationMemory.ts`, ajustes em `AccountsPage`, `StatementPage`, `PayablesReceivablesPage` (badge "Necta", ações de edição desabilitadas exceto categorizar), reuso de `AiCategoryHelper`/`TagPicker` na categorização em lote.
- Versão: `src/lib/appVersion.ts` com `APP_VERSION`, exibido no `FinanceSidebar` e no `ProfileDialog`, espelhado em `package.json`.
