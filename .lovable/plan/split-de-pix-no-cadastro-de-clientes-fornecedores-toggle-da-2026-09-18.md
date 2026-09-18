# Split de PIX no cadastro de clientes/fornecedores + toggle da Conta Necta

## 1. Split de PIX passa para Clientes e Fornecedores

A tela separada "Split de PIX" deixa de existir. Toda a configuração passa a viver no cadastro de clientes e fornecedores.

**No cadastro de cada cliente/fornecedor:**
- Nova aba "PIX / Split" no formulário, com chave PIX (tipo + chave), banco, agência e conta.
- Nessa mesma aba, a lista de regras de divisão em que essa pessoa é a recebedora: valor (percentual ou fixo), abrangência (todas as cobranças, uma categoria, um cliente específico ou uma tag), prioridade, ativa/inativa e observação.
- Criar, editar e excluir regras direto ali, sem sair do cadastro.

**Na listagem de clientes/fornecedores:**
- Coluna/selo indicando quem tem chave PIX cadastrada e quantas regras de split ativas possui.
- Filtro opcional "com split ativo".

**Quem recebe o split é sempre um cliente/fornecedor cadastrado.** Os destinatários que hoje existem só no Split de PIX serão convertidos em cadastros de cliente/fornecedor (tipo "Fornecedor") com a chave PIX preenchida, e as regras existentes são religadas a eles — nada se perde.

## 2. Conta Necta vira um toggle de módulo

Hoje a Conta Necta é criada automaticamente ao ligar o módulo Pagamentos. Passa a ser uma opção própria:
- Novo toggle "Conta Necta espelhada" na aba de Módulos das configurações da empresa (Modo Administrativo), sempre visível.
- Quando o módulo Pagamentos estiver desligado, o toggle aparece com aviso de que depende do módulo Pagamentos para trazer dados.
- Ao ligar: a Conta Necta é criada (se ainda não existir) e passa a aparecer em saldos, extratos e contas a receber.
- Ao desligar: a conta e os lançamentos espelhados deixam de aparecer nas telas financeiras; nada é apagado, então religar recupera tudo.
- Empresas que já têm a Conta Necta criada entram com o toggle ligado.

A versão do app sobe de 1.1.0 para 1.2.0.

## Detalhes técnicos

- Migração: `clients_suppliers` ganha `pix_key`, `pix_key_type`, `bank_name`, `bank_branch`, `bank_account` (nullable). `split_rules` ganha `client_supplier_id uuid references clients_suppliers(id)`; backfill criando um `clients_suppliers` (tipo `supplier`) para cada `split_recipients` sem correspondente por documento/nome e preenchendo `client_supplier_id`. `split_recipients`/`recipient_id` permanecem no banco (sem uso novo). `companies` ganha `necta_mirror_enabled boolean not null default false`, com backfill `true` onde `necta_account_id is not null`.
- `useSplitRules.ts`: passa a gravar/ler `client_supplier_id`; `useSplitRecipients.ts` deixa de ser usado pela UI.
- `ClientsSuppliersPage.tsx`: formulário em `Tabs` (Dados / PIX e Split), com a gestão de regras embutida (reaproveitando `DeleteConfirmDialog`, categorias, tags e a própria lista de clientes para o escopo).
- Remover `SplitPixPage.tsx`, sua entrada em `financeMenuItems.tsx`, o `case 'split-pix'` e o tipo em `Finance.tsx`, e a chave `finance.split_pix` em `src/lib/permissions.ts` (mantendo `finance.clients_suppliers` como permissão de acesso).
- `CompanySettingsDialog.tsx`: novo switch `necta_mirror_enabled`; chamada de `ensure_necta_mirror_account` passa a depender desse flag, não de `payments_module_enabled`.
- Novo hook `useNectaMirrorFlag` (ou extensão de `usePaymentsModule.ts`) lendo `necta_mirror_enabled`; `useAccounts`, `useAccountStatement` e `usePayablesReceivables` só incluem a conta/lançamentos espelho quando o flag estiver ligado.
- `src/lib/appVersion.ts` e `package.json` para `1.2.0`.
