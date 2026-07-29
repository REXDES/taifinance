
-- 1. custom_roles table
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text NOT NULL DEFAULT '#6366f1',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read custom roles"
  ON public.custom_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only supervisor can insert custom roles"
  ON public.custom_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "Only supervisor can update custom roles"
  ON public.custom_roles FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "Only supervisor can delete custom roles"
  ON public.custom_roles FOR DELETE TO authenticated
  USING (public.is_supervisor(auth.uid()));

CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_key, permission_key)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read role permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only supervisor can insert role permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "Only supervisor can update role permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "Only supervisor can delete role permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.is_supervisor(auth.uid()));

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. user_roles.custom_role_id
ALTER TABLE public.user_roles
  ADD COLUMN custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- 4. has_permission function
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- supervisor always yes
    public.is_supervisor(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp_base
        ON rp_base.role_key = ur.role::text
       AND rp_base.permission_key = _permission_key
      LEFT JOIN public.role_permissions rp_custom
        ON ur.custom_role_id IS NOT NULL
       AND rp_custom.role_key = ur.custom_role_id::text
       AND rp_custom.permission_key = _permission_key
      WHERE ur.user_id = _user_id
        AND (
          COALESCE(rp_custom.allowed, rp_base.allowed, true) = true
        )
    );
$$;

-- 5. Helper: get all permissions for a user (returns rows of permission_key)
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_key text, allowed boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rp.permission_key, bool_or(rp.allowed) AS allowed
  FROM public.user_roles ur
  JOIN public.role_permissions rp
    ON rp.role_key = ur.role::text
    OR (ur.custom_role_id IS NOT NULL AND rp.role_key = ur.custom_role_id::text)
  WHERE ur.user_id = _user_id
  GROUP BY rp.permission_key;
$$;
