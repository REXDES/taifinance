# Credencial de cobrança Necta: entender o 403 e destravar a emissão

## O que o erro significa

`POST /api-tokens [403] Forbidden - Group not allowed.` não é erro do TAI Finance nem do estabelecimento: é a Necta recusando **a chave do marketplace** para criar tokens de API. O grupo/perfil da credencial `Integration-TAI` configurada no projeto não tem permissão na rota `/api-tokens`. Ou seja: o app pediu certo, o provisionamento automático simplesmente não está liberado do lado da Necta.

Confirmado: a tabela de credenciais de seller está vazia (0 registros), então toda cobrança hoje cai no caminho de provisionar na hora — e falha.

## Como está arquitetada a árvore de informação hoje

```text
Empresa (TAI Finance)
  └── necta_establishments  (perfil próprio + estabelecimentos/sellers)
        ├── necta_establishment_id  ── vínculo com o seller na Necta
        └── necta_seller_credentials (clientSecret/secretKey do seller)
              └── usado para POST /sales, /payment-links, /void
Cobrança (necta_sales) → recebedor = establishment_id (ou perfil próprio da empresa)
```

Regra da Necta: leitura funciona com o token do marketplace; **escrita (emitir/estornar) exige token vinculado ao seller**. O app resolve a credencial por estabelecimento; se não existe, tenta criar via `/api-tokens` — passo que agora retorna 403.

## O que fazer

1. **Cadastro manual da credencial do seller** (destrava sem depender da Necta liberar a rota): na tela Estabelecimentos, ao lado de "Gerar credencial", um diálogo "Informar credencial" para colar `clientSecret` e `secretKey` que você já possui na plataforma legado da Necta. Salvo em `necta_seller_credentials` (só service_role lê) e marca `has_charge_credentials`.
2. **Validar antes de salvar**: a função testa a credencial com `POST /auth` e recusa se não autenticar, evitando gravar par inválido.
3. **Mensagem de erro útil na emissão**: quando o provisionamento retorna 403 "Group not allowed", a cobrança passa a informar claramente "A Necta não autoriza este marketplace a criar tokens de API. Cadastre manualmente a credencial do estabelecimento ou solicite liberação da rota /api-tokens à Necta" — em vez do texto cru da API.
4. **Sem fallback silencioso para o marketplace**: não emitir com a chave do marketplace quando a do seller falta, pois a Necta rejeitaria com 400/403 depois e a cobrança ficaria em estado inconsistente.

## Detalhes técnicos

- `supabase/functions/_shared/nectaSeller.ts`: nova `saveSellerCredentials()` (valida via `/auth`, faz upsert por `establishment_id`, atualiza flags no estabelecimento); `provisionSellerCredentials()` passa a lançar erro traduzido no caso 403.
- `supabase/functions/necta-api/index.ts`: nova ação `set_seller_credentials { establishment_id, client_secret, secret_key }`.
- `src/components/payments/NectaEstablishmentsPage.tsx`: botão/diálogo "Informar credencial" ao lado do atual, com feedback de sucesso/erro.
- `supabase/functions/necta-sale/index.ts`: apenas a mensagem exibida ao usuário no bloco de obtenção da credencial.
- Sem mudança de schema; a tabela já tem todas as colunas necessárias.
