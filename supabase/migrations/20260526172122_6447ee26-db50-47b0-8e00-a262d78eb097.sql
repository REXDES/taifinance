
CREATE TABLE public.credit_ignored_occurrences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  application_id uuid,
  documento text NOT NULL,
  occurrence_key text NOT NULL,
  category text NOT NULL,
  titulo text,
  descricao text,
  raw_record jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  request_reason text,
  decision_notes text,
  requested_by uuid,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_cio_lookup ON public.credit_ignored_occurrences (company_id, documento, status);
CREATE UNIQUE INDEX uq_cio_pending_or_approved ON public.credit_ignored_occurrences (company_id, documento, occurrence_key)
  WHERE status IN ('pending','approved');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_ignored_occurrences TO authenticated;
GRANT ALL ON public.credit_ignored_occurrences TO service_role;

ALTER TABLE public.credit_ignored_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View ignored occurrences in their companies"
ON public.credit_ignored_occurrences
FOR SELECT
TO authenticated
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Anyone with company access can request ignore"
ON public.credit_ignored_occurrences
FOR INSERT
TO authenticated
WITH CHECK (
  has_company_access(auth.uid(), company_id)
  AND requested_by = auth.uid()
  AND status = 'pending'
);

CREATE POLICY "Gerentes and supervisors can decide ignore requests"
ON public.credit_ignored_occurrences
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

CREATE POLICY "Gerentes and supervisors can delete ignore requests"
ON public.credit_ignored_occurrences
FOR DELETE
TO authenticated
USING (
  has_company_access(auth.uid(), company_id)
  AND (is_supervisor(auth.uid()) OR has_role(auth.uid(), 'gerente'::app_role))
);

CREATE TRIGGER trg_cio_updated_at
BEFORE UPDATE ON public.credit_ignored_occurrences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
