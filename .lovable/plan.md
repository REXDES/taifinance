
# Split de PIX — Fase 1: Cadastro e Regras (sem PSP)

Implementação da **camada de configuração** do split de pagamentos PIX. Toda a UI, banco e lógica de cálculo das frações ficam prontas; a chamada real ao PSP fica como TODO marcado, para ativar quando você confirmar o provedor (Unida/Asaas/Celcoin).

## O que entra nesta fase

1. **Cadastro de Recebedores de Split** (tela própria + criação inline)
2. **Regras de split** em 3 níveis: global da empresa, por cobrança, por categoria/cliente/tag
3. **Cálculo automático** da fração ao gerar PIX/cobrança
4. **Visualização** do split em cobranças e contas a receber
5. **Marcação clara** de que o split é "lógico" (ainda não executado pelo PSP) até a Fase 2

## O que NÃO entra (fica para Fase 2)

- Chamada real ao PSP para executar o split na liquidação
- Webhook de confirmação de split pago
- Reconciliação automática entre fração prometida x fração liquidada

---

## 1. Banco de dados

### `split_recipients` — cadastro de recebedores
- `company_id` (FK companies)
- `name` — apelido ("Sócio João", "Comissão Vendedor X")
- `document` — CPF/CNPJ
- `pix_key` + `pix_key_type` (cpf/cnpj/email/phone/random)
- `bank_name`, `bank_branch`, `bank_account` (opcionais — para Fase 2)
- `notes`, `active`
- RLS por `has_company_access(company_id)`

### `split_rules` — regras automáticas por empresa
- `company_id`, `recipient_id` (FK), `priority`
- `scope` enum: `global` | `category` | `client_supplier` | `tag`
- `scope_ref_id` — id da categoria/cliente/tag quando aplicável
- `value_type` enum: `percent` | `fixed`
- `value` — número (10 = 10% ou R$ 10,00)
- `active`
- RLS por empresa

### `pix_charge_splits` — split definido em cada cobrança
- `payable_receivable_id` (FK) — vínculo com a cobrança
- `recipient_id` (FK), `value_type`, `value`, `calculated_amount`
- `rule_id` (nullable — quando veio de regra automática) ou `manual = true`
- `status` enum: `pending` | `executed` | `failed` — sempre `pending` na Fase 1
- RLS por empresa via FK

**Migração inclui GRANT + RLS + triggers `updated_at` conforme padrão do projeto.**

## 2. UI — Cadastros

### Nova página `SplitRecipientsPage.tsx` (em "Cadastros" no sidebar financeiro)
- Lista com nome, documento, chave PIX, status ativo, contagem de regras vinculadas
- Dialog de criar/editar (CPF/CNPJ + chave PIX com validação `validatePixKey` já existente)
- Exclusão com `DeleteConfirmDialog` + erro descritivo se houver regra/cobrança vinculada
- Soma rápida "X cobranças usaram este recebedor" (similar ao que pediu nas Tags)

### Nova página `SplitRulesPage.tsx`
- Lista de regras agrupadas por escopo (Global / Categoria / Cliente / Tag)
- Dialog criar/editar: seleciona recebedor + escopo + valor (% ou fixo) + prioridade
- Quando escopo ≠ global, mostra picker do alvo (Select de categoria, ClientSupplier, ou TagPicker)
- Validação: soma de splits globais não pode passar de 100%

## 3. UI — No momento de gerar a cobrança PIX

### `PixQrCodeDialog.tsx` e criação de payable receivable (tipo recebível com PIX)
- Nova seção colapsável **"Split de Pagamento"** abaixo do valor
- Mostra automaticamente as regras aplicáveis (badges com recebedor + valor calculado)
- Botão "+ Adicionar recebedor manualmente" — abre TagPicker-style com busca, cor por recebedor, criação inline (abre dialog rápido do `SplitRecipientsPage`)
- Resumo no rodapé: valor bruto, total de splits, **valor líquido restante para a empresa**
- Validação: soma dos splits ≤ valor total

