# Integridade dos dados enviados à Necta (cobranças e homologação)

Baixei o contrato oficial (OpenAPI 3.1 da Necta Multi-Pay) e comparei campo por
campo com o que o app envia hoje em `POST /sales`, `POST /payment-links` e
`POST /establishments`. Sim: há pontos de formatação que hoje passam do app e
só quebram no gateway (400), tanto na cobrança quanto no cadastro/homologação.

## O que o contrato exige e o app ainda não garante

### Cobranças (`POST /sales`, `/payment-links`)
- **CPF/CNPJ do pagador**: só removemos a máscara; não validamos 11/14 dígitos
  nem os dígitos verificadores. Documento inválido → 400 do gateway.
- **Telefone**: hoje qualquer coisa com dígitos passa. Precisa ser DDD + número
  (10 ou 11 dígitos).
- **E-mail**: o contrato pede `format: email`; não validamos.
- **Endereço**: `postalCode` precisa ter 8 dígitos, `state` precisa ser uma UF
  válida, `number` não pode ser vazio (usar "S/N" quando não houver), e os
  textos devem ir sem espaços sobrando.
- **Vencimento do boleto**: não validamos data válida nem vencimento no passado.
- **Valor mínimo do boleto**: fixamos R$ 10,00 no código, mas o contrato diz que
  é por gateway — Rinne aceita R$ 5,00. Hoje bloqueamos cobrança válida.
- **Valor**: falta garantir valor > 0 antes de converter para centavos.
- **Pagador igual ao recebedor**: o gateway recusa autocobrança em bolepix.
  Bloquear com mensagem clara antes de chamar a API.
- **Erros do gateway**: hoje o JSON cru vai para `sync_error`; traduzir as
  mensagens 400 mais comuns para português na tela.

### Cadastro / homologação (`POST /establishments`)
- Mesmas normalizações de documento, telefone, e-mail, CEP e UF.
- `openingHours` / `closingHours` precisam sair como `HH:mm` (hoje vão como
  digitados).
- `birthDate` / `openingDate`: validar data real e coerente (nascimento não
  pode ser no futuro).
- `revenue`: enviar como string numérica limpa.
- `mccId` deve ser UUID e `legalNature` só dígitos.
- Conta bancária: `accountNumber` deve incluir o dígito verificador (e nunca
  junto de `accountDigit`) — validar tamanho mínimo antes de enviar.

### Lacuna funcional na homologação
O contrato tem `POST /establishments/{uuid}/documents` (multipart,
`merchantDocumentList[n]`, apenas JPG/JPEG/PDF) para envio dos documentos do
lojista, e a assinatura de termo (`term-acceptance` / `term-sign`), que hoje só
existe em "Meu Perfil" — a tela de Estabelecimentos não oferece nenhum dos dois.

## O que proponho implementar

1. **Camada única de validação/normalização** (`src/lib/nectaFormat.ts` e uma
   cópia em `supabase/functions/_shared/nectaFormat.ts`, para o backend não
   depender do front): documento com dígito verificador, telefone BR, e-mail,
   CEP, UF, data, hora `HH:mm`, valor em centavos e trim de textos.
2. **Aplicar no envio da cobrança**: validação no submit da tela de Cobranças
   (mensagens campo a campo, em português) e a mesma checagem no
   `necta-sale` antes do `POST /sales` — inclusive pagador ≠ recebedor,
   vencimento futuro e mínimo do boleto por gateway (parâmetro configurável,
   default R$ 5,00 para Rinne / R$ 10,00 nos demais).
3. **Aplicar no cadastro/homologação**: `buildEstablishmentPayload` passa a usar
   a mesma camada, e a lista de "campos faltando" ganha também os campos
   inválidos (não só vazios), com o motivo.
4. **Tradutor de erros do gateway**: mapear as respostas 400 da Rinne/Barte/
   Getnet para texto legível na tela e em `sync_error`.
5. **Complementar a homologação em Estabelecimentos**: botão de upload de
   documentos (JPG/JPEG/PDF, tipos `SELFIE`, `IDENTIFICATION_DOCUMENT`, etc.)
   via `POST /establishments/{uuid}/documents` e o aceite de termo, iguais aos
   de Meu Perfil.

## Detalhes técnicos

- Sem mudança de schema. O upload multipart passa por uma ação nova no proxy
  `necta-api` (o proxy atual só faz JSON).
- Arquivos tocados: `src/lib/nectaFormat.ts` (novo), `src/lib/nectaEstablishment.ts`,
  `src/components/payments/NectaChargesPage.tsx`,
  `src/components/payments/NectaEstablishmentsPage.tsx`,
  `src/components/payments/NectaRegistrationPage.tsx`,
  `supabase/functions/necta-sale/index.ts`, `supabase/functions/necta-api/index.ts`.

## Fora deste plano

A troca da credencial para a chave da Pagando (configuração), que você já
indicou que fará depois.
