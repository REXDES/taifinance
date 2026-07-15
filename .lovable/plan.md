## 1. Novo campo "Utilização" no cadastro do inventário

Cada item do inventário passa a ter um campo obrigatório indicando sua finalidade:

- **Locação** — item disponível para alugar (aparece na tabela de preços e em locações)
- **Venda** — item destinado à revenda
- **Estoque** — uso interno / imobilizado / peças, não entra em locação nem venda

### Alterações
- **Migração**: adicionar `usage_purpose text[]` em `machines` (array, pois um mesmo item pode ser "locação" e "venda" ao mesmo tempo — ex.: máquina seminova que loca ou vende). Default `{'locacao'}`.
- **`MachinesPage.tsx`**: novo campo multi-select "Utilização" no formulário de cadastro; badge visual na listagem; filtro por utilização.
- **`useMachinesModule.ts`**: incluir `usage_purpose` no tipo `Machine`.
- **Dashboard (`MachinesDashboardPage`)**: novo KPI "Itens por utilização" (Locação / Venda / Estoque).

## 2. Tela "Tabela de Preços de Locação" (planilha editável)

Nova página em **Máquinas & Locação → Tabela de Preços**, cobrindo **todos os itens do inventário** (máquinas, implementos, equipamentos, veículos — tudo que está em `machines`), **filtrando por padrão apenas os marcados com utilização "Locação"** (com opção de mostrar todos).

### Colunas (formato planilha)
| Item | Categoria | Tipo | Hora ✓ / R$ | Diária ✓ / R$ | Semanal ✓ / R$ | Mensal ✓ / R$ |

- Toggle (checkbox) em cada modalidade indica se o item pode ser locado naquela unidade
- Input numérico ao lado do toggle para o valor
- Desmarcar toggle → deleta o registro daquela unidade em `rental_price_tables`
- Marcar + valor → upsert em `rental_price_tables` (`unit`, `price`, `min_qty=1`)
- Auto-save on blur com debounce e feedback visual (spinner/check por célula)

### Filtros e ações
- Busca por nome, filtro por categoria, filtro por tipo, filtro por utilização
- "Aplicar valor em todos filtrados" por coluna (bulk fill opcional)
- Ordenação por qualquer coluna

### Integração
- Reaproveita `rental_price_tables` (estrutura atual já suporta 1 registro por par máquina+unidade — sem mudança de schema)
- `RentalsPage` continua puxando os preços daqui — a sugestão automática de preço na criação de locação passa a refletir o que foi editado na planilha

## Arquivos

**Migração:**
- Nova migration: adicionar `usage_purpose text[]` em `public.machines` com default `{'locacao'}`

**Criar:**
- `src/components/machines/RentalPricingPage.tsx`

**Editar:**
- `src/hooks/useMachinesModule.ts` — tipo `Machine` com `usage_purpose`
- `src/components/machines/MachinesPage.tsx` — campo "Utilização" no form + badge + filtro
- `src/components/machines/MachinesDashboardPage.tsx` — KPIs por utilização
- `src/components/finance/FinanceSidebar.tsx` — item "Tabela de Preços" no grupo Máquinas
- `src/pages/Finance.tsx` — rota para a nova view

## Observações
- Sem quebra: itens existentes recebem `{'locacao'}` como default na migração
- Split em fases não necessário — é uma feature contida
