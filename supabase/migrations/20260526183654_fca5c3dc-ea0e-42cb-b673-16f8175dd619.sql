
ALTER TABLE public.credit_rules
  ADD COLUMN IF NOT EXISTS bolsa_familia_block boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_dependentes_bolsa_familia integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_probabilidade_inadimplencia integer NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS texto_inadimplencia_block_levels jsonb NOT NULL DEFAULT '[]'::jsonb;
