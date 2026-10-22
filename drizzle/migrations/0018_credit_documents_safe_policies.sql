DROP POLICY IF EXISTS "Users view credit-documents in their companies" ON storage.objects;
CREATE POLICY "Users view credit-documents in their companies" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'credit-documents' AND (
  CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    THEN public.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  WHEN (storage.foldername(name))[1] = 'biometry'
    THEN EXISTS (SELECT 1 FROM public.credit_biometry b WHERE b.id::text = (storage.foldername(name))[3] AND public.has_company_access(auth.uid(), b.company_id))
  ELSE false END));
DROP POLICY IF EXISTS "Users delete credit-documents in their companies" ON storage.objects;
CREATE POLICY "Users delete credit-documents in their companies" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'credit-documents' AND (
  CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    THEN public.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  WHEN (storage.foldername(name))[1] = 'biometry'
    THEN EXISTS (SELECT 1 FROM public.credit_biometry b WHERE b.id::text = (storage.foldername(name))[3] AND public.has_company_access(auth.uid(), b.company_id))
  ELSE false END));