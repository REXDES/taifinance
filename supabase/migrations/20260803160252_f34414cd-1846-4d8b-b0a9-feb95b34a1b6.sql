ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS reconciliation_tolerance numeric(12,2) NOT NULL DEFAULT 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'Users can manage accounts in their companies'
  ) THEN
    CREATE POLICY "Users can manage accounts in their companies"
    ON public.accounts FOR ALL
    TO authenticated
    USING (public.has_company_access(auth.uid(), company_id))
    WITH CHECK (public.has_company_access(auth.uid(), company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'Users can view accounts in their companies'
  ) THEN
    CREATE POLICY "Users can view accounts in their companies"
    ON public.accounts FOR SELECT
    TO authenticated
    USING (public.has_company_access(auth.uid(), company_id));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.update_accounts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_accounts_updated_at();