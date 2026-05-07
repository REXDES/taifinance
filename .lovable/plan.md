## Correção do KRCode PIX rejeitado na liquidação

### Mudanças

**1. `src/lib/pixUtils.ts`** — adicionar normalização e validação:

- `normalizePixKey(key, type)`:
  - `cpf`/`cnpj`: só dígitos
  - `phone`: prefixar `+55` no padrão E.164 (ex: `+5511999998888`)
  - `email`: trim + lowercase
  - `random`: trim + lowercase (UUID)
- `sanitizeAlphaNum(s, max)` para tags 59 (nome) e 60 (cidade): remove acentos, força MAIÚSCULAS, mantém apenas `[A-Z0-9 ]`, colapsa espaços e respeita o limite (25/15).
- `sanitizeTxId(s)`: mantém apenas `[A-Za-z0-9]`, força MAIÚSCULAS, máx 25 chars; fallback `***`.
- `generatePixPayload`: usa a chave normalizada na tag 26 e os helpers acima.
- Nova `validatePixKey(key, type)` retornando mensagem de erro ou `null`.

**2. `src/components/finance/PixQrCodeDialog.tsx`**

- Passar `txId` já sanitizado: `record.id.substring(0, 25).replace(/-/g, '').toUpperCase()`.
- Mostrar a chave normalizada (via `normalizePixKey`) num pequeno texto abaixo do QR para facilitar conferência.

**3. `src/components/finance/CompanySettingsDialog.tsx` (aba PIX)**

- Ao salvar, chamar `validatePixKey` conforme o `pix_key_type`. Se inválida, exibir `toast.error` com a mensagem e abortar o save.
- Salvar a chave já normalizada (`normalizePixKey`) em `pix_key`, evitando registros futuros com `(11) 99999-8888`, `123.456.789-00` etc.

### Causa provável do erro

O QR é lido (banco extrai o que dá), mas o PSP destino consulta o DICT pela string exata da chave da tag 26. Formatos como `(11) 99999-8888` ou `5511999998888` (sem `+`) não batem com o registro DICT (`+5511999998888`) e a transação é recusada na liquidação. Pagar manualmente funciona porque o app do banco normaliza antes de consultar o DICT.

### Validação

1. Reabrir Configurações da Empresa → PIX e re-salvar (a chave será normalizada).
2. Gerar nova cobrança e pagar pelo banco — deve liquidar.