### Persistência
- Ao salvar a cobrança, grava registros em `pix_charge_splits` com `calculated_amount` congelado naquele momento

## 4. Visualização

### Lista de Contas a Receber (`PayablesReceivablesPage`)
- Ícone/badge "Split" quando a cobrança tem splits
- Tooltip mostra recebedores e valores
- Expansão da linha mostra detalhamento

### Tela de detalhe da cobrança
- Seção "Split de Pagamento" com tabela: recebedor | tipo | valor | status
- Banner amarelo informativo: **"Split em modo lógico — execução automática no PSP ainda não ativa. Marque manualmente os repasses por enquanto."**

### Relatório Pagar/Receber
- Filtro adicional: "Tem split? Sim/Não/Qualquer"
- Filtro por recebedor de split

## 5. Hooks novos
- `useSplitRecipients(companyId)` — CRUD + usage count
- `useSplitRules(companyId)` — CRUD + matching helper `getApplicableRules({ amount, categoryId, clientId, tagIds })`
- `usePixChargeSplits(payableReceivableId)` — read + setSplits (sync delete/insert)

## 6. Integração com regras

Função utilitária `calculateSplits(amount, context, rules)`:
- Aplica primeiro splits **fixos** (R$), depois **percentuais** sobre o valor restante (ou bruto — você escolhe na regra)
- Resolve conflitos por `priority`
- Retorna array `{ recipient_id, value_type, value, calculated_amount }`

---

## Detalhes técnicos

```text
Fluxo ao criar cobrança PIX
───────────────────────────
[Usuário cria recebível PIX]
         │
         ▼
[Hook busca regras aplicáveis: global + categoria + cliente + tags]
         │
         ▼
[calculateSplits() → array de splits sugeridos]
         │
         ▼
[UI mostra splits + permite editar/adicionar manualmente]
         │
         ▼
[Save → INSERT payable_receivable + INSERT pix_charge_splits]
         │
         ▼
[PIX QR gerado normalmente (chave da empresa) — split é lógico]
```

- O **BR Code PIX continua sendo gerado pela `pixUtils.ts` atual**, apontando para a chave da empresa. Nenhuma mudança no payload EMV — split é metadado interno.
- Tipos do Supabase serão regenerados após a migração.
- Sidebar: adiciono "Recebedores de Split" e "Regras de Split" em **Cadastros**, abaixo de Tags.

## Arquivos a criar/editar

**Criar:**
- `supabase/migrations/<timestamp>_split_payments.sql`
- `src/components/finance/SplitRecipientsPage.tsx`
- `src/components/finance/SplitRulesPage.tsx`
- `src/components/finance/SplitPicker.tsx` (componente reutilizável na cobrança)
- `src/components/finance/SplitBadge.tsx`
- `src/hooks/useSplitRecipients.ts`
- `src/hooks/useSplitRules.ts`
- `src/hooks/usePixChargeSplits.ts`
- `src/lib/splitCalculator.ts`

**Editar:**
- `src/components/finance/FinanceSidebar.tsx` (novos itens)
- `src/pages/Finance.tsx` (rotas)
- `src/components/finance/PixQrCodeDialog.tsx` (seção split)
- `src/components/finance/PayablesReceivablesPage.tsx` (badge + filtro + detalhe)
- `src/components/finance/PayablesReceivablesReportPage.tsx` (filtros)
- `src/hooks/usePayablesReceivables.ts` (incluir splits no create/update)
- `src/integrations/supabase/types.ts` (auto-gerado pós-migração)

## Próximos passos depois desta fase

1. Você confirma com a Unida se o plano libera split de PIX e me passa a doc
2. **Fase 2:** implemento o adapter PSP (`src/lib/pspAdapter/unida.ts` ou `asaas.ts`) que chama a API real, cria a cob dinâmica com split e atualiza `pix_charge_splits.status`
3. **Fase 3:** webhook de confirmação + reconciliação
