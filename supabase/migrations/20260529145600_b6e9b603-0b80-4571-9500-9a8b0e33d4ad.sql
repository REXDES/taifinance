
ALTER TABLE public.clients_suppliers
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS doc_front_url text,
  ADD COLUMN IF NOT EXISTS doc_back_url text,
  ADD COLUMN IF NOT EXISTS biometry_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS biometry_similarity_score integer;
