CREATE TABLE public.whatsapp_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL,
  template_name text,
  recipient_name text,
  recipient_phone text NOT NULL,
  description text,
  amount numeric,
  method text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  provider_message_id text,
  response jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_logs_company_created ON public.whatsapp_message_logs (company_id, created_at DESC);
CREATE INDEX idx_whatsapp_logs_created ON public.whatsapp_message_logs (created_at DESC);

GRANT SELECT ON public.whatsapp_message_logs TO authenticated;
GRANT ALL ON public.whatsapp_message_logs TO service_role;

ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem logs de whatsapp das suas empresas"
ON public.whatsapp_message_logs
FOR SELECT
TO authenticated
USING (
  public.is_supervisor(auth.uid())
  OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id))
);