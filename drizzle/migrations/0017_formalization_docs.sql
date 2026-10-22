ALTER TABLE public.credit_contracts
  ADD COLUMN IF NOT EXISTS invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_name TEXT,
  ADD COLUMN IF NOT EXISTS contract_file_url TEXT,
  ADD COLUMN IF NOT EXISTS contract_file_name TEXT;

COMMENT ON COLUMN public.credit_contracts.pdf_url IS 'DEPRECATED: contrato gerado pelo app; a etapa Formalização agora usa contract_file_url (arquivo enviado pelo usuário)';
COMMENT ON COLUMN public.credit_contracts.whatsapp_accepted_at IS 'DEPRECATED: aceite via WhatsApp não é mais registrado; a etapa Formalização aceita uploads opcionais de nota fiscal e contrato';