# Corrigir erro "from_company_id" na Transferência entre contas

## Causa (confirmada no código e nos logs)
Na transferência livre, o app não grava qual empresa está enviando o dinheiro. Ele só faz isso no desembolso da antecipação. Por isso o histórico é salvo com a origem vazia, e o banco de dados recusa o registro.

## Correção
- Em `supabase/functions/seller-transfer/index.ts`, no trecho da transferência livre, definir `from = body.from_company_id` antes de buscar o destino.
- Publicar a função de novo e testar com R$ 1,00.

Não é preciso mexer no banco de dados nem na tela.
