-- Conta espelho da Necta + memória de categorização

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_mirror boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS necta_account_id uuid;

CREATE TABLE IF NOT EXISTS public.necta_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  necta_entry_id text NOT NULL,
  entry_type text NOT NULL DEFAULT 'settlement',
  date date NOT NULL,
  description text NOT NULL DEFAULT '',
  counterparty text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'in',
  necta_sale_id uuid REFERENCES public.necta_sales(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.transaction_subcategories(id) ON DELETE SET NULL,
  category_source text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_ledger_entries TO authenticated;
GRANT ALL ON public.necta_ledger_entries TO service_role;
ALTER TABLE public.necta_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "necta_ledger_company_access" ON public.necta_ledger_entries
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE UNIQUE INDEX IF NOT EXISTS necta_ledger_entries_unique
  ON public.necta_ledger_entries (company_id, necta_entry_id);
CREATE INDEX IF NOT EXISTS necta_ledger_entries_account_date
  ON public.necta_ledger_entries (account_id, date);

CREATE TRIGGER trg_necta_ledger_entries_updated
  BEFORE UPDATE ON public.necta_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.finance_categorization_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'ledger',
  pattern text NOT NULL,
  category_id uuid REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
  subcategory_id uuid REFERENCES public.transaction_subcategories(id) ON DELETE SET NULL,
  tag_ids uuid[] NOT NULL DEFAULT '{}',
  hits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categorization_memory TO authenticated;
GRANT ALL ON public.finance_categorization_memory TO service_role;
ALTER TABLE public.finance_categorization_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_memory_company_access" ON public.finance_categorization_memory
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE UNIQUE INDEX IF NOT EXISTS finance_categorization_memory_unique
  ON public.finance_categorization_memory (company_id, scope, pattern);

CREATE TRIGGER trg_finance_categorization_memory_updated
  BEFORE UPDATE ON public.finance_categorization_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_necta_mirror_account(_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group_id uuid;
  _account_id uuid;
BEGIN
  SELECT id INTO _account_id
  FROM public.accounts
  WHERE company_id = _company_id AND source = 'necta'
  LIMIT 1;

  IF _account_id IS NULL THEN
    SELECT id INTO _group_id
    FROM public.account_groups
    WHERE company_id = _company_id AND type = 'ativo'
    ORDER BY created_at
    LIMIT 1;

    IF _group_id IS NULL THEN
      INSERT INTO public.account_groups (company_id, name, type, color)
      VALUES (_company_id, 'Ativo', 'ativo', '#3B82F6')
      RETURNING id INTO _group_id;
    END IF;

    INSERT INTO public.accounts (
      company_id, group_id, name, description,
      initial_balance, current_balance, color, source, is_mirror
    )
    VALUES (
      _company_id, _group_id, 'Conta Necta',
      'Conta espelho: saldo e movimentações vindos da Necta.',
      0, 0, '#0EA5E9', 'necta', true
    )
    RETURNING id INTO _account_id;
  END IF;

  UPDATE public.companies SET necta_account_id = _account_id WHERE id = _company_id;
  RETURN _account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_necta_mirror_account(uuid) TO authenticated, service_role;