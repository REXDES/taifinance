UPDATE public.credit_applications a
SET current_step = 3
WHERE current_step > 3
  AND status NOT IN ('contracted', 'rejected')
  AND NOT EXISTS (SELECT 1 FROM public.credit_qualifications q WHERE q.application_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.credit_biometry b WHERE b.application_id = a.id);

UPDATE public.credit_applications a
SET current_step = 4
WHERE current_step > 4
  AND status NOT IN ('contracted', 'rejected')
  AND EXISTS (SELECT 1 FROM public.credit_qualifications q WHERE q.application_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.credit_biometry b WHERE b.application_id = a.id);