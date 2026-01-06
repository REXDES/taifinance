-- Add type column to account_groups for active/passive classification
ALTER TABLE public.account_groups 
ADD COLUMN type text NOT NULL DEFAULT 'ativo' CHECK (type IN ('ativo', 'passivo'));