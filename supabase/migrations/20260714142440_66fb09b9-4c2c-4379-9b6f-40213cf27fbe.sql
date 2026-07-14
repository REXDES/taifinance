
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS serial_number TEXT;

CREATE TABLE IF NOT EXISTS public.machine_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_tags TO authenticated;
GRANT ALL ON public.machine_tags TO service_role;
ALTER TABLE public.machine_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machine_tags company access" ON public.machine_tags
  FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_machine_tags_updated BEFORE UPDATE ON public.machine_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.machine_tag_links (
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.machine_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (machine_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_tag_links TO authenticated;
GRANT ALL ON public.machine_tag_links TO service_role;
ALTER TABLE public.machine_tag_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machine_tag_links via machine" ON public.machine_tag_links
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.machines m WHERE m.id = machine_id AND public.has_company_access(auth.uid(), m.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.machines m WHERE m.id = machine_id AND public.has_company_access(auth.uid(), m.company_id)));

CREATE INDEX IF NOT EXISTS idx_machine_tag_links_tag ON public.machine_tag_links(tag_id);
