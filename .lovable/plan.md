## Módulo de Máquinas & Locação

Novo módulo para gestão de máquinas, ferramentas, equipamentos e implementos com inventário, manutenção, locações e integração financeira. Acesso controlado por flag na empresa (`machines_module_enabled`).

### 1. Banco de dados (novas tabelas)

Todas com `company_id` + RLS via `has_company_access`.

- **`machine_types`** — tipos configuráveis (Máquina, Trator, Implemento, Ferramenta, Equipamento, etc.) por empresa.
- **`machines`** — `name, brand, model, year, type_id, destination, acquisition_value, acquisition_date, current_horimeter, preventive_maintenance_interval_hours, status` (`available | rented | maintenance | sold`), **`acquisition_source`** (`new_purchase | pre_existing`).
- **`machine_horimeter_logs`** — histórico (origem: locação início/fim, manutenção, ajuste manual).
- **`operators`** — cadastro de operadores (nome, documento, telefone, observações).
- **`mechanics`** — cadastro de mecânicos (nome, documento, telefone, especialidade).
- **`maintenance_records`** — `machine_id, mechanic_id, start_date, end_date, description, horimeter_at_service, total_cost, payment_mode` (`cash | installments`), `payable_id` (FK opcional), `transaction_id` (FK opcional).
- **`rental_price_tables`** — tabela flexível por máquina/implemento com múltiplas faixas (`unit`: hora/dia/semana/mês, `min_qty, max_qty, price`, `valid_from, valid_to`).
- **`rental_kits`** — kit nomeado (ex.: "Trator + Arado").
- **`rental_kit_items`** — itens do kit (kit_id, machine_id).
- **`rentals`** — `client_id, operator_id (opcional), kit_id (opcional), start_date, end_date, unit, qty, unit_price, total_amount, horimeter_start, horimeter_end, payment_mode` (`cash | installments`), `installments_count, billing_frequency` (`monthly | weekly | daily`), `status` (`active | finished | cancelled`), `notes`.
- **`rental_machines`** — máquinas/implementos da locação (rental_id, machine_id, price_snapshot).

### 2. Cadastro de máquinas: nova vs. pré-existente

No formulário de cadastro de máquina/equipamento/ferramenta, o usuário escolhe a **origem**:

- **Aquisição nova** (`new_purchase`) — gera lançamento financeiro:
  - À vista → cria `transactions` (despesa).
  - A prazo → cria N parcelas em `payables_receivables` (tipo "payable").
- **Já existente no patrimônio** (`pre_existing`) — apenas inclui no inventário com todos os dados (nome, marca, modelo, ano, tipo, valor, horímetro atual, etc.). **Não cria nenhum lançamento financeiro.** O valor entra apenas como referência patrimonial/inventário.

A diferença fica visível no inventário (badge "Pré-existente" vs "Adquirida em DD/MM/AAAA") e nos relatórios de inventário.

### 3. Flag de acesso por empresa

Migration adiciona coluna em `companies`:
```
machines_module_enabled boolean NOT NULL DEFAULT false
```
Sidebar só renderiza a seção "Máquinas & Locação" quando a empresa selecionada tem a flag ativa. Toggle disponível em **Configurações da Empresa** (modo Admin).

### 4. Integração financeira (híbrida)

Adicionar em `payables_receivables`:
- `rental_id uuid` (FK opcional)
- `maintenance_id uuid` (FK opcional)

#### Compras de máquinas novas
- À vista → `transactions` (despesa).
- A prazo → N parcelas em `payables_receivables` (tipo "payable").
- Máquinas pré-existentes: **sem efeito financeiro**.

#### Manutenções (custo da própria empresa, NÃO é serviço prestado)
- Sempre gera **Contas a Pagar** (ou transação à vista) — nunca a receber.
- À vista → `transactions` (despesa) vinculada via `transaction_id`.
- A prazo → N parcelas em `payables_receivables` (tipo "payable") vinculadas via `maintenance_id` + `parent_id`.
- Cancelar/alterar manutenção remove ou ajusta as parcelas futuras pendentes (parcelas já pagas permanecem; aviso ao usuário).

#### Locações
- À vista → `transactions` (receita) na conta escolhida.
- A prazo (recorrente) → cria N parcelas em `payables_receivables` (tipo "receivable"), uma por período (`billing_frequency`), usando `parent_id`, `installment_number`, `total_installments`. `due_date` calculado a partir de `start_date` + offset por período. Todas com `rental_id` preenchido.

### 5. Relatório de Locações

Nova página **Relatório de Locações** dentro do módulo. Funcionalidades:

- Lista de locações com filtros: período, cliente, máquina, status, modalidade.
- Colunas: cliente, máquina/kit, período, valor total, modalidade, parcelas (pagas/total), status.
- Ações por linha:
  - **Editar valor/quantidade/preço** → recalcula `total_amount`. Para a prazo: **recalcula apenas as parcelas futuras pendentes** (parcelas pagas ficam intactas). Novo valor das parcelas = (total_amount − soma já paga) ÷ qtd parcelas pendentes.
  - **Cancelar locação** → status `cancelled`. Para a prazo: **exclui todas as parcelas futuras pendentes** em `payables_receivables`. Parcelas já pagas permanecem (com aviso). À vista: opção de estornar a transação.
  - **Encerrar locação** (lançar horímetro final, marca `finished`).
- Exportação PDF/Excel seguindo padrão dos demais relatórios.
- Toda alteração/cancelamento registra entrada em `audit_logs`.

### 6. Lógica de horímetro

- Início de locação → registra leitura inicial e atualiza `machines.current_horimeter`.
- Fim de locação → registra leitura final.
- Manutenção → registra leitura no momento do serviço.
- Alerta visual quando `current_horimeter − última manutenção ≥ preventive_maintenance_interval_hours`.

### 7. UI / Navegação

Nova seção na sidebar "Máquinas & Locação" (somente se flag ativa):
- Máquinas (inventário, com filtro por origem nova/pré-existente)
- Locações (operação)
- Manutenções (histórico)
- Relatório de Locações
- Cadastros: Operadores, Mecânicos, Tipos de Máquina, Tabelas de Preço, Kits

### 8. Arquivos a criar

**Migrations:** tabelas acima + coluna `machines_module_enabled` em `companies` + colunas `rental_id`/`maintenance_id` em `payables_receivables`.

**Hooks:** `useMachines`, `useMachineTypes`, `useOperators`, `useMechanics`, `useMaintenance`, `useRentals`, `useRentalKits`, `useRentalPriceTables`.

**Componentes** em `src/components/machines/`:
- `MachinesPage.tsx`, `MachineFormDialog.tsx` (com toggle nova/pré-existente)
- `RentalsPage.tsx`, `RentalFormDialog.tsx`, `RentalsReportPage.tsx`
- `MaintenancePage.tsx`, `MaintenanceFormDialog.tsx`
- `OperatorsPage.tsx`, `MechanicsPage.tsx`
- `MachineTypesPage.tsx`, `RentalPriceTablesPage.tsx`, `RentalKitsPage.tsx`

**Editar:** `FinanceSidebar.tsx` (nova seção condicional), `Finance.tsx` (rotear novas views), `CompanySettingsDialog.tsx` (toggle do módulo).
