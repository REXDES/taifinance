# Credenciais de cobrança só no Modo Administrativo

Faz total sentido: clientSecret e secretKey são dados técnicos do Portal Necta. Quem usa o sistema no dia a dia só precisa emitir o boleto — quem configura a conexão é você, no Modo Administrativo.

## O que muda

1. **Sai da tela de Estabelecimentos (modo normal)** o botão de chave e a janela para digitar clientSecret/secretKey. Na listagem fica apenas um selo informativo: "Pronto para cobrar" ou "Aguardando liberação" — sem nenhum campo técnico.
2. **Entra em Pagamentos → Admin → Cadastros** uma nova aba "Credenciais de cobrança", com a lista dos estabelecimentos cadastrados (empresa, nome, documento, situação) e o botão para informar/atualizar o par de credenciais do Portal Necta. Ao salvar, o sistema testa as credenciais na Necta antes de guardar e mostra erro claro se forem recusadas.
3. **Emissão de boleto continua igual** para o usuário final: ele escolhe o recebedor, o valor e o vencimento. Se o estabelecimento ainda não tiver credencial liberada, a mensagem passa a ser orientativa ("credencial de cobrança pendente — solicite ao administrador"), em vez de erro técnico da Necta.
4. **Prioridade mantida**: depois disso, cadastro da credencial real e teste de emissão de um boleto de ponta a ponta.

## Detalhes técnicos

- `src/components/payments/NectaEstablishmentsPage.tsx`: remover `credRow`/`credForm`, a função `saveCredentials`, o botão `KeyRound` e o `Dialog` de credenciais; manter apenas badge derivado de `has_charge_credentials`.
- `src/components/payments/NectaAdminRegistrationPage.tsx`: nova `TabsTrigger`/`TabsContent` "Credenciais"; carrega `necta_establishments` (id, company_id, legal_name, trade_name, document, necta_establishment_id, has_charge_credentials) via Supabase, com nome da empresa por join em `companies`; dialog chamando `nectaAction('set_seller_credentials', { establishment_id, client_secret, secret_key })`.
- Back-end sem mudança de contrato: `set_seller_credentials` em `necta-api` e `savedSellerCredentials` em `_shared/nectaSeller.ts` já validam via `POST /auth` e gravam em `necta_seller_credentials`. Deploy de `necta-api` e `necta-sale` (pendente do turno anterior).
- `necta-sale`: quando não houver credencial salva para o recebedor, retornar mensagem em português orientando a configuração no Modo Administrativo, em vez de cair na credencial do projeto e receber "Authenticated seller context is required".
- Permissão: reutiliza `payments.admin_registration`, já presente em `src/lib/permissions.ts`.
- Sem mudança de banco de dados.
