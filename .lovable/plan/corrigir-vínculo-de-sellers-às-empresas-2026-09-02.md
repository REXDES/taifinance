# Corrigir vínculo de sellers às empresas

## O que está acontecendo

Dois problemas distintos no botão "Vincular sellers às empresas":

1. **Erro de coluna**: ao gravar o seller, o código envia um campo `status`, mas a tabela de estabelecimentos não tem essa coluna — o nome correto é `necta_status`. Por isso o banco recusa a gravação com "Could not find the 'status' column".

2. **Chamada desnecessária à Necta**: o vínculo hoje refaz a listagem completa de sellers na API da Necta só para reencontrar os dados do seller escolhido. Como a tela já tem esses dados em mãos (foram carregados quando a lista foi aberta), essa ida à API é redundante — e é o que faz o vínculo falhar/demorar sempre que a API da Necta está instável.

## O que será feito

- Corrigir o mapeamento de campos: `status` passa a gravar em `necta_status`; conferir os demais campos contra as colunas reais da tabela para não repetir o problema.
- O vínculo passa a usar os dados do seller enviados pela própria tela (nome, documento, e-mail, endereço etc.), sem consultar a Necta novamente. A consulta à API vira apenas um fallback, usado só quando a tela não enviar os dados.
- Mensagens de erro por seller continuam sendo devolvidas, para que a tela mostre exatamente qual vínculo falhou em vez de um erro genérico.

## Detalhes técnicos

- `supabase/functions/necta-api/index.ts`
  - `mapSeller`: trocar `status: it?.status?.name` por `necta_status: it?.status?.name ?? it?.status ?? null`.
  - `link_sellers`: aceitar `items: [{ necta_establishment_id, company_id, seller? }]`; usar `sel.seller` quando presente e só chamar `listSellers()` se algum item vier sem snapshot.
- `src/components/payments/NectaSellerLinkDialog.tsx`: enviar o objeto do seller já carregado junto de cada seleção.
- Redeploy da função `necta-api` após a alteração.
