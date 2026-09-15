# Dashboard de Pagamentos por empresa + template de WhatsApp

## 1. Dashboard de Pagamentos: separar por perfil

Hoje o dashboard busca os números da Necta sem dizer de qual empresa se trata. Quando isso acontece, a consulta cai na credencial da Pagando (marketplace) e a empresa logada vê o movimento de todo mundo, e não apenas o dela. Os cartões de cobranças em aberto/pagas já são da empresa; os de receita, transações, ticket médio e os dois gráficos não.

O que muda:

- O dashboard passa a consultar sempre em nome da empresa selecionada, usando a chave de API cadastrada para ela em Credenciais de Cobrança.
- Se a empresa ainda não tem chave própria cadastrada, o dashboard não mostra números de outra empresa: exibe um aviso claro ("esta empresa ainda não tem credencial de cobrança") e mantém apenas os totais locais das cobranças dela.
- No Modo Administrativo (visão Pagando) segue possível ver o consolidado do marketplace, com rótulo indicando que aquela visão é do marketplace.

## 2. Template de WhatsApp para cobrança

O envio falhou porque o template ainda não existe aprovado na Meta. Vou deixar no projeto um arquivo com o texto exato a cadastrar (`docs/whatsapp-template-cobranca.md`) e a tela passa a mostrar essa instrução quando a Meta recusar.

Template a criar no Gerenciador do WhatsApp (Meta):

- Nome: `cobranca_pagamento`
- Idioma: Português (BR)
- Categoria: Utilidade
- Corpo (4 variáveis, nesta ordem):

```text
Olá! Você tem uma cobrança de {{1}}.

Referente a: {{2}}
Valor: {{3}}

{{4}}
```

- Exemplos para aprovação: {{1}} Pagando, {{2}} Mensalidade setembro, {{3}} R$ 10,00, {{4}} Confira a linha digitável do boleto na mensagem a seguir.
- Sem botões e sem cabeçalho (o código/link vai na mensagem de texto seguinte, dentro da janela de 24h).

Depois de aprovado, o envio funciona sem mais nenhuma mudança; se você usar outro nome, é só me dizer que eu ajusto.

## Detalhes técnicos

- `supabase/functions/necta-api/index.ts`: aceitar `company_id` no proxy genérico e resolver credenciais via `companyCredentials(admin, company_id)` (com `has_company_access` do usuário); erro explícito quando não houver credencial, sem cair em `marketplaceCreds()`.
- `src/hooks/useNectaApi.ts`: `nectaCall` passa `company_id` opcional no body.
- `src/components/payments/NectaDashboardPage.tsx`: enviar `companyId` nas 4 chamadas `/sales/*`, tratar o erro de credencial ausente com `Alert` informativo e manter os KPIs locais de `necta_sales`.
- `src/components/payments/NectaAdminDashboardPage.tsx`: manter escopo marketplace, com rótulo "Consolidado do marketplace".
- `supabase/functions/send-necta-charge-whatsapp/index.ts`: mensagem de erro/hint apontando o template documentado.
- Redeploy de `necta-api`.
