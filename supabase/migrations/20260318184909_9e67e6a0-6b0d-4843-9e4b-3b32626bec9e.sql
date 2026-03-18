
CREATE TABLE public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  account_id text,
  agency text,
  account_number text,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage bank connections in their companies"
ON public.bank_connections
FOR ALL TO authenticated
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can view bank connections in their companies"
ON public.bank_connections
FOR SELECT TO authenticated
USING (has_company_access(auth.uid(), company_id));

CREATE TRIGGER update_bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
