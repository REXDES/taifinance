ALTER TABLE public.cappta_charges
  ADD COLUMN IF NOT EXISTS boleto_digitable_line text,
  ADD COLUMN IF NOT EXISTS boleto_url text,
  ADD COLUMN IF NOT EXISTS boleto_our_number text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cappta_charges_open
  ON public.cappta_charges (company_id, status)
  WHERE status IN ('pending', 'issued', 'registered');