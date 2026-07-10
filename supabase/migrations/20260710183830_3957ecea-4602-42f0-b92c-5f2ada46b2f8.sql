
-- ENUMS
CREATE TYPE public.split_scope AS ENUM ('global','category','client_supplier','tag');
CREATE TYPE public.split_value_type AS ENUM ('percent','fixed');
CREATE TYPE public.split_status AS ENUM ('pending','executed','failed');

-- 1) split_recipients
CREATE TABLE public.split_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  pix_key TEXT NOT NULL,
  pix_key_type TEXT NOT NULL,
  bank_name TEXT,
  bank_branch TEXT,
  bank_account TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.split_recipients TO authenticated;
GRANT ALL ON public.split_recipients TO service_role;
ALTER TABLE public.split_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "split_recipients_company_access" ON public.split_recipients
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE INDEX idx_split_recipients_company ON public.split_recipients(company_id);
CREATE TRIGGER trg_split_recipients_updated_at
  BEFORE UPDATE ON public.split_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) split_rules
CREATE TABLE public.split_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.split_recipients(id) ON DELETE CASCADE,
  scope public.split_scope NOT NULL DEFAULT 'global',
  scope_ref_id UUID,
  value_type public.split_value_type NOT NULL DEFAULT 'percent',
  value NUMERIC(14,4) NOT NULL CHECK (value >= 0),
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.split_rules TO authenticated;
GRANT ALL ON public.split_rules TO service_role;
ALTER TABLE public.split_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "split_rules_company_access" ON public.split_rules
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE INDEX idx_split_rules_company ON public.split_rules(company_id);
CREATE INDEX idx_split_rules_recipient ON public.split_rules(recipient_id);
CREATE INDEX idx_split_rules_scope ON public.split_rules(scope, scope_ref_id);
CREATE TRIGGER trg_split_rules_updated_at
  BEFORE UPDATE ON public.split_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) pix_charge_splits
CREATE TABLE public.pix_charge_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payable_receivable_id UUID NOT NULL REFERENCES public.payables_receivables(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.split_recipients(id) ON DELETE RESTRICT,
  rule_id UUID REFERENCES public.split_rules(id) ON DELETE SET NULL,
  manual BOOLEAN NOT NULL DEFAULT false,
  value_type public.split_value_type NOT NULL,
  value NUMERIC(14,4) NOT NULL,
  calculated_amount NUMERIC(14,2) NOT NULL,
  status public.split_status NOT NULL DEFAULT 'pending',
  psp_reference TEXT,
  executed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pix_charge_splits TO authenticated;
GRANT ALL ON public.pix_charge_splits TO service_role;
ALTER TABLE public.pix_charge_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pix_charge_splits_company_access" ON public.pix_charge_splits
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE INDEX idx_pix_charge_splits_pr ON public.pix_charge_splits(payable_receivable_id);
CREATE INDEX idx_pix_charge_splits_recipient ON public.pix_charge_splits(recipient_id);
CREATE TRIGGER trg_pix_charge_splits_updated_at
  BEFORE UPDATE ON public.pix_charge_splits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
