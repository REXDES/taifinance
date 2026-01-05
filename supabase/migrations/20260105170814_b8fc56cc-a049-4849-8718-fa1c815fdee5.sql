-- Add monthly_budget column to transaction_categories
ALTER TABLE public.transaction_categories 
ADD COLUMN monthly_budget numeric DEFAULT NULL;