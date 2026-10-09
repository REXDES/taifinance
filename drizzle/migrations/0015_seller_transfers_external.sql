ALTER TABLE public.seller_transfers ALTER COLUMN to_company_id DROP NOT NULL;
ALTER TABLE public.seller_transfers ADD COLUMN IF NOT EXISTS to_seller_id text;
ALTER TABLE public.seller_transfers ADD COLUMN IF NOT EXISTS to_seller_name text;