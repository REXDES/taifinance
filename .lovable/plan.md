## Finalização do Módulo Máquinas & Locação

As 5 páginas e a infraestrutura (11 tabelas, hooks, lógica financeira híbrida) já foram criadas. Falta integrar à navegação e ao toggle de configuração da empresa.

### 1. Toggle no cadastro da empresa
- Editar `src/components/finance/CompanySettingsDialog.tsx` (ou local equivalente do cadastro de empresa) para adicionar um switch **"Habilitar módulo Máquinas & Locação"** vinculado à coluna `companies.machines_module_enabled` (já existente).
- Visível apenas para Supervisor/Gerente.

### 2. Sidebar — nova seção "Máquinas & Locação"
- Editar `src/components/finance/FinanceSidebar.tsx` para incluir um grupo colapsável **"Máquinas & Locação"** que aparece somente quando `currentCompany.machines_module_enabled === true`.
- Itens do grupo:
  - Inventário (Máquinas/Equipamentos/Ferramentas)
  - Locações
  - Relatório de Locações
  - Manutenções
  - Operadores & Mecânicos
  - Tabela de Preços / Kits (sub-aba dentro de Locações)

### 3. Rotas
- Editar `src/pages/Finance.tsx` para registrar as rotas das páginas já criadas:
  - `/finance/machines` → `MachinesPage`
  - `/finance/machines/maintenance` → `MaintenancePage`
  - `/finance/machines/rentals` → `RentalsPage`
  - `/finance/machines/rentals-report` → `RentalsReportPage`
  - `/finance/machines/people` → `PeoplePage`
- Guard nas rotas: redireciona se `machines_module_enabled` for `false`.

### 4. Ajustes finos
- Garantir que os hooks (`useMachinesModule`) respeitem `currentCompany.id` e bloqueiem fetch quando `initialSessionResolved` for falso (regra do projeto).
- Validar que diálogos de formulário usam `overflow-y-auto max-h-[85vh]` (regra do projeto).
- Adicionar `DeleteConfirmDialog` padronizado nas exclusões de máquinas/locações/manutenções.

### 5. Memória do projeto
- Após implementação, salvar `mem://features/machines-rental-module` descrevendo: toggle por empresa, fluxo financeiro híbrido (compras/manutenções → contas a pagar; locações → contas a receber recorrentes), regras de edição/cancelamento (recalcula apenas parcelas futuras pendentes), aquisição `pre_existing` sem impacto financeiro.

Resultado: módulo totalmente acessível na navegação, controlado pelo flag por empresa, com fluxos financeiros automáticos integrados a `transactions` e `payables_receivables`.