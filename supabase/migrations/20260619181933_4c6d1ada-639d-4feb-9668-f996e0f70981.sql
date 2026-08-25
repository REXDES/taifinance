
-- Tabela de Tags (independente da árvore de categorias)
CREATE TABLE public.finance_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tags TO authenticated;
GRANT ALL ON public.finance_tags TO service_role;

ALTER TABLE public.finance_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access tags of their companies"
  ON public.finance_tags FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_finance_tags_updated_at
  BEFORE UPDATE ON public.finance_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_finance_tags_company ON public.finance_tags(company_id);

-- Junction: transações <-> tags
CREATE TABLE public.transaction_tags (
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.finance_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, tag_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_tags TO authenticated;
GRANT ALL ON public.transaction_tags TO service_role;

ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access transaction_tags via company"
  ON public.transaction_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND public.has_company_access(auth.uid(), t.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND public.has_company_access(auth.uid(), t.company_id)));

CREATE INDEX idx_transaction_tags_tag ON public.transaction_tags(tag_id);

-- Junction: contas a pagar/receber <-> tags
CREATE TABLE public.payable_receivable_tags (
  payable_receivable_id uuid NOT NULL REFERENCES public.payables_receivables(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.finance_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payable_receivable_id, tag_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payable_receivable_tags TO authenticated;
GRANT ALL ON public.payable_receivable_tags TO service_role;

ALTER TABLE public.payable_receivable_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access payable_receivable_tags via company"
  ON public.payable_receivable_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payables_receivables p WHERE p.id = payable_receivable_id AND public.has_company_access(auth.uid(), p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.payables_receivables p WHERE p.id = payable_receivable_id AND public.has_company_access(auth.uid(), p.company_id)));

CREATE INDEX idx_pr_tags_tag ON public.payable_receivable_tags(tag_id);

-- Junction: transferências <-> tags
CREATE TABLE public.transfer_tags (
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.finance_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transfer_id, tag_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfer_tags TO authenticated;
GRANT ALL ON public.transfer_tags TO service_role;

ALTER TABLE public.transfer_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access transfer_tags via company"
  ON public.transfer_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND public.has_company_access(auth.uid(), t.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transfers t WHERE t.id = transfer_id AND public.has_company_access(auth.uid(), t.company_id)));

CREATE INDEX idx_transfer_tags_tag ON public.transfer_tags(tag_id);
