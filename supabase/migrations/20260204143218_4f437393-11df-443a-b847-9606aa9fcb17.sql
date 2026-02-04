
-- Function to complete the invitation acceptance process
-- This should be called after the user successfully signs up
CREATE OR REPLACE FUNCTION public.accept_invitation(
  _invitation_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation record;
  _company_id uuid;
BEGIN
  -- Get the invitation
  SELECT * INTO _invitation
  FROM invitations
  WHERE id = _invitation_id
    AND is_used = false
    AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Mark invitation as used
  UPDATE invitations
  SET is_used = true
  WHERE id = _invitation_id;

  -- Create user role
  INSERT INTO user_roles (user_id, role, company_limit, invitation_limit)
  VALUES (
    _user_id, 
    _invitation.role,
    CASE WHEN _invitation.role = 'gerente' THEN _invitation.company_limit ELSE NULL END,
    CASE WHEN _invitation.role = 'gerente' THEN 5 ELSE NULL END -- Default invitation limit for gerentes
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = _invitation.role,
      company_limit = CASE WHEN _invitation.role = 'gerente' THEN _invitation.company_limit ELSE user_roles.company_limit END;

  -- Copy companies from invitation_company_access to user_companies
  -- First check if there are specific companies assigned
  IF EXISTS (SELECT 1 FROM invitation_company_access WHERE invitation_id = _invitation_id) THEN
    INSERT INTO user_companies (user_id, company_id)
    SELECT _user_id, ica.company_id
    FROM invitation_company_access ica
    WHERE ica.invitation_id = _invitation_id
    ON CONFLICT DO NOTHING;
  ELSE
    -- If no specific companies, assign to the main invitation company
    INSERT INTO user_companies (user_id, company_id)
    VALUES (_user_id, _invitation.company_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Copy account group access
  INSERT INTO user_account_group_access (user_id, account_group_id)
  SELECT _user_id, iaga.account_group_id
  FROM invitation_account_group_access iaga
  WHERE iaga.invitation_id = _invitation_id
  ON CONFLICT DO NOTHING;

  -- Copy account access
  INSERT INTO user_account_access (user_id, account_id)
  SELECT _user_id, iaa.account_id
  FROM invitation_account_access iaa
  WHERE iaa.invitation_id = _invitation_id
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

-- Function to check if an invitation has already been accepted (user exists for that email)
CREATE OR REPLACE FUNCTION public.check_invitation_status(_invitation_id uuid)
RETURNS TABLE(
  invitation_exists boolean,
  is_used boolean,
  is_expired boolean,
  user_exists boolean,
  user_email text,
  invitation_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation record;
  _user_exists boolean;
BEGIN
  -- Get invitation
  SELECT i.* INTO _invitation
  FROM invitations i
  WHERE i.id = _invitation_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, false, false, ''::text, ''::text;
    RETURN;
  END IF;

  -- Check if user with this email exists in profiles
  SELECT EXISTS(
    SELECT 1 FROM profiles p WHERE p.email = _invitation.email
  ) INTO _user_exists;

  RETURN QUERY SELECT 
    true,
    _invitation.is_used,
    _invitation.expires_at < now(),
    _user_exists,
    _invitation.email,
    _invitation.name;
END;
$$;

-- Add unique constraint to user_roles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_key'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END $$;
