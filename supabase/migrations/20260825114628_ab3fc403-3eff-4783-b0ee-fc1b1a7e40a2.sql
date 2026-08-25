ALTER TABLE public.credit_rules
  ADD COLUMN IF NOT EXISTS score_weights jsonb NOT NULL DEFAULT '{"score":35,"probabilidade_pagamento":25,"score_analise":15,"faturas_em_atraso":10,"contratos_recentes":5,"rating":5,"restricoes":5}'::jsonb,
  ADD COLUMN IF NOT EXISTS score_analise_scale_max integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS letter_criteria_mode jsonb NOT NULL DEFAULT '{"classificacao_score":"pontuar","faturas_em_atraso":"pontuar","contratos_recentes":"pontuar","sugestao_negocio":"pontuar"}'::jsonb;