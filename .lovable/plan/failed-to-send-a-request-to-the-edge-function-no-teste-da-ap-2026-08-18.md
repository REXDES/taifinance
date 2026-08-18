# "Failed to send a request to the Edge Function" no teste da API de Pagamentos

## O que esse erro significa

É um erro de rede do navegador: a chamada nem chegou a ser processada. Ou seja, não é erro de credencial da Necta — o app não conseguiu falar com a função de backend.

## Causa confirmada

As funções do módulo Pagamentos (Necta) existem no código mas **não estão publicadas no backend**. Testando os endpoints diretamente, todos respondem:

```text
necta-api      -> 404 NOT_FOUND ("Requested function was not found")
necta-sale     -> 404 NOT_FOUND
necta-webhook  -> 404 NOT_FOUND
```

Como não há função publicada, o preflight/CORS falha e o navegador mostra "Failed to send a request to the Edge Function" — exatamente o que aparece nas requisições registradas do dashboard e no botão "Testar conexão".

## Correção proposta

1. Publicar as três funções: `necta-api`, `necta-sale`, `necta-webhook` (esta última pública, sem verificação de JWT — já configurada).
2. Rodar o teste de conexão (`/users/me`) para validar autenticação com as credenciais Necta já armazenadas.
3. Se o teste retornar erro da Necta (401/403), aí sim é credencial/base URL — verificar `NECTA_API_BASE_URL`, `NECTA_CLIENT_SECRET` e `NECTA_SECRET_KEY`.
4. Recarregar as telas do módulo (Dashboard, Cobranças, Configurações) e confirmar que as chamadas retornam dados em vez do erro de rede.

## Detalhes técnicos

- Nenhuma alteração de schema é necessária.
- `supabase/config.toml` já contém `[functions.necta-webhook] verify_jwt = false`.
- Se após a publicação alguma chamada retornar 502 com mensagem `Necta ... [status]`, o proxy está funcionando e o problema passa a ser do lado da API Necta (rota ou permissão do token).
