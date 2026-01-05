-- Update handle_new_user function to also apply finance access from invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        VALUES (NEW.id, invitation_record.company_id);
        
        -- Inserir na tabela user_roles
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, invitation_record.role);
        
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
$$;