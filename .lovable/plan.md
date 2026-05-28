# Reformulação da régua de crédito

## 1. Probabilidade de inadimplência (escala 1–100)

A escala correta do bureau é o **percentual de inadimplência** (1 = melhor pagador, 100 = pior). O valor 9 significa 9% de risco — daí o texto "91% pagarão os próximos 6 meses".

- **Edge function `credit-consult`**: deixar de arredondar o valor para 1–9; preservar inteiro 1–100 (ex.: "9,00" → 9, "12,5" → 13). Manter parser de vírgula.
- **Lógica de bloqueio**: rejeitar quando `probabilidade_inadimplencia > max_probabilidade_inadimplencia` (o admin define o **máximo de risco aceito**, ex.: 30 = aceita até 30%).
- **`useCreditModule.ts`**:
  - `toPaymentProbability` agora retorna **probabilidade de pagamento** = `100 - inadimplencia` (para exibição amigável).
  - `DEFAULT_RULES.max_probabilidade_inadimplencia = 30`.
- **`CreditAdminPage.tsx`**: input passa a ser "Máx. probabilidade de inadimplência (%)" com slider/input 1–100.
- **`PaymentProbabilityBadge.tsx`**: exibir tanto `X% inadimplência` quanto `(100-X)% pagamento`, com cores invertidas (≤10 verde, ≥50 vermelho).
- **Migração de dados**: registros antigos já estão em valores baixos (1–9); manter como está — passam a ser interpretados como "1%–9% risco" (excelentes pagadores), o que é coerente.

## 2. Score médio (rating + análise + score)

O bureau devolve três scores distintos: `score_rating`, `score_analise` e `score` (genérico). Hoje só `score` rege a régua.

- **Edge function**: extrair os três do `summary` / `principal` / `bureau_analysis`. Calcular `score_medio = round((s1 + s2 + s3) / n)` ignorando ausentes.
- **Persistência**: gravar `score_breakdown: { rating, analise, score, media }` em `credit_applications.bureau_analysis` (já é jsonb — sem migração).
- **Régua (`score_bands`)**: passa a aplicar-se sobre `score_medio`.
- **UI da proposta**: card mostrando os três valores individuais + média destacada.

## 3. Novos parâmetros de corte A–E no robô

Para cada campo abaixo, o admin define a **pior letra aceita** (A é melhor, E pior). Tudo acima da letra escolhida bloqueia.

| Campo bureau | Significado A → E | Default |
|---|---|---|
| `classificacao_score` | A ótimo → E péssimo | C |
| `faturas_em_atraso` | A pontual → E muito mau pagador | C |
| `contratos_recentes` | A relacionamento recente → E sem relacionamento | E |

- **Migração**: adicionar 3 colunas em `credit_rules`:
  - `max_classificacao_score text default 'C'`
  - `max_faturas_em_atraso text default 'C'`
  - `max_contratos_recentes text default 'E'`
- **Edge function**: parser pega a letra de cada campo do bureau (regex inicial A-E) e compara ordinalmente (`A<B<C<D<E`). Se exceder o máximo configurado, knockout com motivo claro.
- **`CreditAdminPage.tsx`**: 3 selects A–E na aba **Motor**.

## 4. `sugestao_negocio` dinâmica

Hoje é lista fixa de buckets. Passar a interpretar dinamicamente a frase recebida via heurística + bucket persistido:

- **Edge function**: já existe `sugestao_de_negocio_bucket` (`recomendar` / `recomendar_com_cautela` / `nao_recomendar`). Reaproveitar — mas mapear qualquer texto novo via palavras-chave (`recomendar`, `cautela`/`ressalva`, `não recomendar`/`negar`) e fallback `desconhecido`.
- **Admin**: substituir `sugestao_negocio_block_levels` por **3 checkboxes** com label dinâmico (todos os buckets já vistos + os 3 padrões), marcando quais BLOQUEIAM.
- O texto original sempre é exibido na proposta para auditoria.

## 5. Auto-preenchimento da qualificação via endereço

O bureau retorna `endereco`, `cep`, `cidade`, `uf` no `principal` (PF/PJ).

- **`QualificationStep.tsx`**: ao montar (ou após consulta), se `credit_consultations.summary.endereco_*` existir e os campos da qualificação ainda estiverem vazios, pré-preencher `endereco_entrega`, `cep`, `cidade`, `uf`. Usuário pode editar.
- Sem migração — usa colunas existentes em `credit_qualifications`.

## Arquivos afetados

- `supabase/functions/credit-consult/index.ts` (parser, scores, knockouts, breakdown)
- `src/hooks/useCreditModule.ts` (tipos, defaults, `toPaymentProbability`)
- `src/components/credit/CreditAdminPage.tsx` (aba Motor: novos campos)
- `src/components/credit/PaymentProbabilityBadge.tsx` (escala 1–100)
- `src/components/credit/BureauAnalysisCard.tsx` (mostrar 3 scores + média)
- `src/components/credit/steps/QualificationStep.tsx` (auto-preencher endereço)
- Migração: adicionar 3 colunas em `credit_rules`

## Observação técnica

Não vou rodar nova migração nos dados existentes de `probabilidade_inadimplencia` — os valores baixos (1–9) já fazem sentido na nova escala (= risco baixo, bons pagadores). Apenas novas consultas usarão o range completo 1–100.
