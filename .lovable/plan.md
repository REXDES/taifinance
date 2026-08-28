# Cobrança recusada: pagador igual ao recebedor

## O que aconteceu

O erro gravado na última cobrança (Bolepix, R$ pagador CPF 004.755.412-60) foi:

```text
Rinne recusou a requisição (400): consumer.document_number —
Payer document cannot be the same as the receiver (merchant)
document for BOLEPIX transactions.
```

Sua leitura está correta na prática: a credencial em uso hoje aponta para um
estabelecimento (merchant) cujo documento é o **seu CPF**, e o pagador
informado na cobrança era o mesmo documento. O adquirente bloqueia
autocobrança em Bolepix. Não é problema de token inválido nem de cadastro
incompleto — é apenas pagador == recebedor.

Trocando para a credencial/estabelecimento da Pagando (documento diferente do
seu CPF), essa mesma cobrança passa a ser aceita. Alternativa imediata sem
trocar nada: emitir para um pagador com documento diferente do merchant.

## O que proponho implementar

1. **Bloqueio amigável antes de chamar a API** — na tela de Cobranças e na
   função `necta-sale`, comparar o documento do pagador com o documento do
   estabelecimento/perfil ativo. Se forem iguais, exibir:
   "O pagador não pode ter o mesmo CPF/CNPJ do recebedor. Selecione outro
   pagador ou emita por outro estabelecimento."
2. **Tradução dos erros do adquirente** — mapear as mensagens 400 da Rinne /
   Barte / Getnet para textos em português na tela, em vez do JSON cru que hoje
   fica em `sync_error`.
3. **Recebedor visível na cobrança** — mostrar no formulário qual
   estabelecimento está emitindo (nome + documento), para deixar explícito quem
   é o recebedor daquela cobrança.

## Detalhes técnicos

- Front: `src/components/payments/NectaChargesPage.tsx` — validação no submit
  usando o documento do estabelecimento carregado de `necta_establishments`.
- Backend: `supabase/functions/necta-sale/index.ts` — checagem em
  `buyerPayload` (comparação por dígitos) e um tradutor de erro aplicado antes
  de gravar `sync_error`.
- Sem mudança de schema.

## Fora deste plano

A troca da credencial em si (chave da Pagando) é configuração: assim que você
quiser, cadastramos/apontamos o estabelecimento correto nas Configurações do
módulo de Pagamentos.
