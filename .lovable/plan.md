# Cobrança em um só lugar + módulo de Vendas com marca configurável

## Conceito
- **Contas a Receber** (Gestão Financeira) é o único lugar para cobrar. Empresas sem o módulo Pagamentos continuam exatamente como hoje.
- Com Pagamentos ativo, ao criar uma conta a receber o usuário escolhe entre:
  - **Cobrança Própria:** como hoje. A conta de recebimento é escolhida manualmente e o envio usa o PIX da empresa. Tem Efetivar, Pausar, Cancelar e Excluir.
  - **Cobrança [marca do gateway]:** boleto, PIX, Bolepix ou link. O valor cai na conta do gateway e a baixa é automática.
- O módulo Pagamentos passa a ser **vendas e faturamento**: consulta de vendas, maquininhas, taxas e transferências.
- Os dois tipos de mensagem ficam registrados no **Log de Mensagens** (novo nome do botão "Info").

## Fase 1 — Menu "Configuração de Módulos" (modo administrativo)
- Novo menu no modo administrativo que lista **todos os módulos**: Gestão Financeira, Banco Digital, Máquinas e Locação, Crédito e Pagamentos.
- Para cada módulo é possível configurar:
  - **Nome exibido** (por exemplo, Pagamentos → "Pagando.net");
  - **Logo** (envio de imagem);
  - **Cor** de destaque.
- Nome, logo e cor aparecem em todo o app: menu lateral e móvel, títulos, opções e selos. No caso de Pagamentos, também no nome da conta espelhada (por exemplo, "Conta Pagando.net").
- O nome técnico dos módulos não muda. A configuração vale para todas as empresas, e cada campo sem configuração continua com o nome, ícone e cor atuais.

## Fase 2 — Nomes e organização
- "Necta" deixa de aparecer em qualquer tela e é substituído pela marca configurada de Pagamentos.
- "Estabelecimentos" vira **"Pagadores"** (título "Relatório de Pagadores").
- "Cobranças" vira **"Vendas/Recebimentos"**.
- "Info" vira **"Log de Mensagens"**.

## Fase 3 — Perfil único da empresa
- A tela "Meu Perfil" de Pagamentos passa a ser a aba **Cadastro** em Configurações da Empresa, para todas as empresas.
- A aba PIX sai, porque os dados já estão no Perfil. A aba WhatsApp continua.
- A homologação no gateway só usa esses dados quando o módulo está ativo.
- O menu "Meu Perfil" sai de Pagamentos.

## Fase 4 — Duas formas de cobrar no Contas a Receber
- Escolha entre "Cobrança Própria" e "Cobrança [marca]" ao criar a conta. A segunda só aparece se a empresa tiver o módulo e estiver homologada.
- **Cobrança pelo gateway:** escolha da forma de pagamento; parcelado ou recorrente gera uma venda por parcela; ao cancelar, pergunta se é só esta ou todas as futuras, e também cancela no gateway.
- Selo por linha ("Própria" ou a marca, com logo) e filtro por tipo.
- Reenvio de WhatsApp nos dois tipos, registrado no Log de Mensagens.
- A lista detalhada continua sendo a padrão; os totais por dia, mês, pagador, forma de pagamento ou status são opcionais.
- Cabeçalho: Total a Receber, Total a Pagar e Saldo Previsto do período.

## Fase 5 — Tela de Vendas (módulo)
- Todas as vendas pelo gateway: boletos, PIX, links e maquininhas (à vista e parcelado). É só consulta, sem emissão.
- Lista detalhada, com totais opcionais. Cabeçalho: faturado, recebido, em aberto e taxas.

## Fase 6 — Novos recursos
- **Transferir saldo** para a conta bancária da empresa (exige os dados bancários do Perfil), com confirmação e histórico.
- **Minhas Taxas:** PIX, boleto, cartão à vista e parcelado.
- **Maquininhas:** modelo, número de série, situação, última venda e volume.

## Fase 7 — Mensagens automáticas
- Na cobrança pelo gateway, os lembretes são enviados pelo gateway e registrados no Log de Mensagens.
- Na cobrança própria, continuam os lembretes do Tai Finance.

## Pontos a confirmar na API do gateway
1. Se a transferência para conta própria está liberada por empresa.
2. Se as taxas vêm por empresa.
3. Se a lista de maquininhas traz a última venda (se não trouxer, calculo pelas vendas).
4. Se o gateway avisa o sistema quando envia WhatsApp.

## Detalhes técnicos
- Nova tabela de configuração global da marca (nome, caminho do logo, cor). Leitura para todos os usuários autenticados e edição só por supervisor. O logo fica em um armazenamento público.
- Um provedor no front carrega a marca uma vez. Todos os textos e selos passam a usar essa marca, em vez de nomes fixos.
- O nome da conta espelhada é exibido a partir da marca (o nome gravado não muda).
- O formulário de conta a receber chama a função de venda já existente quando a cobrança é pelo gateway. Nova coluna para agrupar as parcelas.
- A tela de Cobranças passa a ser a consulta de Vendas. Tabelas e chaves de permissão continuam iguais, e os novos menus são cadastrados no catálogo de permissões.
- A versão do app sobe a cada fase.

## Ordem sugerida
Fase 1 → 2 → 3 → 4 → 5 → 6 → 7.
