# Pagamentos como centro do Contas a Receber — análise e plano em fases

## Resposta curta
Faz sentido e é viável. Hoje as informações estão duplicadas: cobranças ficam em Pagamentos e as contas a receber, na Gestão Financeira. Com o plano, a empresa que usa Pagamentos passa a ter um só lugar para cobrar. Como o escopo é grande, a entrega será em 5 fases, cada uma testável separadamente.

## Fase 1 — Nomes e organização (rápida)
- "Necta" vira **"Pagando"** em todos os textos que o usuário vê: "Conta Pagando", selos, avisos e relatórios. Os nomes internos não mudam.
- O menu "Estabelecimentos" em Pagamentos passa a se chamar **"Pagadores"** (título "Relatório de Pagadores").

## Fase 2 — Perfil único da empresa
- A tela "Meu Perfil" de Pagamentos passa a ser a aba **Cadastro** em Configurações da Empresa, para todas as empresas do Tai Finance.
- A aba PIX sai, porque os dados de PIX e de banco já estão no Perfil. A aba WhatsApp continua, com as regras de lembretes.
- O envio desses dados para a homologação Pagando só acontece se a empresa tiver o módulo Pagamentos ativo.
- O menu "Meu Perfil" sai de Pagamentos, e o botão leva para Configurações da Empresa.

## Fase 3 — Cobranças completas (o núcleo do plano)
Com Pagamentos ativo, "Contas a Receber" leva para **Cobranças**, que passa a ter:
- **Dois tipos de cobrança:**
  - **Pagando:** emitida pela plataforma, com baixa automática.
  - **Simples:** sem emissão externa, com Efetivar, Pausar, Cancelar e Excluir, como hoje na Gestão Financeira.
- **Parcelado e recorrente:** para os dois tipos, com a opção "cancelar só esta" ou "cancelar todas as futuras". Na cobrança Pagando, o cancelamento também é feito na plataforma, parcela por parcela.
- **Visualização:** a padrão continua a lista atual, com cada cobrança separada e detalhada. Os **totais** (por dia, mês, pagador, forma de pagamento ou status) são opcionais e aparecem só quando o usuário escolhe um agrupamento. Os grupos abrem e fecham e mostram as cobranças de cada um.
- **Cabeçalho:** Total a Receber, Total a Pagar e Saldo Previsto do período filtrado.
- **Reenviar WhatsApp** pelo sistema, registrado no botão Info.
- As contas a pagar continuam na Gestão Financeira. O Contas a Receber de lá passa a mostrar as mesmas cobranças, sem duplicar nada.

## Fase 4 — Mensagens automáticas
- Nas cobranças Pagando, os lembretes automáticos deixam de sair pelo Tai Finance e passam a ser enviados pela Pagando. O Tai Finance registra cada ocorrência que a Pagando informar e mostra no botão Info.
- As cobranças simples continuam com os lembretes do Tai Finance, conforme a aba WhatsApp da empresa.
- **Depende de confirmação:** precisamos saber se a Pagando realmente envia WhatsApp e avisa o nosso sistema quando envia. Se não avisar, o relatório mostrará só o que o Tai Finance consegue saber.

## Fase 5 — Novos recursos em Pagamentos
- **Transferir saldo:** da Conta Pagando para a conta bancária da própria empresa. Só funciona se os dados bancários do Perfil estiverem completos. Terá confirmação, histórico e reflexo no extrato.
- **Minhas Taxas:** PIX, boleto, cartão à vista e parcelado (por número de parcelas), conforme o plano de taxas da empresa.
- **Maquininhas:** relatório com modelo, número de série, situação (em operação ou inativa), última venda e volume no período.

## Pontos que dependem da API da Pagando
Antes das fases 4 e 5, vou conferir na documentação e com testes reais:
1. Se a transferência para conta própria está liberada para a credencial de cada empresa.
2. Se as taxas vêm por empresa ou só pelo marketplace.
3. Se a lista de maquininhas traz a data da última venda. Se não trouxer, calculo pela última venda registrada.
4. Se existem os avisos de WhatsApp enviados pela Pagando.

Se algum desses recursos não estiver disponível, eu aviso e a fase segue com o que for possível.

## Detalhes técnicos
- As cobranças simples usam a própria tabela de contas a receber. A tela de Cobranças junta as cobranças simples e as vendas da Pagando, no mesmo formato que o hook de contas a pagar/receber já usa.
- Parcelado ou recorrente na Pagando: cada parcela é uma venda, ligada às outras por um identificador de grupo. Será preciso uma nova coluna para isso.
- A troca de nomes muda só os textos. Tabelas, funções e as chaves de permissão continuam iguais.
- Transferência: nova ação no serviço interno de integração, com registro em tabela própria, verificação de permissão e de acesso à empresa.
- Taxas e maquininhas: leitura pela integração, com uso das tabelas de taxas e de maquininhas que já existem como cópia local.
- Os novos menus serão cadastrados no catálogo de permissões.
- A versão do app sobe a cada fase entregue.

## Ordem sugerida
Fase 1 → Fase 2 → Fase 3 → Fase 5 → Fase 4. A Fase 4 fica por último porque depende da confirmação da Pagando.
