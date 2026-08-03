## Objetivo

Na tela de **Importar Extrato Bancário**, quando o saldo informado pelo extrato já estiver batendo com o saldo calculado do app, permitir ao usuário **encerrar a conciliação** sem precisar efetivar linhas que estejam como **Pendente** ou **Duplicidade**. Isso evita criar transações duplicadas e deixar o saldo errado.

## Mudanças

### `src/hooks/useStatementImport.ts`
- Adicionar função `finishReconciliation(importId: string, lineIdsToIgnore?: string[])` que:
  - Marca o `statement_imports.status` como `done`.
  - Opcionalmente marca as linhas ainda pendentes como `ignored` (para não ficarem eternamente pendentes no banco).
  - Retorna o import atualizado.

### `src/components/finance/StatementImportPage.tsx`
- Quando `balanceDiff` for nulo ou menor que `0.01` (saldo batendo), exibir um alerta/destaque claro com:
  - Mensagem: "Saldo já está consistente com o extrato. Você pode encerrar a conciliação sem efetivar as linhas restantes."
  - Botão **"Encerrar conciliação"**.
- Ao clicar no botão:
  - Perguntar se deseja ignorar as linhas pendentes restantes (checkbox padrão marcado) ou mantê-las pendentes.
  - Chamar `finishReconciliation`.
  - Voltar automaticamente para a lista de importações.
- Ajustar o status derivado (`derivedStatus`) para considerar `done` também quando o usuário encerra manualmente, mesmo com linhas pendentes.
- Garantir que o botão **"Efetivar selecionadas"** continue funcionando normalmente para quem quer converter linhas em transações.

### `src/components/finance/StatementImportPage.tsx` (UX)
- Melhorar a badge de duplicidade: oferecer ação rápida "Marcar como duplicidade/ignorar" para limpar a lista.
- No card de resumo, trocar o label "Conciliadas" para algo mais claro quando o saldo bate, reforçando que a conciliação pode ser encerrada.

## Resultado

- Usuário importa extrato, saldo bate, mas restam 2 linhas marcadas como duplicidade.
- App mostra: "Saldo consistente. Clique em Encerrar conciliação."
- Usuário clica, as linhas restantes são ignoradas e a importação vai para status **Conciliado**.
- O saldo da conta permanece correto, sem transações duplicadas.
