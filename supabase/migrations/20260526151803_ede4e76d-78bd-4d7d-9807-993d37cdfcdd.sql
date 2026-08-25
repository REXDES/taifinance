
-- 1. Toggle do módulo na tabela companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS credit_module_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. credit_rules: configuração do motor por empresa
CREATE TABLE public.credit_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  -- Knock-outs
  max_protestos INTEGER NOT NULL DEFAULT 0,
  max_pendencias_financeiras INTEGER NOT NULL DEFAULT 0,
  max_ccf_total INTEGER NOT NULL DEFAULT 0,
  max_alertas_restricoes INTEGER NOT NULL DEFAULT 0,
  min_idade_pf INTEGER NOT NULL DEFAULT 18,
  min_meses_cnpj INTEGER NOT NULL DEFAULT 6,
  max_dias_inadimplencia_interna INTEGER NOT NULL DEFAULT 30,
  -- Teto e faixas (JSONB array de {min_score, max_score, classes[], decision, percent_teto, max_parcelas})
  teto_credito NUMERIC NOT NULL DEFAULT 10000,
  score_bands JSONB NOT NULL DEFAULT '[
    {"min_score":700,"max_score":1000,"classes":["A","B"],"decision":"approved","percent_teto":100,"max_parcelas":12},
    {"min_score":550,"max_score":699,"classes":["C"],"decision":"approved","percent_teto":60,"max_parcelas":6},
    {"min_score":400,"max_score":549,"classes":["D"],"decision":"manual","percent_teto":30,"max_parcelas":3},
    {"min_score":0,"max_score":399,"classes":["E","F","G","H"],"decision":"rejected","percent_teto":0,"max_parcelas":0}
  ]'::jsonb,
  -- Encargos
  juros_mensal_pct NUMERIC NOT NULL DEFAULT 3.5,
  multa_atraso_pct NUMERIC NOT NULL DEFAULT 2.0,
  mora_diaria_pct NUMERIC NOT NULL DEFAULT 0.033,
  parcela_minima NUMERIC NOT NULL DEFAULT 50,
  -- IA / Biometria
  ia_similarity_threshold INTEGER NOT NULL DEFAULT 80,
  ia_require_liveness BOOLEAN NOT NULL DEFAULT true,
  -- Contrato
  contract_clauses TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_rules TO authenticated;
GRANT ALL ON public.credit_rules TO service_role;
ALTER TABLE public.credit_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view credit_rules in their companies" ON public.credit_rules
  FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users manage credit_rules in their companies" ON public.credit_rules
  FOR ALL TO authenticated USING (has_company_access(auth.uid(), company_id)) WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE TRIGGER set_credit_rules_updated_at BEFORE UPDATE ON public.credit_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. credit_applications: proposta principal
CREATE TABLE public.credit_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  client_supplier_id UUID,
  documento TEXT NOT NULL,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('CPF','CNPJ')),
  nome TEXT,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 6),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','consulted','qualifying','biometry_pending','biometry_ok','simulated','contracted','cancelled','rejected')),
  score INTEGER,
  classification TEXT,
  approved_limit NUMERIC,
  decision TEXT CHECK (decision IN ('approved','manual','rejected')),
  decision_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_applications_company ON public.credit_applications(company_id);
