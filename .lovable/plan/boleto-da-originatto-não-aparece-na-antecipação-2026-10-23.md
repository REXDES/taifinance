# Boleto da Originatto não aparece na Antecipação

## Causa (confirmada nos dados)

1. **Erro na tela de Antecipação:** a tela pede uma informação do boleto ("forma de pagamento") que não existe no cadastro de boletos. Por isso a busca de boletos falha sem aviso, e a lista de títulos elegíveis fica sempre vazia, até para o boleto de R$ 51,75 que já está ligado à parcela.
2. **Um segundo boleto novo, solto:** a Originatto emitiu outro boleto recentemente, e ele também não ficou ligado a nenhuma parcela. Isso indica que a ligação automática na emissão ainda não funciona em algum caminho.

## O que vou fazer

1. Tirar o campo inexistente da busca da Antecipação, para os boletos ligados voltarem a aparecer. Também vou mostrar um aviso quando uma busca falhar.
2. Descobrir por que o boleto novo saiu sem parcela, corrigir a ligação na emissão pela Proposta e ligar esse boleto à parcela certa.
3. Conferir na tela, como Originatto: os dois boletos aparecem na Proposta e em Antecipação → Títulos elegíveis.

## Detalhes técnicos

- `AnticipationPage.tsx`: `necta_sales.select('id, payable_receivable_id, payment_method')` → remover `payment_method`. Verificar `error` em todas as queries do `Promise.all`.
- Venda `b300ed51…` (Originatto) com `payable_receivable_id` null: revisar o fluxo `NectaChargesPage` (link do contrato) + `necta-sale` e fazer o backfill criando ou ligando o `payables_receivables` do contrato.
