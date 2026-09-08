CREATE TABLE public.necta_company_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  token_name text,
  client_secret text NOT NULL,
  secret_key text NOT NULL,
  validated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.necta_company_credentials TO service_role;
ALTER TABLE public.necta_company_credentials ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_necta_company_credentials_updated BEFORE UPDATE ON public.necta_company_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS necta_credentials_at timestamptz;