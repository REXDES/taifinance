ALTER TABLE public.necta_establishments
  ADD COLUMN IF NOT EXISTS person_type text NOT NULL DEFAULT 'PJ',
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_own_profile boolean NOT NULL DEFAULT false;

UPDATE public.necta_establishments SET is_own_profile = true WHERE is_own_profile = false;