## Ajuste do template `pix_pagamento_cobranca` e teste

### Mudanças em `supabase/functions/send-pix-whatsapp/index.ts`

1. Trocar default do template:
   - `PIX_TEMPLATE` default = `pix_pagamento_cobranca` (mantém override por env var).

2. Atualizar `sendTemplate` para parâmetros posicionais (`{{1}}..{{4}}`):
   - Trocar `namedParams: Record<string,string>` por `bodyParams: string[]`.
   - Gerar `parameters` como `[{ type: "text", text: v }, ...]` (sem `parameter_name`).

3. Chamada do template passa 4 valores na ordem:
   1. `companyName` (empresa)
   2. `description` (descrição) — obrigatório, validar no início
   3. `valorStr` (R$ formatado)
   4. `pixCode` (copia-e-cola)

4. Remover o envio do **QR Code (imagem)** — o novo template não menciona QR, só código copia-e-cola.

5. Manter o envio adicional de **mensagem de texto apenas com o `pixCode`** logo após o template, para facilitar o "copiar" no WhatsApp (a string fica isolada em uma bolha própria).

6. Atualizar mensagem de `hint` no erro para refletir 4 variáveis posicionais.

### Validação

- Adicionar `description` em `required` (junto com `phone` e `pixCode`).

### Teste

1. Deploy da função.
2. `curl_edge_functions` POST em `/send-pix-whatsapp` com:
   - `phone: "+5511974980448"`
   - `companyName: "Tai Finance"`
   - `description: "Teste de cobrança"`
   - `amount: 123.45`
   - `pixCode: "<código PIX de teste>"`
3. Verificar `success: true` no retorno e checar `edge_function_logs` em caso de falha.
4. Confirmar contigo a chegada da mensagem no WhatsApp.

### Observação

O template diz "Em seguida você receberá o código PIX copia-e-cola", mas o próprio `{{4}}` já é o código. Vou enviar **template + uma segunda mensagem de texto contendo só o código** — assim o usuário consegue tocar e copiar facilmente, e o "em seguida" da mensagem faz sentido. Se preferires apenas o template (sem 2ª mensagem), me avisa antes que eu implemento.
