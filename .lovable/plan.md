## Objetivo

Em **Manutenções de máquinas**:
1. Tanto "à vista" quanto "parcelado" apenas **agendam** o pagamento (título em Contas a Pagar com status `pending`). Baixa efetiva só quando marcado como pago.
2. Permitir **selecionar Tags (finance)** na manutenção, propagadas para os títulos gerados.
3. Adicionar aba **"Deslocamento de equipe"** no diálogo de manutenção, com veículo e km previstos.

## Mudanças

### `src/components/machines/MaintenancePage.tsx`
- Reorganizar o diálogo em abas (Tabs shadcn):
  - **Dados** — campos atuais (máquina, mecânico, datas, descrição, horímetro, custo, status).
  - **Pagamento** — forma de pagamento, parcelas, conta de baixa, tags.
  - **Deslocamento** — novos campos:
    - Toggle `has_travel` ("Haverá deslocamento de equipe?").
    - Quando ligado: `travel_vehicle_id` (Select com veículos = máquinas com `usage_purpose` contendo veículo, ou lista livre de todas as máquinas), `travel_km` (número).
    - Campo texto opcional `travel_notes`.
- Unificar `save()`:
  - Se `cost > 0` e `paid_account_id !== 'none'` → sempre `generateMaintenancePayables(...)` (à vista = 1 parcela).
  - Remover `insert` direto em `transactions` no caso `cash`.
- Adicionar `TagPicker` (`@/components/finance/TagPicker`) na aba Pagamento; propagar `tag_ids` aos títulos gerados.
- Persistir campos de deslocamento no `maintenance_records`.

### `src/lib/machinesFinance.ts`
- `generateMaintenancePayables` aceita `tagIds?: string[]` e insere em `payable_receivable_tags` após criar os títulos.

### `src/hooks/useMachinesModule.ts`
- Estender `MaintenanceRecord` com: `paid_account_id`, `has_travel`, `travel_vehicle_id`, `travel_km`, `travel_notes`.

### DB (migration)
```sql
ALTER TABLE public.maintenance_records
  ADD COLUMN paid_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN has_travel boolean NOT NULL DEFAULT false,
  ADD COLUMN travel_vehicle_id uuid REFERENCES public.machines(id),
  ADD COLUMN travel_km numeric,
  ADD COLUMN travel_notes text;
```
Sem novas tabelas — `payable_receivable_tags` já existe.

### Sem alteração
- `deletePendingInstallments` mantém limpeza de pendências.
- Locações e edição de manutenção existente mantêm comportamento atual.

## Resultado

- Manutenção à vista R$ 500 com tag "Frota A" e deslocamento (Van, 120 km) → 1 título pendente em Contas a Pagar (vence em `start_date`) com tag, e registro guarda o deslocamento previsto. Vira `transaction` real só na baixa.
- Parcelada 3x → 3 títulos pendentes com as tags escolhidas.