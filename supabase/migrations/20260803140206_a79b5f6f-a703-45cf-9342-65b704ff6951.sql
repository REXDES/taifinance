CREATE TABLE public.statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_format text NOT NULL DEFAULT 'csv',
  bank_name text,
  period_start date,
  period_end date,
  opening_balance numeric,
  closing_balance numeric,
  computed_closing_balance numeric,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.statement_imports TO authenticated;
GRANT ALL ON public.statement_imports TO service_role;
ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage statement imports"
ON public.statement_imports FOR ALL TO authenticated
USING (public.has_company_access(auth.uid(), company_id))
WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER update_statement_imports_updated_at
BEFORE UPDATE ON public.statement_imports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.statement_imports(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  line_index integer NOT NULL DEFAULT 0,
  date date NOT NULL,
  raw_description text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  running_balance numeric,
  external_id text,
  fingerprint text,
  suggested_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  suggested_category_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  suggested_subcategory_id uuid REFERENCES public.transaction_subcategories(id) ON DELETE SET NULL,
  suggested_description text,
  suggestion_source text,
  suggestion_confidence numeric,
  duplicate_of_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  duplicate_reason text,
  status text NOT NULL DEFAULT 'pending',
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  payable_receivable_id uuid REFERENCES public.payables_receivables(id) ON DELETE SET NULL,
  reconciled_at timestamptz,
  reconciled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.statement_lines TO authenticated;
GRANT ALL ON public.statement_lines TO service_role;
ALTER TABLE public.statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage statement lines"
ON public.statement_lines FOR ALL TO authenticated
USING (public.has_company_access(auth.uid(), company_id))
WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER update_statement_lines_updated_at
BEFORE UPDATE ON public.statement_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_statement_lines_import ON public.statement_lines(import_id);
CREATE INDEX idx_statement_lines_company_fp ON public.statement_lines(company_id, fingerprint);
CREATE INDEX idx_statement_imports_company ON public.statement_imports(company_id, created_at DESC);