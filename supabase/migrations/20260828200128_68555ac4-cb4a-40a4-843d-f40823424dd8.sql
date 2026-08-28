ALTER TABLE public.necta_sales
  ADD COLUMN IF NOT EXISTS payer_address_street text,
  ADD COLUMN IF NOT EXISTS payer_address_number text,
  ADD COLUMN IF NOT EXISTS payer_address_complement text,
  ADD COLUMN IF NOT EXISTS payer_address_neighborhood text,
  ADD COLUMN IF NOT EXISTS payer_address_city text,
  ADD COLUMN IF NOT EXISTS payer_address_state text,
  ADD COLUMN IF NOT EXISTS payer_address_postal_code text,
  ADD COLUMN IF NOT EXISTS necta_buyer_id text,
  ADD COLUMN IF NOT EXISTS status_reference text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;