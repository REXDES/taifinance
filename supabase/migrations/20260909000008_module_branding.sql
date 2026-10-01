-- Replica drizzle/migrations/0008_module_branding.sql
CREATE TABLE IF NOT EXISTS public.module_branding (
  module_key text PRIMARY KEY,
  display_name text,
  logo_url text,
  color text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_branding TO authenticated;
GRANT ALL ON public.module_branding TO service_role;
ALTER TABLE public.module_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read branding" ON public.module_branding;
CREATE POLICY "Authenticated read branding" ON public.module_branding FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Supervisor manage branding" ON public.module_branding;
CREATE POLICY "Supervisor manage branding" ON public.module_branding FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));
