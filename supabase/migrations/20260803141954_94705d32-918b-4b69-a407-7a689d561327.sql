UPDATE public.statement_imports si
SET status = CASE
  WHEN NOT EXISTS (SELECT 1 FROM public.statement_lines sl WHERE sl.import_id = si.id) THEN 'pending'
  WHEN NOT EXISTS (SELECT 1 FROM public.statement_lines sl WHERE sl.import_id = si.id AND sl.status = 'pending') THEN 'done'
  WHEN NOT EXISTS (SELECT 1 FROM public.statement_lines sl WHERE sl.import_id = si.id AND sl.status <> 'pending') THEN 'pending'
  ELSE 'partial'
END;