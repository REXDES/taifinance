-- Update RLS policies to allow gerentes to manage user access within their companies

-- Drop existing policies for user_companies
DROP POLICY IF EXISTS "Supervisors can manage user_companies" ON public.user_companies;
DROP POLICY IF EXISTS "Users can view their own company assignments" ON public.user_companies;

-- Create new policies for user_companies that allow gerentes to manage
CREATE POLICY "Supervisors can manage user_companies"
ON public.user_companies
FOR ALL
USING (is_supervisor(auth.uid()));

CREATE POLICY "Gerentes can manage users in their companies"
ON public.user_companies
FOR ALL
USING (
  has_role(auth.uid(), 'gerente') AND 
  has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Users can view their own company assignments"
ON public.user_companies
FOR SELECT
USING (user_id = auth.uid());

-- Drop and recreate policies for user_account_group_access
DROP POLICY IF EXISTS "Supervisors can manage user account group access" ON public.user_account_group_access;
DROP POLICY IF EXISTS "Users can view their own account group access" ON public.user_account_group_access;

CREATE POLICY "Supervisors can manage user account group access"
ON public.user_account_group_access
FOR ALL
USING (is_supervisor(auth.uid()));

CREATE POLICY "Gerentes can manage user account group access"
ON public.user_account_group_access
FOR ALL
USING (
  has_role(auth.uid(), 'gerente') AND 
  EXISTS (
    SELECT 1 FROM account_groups ag
    WHERE ag.id = user_account_group_access.account_group_id
    AND has_company_access(auth.uid(), ag.company_id)
  )
);

CREATE POLICY "Users can view their own account group access"
ON public.user_account_group_access
FOR SELECT
USING (auth.uid() = user_id);

-- Drop and recreate policies for user_account_access
DROP POLICY IF EXISTS "Supervisors can manage user account access" ON public.user_account_access;
DROP POLICY IF EXISTS "Users can view their own account access" ON public.user_account_access;

CREATE POLICY "Supervisors can manage user account access"
ON public.user_account_access
FOR ALL
USING (is_supervisor(auth.uid()));

CREATE POLICY "Gerentes can manage user account access"
ON public.user_account_access
FOR ALL
USING (
  has_role(auth.uid(), 'gerente') AND 
  EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = user_account_access.account_id
    AND has_company_access(auth.uid(), a.company_id)
  )
);

CREATE POLICY "Users can view their own account access"
ON public.user_account_access
FOR SELECT
USING (auth.uid() = user_id);

-- Update user_roles policies to allow gerentes to update roles in their companies
DROP POLICY IF EXISTS "Supervisors can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

CREATE POLICY "Supervisors can manage roles"
ON public.user_roles
FOR ALL
USING (is_supervisor(auth.uid()));

CREATE POLICY "Gerentes can update operador roles"
ON public.user_roles
FOR UPDATE
USING (
  has_role(auth.uid(), 'gerente') AND
  role = 'operador' AND
  EXISTS (
    SELECT 1 FROM user_companies uc
    WHERE uc.user_id = user_roles.user_id
    AND has_company_access(auth.uid(), uc.company_id)
  )
);

CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Allow supervisors and gerentes to view roles of users in their companies
CREATE POLICY "Can view roles in own companies"
ON public.user_roles
FOR SELECT
USING (
  is_supervisor(auth.uid()) OR
  (has_role(auth.uid(), 'gerente') AND EXISTS (
    SELECT 1 FROM user_companies uc
    WHERE uc.user_id = user_roles.user_id
    AND has_company_access(auth.uid(), uc.company_id)
  ))
);