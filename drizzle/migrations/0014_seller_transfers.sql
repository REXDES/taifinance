CREATE TABLE public.seller_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  to_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  description text,
  kind text NOT NULL DEFAULT 'free' CHECK (kind IN ('free','disbursement')),
  assignment_id uuid REFERENCES public.receivable_assignments(id) ON DELETE SET NULL,
  request_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
  error text,
  response jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_transfers TO authenticated;
GRANT ALL ON public.seller_transfers TO service_role;
ALTER TABLE public.seller_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_transfers read own" ON public.seller_transfers FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), from_company_id) OR public.has_company_access(auth.uid(), to_company_id));
CREATE INDEX seller_transfers_from ON public.seller_transfers(from_company_id, created_at DESC);
CREATE INDEX seller_transfers_to ON public.seller_transfers(to_company_id, created_at DESC);
ALTER TABLE public.receivable_assignments ADD COLUMN IF NOT EXISTS disbursed_at timestamptz;
ALTER TABLE public.receivable_assignments ADD COLUMN IF NOT EXISTS disbursement_transfer_id uuid REFERENCES public.seller_transfers(id) ON DELETE SET NULL;