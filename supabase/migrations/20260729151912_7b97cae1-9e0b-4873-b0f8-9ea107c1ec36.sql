ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS paid_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS has_travel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS travel_vehicle_id uuid REFERENCES public.machines(id),
  ADD COLUMN IF NOT EXISTS travel_km numeric,
  ADD COLUMN IF NOT EXISTS travel_notes text;