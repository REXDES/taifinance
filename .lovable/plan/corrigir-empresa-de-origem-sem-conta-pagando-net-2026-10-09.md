# Corrigir "Empresa de origem sem conta Pagando.net"

## Causa (confirmada nos dados)
- **MGM Consult**: o código da Pagando.net está salvo no cadastro da empresa (campo usado pela transferência). Por isso a MGM é encontrada.
- **Originatto**: o cadastro da empresa está **sem** esse código. O UUID `5e28c24e…` existe, mas só na lista de **estabelecimentos** da Originatto (registro "Originatto Semijoias"). Essa lista também tem 18 outros estabelecimentos, que são clientes/sellers importados, inclusive a própria MGM.
- A transferência lê **apenas** o campo da empresa. Hoje esse campo só é preenchido no card "Financiador" do adm. A MGM foi configurada por ali e a Originatto não.

## Como a transferência decide hoje

```text
1. Usuário logado?                    não -> erro 401
2. Tem acesso à empresa de origem?    não -> "Sem acesso"
3. Destino: busca o nome do UUID na Pagando.net
                                      não achou -> "Conta de destino não encontrada"
4. Registra no histórico (pendente)
5. Origem: companies.necta_seller_id  vazio -> "Empresa de origem sem conta Pagando.net"   <- AQUI
6. Destino tem UUID?                  não -> "Empresa de destino sem conta"
7. Envia internal-transfer ao marketplace -> concluída ou falha com o motivo
```

## O que vou mudar
1. **Achar o código da origem de forma mais ampla** (passo 5), nesta ordem:
   a. campo da empresa (como hoje);
   b. estabelecimento da empresa com o **mesmo CNPJ** da empresa (é o próprio seller dela, não um cliente);
   c. se encontrar pelo item b, salvar o código no cadastro da empresa para as próximas vezes.
   Se nada for encontrado, a mensagem passa a dizer onde configurar.
2. **Campo visível para configurar**: em Gerenciar Empresa (adm), o "ID da conta Pagando.net" passa a aparecer na parte de Pagamentos, e não só no card Financiador.
3. **Correção imediata dos dados**: preencher o código `5e28c24e-1b0a-4b6a-9c19-dfdd94038587` na Originatto.
4. A mesma regra de busca vale para o split da antecipação (financiador), que tinha a mesma limitação.

## Detalhes técnicos
- Novo helper `resolveCompanySellerId(admin, companyId)` em `_shared/nectaSeller.ts`: compara `companies.cnpj` com o documento do `necta_establishments` (só dígitos) e grava em `companies.necta_seller_id` quando encontrar. Ele será usado em `seller-transfer` (origem e desembolso) e em `_shared/anticipation.ts`.
- Será um UPDATE de dados para a Originatto. O esquema do banco não muda.
