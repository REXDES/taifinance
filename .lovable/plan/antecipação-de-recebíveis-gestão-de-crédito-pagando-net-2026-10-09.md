# Antecipação de Recebíveis (Gestão de Crédito + Pagando.net)

Permitir que um cedente ceda boletos já emitidos a um financiador homologado na Pagando, com o valor indo automaticamente para a conta do financiador quando o sacado pagar — sem depender do cedente repassar.

## Como vai funcionar

1. **Empresa marcada como Financiador.** No cadastro de empresas, nova opção "Financiador" e escolha de quais cedentes (que usam Gestão de Crédito) podem vê-lo.
2. **Menu "Financiador" em Gestão de Crédito** (só para financiadores): regras de crédito (deságio, prazo mín./máx. de parcelas, limite por cedente e por sacado, score mínimo, exigência de nota fiscal) e modelos de contrato de cessão/aditivos (upload de arquivos).
3. **Menu "Antecipação" em Gestão de Crédito** (cedente): títulos elegíveis, anexo de nota fiscal por título, comparação das regras de cada financiador, simulação do líquido e solicitação; acompanhamento dos títulos antecipados.
4. **Visão do financiador:** mesa de aprovação das solicitações e carteira de títulos cedidos, liquidados ou não.
5. **Liquidação automática na Pagando.** Quando o sacado paga, o aviso de pagamento da Pagando dispara automaticamente o split da venda para a conta digital do financiador (valor líquido da cessão). Ajustes e eventual devolução de diferença ao cedente usam transferência interna entre contas digitais Pagando. Tudo com registro de tentativas, sem repasse duplicado, e alerta se algo falhar.
6. **Contas a Receber.** Boletos seguem entrando como pendentes. Ao serem cedidos, ficam marcados "Cedido a <financiador>" e saem da previsão do cedente, mantendo o histórico: emitido → cedido → pago pelo sacado → liquidado ao financiador.
7. **Esteira de crédito completa.** Consulta → decisão → qualificação → simulação → contrato → emissão dos boletos Pagando.net, já prontos para antecipação.

Cedentes que não usam antecipação continuam exatamente como hoje.

## Ponto pendente (Necta)

Confirmar se o split pós-pagamento ocorre antes do saldo ficar disponível para saque do cedente. Até a confirmação, a tela mostra o status "repasse pendente" até o split ser concluído.

## Detalhes técnicos

- Fase 1 (schema): `companies.is_financiador`; `financier_cedent_links`; `financier_credit_rules`; `financier_contract_templates` (bucket privado); `receivable_assignments` (payable_receivable_id, necta_sale_id, cedente, financiador, valor face, deságio, líquido, status `requested|approved|rejected|assigned|paid_by_debtor|settled|settlement_failed|cancelled`); `receivable_assignment_attachments` (NF); `receivable_assignment_events` (split/transfer, request_id, resposta). RLS por `has_company_access` de cedente ou financiador.
- Fase 2: toggle e vínculos em Gerenciar Empresa (modo adm).
- Fases 3-5: páginas `FinancierSettingsPage`, `AnticipationPage` (abas cedente/financiador), permissões `credit.financier` e `credit.anticipation` em `src/lib/permissions.ts`.
- Fase 6: no webhook `sale.paid` (`necta-webhook`), se houver cessão `assigned`, chamar `POST /sales/{uuid}/splits` (`recipientType: SELLER`, seller do financiador); ajustes via `POST /banking/marketplaces/{uuid}/internal-transfers` com `request_id` idempotente e consulta `GET .../internal-transfers/{id}`. Retry manual na carteira para `settlement_failed`. Contas a Receber exibe badge "Cedido" e exclui da previsão.
- Fase 7: revisão do fluxo existente até a emissão via `necta-sale`.
- Entrega incremental por fase, typecheck limpo e verificação no preview.
