# Cobrança em um só lugar + Pagamentos como Vendas e Faturamento

## Conceito
- **Contas a Receber** (Gestão Financeira) é o **único lugar para cobrar**. Empresas sem o módulo Pagamentos continuam exatamente como hoje.
- Com Pagamentos ativo, ao criar uma conta a receber o usuário escolhe como cobrar:
  - **Cobrar diretamente:** funciona como hoje. A conta de recebimento é definida manualmente, e o envio é feito com o PIX configurado da empresa. Tem Efetivar, Pausar, Cancelar e Excluir.
  - **Cobrar pela Gateway Pagando:** emite boleto, PIX, Bolepix ou link. O valor cai na **Conta Pagando** e a baixa é automática.
- O módulo Pagamentos deixa de emitir cobranças e passa a ser **vendas e faturamento**: relatórios, vendas nas maquininhas, taxas e transferências.
- Os dois tipos de mensagem (a direta pelo Tai Finance e a da Pagando) ficam registrados no **Log de Mensagens**, que é o novo nome do botão "Info".

## Fase 1 — Nomes (rápida)
- O nome do módulo muda só na tela. Nome a definir; sugestões: **Vendas e Recebimentos**, **Faturamento**, **Minhas Vendas**.
- "Necta" vira **"Pagando"** em todos os textos visíveis, como "Conta Pagando" e os selos.
- "Estabelecimentos" vira **"Pagadores"** (título "Relatório de Pagadores").
- "Cobranças" vira **"Vendas"**.
- O botão "Info" vira **"Log de Mensagens"**.

## Fase 2 — Perfil único da empresa
- A tela "Meu Perfil" de Pagamentos passa a ser a aba **Cadastro** em Configurações da Empresa, para todas as empresas.
- A aba PIX sai, porque os dados já estão no Perfil. A aba WhatsApp continua.
- Os dados só são enviados para a homologação Pagando quando o módulo Pagamentos está ativo.
- O menu "Meu Perfil" sai de Pagamentos.

## Fase 3 — Duas formas de cobrar no Contas a Receber
- Ao criar uma conta a receber, aparece a escolha **"Cobrar diretamente"** ou **"Cobrar pela Gateway Pagando"**. A segunda opção só aparece se a empresa tiver o módulo e estiver homologada.
- **Pagando:** escolha da forma de pagamento. A opção de parcelado e recorrente gera uma venda por parcela. O cancelamento pergunta se é só esta ou todas as futuras, e também cancela na Pagando.
- Selo por linha ("Direta" ou "Pagando") e filtro por tipo.
- Reenvio de WhatsApp nos dois tipos, registrado no Log de Mensagens.
- Visualização: a lista detalhada continua sendo a padrão. Os totais (por dia, mês, pagador, forma de pagamento ou status) são opcionais.
- Cabeçalho: Total a Receber, Total a Pagar e Saldo Previsto do período.

## Fase 4 — Tela de Vendas (módulo Pagamentos)
- Tudo o que foi vendido pela Pagando: boletos, PIX, links e maquininhas (à vista e parcelado). É uma tela de consulta, sem emissão.
- A lista detalhada é a padrão, com totais opcionais por dia, mês, pagador, forma de pagamento ou status.
- Cabeçalho: faturado, recebido, em aberto e taxas do período.

## Fase 5 — Novos recursos em Pagamentos
- **Transferir saldo:** da Conta Pagando para a conta bancária da empresa. Exige os dados bancários completos no Perfil e tem confirmação e histórico.
- **Minhas Taxas:** PIX, boleto, cartão à vista e parcelado.
- **Maquininhas:** modelo, número de série, situação, última venda e volume.

## Fase 6 — Mensagens automáticas
- **Cobrança Pagando:** os lembretes são enviados pela Pagando, e o Tai Finance registra as ocorrências no Log de Mensagens.
- **Cobrança direta:** continua com os lembretes do Tai Finance.
- Depende de confirmar na Pagando se ela envia WhatsApp e se avisa o sistema.

## Pontos a confirmar na API da Pagando
1. Se a transferência para conta própria está liberada para a credencial de cada empresa.
2. Se as taxas vêm por empresa.
3. Se a lista de maquininhas traz a última venda. Se não trouxer, calculo pela última venda registrada.
4. Se a Pagando avisa quando envia mensagens de WhatsApp.

## Detalhes técnicos
- O formulário de conta a receber ganha a opção de cobrança. "Pagando" chama a função de venda já existente, com vínculo à conta a receber. A lista atual já junta as contas simples e as vendas da Pagando sem duplicar.
- Nova coluna para identificar o grupo de parcelas das vendas Pagando.
- As emissões saem da tela de Cobranças, que vira a consulta de Vendas.
- A troca de nomes muda só os textos. Tabelas e chaves de permissão continuam iguais.
- Transferência: nova ação no serviço de integração, com tabela de histórico e verificação de acesso.
- Novos menus serão cadastrados no catálogo de permissões.
- A versão do app sobe a cada fase.

## Ordem sugerida
Fase 1 → 2 → 3 → 4 → 5 → 6.
