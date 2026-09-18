# Template de WhatsApp para envio de cobrança (Meta / WhatsApp Cloud API)

O envio usa **um único template**, que já carrega o código ou link de pagamento
no próprio corpo. Assim não dependemos da janela de 24h de conversa (a mensagem
de texto livre com o código era bloqueada pela Meta).

Edite o template existente no Gerenciador do WhatsApp (Meta Business →
Ferramentas → Modelos de mensagem). Enquanto a alteração não estiver
**aprovada**, o botão "Enviar por WhatsApp" na tela de Cobranças retorna erro
de template.

- **Nome:** `cobranca_pagamento`
- **Idioma:** Português (BR) — `pt_BR`
- **Categoria:** Utilidade (Utility)
- **Cabeçalho:** nenhum
- **Botões:** nenhum

## Corpo (5 variáveis, nesta ordem)

```text
Olá! Você recebeu uma cobrança de {{1}}.

Referente a: {{2}}
Valor: {{3}}
Forma de pagamento: {{4}}

Código ou link para pagamento:
{{5}}

Use os dados acima para realizar o pagamento.
```

## Exemplos para submissão

| Variável | Significado | Exemplo |
| --- | --- | --- |
| `{{1}}` | Empresa que está cobrando | Pagando |
| `{{2}}` | Descrição da cobrança | Mensalidade setembro |
| `{{3}}` | Valor formatado | R$ 10,00 |
| `{{4}}` | Forma de pagamento | Boleto |
| `{{5}}` | Código PIX, linha digitável ou link | 00020126...5204000053039865802BR |

Valores possíveis de `{{4}}` (gerados pelo sistema): `PIX`, `Boleto`,
`Bolepix (boleto com PIX)`, `Link de pagamento`.

## Usar outro nome de template

Se o template aprovado tiver outro nome ou idioma, configure os segredos:

- `WHATSAPP_TEMPLATE_NECTA_CHARGE` (padrão `cobranca_pagamento`)
- `WHATSAPP_TEMPLATE_NECTA_CHARGE_LANG` (padrão `pt_BR`)
