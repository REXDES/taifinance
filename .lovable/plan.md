# Boleto Necta: usar só autenticação + venda (fluxo confirmado pelo suporte)

O suporte confirmou que não existe etapa de criar estabelecimento nem de gerar token por seller. O fluxo é:

```text
Credenciais do Portal Necta (Tokens de API) → POST /auth → Token → POST /sales (bank_slip) → Boleto
```

Hoje o app tenta criar uma credencial de cobrança por estabelecimento antes de emitir (`POST /api-tokens`), e a Necta responde 403 "Group not allowed" — é exatamente a etapa que o suporte disse não ser necessária. Isso bloqueia toda emissão.

## O que muda

1. **Emitir com a credencial do Portal, direto.** A emissão passa a autenticar com as credenciais já configuradas no projeto e chamar `POST /sales`. Nada de criar token por estabelecimento no meio do caminho.
2. **Nenhum bloqueio por "credencial de cobrança".** Sai o erro 400 atual e sai o aviso na tela de cobranças sobre credencial gerada na primeira emissão. O estabelecimento continua sendo usado apenas como recebedor/validação de pagador ≠ recebedor.
3. **Foco em boleto.** Para `bank_slip`: valida valor mínimo do adquirente e vencimento (hoje ou futuro), envia `paymentMethod: bank_slip`, `totalAmount` em centavos, `dueDate` e o comprador completo (nome, documento, e-mail, telefone e endereço), depois busca `GET /sales/{id}` e `GET /sales/{id}/billet` para linha digitável, código de barras, URL do PDF e vencimento — que já é o comportamento atual, mantido.
4. **Sincronização e estorno** passam a usar a mesma credencial única, sem tentar resolver token de seller.
5. **Teste real de ponta a ponta**: emitir um boleto de teste pela função publicada e conferir o retorno (id da venda, linha digitável, PDF). Se a Necta recusar algum campo, ajusto o corpo conforme a resposta e repito até gerar.

O provisionamento por seller fica desativado no caminho de cobrança (o botão "Gerar credencial" em Estabelecimentos deixa de ser exigido); nada é apagado, para o caso de a Necta liberar marketplace no futuro.

## Detalhes técnicos

- `supabase/functions/necta-sale/index.ts`: remover a resolução de `sellerCredentials`/`provisionSellerCredentials` no `issue`, `void` e `sync`, passando `creds = null` (a camada compartilhada já cai nas credenciais do projeto: `NECTA_CLIENT_SECRET` + `NECTA_SECRET_KEY` via `POST /auth`).
- `supabase/functions/_shared/nectaSeller.ts`: mantém `nectaToken`/`nectaRequest`; `provisionSellerCredentials` deixa de ser chamada na emissão e passa a lançar mensagem clara caso alguém a acione manualmente.
- `src/components/payments/NectaChargesPage.tsx`: remover o aviso sobre credencial de cobrança; nenhuma outra mudança de layout.
- Redeploy de `necta-sale` (e `necta-api` se o import mudar) e teste autenticado com um boleto real.
- Sem mudança de banco. Se as credenciais atuais em `NECTA_CLIENT_SECRET`/`NECTA_SECRET_KEY` não forem as do usuário de API do Portal, o `/auth` falha e eu peço a atualização delas.
