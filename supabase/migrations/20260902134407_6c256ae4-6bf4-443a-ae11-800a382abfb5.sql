CREATE TABLE public.necta_seller_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid,
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.necta_establishments(id) ON DELETE CASCADE,
  necta_seller_id text NOT NULL,
  token_id text,
  token_name text,
  client_secret text NOT NULL,
  secret_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.necta_seller_credentials TO service_role;

ALTER TABLE public.necta_seller_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages seller credentials"
ON public.necta_seller_credentials FOR ALL
TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_necta_seller_credentials_updated_at
BEFORE UPDATE ON public.necta_seller_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.necta_establishments
  ADD COLUMN IF NOT EXISTS has_charge_credentials boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS charge_credentials_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS imported_from_necta boolean NOT NULL DEFAULT false;