CREATE INDEX idx_credit_applications_documento ON public.credit_applications(documento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_applications TO authenticated;
GRANT ALL ON public.credit_applications TO service_role;
ALTER TABLE public.credit_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view credit_applications in their companies" ON public.credit_applications
  FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users manage credit_applications in their companies" ON public.credit_applications
  FOR ALL TO authenticated USING (has_company_access(auth.uid(), company_id)) WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE TRIGGER set_credit_applications_updated_at BEFORE UPDATE ON public.credit_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. credit_consultations: histórico de consultas à RedeBE
CREATE TABLE public.credit_consultations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  application_id UUID REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  documento TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'redebe',
  raw_response JSONB,
  summary JSONB,
  score INTEGER,
  classification TEXT,
  decision TEXT,
  approved_limit NUMERIC,
  decision_reason TEXT,
  consulted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_consultations_company ON public.credit_consultations(company_id);
CREATE INDEX idx_credit_consultations_application ON public.credit_consultations(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_consultations TO authenticated;
GRANT ALL ON public.credit_consultations TO service_role;
ALTER TABLE public.credit_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view credit_consultations in their companies" ON public.credit_consultations
  FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users manage credit_consultations in their companies" ON public.credit_consultations
  FOR ALL TO authenticated USING (has_company_access(auth.uid(), company_id)) WITH CHECK (has_company_access(auth.uid(), company_id));

-- 5. credit_qualifications
CREATE TABLE public.credit_qualifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL UNIQUE REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  renda_mensal NUMERIC,
  profissao TEXT,
  email TEXT,
  whatsapp_phone TEXT NOT NULL,
  endereco_entrega TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_qualifications TO authenticated;
GRANT ALL ON public.credit_qualifications TO service_role;
ALTER TABLE public.credit_qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view credit_qualifications in their companies" ON public.credit_qualifications
  FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users manage credit_qualifications in their companies" ON public.credit_qualifications
  FOR ALL TO authenticated USING (has_company_access(auth.uid(), company_id)) WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE TRIGGER set_credit_qualifications_updated_at BEFORE UPDATE ON public.credit_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. credit_biometry — acessível também via token público (cliente envia selfie/docs sem login)
CREATE TABLE public.credit_biometry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL UNIQUE REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  selfie_url TEXT,
  doc_front_url TEXT,
  doc_back_url TEXT,
  ocr_data JSONB,
  similarity_score INTEGER,
  liveness_passed BOOLEAN,
  ai_analysis JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uploaded','analyzing','approved','rejected','manual_review')),
  rejection_reason TEXT,
  link_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_biometry_token ON public.credit_biometry(public_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_biometry TO authenticated;
-- Allow anon to read/update via public_token (the edge function will validate the token)
GRANT SELECT, UPDATE ON public.credit_biometry TO anon;
GRANT ALL ON public.credit_biometry TO service_role;
ALTER TABLE public.credit_biometry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view credit_biometry in their companies" ON public.credit_biometry
  FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users manage credit_biometry in their companies" ON public.credit_biometry
  FOR ALL TO authenticated USING (has_company_access(auth.uid(), company_id)) WITH CHECK (has_company_access(auth.uid(), company_id));
-- Anon access: we keep it permissive at the row level; the edge function gates by token. Apps never query this anonymously without going through the edge function.
CREATE POLICY "Anon can view biometry rows (token-gated server-side)" ON public.credit_biometry
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can update biometry rows (token-gated server-side)" ON public.credit_biometry
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE TRIGGER set_credit_biometry_updated_at BEFORE UPDATE ON public.credit_biometry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. credit_contracts
CREATE TABLE public.credit_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL UNIQUE REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  client_supplier_id UUID,
  description TEXT NOT NULL,
  principal_amount NUMERIC NOT NULL,
  juros_mensal_pct NUMERIC NOT NULL,
  num_parcelas INTEGER NOT NULL,
  parcela_amount NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  first_due_date DATE NOT NULL,
  pdf_url TEXT,
  contract_status TEXT NOT NULL DEFAULT 'active' CHECK (contract_status IN ('active','cancelled','completed')),
  whatsapp_accepted_at TIMESTAMPTZ,
  whatsapp_accepted_ip TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_contracts_company ON public.credit_contracts(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_contracts TO authenticated;
GRANT ALL ON public.credit_contracts TO service_role;
ALTER TABLE public.credit_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view credit_contracts in their companies" ON public.credit_contracts
  FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Users manage credit_contracts in their companies" ON public.credit_contracts
  FOR ALL TO authenticated USING (has_company_access(auth.uid(), company_id)) WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE TRIGGER set_credit_contracts_updated_at BEFORE UPDATE ON public.credit_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. credit_decision_log
CREATE TABLE public.credit_decision_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  step TEXT NOT NULL,
  input JSONB,
  output JSONB,
  rules_snapshot JSONB,
  decision TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_decision_log_application ON public.credit_decision_log(application_id);

GRANT SELECT, INSERT ON public.credit_decision_log TO authenticated;
GRANT ALL ON public.credit_decision_log TO service_role;
ALTER TABLE public.credit_decision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view credit_decision_log in their companies" ON public.credit_decision_log
  FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "System inserts credit_decision_log" ON public.credit_decision_log
  FOR INSERT TO authenticated WITH CHECK (has_company_access(auth.uid(), company_id));

-- 9. Vínculo parcelas <-> contrato
ALTER TABLE public.payables_receivables ADD COLUMN IF NOT EXISTS credit_contract_id UUID;
CREATE INDEX IF NOT EXISTS idx_payables_receivables_credit_contract ON public.payables_receivables(credit_contract_id);

-- 10. Storage bucket privado para selfie/documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('credit-documents', 'credit-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: arquivos organizados por company_id/application_id/...
CREATE POLICY "Users view credit-documents in their companies"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'credit-documents'
         AND has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Users upload credit-documents in their companies"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'credit-documents'
              AND has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Users delete credit-documents in their companies"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'credit-documents'
         AND has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- Anon: upload via edge function (server-side validates the public token)
CREATE POLICY "Anon can upload credit-documents (gated by edge function)"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'credit-documents');

CREATE POLICY "Anon can read credit-documents (gated by edge function)"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'credit-documents');
