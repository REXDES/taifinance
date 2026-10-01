-- Replica drizzle/migrations/0005_payables_receivables_paused_status.sql (já idempotente).
ALTER TABLE public.payables_receivables DROP CONSTRAINT IF EXISTS payables_receivables_status_check;
ALTER TABLE public.payables_receivables ADD CONSTRAINT payables_receivables_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'paused'::text]));
