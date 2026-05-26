
# Jornada completa da proposta de crédito (etapas 2 → 6)

Hoje, após aprovação/reavaliação, a proposta fica travada em `1/6 — Consulta`. Vou implementar as 5 etapas seguintes, encadeadas, com avanço automático de `current_step` em `credit_applications` e bloqueios de UI conforme o status.

## Visão geral do fluxo

```
[1 Consulta ✅]
   │  decision in (approved, manual) ──► botão "Prosseguir"
   ▼
[2 Qualificação]   formulário → grava credit_qualifications, step=3
   ▼
[3 Biometria]      gera link público (token), envia por WhatsApp,
                   cliente faz selfie+doc → IA analisa similaridade/liveness
                   se passar regras → step=4
   ▼
[4 Simulação]      operador escolhe valor, nº parcelas, 1ª vencimento;
                   sistema valida contra approved_limit, score_band,
                   juros/parcela_minima de credit_rules; step=5
   ▼
[5 Contrato]       gera PDF (jsPDF) com cláusulas + tabela de parcelas,
                   sobe em credit-documents, envia link por WhatsApp,
                   cliente aceita (registra IP/timestamp); step=6
   ▼
[6 Boletos]        cria N linhas em payables_receivables (tipo receivable,
                   recorrência, PIX da empresa), vincula credit_contract_id
```

## UI

**Tela "Propostas" — `CreditApplicationsPage.tsx`**
- Coluna "Etapa" passa a ser clicável → abre o passo atual.
- Nova ação **"Prosseguir"** (ícone `ArrowRight`) ao lado de "Reavaliar", visível quando `decision ∈ {approved, manual}` e `current_step < 6`.
- `ApplicationDetailDialog`: substituir as tabs atuais por um **stepper** vertical com 6 seções (Consulta, Qualificação, Biometria, Simulação, Contrato, Boletos). Cada seção mostra status (✅/⏳/🔒) e o painel correspondente quando ativa. As tabs atuais (Decisão, Ocorrências, Resumo, Resposta) viram sub-abas dentro da seção "Consulta".

**Novos componentes (em `src/components/credit/steps/`)**
- `QualificationStep.tsx` — form: whatsapp (obrigatório), email, renda, profissão, endereço de entrega, CEP/cidade/UF, notas. Persiste em `credit_qualifications` (upsert por `application_id`).
- `BiometryStep.tsx` — botão "Gerar link" → cria registro em `credit_biometry` se não existir, exibe URL pública `/credit/biometry/:token`, botão "Enviar por WhatsApp" usando `whatsapp_phone` da qualificação. Mostra status (pendente/enviado/em análise/aprovado/rejeitado), preview da selfie/doc e resultado da IA (similarity_score, liveness). Ações do gerente: aprovar/rejeitar manual.
- `SimulationStep.tsx` — inputs: valor solicitado, nº parcelas, data 1ª parcela. Calcula parcela (PRICE com `juros_mensal_pct`), exibe tabela. Valida contra `approved_limit`, `max_parcelas` da score_band e `parcela_minima`. Salva no rascunho do contrato (state local até confirmar).
- `ContractStep.tsx` — botão "Gerar contrato" → cria registro em `credit_contracts` (com principal, parcela, juros, descrição, cláusulas de `credit_rules.contract_clauses`), gera PDF com jsPDF, faz upload em `credit-documents/contracts/{application_id}.pdf`, atualiza `pdf_url`. Botão "Enviar por WhatsApp" envia link. Botão "Registrar aceite" grava `whatsapp_accepted_at` + IP.
- `BoletosStep.tsx` — botão "Gerar boletos/parcelas" → insere N linhas em `payables_receivables` (`type=receivable`, `payment_type=pix`, `credit_contract_id`, `installment_number`, `total_installments`, datas mensais a partir de `first_due_date`, `client_supplier_id` da proposta). Lista as parcelas geradas e seus status (pending/paid). Após criação, fecha a jornada (`status='completed'`).

**Página pública da biometria — `src/pages/CreditBiometryPublic.tsx`**
- Rota `/credit/biometry/:token` (sem auth). Lê `credit_biometry` pela RLS anon-por-token (já existe). Captura selfie via `getUserMedia`, upload do doc frente/verso, envia para edge function que chama a IA. Tela final de obrigado.

## Backend

**Nova edge function `credit-biometry-analyze`**
- Recebe `{ token, selfie_b64, doc_front_b64, doc_back_b64 }`.
- Faz upload dos arquivos em `credit-documents/biometry/{application_id}/...`.
- Chama Lovable AI (`google/gemini-2.5-flash`) com prompt para: (a) extrair OCR do documento, (b) avaliar liveness da selfie, (c) estimar similaridade selfie×doc (0–100).
- Aplica `credit_rules.ia_similarity_threshold` e `ia_require_liveness` → grava `status='approved'|'rejected'`, `similarity_score`, `liveness_passed`, `ocr_data`, `ai_analysis`, `completed_at`.
- Se aprovada, atualiza `credit_applications.current_step = max(current_step, 4)`.

**Reuso de funções já existentes**
- `whatsapp-send` (já no projeto) para enviar links de biometria e contrato.
- `pdf` libs: usar `jspdf` + `jspdf-autotable` (já dependências) para o contrato.

## Migração

Nenhuma tabela nova é necessária — `credit_qualifications`, `credit_biometry`, `credit_contracts` e `payables_receivables.credit_contract_id` já existem. Apenas:
- Adicionar `status='completed'` como valor permitido (já é texto livre, sem CHECK).
- Pequeno trigger opcional: ao inserir contrato, dar `current_step = 5`; ao inserir todas as parcelas, `current_step = 6` e `status='completed'`. (Pode ser feito no client; vou no client para simplicidade.)

## Regras de avanço

| De → Para | Condição |
|---|---|
| 1 → 2 | `decision ∈ {approved, manual}` |
| 2 → 3 | linha em `credit_qualifications` com `whatsapp_phone` |
| 3 → 4 | `credit_biometry.status='approved'` (ou override manual gerente) |
| 4 → 5 | contrato criado |
| 5 → 6 | `whatsapp_accepted_at` preenchido (ou aceite manual) |
| 6 → done | parcelas geradas em `payables_receivables` |

Cada passo só fica habilitado depois que o anterior conclui. Voltar a passos anteriores é permitido (somente leitura) exceto para gerente/supervisor que podem reabrir.

## Arquivos a criar/editar

Criar:
- `src/components/credit/steps/QualificationStep.tsx`
- `src/components/credit/steps/BiometryStep.tsx`
- `src/components/credit/steps/SimulationStep.tsx`
- `src/components/credit/steps/ContractStep.tsx`
- `src/components/credit/steps/BoletosStep.tsx`
- `src/components/credit/JourneyStepper.tsx`
- `src/pages/CreditBiometryPublic.tsx`
- `supabase/functions/credit-biometry-analyze/index.ts`

Editar:
- `src/components/credit/CreditApplicationsPage.tsx` (botão Prosseguir, stepper no diálogo)
- `src/App.tsx` (rota pública `/credit/biometry/:token`)
- `src/hooks/useCreditModule.ts` (helpers de avanço/leitura de cada passo)

## Confirmação

Posso prosseguir com este plano? É um escopo grande (≈8 arquivos novos + 1 edge function), então prefiro confirmar antes de executar.
