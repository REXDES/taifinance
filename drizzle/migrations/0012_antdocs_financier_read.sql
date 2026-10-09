CREATE POLICY "antdocs financier read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'anticipation-docs'
    AND EXISTS (
      SELECT 1 FROM public.receivable_assignments ra
      WHERE ra.payable_receivable_id = ((storage.foldername(name))[3])::uuid
        AND ra.financier_company_id IN (SELECT public.get_user_company_ids(auth.uid()))
        AND ra.status NOT IN ('rejected', 'cancelled')
    ));