
-- Flag de habilitação do módulo
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS machines_module_enabled boolean NOT NULL DEFAULT false;

-- Tipos de máquina (configurável por empresa)
CREATE TABLE public.machine_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.machine_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View machine_types in their companies" ON public.machine_types FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Manage machine_types in their companies" ON public.machine_types FOR ALL USING (has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_machine_types_updated BEFORE UPDATE ON public.machine_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Máquinas / Equipamentos / Ferramentas / Implementos
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  type_id uuid REFERENCES public.machine_types(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text,
  model text,
  year integer,
  destination text,
  acquisition_value numeric NOT NULL DEFAULT 0,
  acquisition_date date,
  acquisition_source text NOT NULL DEFAULT 'pre_existing' CHECK (acquisition_source IN ('new_purchase','pre_existing')),
  current_horimeter numeric NOT NULL DEFAULT 0,
  preventive_maintenance_interval_hours numeric,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','rented','maintenance','sold')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View machines in their companies" ON public.machines FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Manage machines in their companies" ON public.machines FOR ALL USING (has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_machines_updated BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Logs de horímetro
CREATE TABLE public.machine_horimeter_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  reading numeric NOT NULL,
  source text NOT NULL CHECK (source IN ('rental_start','rental_end','maintenance','manual')),
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.machine_horimeter_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View horimeter logs of accessible machines" ON public.machine_horimeter_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.machines m WHERE m.id = machine_id AND has_company_access(auth.uid(), m.company_id)));
CREATE POLICY "Manage horimeter logs of accessible machines" ON public.machine_horimeter_logs FOR ALL USING (EXISTS (SELECT 1 FROM public.machines m WHERE m.id = machine_id AND has_company_access(auth.uid(), m.company_id)));

-- Operadores
CREATE TABLE public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  document text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View operators in their companies" ON public.operators FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Manage operators in their companies" ON public.operators FOR ALL USING (has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_operators_updated BEFORE UPDATE ON public.operators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mecânicos
CREATE TABLE public.mechanics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  document text,
  phone text,
  specialty text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View mechanics in their companies" ON public.mechanics FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Manage mechanics in their companies" ON public.mechanics FOR ALL USING (has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_mechanics_updated BEFORE UPDATE ON public.mechanics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Manutenções
CREATE TABLE public.maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  mechanic_id uuid REFERENCES public.mechanics(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date,
  description text,
  horimeter_at_service numeric,
  total_cost numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash','installments','none')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  transaction_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View maintenance in their companies" ON public.maintenance_records FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Manage maintenance in their companies" ON public.maintenance_records FOR ALL USING (has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_maintenance_updated BEFORE UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabelas de preço de locação (faixas)
CREATE TABLE public.rental_price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  unit text NOT NULL CHECK (unit IN ('hour','day','week','month')),
  min_qty numeric NOT NULL DEFAULT 1,
  max_qty numeric,
  price numeric NOT NULL,
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rental_price_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View price tables in their companies" ON public.rental_price_tables FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Manage price tables in their companies" ON public.rental_price_tables FOR ALL USING (has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_price_tables_updated BEFORE UPDATE ON public.rental_price_tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Kits de locação
CREATE TABLE public.rental_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rental_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View kits in their companies" ON public.rental_kits FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Manage kits in their companies" ON public.rental_kits FOR ALL USING (has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_kits_updated BEFORE UPDATE ON public.rental_kits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rental_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.rental_kits(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rental_kit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View kit items via kit" ON public.rental_kit_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.rental_kits k WHERE k.id = kit_id AND has_company_access(auth.uid(), k.company_id)));
CREATE POLICY "Manage kit items via kit" ON public.rental_kit_items FOR ALL USING (EXISTS (SELECT 1 FROM public.rental_kits k WHERE k.id = kit_id AND has_company_access(auth.uid(), k.company_id)));

-- Locações
CREATE TABLE public.rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients_suppliers(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  kit_id uuid REFERENCES public.rental_kits(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date,
  unit text NOT NULL CHECK (unit IN ('hour','day','week','month')),
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  horimeter_start numeric,
  horimeter_end numeric,
  payment_mode text NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash','installments')),
  installments_count integer,
  billing_frequency text CHECK (billing_frequency IN ('monthly','weekly','daily')),
  paid_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  transaction_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','cancelled')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View rentals in their companies" ON public.rentals FOR SELECT USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Manage rentals in their companies" ON public.rentals FOR ALL USING (has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_rentals_updated BEFORE UPDATE ON public.rentals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rental_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  price_snapshot numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rental_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View rental_machines via rental" ON public.rental_machines FOR SELECT USING (EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND has_company_access(auth.uid(), r.company_id)));
CREATE POLICY "Manage rental_machines via rental" ON public.rental_machines FOR ALL USING (EXISTS (SELECT 1 FROM public.rentals r WHERE r.id = rental_id AND has_company_access(auth.uid(), r.company_id)));

-- Vínculos em payables_receivables
ALTER TABLE public.payables_receivables
  ADD COLUMN IF NOT EXISTS rental_id uuid,
  ADD COLUMN IF NOT EXISTS maintenance_id uuid;

CREATE INDEX IF NOT EXISTS idx_pr_rental_id ON public.payables_receivables(rental_id);
CREATE INDEX IF NOT EXISTS idx_pr_maintenance_id ON public.payables_receivables(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_machines_company ON public.machines(company_id);
CREATE INDEX IF NOT EXISTS idx_rentals_company ON public.rentals(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_company ON public.maintenance_records(company_id);
