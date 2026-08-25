
CREATE TABLE public.credit_overridden_criteria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  application_id uuid NOT NULL,
  criterion text NOT NULL,
  criterion_label text,
  actual_value text,
  limit_value text,
  request_reason text,
  decision_notes text,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX credit_overridden_criteria_unique
  ON public.credit_overridden_criteria (application_id, criterion);

CREATE INDEX credit_overridden_criteria_app_idx
  ON public.credit_overridden_criteria (application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_overridden_criteria TO authenticated;
GRANT ALL ON public.credit_overridden_criteria TO service_role;

ALTER TABLE public.credit_overridden_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View overridden criteria in their companies"
ON public.credit_overridden_criteria
FOR SELECT
TO authenticated
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Anyone with company access can request override"
ON public.credit_overridden_criteria
FOR INSERT
TO authenticated
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  AND requested_by = auth.uid()
  AND status = 'pending'
);

CREATE POLICY "Gerentes and supervisors can decide overrides"
ON public.credit_overridden_criteria
FOR UPDATE
TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  AND (is_supervisor(auth.uid()) OR has_role(auth.uid(), 'gerente'::app_role))
)
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  AND (is_supervisor(auth.uid()) OR has_role(auth.uid(), 'gerente'::app_role))
);

CREATE POLICY "Gerentes and supervisors can delete overrides"
ON public.credit_overridden_criteria
FOR DELETE
TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  AND (is_supervisor(auth.uid()) OR has_role(auth.uid(), 'gerente'::app_role))
);

CREATE TRIGGER set_credit_overridden_criteria_updated_at
BEFORE UPDATE ON public.credit_overridden_criteria
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
