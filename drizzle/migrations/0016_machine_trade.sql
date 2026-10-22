ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_acquisition_source_check;
ALTER TABLE public.machines ADD CONSTRAINT machines_acquisition_source_check CHECK (acquisition_source IN ('new_purchase','pre_existing','resale_purchase'));

CREATE TABLE public.machine_trade_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.machine_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  profit_margin_pct numeric NOT NULL DEFAULT 20,
  recovery_pct numeric NOT NULL DEFAULT 10,
  keywords text,
  auction_sites text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.machine_resale_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  setting_id uuid REFERENCES public.machine_trade_settings(id) ON DELETE SET NULL,
  brand text, model text NOT NULL, year_from int, year_to int, max_hours numeric,
  reference_price numeric NOT NULL DEFAULT 0,
  suggested_price numeric,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  researched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.machine_auction_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  setting_id uuid REFERENCES public.machine_trade_settings(id) ON DELETE SET NULL,
  price_id uuid REFERENCES public.machine_resale_prices(id) ON DELETE SET NULL,
  title text NOT NULL, url text, auction_date text, location text,
  current_bid numeric, max_bid numeric, reference_price numeric,
  status text NOT NULL DEFAULT 'saved',
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.machine_parts_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  description text NOT NULL, supplier text, amount numeric NOT NULL DEFAULT 0,
  purchase_date date NOT NULL DEFAULT current_date,
  payable_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.machine_resales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  sale_price numeric NOT NULL, total_cost numeric NOT NULL, real_margin_pct numeric,
  sale_date date NOT NULL DEFAULT current_date,
  buyer_id uuid, receivable_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['machine_trade_settings','machine_resale_prices','machine_auction_opportunities','machine_parts_purchases','machine_resales'] LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY "company access" ON public.%I FOR ALL TO authenticated USING (public.has_company_access(auth.uid(), company_id)) WITH CHECK (public.has_company_access(auth.uid(), company_id))', t);
END LOOP; END $$;