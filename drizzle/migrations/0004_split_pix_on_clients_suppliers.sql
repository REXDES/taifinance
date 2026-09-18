ALTER TABLE public.clients_suppliers
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS bank_account text;

ALTER TABLE public.split_rules
  ADD COLUMN IF NOT EXISTS client_supplier_id uuid REFERENCES public.clients_suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS necta_mirror_enabled boolean NOT NULL DEFAULT false;

-- Backfill: cada destinatário de split vira um cadastro de fornecedor com chave PIX
INSERT INTO public.clients_suppliers (company_id, name, type, document, notes, pix_key, pix_key_type, bank_name, bank_branch, bank_account)
SELECT r.company_id, r.name, 'supplier', r.document, r.notes, r.pix_key, r.pix_key_type, r.bank_name, r.bank_branch, r.bank_account
FROM public.split_recipients r
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients_suppliers cs
  WHERE cs.company_id = r.company_id
    AND (
      (cs.document IS NOT NULL AND r.document IS NOT NULL AND cs.document = r.document)
      OR lower(cs.name) = lower(r.name)
    )
);

UPDATE public.clients_suppliers cs
SET pix_key = COALESCE(cs.pix_key, r.pix_key),
    pix_key_type = COALESCE(cs.pix_key_type, r.pix_key_type),
    bank_name = COALESCE(cs.bank_name, r.bank_name),
    bank_branch = COALESCE(cs.bank_branch, r.bank_branch),
    bank_account = COALESCE(cs.bank_account, r.bank_account)
FROM public.split_recipients r
WHERE cs.company_id = r.company_id
  AND (
    (cs.document IS NOT NULL AND r.document IS NOT NULL AND cs.document = r.document)
    OR lower(cs.name) = lower(r.name)
  );

UPDATE public.split_rules sr
SET client_supplier_id = cs.id
FROM public.split_recipients r
JOIN public.clients_suppliers cs
  ON cs.company_id = r.company_id
 AND (
   (cs.document IS NOT NULL AND r.document IS NOT NULL AND cs.document = r.document)
   OR lower(cs.name) = lower(r.name)
 )
WHERE sr.recipient_id = r.id AND sr.client_supplier_id IS NULL;

UPDATE public.companies SET necta_mirror_enabled = true WHERE necta_account_id IS NOT NULL;