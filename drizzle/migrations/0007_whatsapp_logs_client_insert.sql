GRANT INSERT ON public.whatsapp_message_logs TO authenticated;

CREATE POLICY "Usuarios registram envios das suas empresas"
  ON public.whatsapp_message_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_supervisor(auth.uid())
    OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id))
  );