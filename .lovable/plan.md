## Correções na criação de Locação

### 1. Bug do vencimento (data de ontem)
Em `src/components/machines/RentalsPage.tsx`, o default de `start_date` usa `new Date().toISOString().slice(0,10)`, que converte para UTC e pode devolver o dia anterior em fusos como Brasília. Trocar por uma função `todayLocal()` que monta `YYYY-MM-DD` a partir de `getFullYear/getMonth/getDate` (padrão já documentado em `mem://architecture/date-handling`).

### 2. Reorganizar formulário em torno do "tempo de contrato"

Bloco **Contrato** (substitui os campos atuais Início/Fim/Quantidade/Unidade):
- `Início` (date)
- `Duração` = input numérico + `Unidade` (Hora/Dia/Semana/Mês)
- `Fim` calculado automaticamente (Início + Duração na unidade); editável — se editado, recalcula a duração
- A `qty` salva no banco passa a ser a própria duração (elimina a duplicidade entre "quantidade contratual" e "quantidade para preço")

Bloco **Valores**:
- `Preço unitário (por <unidade>)`
- `Valor total` (auto = duração × preço, editável)

### 3. Periodicidade decorre do contrato

No modo **A prazo**:
- `Periodicidade de cobrança`: Mensal / Semanal / Diária — default conforme a unidade do contrato (Mês→Mensal, Semana→Semanal, Dia/Hora→Diária)
- `Nº de parcelas`: **calculado automaticamente** a partir da duração + periodicidade (ex: 6 meses + Mensal → 6; 90 dias + Mensal → 3; 4 semanas + Semanal → 4). Campo permanece editável para sobrescrita manual, com texto auxiliar "Sugerido: N".
- `1ª parcela vence`: toggle **"Após 1 período" (default)** ou **"Na data de início"**. Resolve o caso reportado em que a parcela única vencia no mesmo dia da locação.

No modo **À vista**: nenhuma alteração — segue lançando 1 receita na data de início.

### 4. Ajuste em `src/lib/machinesFinance.ts`

`generateRentalReceivables` recebe novo parâmetro opcional `firstDueOffset: 0 | 1` (default `1`). Loop usa `dueDateForInstallment(start, freq, i + firstDueOffset)`.

### Arquivos alterados
- `src/components/machines/RentalsPage.tsx`
- `src/lib/machinesFinance.ts`