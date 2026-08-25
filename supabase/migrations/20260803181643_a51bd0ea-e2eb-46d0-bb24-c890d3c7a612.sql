ALTER TABLE public.cappta_charges REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cappta_charges'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cappta_charges;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;