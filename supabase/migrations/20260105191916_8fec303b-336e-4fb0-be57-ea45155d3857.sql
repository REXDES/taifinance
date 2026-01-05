-- Drop and recreate the hash function with explicit schema reference
DROP FUNCTION IF EXISTS public.hash_invitation_token(text);

CREATE OR REPLACE FUNCTION public.hash_invitation_token(token text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  SELECT encode(extensions.digest(token::bytea, 'sha256'), 'hex')
$$;

-- Also fix the validate function to use the correct search path
DROP FUNCTION IF EXISTS public.validate_invitation_token(uuid, text);

CREATE OR REPLACE FUNCTION public.validate_invitation_token(_invitation_id uuid, _token text)
RETURNS TABLE(
  id uuid,
  email text,
  name text,
  role app_role,
  company_id uuid,
  expires_at timestamptz,
  is_used boolean,
  is_valid boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  SELECT 
    i.id,
    i.email,
    i.name,
    i.role,
    i.company_id,
    i.expires_at,
    i.is_used,
    (i.token_hash = public.hash_invitation_token(_token) 
     AND i.is_used = false 
     AND i.expires_at > now()) as is_valid
  FROM public.invitations i
  WHERE i.id = _invitation_id
$$;