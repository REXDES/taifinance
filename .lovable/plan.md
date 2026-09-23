# Corrigir datas aparecendo um dia antes

## O problema

As datas são gravadas corretamente (ex.: 25/09/2026), mas várias telas e relatórios interpretam a data como se fosse horário de Londres (UTC). Como o Brasil está 3 horas atrás, "25/09 à meia-noite" vira "24/09 às 21h" na exibição — daí o dia anterior.

Parte do sistema já foi protegida contra isso; o restante não. A correção é padronizar o tratamento de datas em um único lugar e aplicá-lo em todas as telas.

## O que será feito

1. Criar um conjunto único de funções de data (ler, exibir, comparar e ordenar) que sempre trate a data como data local brasileira.
2. Substituir todos os pontos que hoje leem a data sem essa proteção, incluindo:
   - Contas a pagar/receber: lista, relatório, fluxo financeiro, calendário, geração de parcelas e recorrências.
   - Importação de extrato e conciliação.
   - Balancete, Extrato, Fluxo de Caixa, Relatório por Categoria/Tag.
   - Dashboard (visão semanal, últimos lançamentos, evolução patrimonial).
   - Banco digital, boletos, locações/máquinas e tarefas/projetos.
3. Padronizar também a gravação: a data escolhida no calendário passa a ser convertida para texto pelo formato local, nunca por conversão UTC.
4. Conferir uma conta com vencimento em 25/09/2026 nas telas de cadastro, lista, calendário, fluxo e exportações (Excel/PDF) para confirmar que aparece 25/09 em todas.

## Detalhes técnicos

- Novo `src/lib/dateUtils.ts`: `parseLocalDate(value)` (anexa `T00:00:00` de forma segura e aceita `null`), `formatBR(value)`, `formatLocalISO(date)` (usa `date-fns/format`, não `toISOString`), `compareDate`, `isSameLocalDay`.
- Substituições de `new Date(x.date)`, `parseISO(x.date)`, `format(new Date(x.due_date), ...)` e `isSameDay(new Date(...))` pelos helpers nos arquivos: `PayablesReceivablesPage.tsx`, `PayablesReceivablesReportPage.tsx`, `PayablesReceivablesFlowPage.tsx`, `PayablesReceivablesCalendarPage.tsx`, `usePayablesReceivables.ts` (inclui `addMonths` sobre data local), `BalanceSheetPage.tsx`, `StatementPage.tsx`, `CashFlowReportPage.tsx`, `CategoryReportPage.tsx`, `TagReportPage.tsx`, `FinanceDashboard.tsx`, `usePatrimonialEvolution.ts`, `useAccountStatement.ts`, `useStatementImport.ts` / `StatementImportPage.tsx`, `BankDigitalPage.tsx`, `BoletosPage.tsx`, `QuickEntryPage.tsx`, `TransactionsPage.tsx`, `TransfersPage.tsx`, e telas de máquinas/projetos que usam `startDate`/`endDate`.
- Trocar `toISOString().split('T')[0]` por `formatLocalISO` em formulários e filtros (QuickEntry, Transações, Transferências, Tarefas).
- Campos de data/hora reais (`created_at`, `updated_at`, `expires_at`) continuam como timestamp, sem alteração.
- Verificação final: `npx tsgo --noEmit` limpo e incremento de versão do app.
