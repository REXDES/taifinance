-- Adiciona coluna custom_role_id em invitations
ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Atualiza função handle_new_user para propagar custom_role_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    invitation_record RECORD;
    access_record RECORD;
BEGIN
    -- Criar perfil do usuário
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
    );
    
    -- Verificar se existe convite válido para este email
    SELECT * INTO invitation_record
    FROM public.invitations
    WHERE email = NEW.email
      AND is_used = false
      AND expires_at > now()
    LIMIT 1;
    
    -- Se encontrou convite válido, associar usuário à empresa
    IF invitation_record.id IS NOT NULL THEN
        -- Inserir na tabela user_companies
        INSERT INTO public.user_companies (user_id, company_id)
        VALUES (NEW.id, invitation_record.company_id)
        ON CONFLICT DO NOTHING;
        
        -- Inserir na tabela user_roles with company_limit e custom_role_id
        INSERT INTO public.user_roles (user_id, role, company_limit, custom_role_id)
        VALUES (NEW.id, invitation_record.role, invitation_record.company_limit, invitation_record.custom_role_id)
        ON CONFLICT (user_id) DO UPDATE
        SET role = invitation_record.role,
            company_limit = invitation_record.company_limit,
            custom_role_id = invitation_record.custom_role_id;
        
        -- Aplicar acessos a projetos do convite (legacy)
        FOR access_record IN 
            SELECT DISTINCT project_id FROM public.invitation_access 
            WHERE invitation_id = invitation_record.id AND project_id IS NOT NULL
        LOOP
            INSERT INTO public.user_project_access (user_id, project_id)
            VALUES (NEW.id, access_record.project_id)
            ON CONFLICT (user_id, project_id) DO NOTHING;
        END LOOP;
        
        -- Aplicar acessos a elementos do convite (legacy)
        FOR access_record IN 
            SELECT DISTINCT element_id FROM public.invitation_access 
            WHERE invitation_id = invitation_record.id AND element_id IS NOT NULL
        LOOP
            INSERT INTO public.user_element_access (user_id, element_id)
            VALUES (NEW.id, access_record.element_id)
            ON CONFLICT (user_id, element_id) DO NOTHING;
        END LOOP;
        
        -- Aplicar acessos a empresas adicionais do convite (finance)
        FOR access_record IN 
            SELECT DISTINCT company_id FROM public.invitation_company_access 
            WHERE invitation_id = invitation_record.id
        LOOP
            INSERT INTO public.user_companies (user_id, company_id)
            VALUES (NEW.id, access_record.company_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
        
        -- Aplicar acessos a grupos de contas do convite (finance)
        FOR access_record IN 
            SELECT DISTINCT account_group_id FROM public.invitation_account_group_access 
            WHERE invitation_id = invitation_record.id
        LOOP
            INSERT INTO public.user_account_group_access (user_id, account_group_id)
            VALUES (NEW.id, access_record.account_group_id)
            ON CONFLICT (user_id, account_group_id) DO NOTHING;
        END LOOP;
        
        -- Aplicar acessos a contas do convite (finance)
        FOR access_record IN 
            SELECT DISTINCT account_id FROM public.invitation_account_access 
            WHERE invitation_id = invitation_record.id
        LOOP
            INSERT INTO public.user_account_access (user_id, account_id)
            VALUES (NEW.id, access_record.account_id)
            ON CONFLICT (user_id, account_id) DO NOTHING;
        END LOOP;
        
        -- Marcar convite como usado
        UPDATE public.invitations
        SET is_used = true
        WHERE id = invitation_record.id;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Atualiza função accept_invitation para propagar custom_role_id
CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
  INSERT INTO user_roles (user_id, role, company_limit, invitation_limit, custom_role_id)
  VALUES (
    _user_id, 
    _invitation.role,
    CASE WHEN _invitation.role = 'gerente' THEN _invitation.company_limit ELSE NULL END,
    CASE WHEN _invitation.role = 'gerente' THEN 5 ELSE NULL END,
    _invitation.custom_role_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = _invitation.role,
      company_limit = CASE WHEN _invitation.role = 'gerente' THEN _invitation.company_limit ELSE user_roles.company_limit END,
      custom_role_id = COALESCE(_invitation.custom_role_id, user_roles.custom_role_id);

  -- Copy companies from invitation_company_access to user_companies
  IF EXISTS (SELECT 1 FROM invitation_company_access WHERE invitation_id = _invitation_id) THEN
    INSERT INTO user_companies (user_id, company_id)
    SELECT _user_id, ica.company_id
    FROM invitation_company_access ica
    WHERE ica.invitation_id = _invitation_id
    ON CONFLICT DO NOTHING;
  ELSE
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
$function$;