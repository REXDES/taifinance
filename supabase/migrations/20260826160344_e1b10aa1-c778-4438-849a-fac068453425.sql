ALTER TABLE public.credit_rules
  ADD COLUMN IF NOT EXISTS analysis_stance text NOT NULL DEFAULT 'balanceado',
  ADD COLUMN IF NOT EXISTS stance_current_weight integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS score_analise_mode text NOT NULL DEFAULT 'pontuar',
  ADD COLUMN IF NOT EXISTS adverse_history_limit_factor numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS adverse_history_term_factor numeric NOT NULL DEFAULT 1.0;

COMMENT ON COLUMN public.credit_rules.analysis_stance IS 'Postura de análise: atual | balanceado | pregressa | custom';
COMMENT ON COLUMN public.credit_rules.stance_current_weight IS 'Peso (0..100) da situação atual quando analysis_stance = custom';
COMMENT ON COLUMN public.credit_rules.score_analise_mode IS 'pontuar (default) ou bloquear para o corte de score_analise';
COMMENT ON COLUMN public.credit_rules.adverse_history_limit_factor IS 'Fator de redução do limite quando vida pregressa < situação atual (1.0 = sem redução)';
COMMENT ON COLUMN public.credit_rules.adverse_history_term_factor IS 'Fator de redução do prazo quando vida pregressa < situação atual (1.0 = sem redução)';

-- Corrige o corte de score_analise=450 (escala 0-500) que bloqueava praticamente todo cliente
UPDATE public.credit_rules SET min_score_analise = 0 WHERE min_score_analise >= 400;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_rules TO authenticated;
GRANT ALL ON public.credit_rules TO service_role;