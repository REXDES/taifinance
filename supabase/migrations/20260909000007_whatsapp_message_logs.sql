-- Replica drizzle/migrations/0006_whatsapp_message_logs.sql e
-- drizzle/migrations/0007_whatsapp_logs_client_insert.sql.

CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
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

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_company_created ON public.whatsapp_message_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created ON public.whatsapp_message_logs (created_at DESC);

GRANT SELECT, INSERT ON public.whatsapp_message_logs TO authenticated;
GRANT ALL ON public.whatsapp_message_logs TO service_role;

ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem logs de whatsapp das suas empresas" ON public.whatsapp_message_logs;
CREATE POLICY "Usuarios veem logs de whatsapp das suas empresas"
ON public.whatsapp_message_logs
FOR SELECT
TO authenticated
USING (
  public.is_supervisor(auth.uid())
  OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id))
);

DROP POLICY IF EXISTS "Usuarios registram envios das suas empresas" ON public.whatsapp_message_logs;
CREATE POLICY "Usuarios registram envios das suas empresas"
  ON public.whatsapp_message_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_supervisor(auth.uid())
    OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id))
  );
