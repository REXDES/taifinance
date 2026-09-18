# WhatsApp de cobrança e simplificação da tela

## 1. Enviar o código dentro do template aprovado

O fluxo atual envia primeiro o template e depois tenta enviar o código como uma mensagem comum. O envio do template não abre, por si só, a janela de atendimento de 24 horas; por isso o cliente pode receber o aviso, mas não o código.

Vamos substituir esse fluxo por um único template de utilidade, já contendo o código ou link de pagamento como variável. Sugestão para cadastro na Meta:

- **Nome:** `cobranca_pagamento_com_codigo`
- **Idioma:** Português (BR)
- **Categoria:** Utilidade
- **Cabeçalho e botões:** nenhum
- **Corpo:**

```text
Olá! Você recebeu uma cobrança de {{1}}.

Referente a: {{2}}
Valor: {{3}}
Forma de pagamento: {{4}}

Código ou link para pagamento:
{{5}}

Use os dados acima para realizar o pagamento.
```

Variáveis: empresa, descrição, valor, forma de pagamento e código PIX/linha digitável/link.

Após a aprovação na Meta:

- o botão enviará apenas esse template completo;
- PIX, boleto, bolepix e link usarão o mesmo modelo;
- a tela distinguirá claramente template não aprovado, telefone inválido e falha de envio;
- a confirmação só aparecerá quando a Meta aceitar a mensagem completa.

Também será atualizado o documento de orientação do template.

## 2. Simplificar “Nova cobrança”

Concordo com as remoções propostas:

- retirar por completo **Conta de recebimento**, pois toda cobrança já vai obrigatoriamente para a Conta Necta;
- retirar o informativo acima dos botões sobre emissão, atualização e reflexo financeiro;
- quando a empresa estiver corretamente habilitada, não ocupar espaço mostrando o recebedor fixo; exibir somente um alerta bloqueante quando faltar homologação ou chave de cobrança;
- manter a ordem mais direta: forma e valor, vencimento e descrição, pagador, endereço e recorrência;
- preservar os avisos apenas quando exigirem ação do usuário.

## 3. Validação

- testar o conteúdo enviado para PIX, boleto e link;
- confirmar que não existe mais uma segunda mensagem dependente da janela de 24 horas;
- conferir a nova cobrança em telas grandes e celulares;
- incrementar a versão do aplicativo.

## Detalhes técnicos

- Ajustar `send-necta-charge-whatsapp` para validar os dados recebidos e enviar cinco parâmetros no único template.
- Atualizar a tela de cobranças para tratar o retorno real da função e remover os blocos fixos redundantes.
- Atualizar `docs/whatsapp-template-cobranca.md` com o novo modelo e exemplos de submissão.
- Publicar novamente a função de envio após a alteração.

A mudança de código pode ser preparada imediatamente, mas o envio completo só funcionará quando o novo template estiver aprovado na Meta.
