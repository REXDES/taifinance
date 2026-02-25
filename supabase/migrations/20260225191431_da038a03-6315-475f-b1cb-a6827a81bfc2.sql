
-- Create a security definer function to count companies created by a user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.count_companies_created_by(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.companies WHERE created_by = _user_id
$$;

-- Create a security definer function to get company limit (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_company_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_limit FROM public.user_roles WHERE user_id = _user_id
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Gerentes can create companies within limit" ON public.companies;

-- Recreate it using security definer functions to avoid recursion
CREATE POLICY "Gerentes can create companies within limit"
ON public.companies
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'gerente'::app_role) 
  AND get_company_limit(auth.uid()) > count_companies_created_by(auth.uid())
);
