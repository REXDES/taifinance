-- Create audit_logs table for tracking manager actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Supervisors can view all logs
CREATE POLICY "Supervisors can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (is_supervisor(auth.uid()));

-- Gerentes can view logs from their companies
CREATE POLICY "Gerentes can view logs from their companies"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'gerente'::app_role) 
  AND has_company_access(auth.uid(), company_id)
);

-- Users can insert their own logs
CREATE POLICY "Users can insert their own logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);