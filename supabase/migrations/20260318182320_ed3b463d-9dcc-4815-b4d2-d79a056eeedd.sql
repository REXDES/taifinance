CREATE POLICY "Supervisors can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_supervisor(auth.uid()))
WITH CHECK (is_supervisor(auth.uid()));

CREATE POLICY "Gerentes can update profiles in their companies"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role) 
  AND user_id IN (
    SELECT uc.user_id FROM user_companies uc 
    WHERE uc.company_id IN (SELECT get_user_company_ids(auth.uid()))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'gerente'::app_role)
  AND user_id IN (
    SELECT uc.user_id FROM user_companies uc 
    WHERE uc.company_id IN (SELECT get_user_company_ids(auth.uid()))
  )
);