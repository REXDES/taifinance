ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_financiador boolean NOT NULL DEFAULT false;
ALTER TABLE public.payables_receivables ADD COLUMN IF NOT EXISTS assignment_id uuid;

CREATE TABLE public.financier_cedent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financier_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cedent_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financier_company_id, cedent_company_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financier_cedent_links TO authenticated;
GRANT ALL ON public.financier_cedent_links TO service_role;
ALTER TABLE public.financier_cedent_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcl read" ON public.financier_cedent_links FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_company_access(auth.uid(), financier_company_id) OR public.has_company_access(auth.uid(), cedent_company_id));
CREATE POLICY "fcl supervisor write" ON public.financier_cedent_links FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

CREATE TABLE public.financier_credit_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financier_company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  monthly_discount_rate numeric NOT NULL DEFAULT 3,
  min_days integer NOT NULL DEFAULT 1,
  max_days integer NOT NULL DEFAULT 180,
  min_installments integer NOT NULL DEFAULT 1,
  max_installments integer NOT NULL DEFAULT 24,
  min_title_amount numeric NOT NULL DEFAULT 0,
  max_title_amount numeric,
  limit_per_cedent numeric,
  limit_per_debtor numeric,
  min_score integer,
  requires_invoice boolean NOT NULL DEFAULT true,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financier_credit_rules TO authenticated;
GRANT ALL ON public.financier_credit_rules TO service_role;
ALTER TABLE public.financier_credit_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcr read" ON public.financier_credit_rules FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), financier_company_id) OR EXISTS (
    SELECT 1 FROM public.financier_cedent_links l WHERE l.financier_company_id = financier_credit_rules.financier_company_id AND l.active AND public.has_company_access(auth.uid(), l.cedent_company_id)));
CREATE POLICY "fcr write" ON public.financier_credit_rules FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), financier_company_id)) WITH CHECK (public.has_company_access(auth.uid(), financier_company_id));

CREATE TABLE public.financier_contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financier_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'cessao',
  storage_path text,
  body text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financier_contract_templates TO authenticated;
GRANT ALL ON public.financier_contract_templates TO service_role;
ALTER TABLE public.financier_contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fct read" ON public.financier_contract_templates FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), financier_company_id) OR EXISTS (
    SELECT 1 FROM public.financier_cedent_links l WHERE l.financier_company_id = financier_contract_templates.financier_company_id AND l.active AND public.has_company_access(auth.uid(), l.cedent_company_id)));
CREATE POLICY "fct write" ON public.financier_contract_templates FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), financier_company_id)) WITH CHECK (public.has_company_access(auth.uid(), financier_company_id));

CREATE TABLE public.receivable_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_receivable_id uuid NOT NULL REFERENCES public.payables_receivables(id) ON DELETE CASCADE,
  necta_sale_id uuid,
  cedent_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  financier_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  face_amount numeric NOT NULL,
  discount_rate numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'requested',
  rejection_reason text,
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ra_status_chk CHECK (status IN ('requested','approved','rejected','assigned','paid_by_debtor','settled','settlement_failed','cancelled'))
);
CREATE UNIQUE INDEX ra_active_title ON public.receivable_assignments(payable_receivable_id) WHERE status NOT IN ('rejected','cancelled');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivable_assignments TO authenticated;
GRANT ALL ON public.receivable_assignments TO service_role;
ALTER TABLE public.receivable_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ra read" ON public.receivable_assignments FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), cedent_company_id) OR public.has_company_access(auth.uid(), financier_company_id));
CREATE POLICY "ra cedent insert" ON public.receivable_assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), cedent_company_id) AND status = 'requested' AND EXISTS (
    SELECT 1 FROM public.financier_cedent_links l WHERE l.financier_company_id = receivable_assignments.financier_company_id AND l.cedent_company_id = receivable_assignments.cedent_company_id AND l.active));
CREATE POLICY "ra update parties" ON public.receivable_assignments FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), cedent_company_id) OR public.has_company_access(auth.uid(), financier_company_id));
CREATE TRIGGER ra_updated BEFORE UPDATE ON public.receivable_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.receivable_assignment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES public.receivable_assignments(id) ON DELETE CASCADE,
  payable_receivable_id uuid NOT NULL REFERENCES public.payables_receivables(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'invoice',
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivable_assignment_attachments TO authenticated;
GRANT ALL ON public.receivable_assignment_attachments TO service_role;
ALTER TABLE public.receivable_assignment_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raa read" ON public.receivable_assignment_attachments FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR EXISTS (
    SELECT 1 FROM public.receivable_assignments a WHERE a.payable_receivable_id = receivable_assignment_attachments.payable_receivable_id AND public.has_company_access(auth.uid(), a.financier_company_id)));
CREATE POLICY "raa write" ON public.receivable_assignment_attachments FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id)) WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TABLE public.receivable_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.receivable_assignments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  request_id text,
  success boolean,
  payload jsonb,
  response jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.receivable_assignment_events TO authenticated;
GRANT ALL ON public.receivable_assignment_events TO service_role;
ALTER TABLE public.receivable_assignment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rae read" ON public.receivable_assignment_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.receivable_assignments a WHERE a.id = assignment_id AND (public.has_company_access(auth.uid(), a.cedent_company_id) OR public.has_company_access(auth.uid(), a.financier_company_id))));
CREATE POLICY "rae insert" ON public.receivable_assignment_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.receivable_assignments a WHERE a.id = assignment_id AND (public.has_company_access(auth.uid(), a.cedent_company_id) OR public.has_company_access(auth.uid(), a.financier_company_id))));

CREATE POLICY "antdocs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'anticipation-docs' AND public.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "antdocs insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anticipation-docs' AND public.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "antdocs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'anticipation-docs' AND public.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));