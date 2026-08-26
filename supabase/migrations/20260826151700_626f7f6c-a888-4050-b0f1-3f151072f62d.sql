CREATE TABLE public.machine_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('venda','baixa')),
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  buyer_client_id uuid REFERENCES public.clients_suppliers(id) ON DELETE SET NULL,
  buyer_name text,
  sale_amount numeric NOT NULL DEFAULT 0,
  payment_mode text CHECK (payment_mode IN ('cash','installments')),
  down_payment numeric NOT NULL DEFAULT 0,
  installments_count integer,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_movements TO authenticated;
GRANT ALL ON public.machine_movements TO service_role;

ALTER TABLE public.machine_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage machine movements"
  ON public.machine_movements FOR ALL
  TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_machine_movements_updated
  BEFORE UPDATE ON public.machine_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_machine_movements_company ON public.machine_movements(company_id);
CREATE INDEX idx_machine_movements_machine ON public.machine_movements(machine_id);

ALTER TABLE public.payables_receivables
  ADD COLUMN IF NOT EXISTS machine_movement_id uuid REFERENCES public.machine_movements(id) ON DELETE SET NULL;