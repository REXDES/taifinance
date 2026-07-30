CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_key text, allowed boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT rp.permission_key, rp.allowed
  FROM public.user_roles ur
  JOIN public.role_permissions rp
    ON rp.role_key = CASE
      WHEN ur.custom_role_id IS NOT NULL THEN ur.custom_role_id::text
      ELSE ur.role::text
    END
  WHERE ur.user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_supervisor(_user_id)
    OR COALESCE((
      SELECT CASE
        WHEN ur.custom_role_id IS NOT NULL THEN COALESCE((
          SELECT rp.allowed
          FROM public.role_permissions rp
          WHERE rp.role_key = ur.custom_role_id::text
            AND rp.permission_key = _permission_key
          LIMIT 1
        ), false)
        ELSE COALESCE((
          SELECT rp.allowed
          FROM public.role_permissions rp
          WHERE rp.role_key = ur.role::text
            AND rp.permission_key = _permission_key
          LIMIT 1
        ), true)
      END
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
      LIMIT 1
    ), false);
$$;