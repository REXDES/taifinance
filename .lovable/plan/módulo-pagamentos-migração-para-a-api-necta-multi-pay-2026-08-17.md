# Módulo Pagamentos — migração para a API Necta Multi-Pay

Substitui a integração anterior (Cappta) pela API Necta Multi-Pay (`https://api-gateway.nectaco.com.br`), com autenticação máquina-a-máquina (`POST /auth` com `clientSecret` + `secretKey` → JWT).

## Estrutura de telas

### Modo Normal (empresa cliente, 3 páginas)
1. **Dashboard** — BIs da operação: receita do período vs. anterior, volume, ticket médio, série mensal (6 meses), distribuição por método de pagamento, cobranças em aberto/pagas, saldo e próximas liquidações.
2. **Cadastro** — dados do estabelecimento (razão social, CNPJ/CPF, contato), endereço completo, dados bancários (conta e chaves PIX), configuração de boleto e usuários do estabelecimento. Inclui bloco **Homologação**: envio de documentos, aceite/assinatura de termos e indicador de status (pré-registro → em análise → homologado/recusado), com botão "Enviar para homologação".
3. **Cobranças** — geração de cobrança (PIX, boleto, bolepix, cartão e link de pagamento), lista com filtros por status (em aberto, pagas, estornadas, vencidas), recorrentes, detalhe com linha digitável / PIX copia-e-cola / PDF do boleto, estorno e acompanhamento de status. Cada cobrança paga reflete em **Gestão Financeira** (recebível liquidado / transação na conta configurada).

### Modo Administrativo (marketplace)
4. **Dashboard geral** — consolidado de todos os estabelecimentos: ativos no período vs. anterior, ranking top 5 por receita, volume/receita agregados, estatísticas do escopo.
5. **Cadastro** — CRUD de estabelecimentos, terminais **POS** (modelos homologados, registrar, vincular/desvincular a lojista) e **Taxas** (planos de taxa e troca de plano por estabelecimento, royalty).
6. **Liquidações** — lista de liquidações com filtros (período, estabelecimento, status), drill-down para liquidações por lojista e ordens da liquidação.
7. **Configurações** — gestão de API (tokens, teste de conexão), webhooks (canal, URLs de destino, eventos, log de recebimentos), e parâmetros do módulo por empresa.

## Backend

Novas tabelas (todas com RLS por empresa + GRANTs):
- `necta_establishments` — vínculo empresa ↔ estabelecimento na Necta, dados cadastrais, endereço, banco, status de homologação.
- `necta_sales` — cobranças/vendas (método, valor, vencimento, pagador, status, recorrência, IDs da Necta, links/boleto/PIX) + vínculo com `payables_receivables` / `transactions`.
- `necta_pos` — terminais e vínculo com estabelecimento.
- `necta_fee_plans` — planos de taxa espelhados.
- `necta_settlements` — liquidações e liquidações por lojista.
- `necta_webhook_endpoints` e `necta_webhook_events` — configuração e log.

Edge functions:
- `necta-auth` — autentica client credentials e mantém o JWT em cache.
- `necta-api` — proxy genérico autenticado (todas as rotas do spec), validando empresa/permissão do chamador.
- `necta-sale` — criar/emitir/consultar/estornar cobrança e espelhar status no financeiro.
- `necta-webhook` — recebe eventos (`verify_jwt = false`), grava log e atualiza vendas/liquidações.
- `necta-sync` — sincronização periódica de vendas em aberto e liquidações.

Segredos necessários: `NECTA_API_BASE_URL`, `NECTA_CLIENT_SECRET`, `NECTA_SECRET_KEY` (as novas credenciais). Serão solicitados durante a implementação.

## Observações
- As telas e tabelas Cappta deixam de ser usadas no menu; as tabelas permanecem no banco sem uso para não perder histórico.
- Permissões: as 7 telas são registradas em `src/lib/permissions.ts` (`payments.*`) para aparecerem na matriz de cargos.
- Ativação continua por empresa, no seletor de módulos em Configurações da Empresa.
