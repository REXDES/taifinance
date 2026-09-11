CREATE TABLE public.necta_homologation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.necta_establishments(id) ON DELETE CASCADE,
  public_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'waiting_client' CHECK (status IN ('draft','waiting_client','ready','submitted','under_review','approved','rejected','expired')),
  client_completed_at timestamptz,
  submitted_at timestamptz,
  last_opened_at timestamptz,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_homologation_requests TO authenticated;
GRANT ALL ON public.necta_homologation_requests TO service_role;
ALTER TABLE public.necta_homologation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_homologation_requests_company_access" ON public.necta_homologation_requests FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE INDEX idx_necta_homologation_requests_company ON public.necta_homologation_requests(company_id, status);
CREATE TRIGGER trg_necta_homologation_requests_updated BEFORE UPDATE ON public.necta_homologation_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.necta_homologation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.necta_homologation_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.necta_establishments(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('SELFIE','IDENTIFICATION_DOCUMENT')),
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','application/pdf')),
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','sent','accepted','rejected')),
  necta_response jsonb,
  rejection_reason text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_homologation_documents TO authenticated;
GRANT ALL ON public.necta_homologation_documents TO service_role;
ALTER TABLE public.necta_homologation_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_homologation_documents_company_access" ON public.necta_homologation_documents FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE INDEX idx_necta_homologation_documents_request ON public.necta_homologation_documents(request_id);

CREATE TABLE public.necta_homologation_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.necta_homologation_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.necta_establishments(id) ON DELETE CASCADE,
  term_slug text NOT NULL,
  term_version text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, term_slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_homologation_terms TO authenticated;
GRANT ALL ON public.necta_homologation_terms TO service_role;
ALTER TABLE public.necta_homologation_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_homologation_terms_company_access" ON public.necta_homologation_terms FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE INDEX idx_necta_homologation_terms_request ON public.necta_homologation_terms(request_id);

CREATE POLICY "necta_homologation_storage_authenticated_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'necta-homologation-documents' AND public.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "necta_homologation_storage_service" ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'necta-homologation-documents')
  WITH CHECK (bucket_id = 'necta-homologation-documents');