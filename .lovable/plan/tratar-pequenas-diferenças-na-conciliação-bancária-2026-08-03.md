# Tratar pequenas diferenças na conciliação bancária

## Contexto
Hoje a conciliação bancária sinaliza qualquer diferença entre o saldo do app e o saldo do extrato importado como erro vermelho, mesmo quando a divergência é de poucos centavos. Na prática essas diferenças costumam vir de lançamentos manuais com arredondamento ou erros de digitação de centavos, e o usuário quer poder "fechar" a conciliação sem ter que caçar cada lançamento.

## Objetivo
Permitir que o usuário configure uma tolerância por conta e, quando a diferença estiver dentro dessa tolerância, gere um lançamento de ajuste de arredondamento para equalizar o saldo e encerrar a conciliação.

## O que será feito

### 1. Banco de dados
- Adicionar coluna `reconciliation_tolerance` (numeric, default 0) na tabela `public.accounts`.
- Garantir GRANTs e manter RLS existente.

### 2. Cadastro de contas
- Incluir campo "Tolerância de conciliação" no formulário de conta (`AccountsPage`).
- Valor padrão 0 (zero), permitindo decimais (ex: 0.50, 1.00).

### 3. Tela de conciliação (`StatementImportPage`)
- Ler a tolerância da conta selecionada no extrato.
- Quando `appBalanceDiff` for menor ou igual à tolerância configurada:
  - Trocar o alerta vermelho por um alerta amarelo de aviso.
  - Mostrar botão "Gerar ajuste de arredondamento".
- Ao clicar no botão:
  - Criar uma transação na conta corrente com o valor da diferença.
  - Tipo: receita se a diferença for positiva (extrato > app), despesa se negativa.
  - Descrição: "Ajuste de arredondamento - conciliação".
  - Data: data final do período do extrato.
  - Vincular essa transação a uma linha especial de ajuste ou criar diretamente e atualizar o saldo.
- Permitir encerrar a conciliação quando o saldo estiver dentro da tolerância (com ou sem ajuste já gerado).

### 4. Hook `useStatementImport.ts`
- Criar função `createReconciliationAdjustment(import, accountId, diffAmount)` que insere a transação de ajuste e, se necessário, marca a importação como ajustada.

## Critérios de aceitação
- Diferenças menores ou iguais à tolerância configurada não bloqueiam o encerramento.
- O usuário pode gerar um lançamento de ajuste com um clique.
- O saldo da conta continua consistente após o ajuste.
- Diferenças acima da tolerância continuam sendo alertadas como erro e exigem correção manual.

## Notas técnicas
- A transação de ajuste será criada diretamente na tabela `transactions`, respeitando as policies existentes.
- O trigger `update_account_balance_on_transaction` atualizará o saldo da conta automaticamente.
- Será necessário atualizar o tipo `Account` em `useAccounts.ts` para incluir `reconciliation_tolerance`.