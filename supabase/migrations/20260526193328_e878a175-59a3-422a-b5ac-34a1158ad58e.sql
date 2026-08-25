ALTER TABLE public.credit_consultations ADD COLUMN IF NOT EXISTS pdf_data text;
ALTER TABLE public.credit_applications ADD COLUMN IF NOT EXISTS probabilidade_inadimplencia integer;
ALTER TABLE public.credit_applications ADD COLUMN IF NOT EXISTS texto_score_bucket text;