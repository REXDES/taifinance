-- ESTABELECIMENTOS
CREATE TABLE public.necta_establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  necta_establishment_id text,
  legal_name text,
  trade_name text,
  document text,
  email text,
  phone text,
  address_zip text,
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_state text,
  bank_code text,
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text,
  bank_account_holder text,
  bank_account_document text,
  pix_key text,
  pix_key_type text,
  billet_config jsonb DEFAULT '{}'::jsonb,
  fee_plan_id text,
  fee_plan_name text,
  homologation_status text NOT NULL DEFAULT 'draft',
  homologation_sent_at timestamptz,
  homologation_notes text,
  term_accepted_at timestamptz,
  term_slug text,
  documents jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  raw jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_establishments TO authenticated;
GRANT ALL ON public.necta_establishments TO service_role;
ALTER TABLE public.necta_establishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_establishments_access" ON public.necta_establishments FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)))
  WITH CHECK (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)));
CREATE TRIGGER trg_necta_establishments_updated BEFORE UPDATE ON public.necta_establishments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- COBRANCAS / VENDAS
CREATE TABLE public.necta_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  establishment_id uuid REFERENCES public.necta_establishments(id) ON DELETE SET NULL,
  necta_sale_id text,
  necta_payment_link_id text,
  method text NOT NULL DEFAULT 'pix',
  amount numeric NOT NULL DEFAULT 0,
  installments integer NOT NULL DEFAULT 1,
  description text,
  payer_name text,
  payer_document text,
  payer_email text,
  payer_phone text,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  provider_status text,
  paid_at timestamptz,
  refunded_at timestamptz,
  pix_copy_paste text,
  pix_qr_code text,
  boleto_digitable_line text,
  boleto_barcode text,
  boleto_url text,
  payment_url text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_interval text,
  recurrence_count integer,
  recurrence_index integer,
  parent_sale_id uuid REFERENCES public.necta_sales(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.transaction_subcategories(id) ON DELETE SET NULL,
  payable_receivable_id uuid REFERENCES public.payables_receivables(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  fee_amount numeric,
  net_amount numeric,
  last_sync_at timestamptz,
  sync_error text,
  raw jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_sales TO authenticated;
GRANT ALL ON public.necta_sales TO service_role;
ALTER TABLE public.necta_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_sales_access" ON public.necta_sales FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_necta_sales_updated BEFORE UPDATE ON public.necta_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_necta_sales_company_status ON public.necta_sales(company_id, status);

-- POS
CREATE TABLE public.necta_pos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  establishment_id uuid REFERENCES public.necta_establishments(id) ON DELETE SET NULL,
  necta_pos_id text,
  serial_number text,
  model text,
  model_id text,
  status text NOT NULL DEFAULT 'available',
  bound_at timestamptz,
  raw jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_pos TO authenticated;
GRANT ALL ON public.necta_pos TO service_role;
ALTER TABLE public.necta_pos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_pos_access" ON public.necta_pos FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)))
  WITH CHECK (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)));
CREATE TRIGGER trg_necta_pos_updated BEFORE UPDATE ON public.necta_pos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PLANOS DE TAXA
CREATE TABLE public.necta_fee_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  necta_plan_id text,
  name text NOT NULL,
  description text,
  pix_fee numeric,
  bank_slip_fee numeric,
  debit_fee numeric,
  credit_fee numeric,
  credit_installment_fee numeric,
  anticipation_fee numeric,
  royalty_percent numeric,
  is_default boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_fee_plans TO authenticated;
GRANT ALL ON public.necta_fee_plans TO service_role;
ALTER TABLE public.necta_fee_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_fee_plans_access" ON public.necta_fee_plans FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)))
  WITH CHECK (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)));
CREATE TRIGGER trg_necta_fee_plans_updated BEFORE UPDATE ON public.necta_fee_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LIQUIDACOES
CREATE TABLE public.necta_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  establishment_id uuid REFERENCES public.necta_establishments(id) ON DELETE SET NULL,
  necta_settlement_id text,
  necta_merchant_settlement_id text,
  merchant_name text,
  merchant_document text,
  settlement_date date,
  status text,
  gross_amount numeric DEFAULT 0,
  fee_amount numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  orders_count integer DEFAULT 0,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_settlements TO authenticated;
GRANT ALL ON public.necta_settlements TO service_role;
ALTER TABLE public.necta_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_settlements_access" ON public.necta_settlements FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)))
  WITH CHECK (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)));
CREATE TRIGGER trg_necta_settlements_updated BEFORE UPDATE ON public.necta_settlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WEBHOOKS
CREATE TABLE public.necta_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'marketplaces',
  scope_uuid text,
  necta_endpoint_id text,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  raw jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.necta_webhook_endpoints TO authenticated;
GRANT ALL ON public.necta_webhook_endpoints TO service_role;
ALTER TABLE public.necta_webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_webhook_endpoints_access" ON public.necta_webhook_endpoints FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)))
  WITH CHECK (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)));
CREATE TRIGGER trg_necta_webhook_endpoints_updated BEFORE UPDATE ON public.necta_webhook_endpoints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.necta_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text,
  necta_reference_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  process_error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.necta_webhook_events TO authenticated;
GRANT ALL ON public.necta_webhook_events TO service_role;
ALTER TABLE public.necta_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "necta_webhook_events_read" ON public.necta_webhook_events FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)));