CREATE UNIQUE INDEX IF NOT EXISTS necta_establishments_one_own_profile
  ON public.necta_establishments (company_id)
  WHERE is_own_profile;