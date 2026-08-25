
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_status_check;

ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS technical_status text NOT NULL DEFAULT 'operacional';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS location text;

UPDATE public.machines SET technical_status = 'em_manutencao' WHERE status = 'maintenance';
UPDATE public.machines SET status = 'disponivel' WHERE status IN ('available','maintenance');
UPDATE public.machines SET status = 'locada' WHERE status = 'rented';
UPDATE public.machines SET status = 'vendida' WHERE status = 'sold';

CREATE TABLE IF NOT EXISTS public.machine_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

ALTER TABLE public.machine_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View machine_locations in their companies" ON public.machine_locations;
DROP POLICY IF EXISTS "Manage machine_locations in their companies" ON public.machine_locations;

CREATE POLICY "View machine_locations in their companies"
  ON public.machine_locations FOR SELECT
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Manage machine_locations in their companies"
  ON public.machine_locations FOR ALL
  USING (has_company_access(auth.uid(), company_id));
