# Boleto emitido na Proposta não aparece (nem para o financiador)

## O que está acontecendo (confirmado nos dados)

O boleto de R$ 51,75 emitido ontem pela Pagando.net foi criado, mas ficou "solto": não está ligado a nenhuma parcela de Contas a Receber nem à proposta.

- A tela da Proposta só mostra parcelas de Contas a Receber ligadas ao contrato. Como o boleto não criou parcela, a lista fica vazia.
- A Antecipação (e a visão do financiador) só lista boletos ligados a uma parcela de Contas a Receber. Sem esse vínculo, o boleto não aparece como título elegível, e o financiador não vê nada.

## O que vou fazer

1. **Ao emitir pela Pagando.net na Proposta**, criar automaticamente as parcelas em Contas a Receber (ligadas ao contrato e ao cliente) e ligar cada boleto emitido à sua parcela.
2. **Na tela da Proposta**, mostrar as parcelas com o boleto: status, linha digitável/código de barras com botão copiar e link do boleto.
3. **Corrigir o boleto já emitido**: ligar o boleto de R$ 51,75 à proposta, criando a parcela correspondente, para ele aparecer na Proposta e ficar disponível para antecipação.
4. **Antecipação**: com o vínculo feito, o boleto aparece para o cedente como título elegível. Depois que ele for solicitado, aparece também na mesa do financiador.

Observação: o financiador vê o título só depois que o cedente pede a antecipação. Se quiser que o financiador veja os boletos em aberto antes do pedido, me avise.

## Detalhes técnicos

- `NectaChargesPage` (modo dialogOnly): aceitar `link={{ credit_contract_id, client_supplier_id }}`. Depois do POST em `necta-sale`, inserir em `payables_receivables` (type receivable, payment_type boleto, credit_contract_id, installment_number) e enviar o `payable_receivable_id` para a `necta-sale`, ou fazer o update em `necta_sales.payable_receivable_id`. Caso de parcelamento: uma linha por venda/parcela.
- `BoletosStep`: fazer o join `necta_sales` por `payable_receivable_id` para mostrar a linha digitável e o status. Depois da emissão, atualizar `credit_applications` para `contracted`/`current_step 6`.
- Backfill: dar UPDATE na venda `eab53b2f…`, que hoje está sem `payable_receivable_id`, depois de identificar a proposta/contrato da empresa `bced3a57…`, e criar a parcela.
- Verificação: emitir em uma proposta de teste e conferir a Proposta, a Antecipação (cedente) e a mesa do financiador.
