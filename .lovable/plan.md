# Split pelo saldo da conta (Pagando.net)

## O que a Necta oferece
`POST /banking/establishments/{uuid}/splits` tira um valor do **saldo** da conta da empresa e envia para um recebedor. Não depende de uma venda paga. Regras da documentação:
- O recebedor precisa ser um **beneficiário** já cadastrado na Pagando.net. Não aceita outro seller direto.
- O valor é sempre fixo em reais. Não aceita percentual.
- Dá para agendar uma data de liquidação. Ela precisa cair em dia útil, senão a Pagando.net recusa.
- `GET` na mesma rota lista os splits já feitos pela empresa.

Isso complementa a "Transferir entre contas", que continua sendo de seller para seller.

## O que vamos construir
1. Em **Pagamentos → Transferir entre contas**, uma segunda aba: **Split pelo saldo**.
   - Escolher o beneficiário na lista dos recebedores de split que já estão cadastrados (os mesmos de Clientes/Fornecedores).
   - Informar o valor, a data de liquidação (opcional) e uma descrição.
   - A data aceita só dias úteis. Antes de enviar, o app pede confirmação com o nome e o valor.
2. Um histórico próprio para essa aba. Ele junta o que foi gravado no Tai Finance com a lista que a Pagando.net devolve, mostrando o status de cada split.
3. A mesma permissão que hoje controla "Transferir entre contas".

## Detalhes técnicos
- Na função `seller-transfer`, entram as ações `balance_split` e `list_balance_splits`. As duas validam o acesso à empresa. O envio usa a credencial da própria empresa (`companyCredentials`), porque a rota é por estabelecimento. A empresa é identificada pelo seller dela, via `resolveCompanySellerId`.
- O envio vai assim: `{ recipientType:'BENEFICIARY', recipientId, amount: centavos, splitType:'ABSOLUTE', settlementDate? }`. Cada envio tem um `request_id`, que evita mandar o mesmo split duas vezes.
- Cada split fica registrado em `seller_transfers`, com `kind='balance_split'`, `to_seller_id` igual ao id do beneficiário e o nome dele. Não é preciso mudar o banco, a não ser que `kind` tenha uma regra que só aceite certos valores. Se tiver, um ajuste pequeno libera o novo valor.
- O beneficiário sai do cadastro de recebedores de split que já existe (`useSplitRecipients`). Antes de aparecer na lista, ele precisa ter o id de beneficiário da Pagando.net.

## A confirmar no primeiro teste
- Se a credencial da empresa tem permissão nessa rota. Se a Pagando.net responder 403, o envio passa a usar a credencial do marketplace.
- Teste com R$ 1,00 para um beneficiário real.
