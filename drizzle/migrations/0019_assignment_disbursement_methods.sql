ALTER TABLE public.receivable_assignments
  ADD COLUMN IF NOT EXISTS disbursement_method text,
  ADD COLUMN IF NOT EXISTS disbursement_sale_id uuid REFERENCES public.necta_sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disbursement_proof_path text,
  ADD COLUMN IF NOT EXISTS disbursement_note text;
NOTIFY pgrst, 'reload schema';