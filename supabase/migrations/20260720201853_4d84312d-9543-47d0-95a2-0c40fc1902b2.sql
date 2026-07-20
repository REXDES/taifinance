
-- =====================================================================
-- MÓDULO PAGAMENTOS (Cappta White Label)
-- =====================================================================

-- 1. Flag no companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS payments_module_enabled boolean NOT NULL DEFAULT false;

-- 2. cappta_merchants (Estabelecimentos)
CREATE TABLE IF NOT EXISTS public.cappta_merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cappta_merchant_id text,
  legal_name text NOT NULL,
  trade_name text,
  document text NOT NULL, -- CNPJ/CPF
  document_type text NOT NULL DEFAULT 'cnpj' CHECK (document_type IN ('cnpj','cpf')),
  email text,
  phone text,
  address_zip text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  plan_id uuid,
  bank_code text,
  bank_agency text,
  bank_account text,
  bank_account_digit text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','blocked','inactive')),
  raw_payload jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cappta_merchants TO authenticated;
GRANT ALL ON public.cappta_merchants TO service_role;
ALTER TABLE public.cappta_merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cappta_merchants_company_access" ON public.cappta_merchants
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- 3. cappta_plans (Planos & Taxas)
CREATE TABLE IF NOT EXISTS public.cappta_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cappta_plan_id text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  rates jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{brand, product, installments, mdr, anticipation}]
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cappta_plans TO authenticated;
GRANT ALL ON public.cappta_plans TO service_role;
ALTER TABLE public.cappta_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cappta_plans_company_access" ON public.cappta_plans
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- 4. cappta_terminals (POS)
CREATE TABLE IF NOT EXISTS public.cappta_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.cappta_merchants(id) ON DELETE SET NULL,
  cappta_terminal_id text,
  serial_number text,
  model text,
  brand text,
  logic_number text,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','blocked','pending')),
  activated_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cappta_terminals TO authenticated;
GRANT ALL ON public.cappta_terminals TO service_role;
ALTER TABLE public.cappta_terminals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cappta_terminals_company_access" ON public.cappta_terminals
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- 5. cappta_transactions (Vendas capturadas)
CREATE TABLE IF NOT EXISTS public.cappta_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.cappta_merchants(id) ON DELETE SET NULL,
  terminal_id uuid REFERENCES public.cappta_terminals(id) ON DELETE SET NULL,
  cappta_transaction_id text UNIQUE,
  nsu text,
  authorization_code text,
  brand text,
  product text, -- credit/debit/pix/voucher
  installments integer DEFAULT 1,
  gross_amount numeric(15,2) NOT NULL DEFAULT 0,
  fee_amount numeric(15,2) NOT NULL DEFAULT 0,
  net_amount numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','denied','reversed','pending','cancelled')),
  captured_at timestamptz,
  settlement_date date,
  linked_transaction_id uuid, -- link com public.transactions (receita gerada)
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cappta_tx_company_date ON public.cappta_transactions(company_id, captured_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cappta_transactions TO authenticated;
GRANT ALL ON public.cappta_transactions TO service_role;
ALTER TABLE public.cappta_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cappta_transactions_company_access" ON public.cappta_transactions
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- 6. cappta_charges (Cobranças: link/boleto/pix)
CREATE TABLE IF NOT EXISTS public.cappta_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.cappta_merchants(id) ON DELETE SET NULL,
  cappta_charge_id text UNIQUE,
  charge_type text NOT NULL CHECK (charge_type IN ('link','boleto','pix')),
  amount numeric(15,2) NOT NULL,
  description text,
  payer_name text,
  payer_document text,
  payer_email text,
  payer_phone text,
  due_date date,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled','failed')),
  payment_url text,
  boleto_barcode text,
  pix_qrcode text,
  pix_copy_paste text,
  linked_payable_id uuid, -- link com payables_receivables
  linked_transaction_id uuid, -- link com transactions (recebimento)
  raw_payload jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cappta_charges TO authenticated;
GRANT ALL ON public.cappta_charges TO service_role;
ALTER TABLE public.cappta_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cappta_charges_company_access" ON public.cappta_charges
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- 7. cappta_settlements (Liquidações/Repasses)
CREATE TABLE IF NOT EXISTS public.cappta_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.cappta_merchants(id) ON DELETE SET NULL,
  cappta_settlement_id text UNIQUE,
  settlement_date date NOT NULL,
  gross_amount numeric(15,2) NOT NULL DEFAULT 0,
  fee_amount numeric(15,2) NOT NULL DEFAULT 0,
  net_amount numeric(15,2) NOT NULL DEFAULT 0,
  transactions_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cappta_settlements TO authenticated;
GRANT ALL ON public.cappta_settlements TO service_role;
ALTER TABLE public.cappta_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cappta_settlements_company_access" ON public.cappta_settlements
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- 8. cappta_webhook_events
CREATE TABLE IF NOT EXISTS public.cappta_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_id text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cappta_webhook_events TO authenticated;
GRANT ALL ON public.cappta_webhook_events TO service_role;
ALTER TABLE public.cappta_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cappta_webhook_events_supervisor_read" ON public.cappta_webhook_events
  FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) OR (company_id IS NOT NULL AND public.has_company_access(auth.uid(), company_id)));

-- Triggers de updated_at
CREATE TRIGGER trg_cappta_merchants_updated BEFORE UPDATE ON public.cappta_merchants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cappta_plans_updated BEFORE UPDATE ON public.cappta_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cappta_terminals_updated BEFORE UPDATE ON public.cappta_terminals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cappta_transactions_updated BEFORE UPDATE ON public.cappta_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cappta_charges_updated BEFORE UPDATE ON public.cappta_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
