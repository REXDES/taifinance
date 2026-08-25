
CREATE TABLE public.machine_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_categories TO authenticated;
GRANT ALL ON public.machine_categories TO service_role;

ALTER TABLE public.machine_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage machine_categories of their companies"
  ON public.machine_categories FOR ALL
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_machine_categories_updated_at
  BEFORE UPDATE ON public.machine_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
