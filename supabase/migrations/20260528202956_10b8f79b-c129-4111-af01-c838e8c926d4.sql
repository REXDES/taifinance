ALTER TABLE public.credit_rules
  ADD COLUMN IF NOT EXISTS max_classificacao_score text NOT NULL DEFAULT 'C',
  ADD COLUMN IF NOT EXISTS max_faturas_em_atraso text NOT NULL DEFAULT 'C',
  ADD COLUMN IF NOT EXISTS max_contratos_recentes text NOT NULL DEFAULT 'E',
  ADD COLUMN IF NOT EXISTS sugestao_negocio_block_buckets jsonb NOT NULL DEFAULT '["nao_recomendar"]'::jsonb;

ALTER TABLE public.credit_rules ALTER COLUMN max_probabilidade_inadimplencia SET DEFAULT 30;
UPDATE public.credit_rules SET max_probabilidade_inadimplencia = 30 WHERE max_probabilidade_inadimplencia <= 9;