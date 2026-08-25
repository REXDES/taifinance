ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS rental_price_daily numeric,
  ADD COLUMN IF NOT EXISTS rental_price_weekly numeric,
  ADD COLUMN IF NOT EXISTS rental_price_monthly numeric;