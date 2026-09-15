# Template de WhatsApp para envio de cobrança (Meta / WhatsApp Cloud API)

Cadastre este template no Gerenciador do WhatsApp (Meta Business → Ferramentas
→ Modelos de mensagem). Enquanto ele não estiver **aprovado**, o botão
"Enviar por WhatsApp" na tela de Cobranças retorna erro de template.

- **Nome:** `cobranca_pagamento`
- **Idioma:** Português (BR) — `pt_BR`
- **Categoria:** Utilidade (Utility)
- **Cabeçalho:** nenhum
- **Botões:** nenhum

## Corpo (4 variáveis, nesta ordem)

```text
Olá! Você tem uma cobrança de {{1}}.

Referente a: {{2}}
Valor: {{3}}

{{4}}
```

## Exemplos para submissão

| Variável | Significado | Exemplo |
| --- | --- | --- |
| `{{1}}` | Empresa que está cobrando | Pagando |
| `{{2}}` | Descrição da cobrança | Mensalidade setembro |
| `{{3}}` | Valor formatado | R$ 10,00 |
| `{{4}}` | Instrução conforme o meio | Confira a linha digitável do boleto na mensagem a seguir. |

Textos possíveis para `{{4}}` (gerados pelo sistema):

- PIX: `Confira o código PIX na mensagem a seguir.`
- Boleto: `Confira a linha digitável do boleto na mensagem a seguir.`
- Bolepix: `Confira o código de pagamento (bolepix) na mensagem a seguir.`
- Link: `Acesse o link de pagamento na mensagem a seguir.`

## Como o envio funciona

1. O sistema envia o template acima — isso abre a janela de 24h de conversa.
2. Em seguida envia uma mensagem de texto simples com o código PIX, a linha
   digitável ou o link. Esse conteúdo não passa por aprovação da Meta porque
   viaja como texto livre dentro da janela aberta.

## Usar outro nome de template

Se o template aprovado tiver outro nome ou idioma, configure os segredos:

- `WHATSAPP_TEMPLATE_NECTA_CHARGE` (padrão `cobranca_pagamento`)
- `WHATSAPP_TEMPLATE_NECTA_CHARGE_LANG` (padrão `pt_BR`)
