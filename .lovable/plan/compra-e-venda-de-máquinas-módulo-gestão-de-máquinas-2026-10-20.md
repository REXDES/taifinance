# Compra e Venda de Máquinas (módulo Gestão de Máquinas)

## O que o usuário vai ter
Um novo grupo de menus dentro de Gestão de Máquinas: **Compra e Venda**.

1. **Configurações por categoria** (agrícola, pesada/construção, mini máquinas e outras que o usuário criar)
   - Margem de lucro desejada (%)
   - % de despesas de recuperação (deixar a máquina em condições de venda)
   - Palavras-chave e sites preferidos para a pesquisa

2. **Tabela de preços de venda**
   - Uma linha por modelo (categoria, marca, modelo, faixa de ano, horímetro).
   - Botão "Pesquisar preços na internet": o app busca anúncios de venda direta (fora de leilão), mostra os preços encontrados com link da fonte e sugere um preço (mediana).
   - O usuário aceita a sugestão ou digita o próprio preço. O preço de referência fica salvo com a data da pesquisa.

3. **Oportunidades de leilão**
   - O usuário escolhe a categoria e clica "Buscar leilões". O app pesquisa só sites de leilão e lista: máquina, lance/preço atual, data do leilão, local, link.
   - Para cada item, o app calcula o **preço máximo de compra**:
     - Preço de venda necessário = compra × (1 + margem%) + compra × recuperação%
     - Logo, lance máximo = preço da tabela ÷ (1 + margem% + recuperação%)
     - Exemplo: tabela R$ 130.000, margem 20%, recuperação 10% → lance máximo R$ 100.000
   - Mostra se é **Oportunidade** (lance abaixo do máximo), **No limite** ou **Fora**, com o lucro estimado em R$ e %.
   - Anúncios de balcão não entram na comparação (já têm preço final), só alimentam a tabela de preços.
   - O usuário pode salvar uma oportunidade para acompanhar ou marcar "Comprei".

4. **Comprei → controle até a venda**
   - "Comprei" cadastra a máquina com origem "Compra para revenda", valor pago e gera a conta a pagar (como já acontece nas compras).
   - Na ficha da máquina, uma aba **Custos de recuperação**: manutenções (já existentes) e compra de peças (novo: peça, fornecedor, valor, data, gera conta a pagar).
   - Painel de custo: compra + peças + manutenções + outras despesas = **custo total**, comparado com o preço da tabela.

5. **Venda**
   - Botão "Vender": mostra custo total, preço sugerido pela margem configurada, e o usuário define o preço final. Mostra a margem real.
   - Gera a conta a receber, marca a máquina como vendida e guarda o histórico (comprada por, gasto, vendida por, lucro).
   - Relatório simples de revendas: lucro por máquina e por categoria.

## Pesquisa na internet
- Usaremos o serviço de pesquisa/leitura de páginas Firecrawl (será pedida a conexão uma vez) e a IA do Lovable para organizar os resultados (extrair modelo, ano, horas, preço, data do leilão).
- Os resultados dependem do que os sites mostram publicamente; alguns leilões exigem login e podem não aparecer. Cada pesquisa gasta créditos do serviço.

## Detalhes técnicos
- Novas tabelas (com company_id, GRANTs e RLS por `has_company_access`): `machine_trade_category_settings` (margem, % recuperação, keywords, sites), `machine_price_table` (modelo, preço referência, preço sugerido, fontes jsonb, pesquisado_em), `machine_auction_opportunities` (dados do leilão, preço máximo calculado, status salvo/comprado/descartado, machine_id), `machine_parts_purchases` (machine_id, peça, valor, payable_id), `machine_sales` (machine_id, preço, custo total, margem real, receivable_id).
- Coluna em `machines`: `acquisition_source` passa a aceitar `resale_purchase`; usa as categorias existentes (`machine_categories`).
- Edge function `machine-market-search` com ações `price_research` (busca de anúncios) e `auction_search` (busca de leilões): Firecrawl search + extração por IA (Lovable AI, saída estruturada). Valida acesso à empresa.
- Cálculo do preço máximo e margem num helper `src/lib/machineTrade.ts` com testes de unidade (fórmula da margem e da recuperação).
- Novas permissões em `src/lib/permissions.ts`: `machines.trade_settings`, `machines.price_table`, `machines.auctions`, `machines.resale`.
- Peças e venda reutilizam `generateMaintenancePayables`/`payables_receivables` para conta a pagar/receber.

## A confirmar
- Fórmula confirmada: margem e recuperação são percentuais sobre o preço de compra. Na venda real, a recuperação usa os custos lançados (peças + manutenções) no lugar do percentual estimado.
- Sites de leilão preferidos (ex.: Sodré Santoro, Superbid, Mega Leilões) podem ser informados nas configurações.
