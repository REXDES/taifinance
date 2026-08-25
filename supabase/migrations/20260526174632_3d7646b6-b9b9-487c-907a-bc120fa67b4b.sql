
ALTER TABLE public.credit_ignored_occurrences
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'document'
    CHECK (scope IN ('application','document','global'));

CREATE INDEX IF NOT EXISTS idx_cio_scope ON public.credit_ignored_occurrences (company_id, scope, status);
