
ALTER TABLE public.credit_rules
  ADD COLUMN IF NOT EXISTS min_score_analise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS use_bureau_limits boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_nivel_confianca_levels jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sugestao_negocio_block_levels jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.credit_applications
  ADD COLUMN IF NOT EXISTS bureau_analysis jsonb;

ALTER TABLE public.credit_consultations
  ADD COLUMN IF NOT EXISTS bureau_analysis jsonb;
