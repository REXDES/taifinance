-- Add company_limit to invitations table
ALTER TABLE public.invitations 
ADD COLUMN company_limit integer DEFAULT NULL;

-- Add company_limit to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN company_limit integer DEFAULT NULL;

-- Add created_by to companies table to track who created the company
ALTER TABLE public.companies 
ADD COLUMN created_by uuid REFERENCES auth.users(id) DEFAULT NULL;