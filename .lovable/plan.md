# Equilíbrio entre situação atual e vida pregressa no crédito

## O que realmente aconteceu com o CPF 342.301.898-42

Consultei a proposta e as regras da empresa no banco. Os pesos **foram aplicados**: o score final ponderado gravado é **552 pontos** (não é mais a média simples de 73). Ou seja, a parte de pesos funcionou.

A recusa atual vem de outro lugar: nas regras da empresa está configurado **"Score analítico mínimo = 450"**, e o bureau devolveu **score_analise = 125**. Esse critério hoje é **veto duro**, então ele derruba a proposta antes de a régua de faixas decidir. O motivo gravado é exatamente: *"Score analítico do bureau 125 abaixo do mínimo (450)"*.

Dois problemas práticos nisso:

1. O corte de 450 está na escala do `score_analise` (0–500), mas foi preenchido como se fosse escala de score geral (0–1000). Com 450 de mínimo, praticamente todo cliente é recusado por vida pregressa.
2. Sendo veto duro, ele mascara o score ponderado de 552 — que, na régua atual, cairia em **aprovado com 60% do teto**.

A tela de **Crédito → Regras** já tem a seção "Pesos do score final" (score do bureau 35%, probabilidade de pagamento 25%, score de análise 15%, faturas 10%, contratos 5%, rating 5%, restrições 5%). Ela existe, mas é uma lista de sete sliders soltos — não deixa claro o que é *situação atual* e o que é *vida pregressa*, que é justamente o controle que você quer.

## O que sugiro

### 1. Postura de análise (o controle principal)
No topo das regras, um seletor com quatro opções:

| Postura | Situação atual (Serasa/score + probabilidade de pagamento) | Vida pregressa (score de análise, faturas, contratos, rating, restrições) |
|---|---|---|
| Foco na situação atual | 80% | 20% |
| Balanceado (sugerido) | 50% | 50% |
| Foco na vida pregressa | 20% | 80% |
| Personalizado | slider livre | slider livre |

Um único slider "Atual ⟷ Pregressa" distribui o peso entre os dois blocos; dentro de cada bloco os pesos finos continuam editáveis (recolhidos em "Ajuste avançado"), com soma normalizada automaticamente. Sinal ausente na resposta sai do cálculo e o peso é redistribuído.

Com **Balanceado** neste CPF: situação atual puxa para cima (score 440, 91% de probabilidade de pagamento), vida pregressa puxa para baixo (score de análise 125, faturas em atraso E/D, rating E) — o score final cai na faixa de **análise manual**, que é exatamente o desfecho que você descreveu como correto.

### 2. Score de análise deixa de ser veto por padrão
"Score analítico mínimo" passa a ter, como os critérios de letra, a opção **pontuar (padrão) ou bloquear**. Em "pontuar", ele entra no bloco de vida pregressa em vez de recusar sozinho. O corte é corrigido para a escala real do campo (0–500), com aviso na tela quando o valor digitado passa da escala configurada.

### 3. Score de rating vira confiança da informação
`score_rating` (20 aqui) para de tentar virar pontuação e passa a ser **grau de confiança do rating**: quanto menor, menor o peso que o rating tem no bloco de vida pregressa, e a proposta ganha um selo "informação de rating pouco confiável" no checklist. Assim um rating E fraco em evidência não afunda sozinho o cliente.

### 4. Impacto em limite e prazo
O score ponderado continua sendo o número que entra na régua de faixas, que define decisão, **% do teto** e **número máximo de parcelas**. Acrescento na régua um ajuste opcional por postura: quando a vida pregressa está pior que a situação atual, aplicar um **fator de redução configurável** (ex.: −30% no limite e −50% no prazo) em vez de recusar. Cliente "bom presente, histórico ruim" entra com limite e prazo menores, o que é o comportamento comercialmente correto.

### 5. Transparência
No card "Análise do bureau": duas barras — Situação atual X pts / Vida pregressa Y pts — e o resultado ponderado. No checklist de decisão, o bloco "Sinais contraditórios" já previsto, agora nomeando o lado que puxou cada ponto.

### 6. Reprocessar esta proposta
Depois de ajustar as regras (corte de score de análise para "pontuar" e postura Balanceado), uso **Reavaliar** nesta proposta, sem nova cobrança, para que ela passe de recusada a **análise manual** com limite e prazo calculados.

## Detalhes técnicos

- Migração em `credit_rules`: `analysis_stance` (text: `atual` | `balanceado` | `pregressa` | `custom`), `stance_current_weight` (int, default 50), `score_analise_mode` (text: `pontuar` | `bloquear`, default `pontuar`), `adverse_history_limit_factor` e `adverse_history_term_factor` (numeric). Correção de dado: `min_score_analise` de 450 → valor coerente com a escala 0–500 na empresa afetada.
- `supabase/functions/credit-consult/index.ts`: agrupar os sinais em `CURRENT_SIGNALS` / `HISTORY_SIGNALS`, aplicar a distribuição da postura antes dos pesos finos em `computeWeightedScore`; tornar `min_score_analise` condicional a `score_analise_mode`; ponderar o sinal `rating` por `score_rating`; aplicar os fatores de redução de limite/prazo após a escolha da faixa; devolver `score_breakdown.blocks`.
- `src/hooks/useCreditModule.ts`: novos campos em `CreditRules` + defaults; tipos `ScoreBlock` em `ScoreBreakdown`.
- `src/components/credit/CreditAdminPage.tsx`: seletor de postura + slider Atual/Pregressa, "Ajuste avançado" recolhível, modo do score analítico, validação de escala.
- `src/components/credit/BureauAnalysisCard.tsx` e `EngineChecklist.tsx`: barras por bloco, selo de confiança do rating, bloco de sinais contraditórios.
