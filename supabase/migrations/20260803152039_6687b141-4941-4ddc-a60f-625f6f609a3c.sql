ALTER TABLE public.statement_lines
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS receipt_name text,
  ADD COLUMN IF NOT EXISTS receipt_details text,
  ADD COLUMN IF NOT EXISTS tag_ids uuid[] NOT NULL DEFAULT '{}';