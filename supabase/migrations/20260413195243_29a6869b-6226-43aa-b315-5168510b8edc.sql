
-- Add PIX and WhatsApp notification fields to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS pix_holder_name text,
  ADD COLUMN IF NOT EXISTS pix_city text,
  ADD COLUMN IF NOT EXISTS whatsapp_notify_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_notify_days_before integer[] NOT NULL DEFAULT '{0}',
  ADD COLUMN IF NOT EXISTS whatsapp_notify_time text NOT NULL DEFAULT '08:00';

-- Add WhatsApp phone to clients_suppliers
ALTER TABLE public.clients_suppliers
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;
