ALTER TABLE public.necta_establishments
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'local';

UPDATE public.necta_establishments
   SET origin = 'marketplace'
 WHERE created_by IS NULL
   AND necta_establishment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS necta_establishments_company_origin_idx
  ON public.necta_establishments (company_id, origin);