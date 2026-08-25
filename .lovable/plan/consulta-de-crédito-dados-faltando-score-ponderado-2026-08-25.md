# Consulta de crédito: dados faltando + score ponderado

## O que aconteceu na consulta do CPF 342.301.898-42

Ao inspecionar a resposta gravada dessa consulta, encontrei duas causas distintas.

**1. Nome e endereço existem na resposta, mas o app não os leu.**
O provedor devolveu a resposta dentro de um envelope `data: [ { RedeBE: ... } ]`. O código só sabe abrir dois formatos (`RedeBE` na raiz, ou `data.RedeBE` como objeto) — como aqui `data` é uma lista, o bloco inteiro do resumo foi perdido. Resultado: o nome ("FELIPE INACIO DE OLIVEIRA"), o endereço (R Fabio Carlos Cassano 14, Boituva/SP), telefone, renda presumida, rating "E", `possui_restricao: false` e os contadores de protestos/pendências não chegaram ao motor. Só sobraram os campos que a busca profunda de emergência conseguiu resgatar.

**2. A média simples dos três scores gerou um número sem sentido.**
O bureau devolveu score 440 (escala 0–1000), score_analise 125 e score_rating 20 — três escalas diferentes. A média aritmética deu 73, que caiu na pior faixa da régua e recusou a proposta. Foi isso, e não o risco real, que produziu "Score médio 73 abaixo da faixa mínima".

Sobre a aparente contradição: ela é normal. O bureau usou "Negociação aprovada" apenas como resultado de fluxo, enquanto a observação diz "Score insuficiente para sugestão de crédito" e o rating "E" descreve histórico. Ao mesmo tempo, não há restrição ativa e a probabilidade de pagamento é 91%. Ou seja: **bom presente, histórico ruim**. O caminho é parar de tratar cada campo como veto isolado e passar a pontuar tudo com pesos.

## O que será feito

### 1. Corrigir a leitura da resposta
- Aceitar `data` como lista (`data[0].RedeBE`), além dos formatos atuais, e procurar o bloco `resumo`/`retorno` em qualquer profundidade como último recurso.
- Com isso voltam: nome, endereço, telefone, renda presumida, rating, faixa de score e todos os contadores — inclusive o preenchimento automático da Qualificação.

### 2. Score final ponderado (substitui a média simples)
Cada sinal é normalizado para 0–100 e combinado por pesos configuráveis por empresa:

| Sinal | Normalização | Peso sugerido |
|---|---|---|
| Score do bureau (0–1000) | valor / 10 | 35% |
| Probabilidade de pagamento (100 − inadimplência) | direto | 25% |
| Score de análise | pela escala real do provedor (0–500) | 15% |
| Faturas em atraso (A–E) | A=100 … E=0 | 10% |
| Contratos recentes (A–E) | A=100 … E=0 | 5% |
| Rating / descrição de rating (A–E) | A=100 … E=0 | 5% |
| Restrições ativas (protestos, pendências, CCF) | 100 sem ocorrência, decai por ocorrência | 5% |

- Pesos editáveis em Crédito → Regras, com soma normalizada automaticamente (se o usuário zerar um sinal, ele sai do cálculo).
- Sinais ausentes na resposta são excluídos e os pesos redistribuídos, em vez de contar como zero.
- O score final é o número usado na régua de faixas (`score_bands`), decidindo aprovado / manual / recusado e o % do teto.

### 3. Vetos vs. pesos
- Ficam como veto duro (knockout) apenas: restrições ativas acima do limite, protestos, CCF, pendências, idade mínima, inadimplência interna e o corte de probabilidade de inadimplência.
- Letras (faturas em atraso, contratos recentes, classificação) e sugestão de negócio passam a ter, na tela de regras, a opção **"pontuar" (padrão) ou "bloquear"**. Assim um cliente E em faturas mas sem restrição e com 91% de probabilidade de pagamento cai em análise manual em vez de recusa automática.
- Todo veto continua elegível a alçada, como hoje.

### 4. Transparência na tela
- O card "Análise do bureau" passa a mostrar a composição do score final: cada sinal, seu valor normalizado, o peso e a contribuição em pontos.
- O checklist de decisão ganha um bloco "Sinais contraditórios", listando lado a lado o que pesou a favor e contra, com a leitura final (ex.: "sem restrição ativa e 91% de probabilidade de pagamento vs. histórico rating E").

### 5. Reprocessar a consulta atual
A proposta desse CPF será reavaliada com os dados já pagos (via "Reavaliar", sem nova cobrança), passando a exibir nome, endereço e o score ponderado.

## Detalhes técnicos

- `supabase/functions/credit-consult/index.ts`: corrigir o unwrap do envelope; substituir `buildScoreBreakdown` (média simples) por `computeWeightedScore` com pesos e normalizadores; tornar os cortes de letras/sugestão configuráveis entre penalidade e knockout; retornar o detalhamento dos pesos em `bureau_analysis.score_breakdown`.
- Migração em `credit_rules`: `score_weights` (jsonb), `score_analise_scale_max` (int, default 500), `letter_criteria_mode` (jsonb: `pontuar` | `bloquear` por critério).
- `src/hooks/useCreditModule.ts`: novos campos em `CreditRules`/`ScoreBreakdown` e defaults.
- `src/components/credit/CreditAdminPage.tsx`: seção "Pesos do score" com sliders e modo por critério.
- `src/components/credit/BureauAnalysisCard.tsx` e `EngineChecklist.tsx`: exibir a composição ponderada e o bloco de sinais contraditórios.
