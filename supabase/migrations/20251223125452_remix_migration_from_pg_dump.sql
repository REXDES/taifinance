CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'supervisor',
    'gerente',
    'operador'
);


--
-- Name: generate_invitation_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invitation_token() RETURNS text
    LANGUAGE sql
    AS $$
  SELECT encode(gen_random_bytes(32), 'hex')
$$;


--
-- Name: get_invitation_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invitation_by_id(_invitation_id uuid) RETURNS TABLE(id uuid, email text, name text, role public.app_role, company_id uuid, expires_at timestamp with time zone, is_used boolean, temp_password text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    i.id,
    i.email,
    i.name,
    i.role,
    i.company_id,
    i.expires_at,
    i.is_used,
    i.temp_password
  FROM public.invitations i
  WHERE i.id = _invitation_id
$$;


--
-- Name: get_user_company_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_company_ids(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT company_id FROM public.user_companies WHERE user_id = _user_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
        
        -- Aplicar acessos a projetos do convite
        FOR access_record IN 
            SELECT DISTINCT project_id FROM public.invitation_access 
            WHERE invitation_id = invitation_record.id AND project_id IS NOT NULL
        LOOP
            INSERT INTO public.user_project_access (user_id, project_id)
            VALUES (NEW.id, access_record.project_id)
            ON CONFLICT (user_id, project_id) DO NOTHING;
        END LOOP;
        
        -- Aplicar acessos a elementos do convite
        FOR access_record IN 
            SELECT DISTINCT element_id FROM public.invitation_access 
            WHERE invitation_id = invitation_record.id AND element_id IS NOT NULL
        LOOP
            INSERT INTO public.user_element_access (user_id, element_id)
            VALUES (NEW.id, access_record.element_id)
            ON CONFLICT (user_id, element_id) DO NOTHING;
        END LOOP;
        
        -- Marcar convite como usado
        UPDATE public.invitations
        SET is_used = true
        WHERE id = invitation_record.id;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: has_company_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_company_access(_user_id uuid, _company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT public.is_supervisor(_user_id) OR EXISTS (
        SELECT 1 FROM public.user_companies 
        WHERE user_id = _user_id AND company_id = _company_id
    )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;


--
-- Name: hash_invitation_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hash_invitation_token(token text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT encode(digest(token, 'sha256'), 'hex')
$$;


--
-- Name: is_supervisor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_supervisor(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT public.has_role(_user_id, 'supervisor')
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: validate_invitation_token(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_invitation_token(_invitation_id uuid, _token text) RETURNS TABLE(id uuid, email text, name text, role public.app_role, company_id uuid, expires_at timestamp with time zone, is_used boolean, is_valid boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


SET default_table_access_method = heap;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: element_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.element_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    element_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: element_work_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.element_work_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    element_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.elements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#10B981'::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invitation_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitation_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invitation_id uuid NOT NULL,
    project_id uuid,
    element_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    temp_password text NOT NULL,
    company_id uuid NOT NULL,
    role public.app_role DEFAULT 'operador'::public.app_role NOT NULL,
    invited_by uuid,
    is_used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    name text,
    token_hash text
);


--
-- Name: meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    element_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    meeting_type text DEFAULT 'meeting'::text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    reference_type text,
    reference_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subscription jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: status_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6B7280'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    element_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    observation text,
    estimated_value numeric(12,2),
    status_id uuid,
    start_date date,
    end_date date,
    responsible_id uuid,
    color text DEFAULT '#8B5CF6'::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    priority integer DEFAULT 0,
    is_hidden boolean DEFAULT false NOT NULL,
    parent_task_id uuid,
    CONSTRAINT tasks_priority_check CHECK (((priority >= 0) AND (priority <= 5)))
);


--
-- Name: user_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_element_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_element_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    element_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_project_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_project_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'operador'::public.app_role NOT NULL
);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: element_favorites element_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.element_favorites
    ADD CONSTRAINT element_favorites_pkey PRIMARY KEY (id);


--
-- Name: element_favorites element_favorites_user_id_element_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.element_favorites
    ADD CONSTRAINT element_favorites_user_id_element_id_key UNIQUE (user_id, element_id);


--
-- Name: element_work_groups element_work_groups_element_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.element_work_groups
    ADD CONSTRAINT element_work_groups_element_id_user_id_key UNIQUE (element_id, user_id);


--
-- Name: element_work_groups element_work_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.element_work_groups
    ADD CONSTRAINT element_work_groups_pkey PRIMARY KEY (id);


--
-- Name: elements elements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elements
    ADD CONSTRAINT elements_pkey PRIMARY KEY (id);


--
-- Name: invitation_access invitation_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_access
    ADD CONSTRAINT invitation_access_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_user_id_subscription_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_subscription_key UNIQUE (user_id, subscription);


--
-- Name: status_configs status_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_configs
    ADD CONSTRAINT status_configs_pkey PRIMARY KEY (id);


--
-- Name: task_attachments task_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: user_companies user_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_pkey PRIMARY KEY (id);


--
-- Name: user_companies user_companies_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_user_id_company_id_key UNIQUE (user_id, company_id);


--
-- Name: user_element_access user_element_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_element_access
    ADD CONSTRAINT user_element_access_pkey PRIMARY KEY (id);


--
-- Name: user_element_access user_element_access_user_id_element_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_element_access
    ADD CONSTRAINT user_element_access_user_id_element_id_key UNIQUE (user_id, element_id);


--
-- Name: user_project_access user_project_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_project_access
    ADD CONSTRAINT user_project_access_pkey PRIMARY KEY (id);


--
-- Name: user_project_access user_project_access_user_id_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_project_access
    ADD CONSTRAINT user_project_access_user_id_project_id_key UNIQUE (user_id, project_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_tasks_is_hidden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_is_hidden ON public.tasks USING btree (is_hidden);


--
-- Name: idx_tasks_parent_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_parent_task_id ON public.tasks USING btree (parent_task_id);


--
-- Name: companies update_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: elements update_elements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_elements_updated_at BEFORE UPDATE ON public.elements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: status_configs update_status_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_status_configs_updated_at BEFORE UPDATE ON public.status_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tasks update_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: element_favorites element_favorites_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.element_favorites
    ADD CONSTRAINT element_favorites_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: element_work_groups element_work_groups_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.element_work_groups
    ADD CONSTRAINT element_work_groups_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.profiles(user_id);


--
-- Name: element_work_groups element_work_groups_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.element_work_groups
    ADD CONSTRAINT element_work_groups_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: element_work_groups element_work_groups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.element_work_groups
    ADD CONSTRAINT element_work_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: elements elements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elements
    ADD CONSTRAINT elements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: elements elements_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elements
    ADD CONSTRAINT elements_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: invitation_access invitation_access_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_access
    ADD CONSTRAINT invitation_access_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: invitation_access invitation_access_invitation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_access
    ADD CONSTRAINT invitation_access_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.invitations(id) ON DELETE CASCADE;


--
-- Name: invitation_access invitation_access_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_access
    ADD CONSTRAINT invitation_access_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: status_configs status_configs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_configs
    ADD CONSTRAINT status_configs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_parent_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_responsible_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.status_configs(id) ON DELETE SET NULL;


--
-- Name: user_companies user_companies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: user_companies user_companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_element_access user_element_access_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_element_access
    ADD CONSTRAINT user_element_access_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: user_project_access user_project_access_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_project_access
    ADD CONSTRAINT user_project_access_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_element_access Gerentes can manage element access in their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gerentes can manage element access in their companies" ON public.user_element_access USING ((public.has_role(auth.uid(), 'gerente'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.elements e
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((e.id = user_element_access.element_id) AND public.has_company_access(auth.uid(), p.company_id))))));


--
-- Name: user_project_access Gerentes can manage project access in their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gerentes can manage project access in their companies" ON public.user_project_access USING ((public.has_role(auth.uid(), 'gerente'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = user_project_access.project_id) AND public.has_company_access(auth.uid(), p.company_id))))));


--
-- Name: projects Operadores can insert projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Operadores can insert projects" ON public.projects FOR INSERT WITH CHECK (public.has_company_access(auth.uid(), company_id));


--
-- Name: invitations Supervisors and gerentes can create invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors and gerentes can create invitations" ON public.invitations FOR INSERT WITH CHECK ((public.is_supervisor(auth.uid()) OR (public.has_role(auth.uid(), 'gerente'::public.app_role) AND public.has_company_access(auth.uid(), company_id))));


--
-- Name: invitations Supervisors and gerentes can delete invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors and gerentes can delete invitations" ON public.invitations FOR DELETE USING ((public.is_supervisor(auth.uid()) OR (public.has_role(auth.uid(), 'gerente'::public.app_role) AND public.has_company_access(auth.uid(), company_id))));


--
-- Name: invitation_access Supervisors and gerentes can manage invitation access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors and gerentes can manage invitation access" ON public.invitation_access USING ((public.is_supervisor(auth.uid()) OR (public.has_role(auth.uid(), 'gerente'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.invitations i
  WHERE ((i.id = invitation_access.invitation_id) AND public.has_company_access(auth.uid(), i.company_id)))))));


--
-- Name: projects Supervisors and gerentes can manage projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors and gerentes can manage projects" ON public.projects USING ((public.is_supervisor(auth.uid()) OR (public.has_role(auth.uid(), 'gerente'::public.app_role) AND public.has_company_access(auth.uid(), company_id))));


--
-- Name: status_configs Supervisors and gerentes can manage status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors and gerentes can manage status" ON public.status_configs USING ((public.is_supervisor(auth.uid()) OR (public.has_role(auth.uid(), 'gerente'::public.app_role) AND public.has_company_access(auth.uid(), company_id))));


--
-- Name: invitations Supervisors and gerentes can update invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors and gerentes can update invitations" ON public.invitations FOR UPDATE USING ((public.is_supervisor(auth.uid()) OR (public.has_role(auth.uid(), 'gerente'::public.app_role) AND public.has_company_access(auth.uid(), company_id))));


--
-- Name: user_element_access Supervisors can manage all element access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors can manage all element access" ON public.user_element_access USING (public.is_supervisor(auth.uid()));


--
-- Name: user_project_access Supervisors can manage all project access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors can manage all project access" ON public.user_project_access USING (public.is_supervisor(auth.uid()));


--
-- Name: companies Supervisors can manage companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors can manage companies" ON public.companies USING (public.is_supervisor(auth.uid()));


--
-- Name: user_roles Supervisors can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors can manage roles" ON public.user_roles USING (public.is_supervisor(auth.uid()));


--
-- Name: user_companies Supervisors can manage user_companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors can manage user_companies" ON public.user_companies USING (public.is_supervisor(auth.uid()));


--
-- Name: companies Supervisors can view all companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors can view all companies" ON public.companies FOR SELECT USING (public.is_supervisor(auth.uid()));


--
-- Name: notifications System can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: task_attachments Users can add attachments to accessible tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add attachments to accessible tasks" ON public.task_attachments FOR INSERT WITH CHECK (((uploaded_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM ((public.tasks t
     JOIN public.elements e ON ((e.id = t.element_id)))
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((t.id = task_attachments.task_id) AND public.has_company_access(auth.uid(), p.company_id))))));


--
-- Name: task_comments Users can add comments to accessible tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add comments to accessible tasks" ON public.task_comments FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM ((public.tasks t
     JOIN public.elements e ON ((e.id = t.element_id)))
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((t.id = task_comments.task_id) AND public.has_company_access(auth.uid(), p.company_id))))));


--
-- Name: task_attachments Users can delete their own attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own attachments" ON public.task_attachments FOR DELETE USING ((uploaded_by = auth.uid()));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: elements Users can manage elements in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage elements in their projects" ON public.elements USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = elements.project_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: meetings Users can manage meetings in their elements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage meetings in their elements" ON public.meetings USING ((EXISTS ( SELECT 1
   FROM (public.elements e
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((e.id = meetings.element_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: tasks Users can manage tasks in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage tasks in their projects" ON public.tasks USING ((EXISTS ( SELECT 1
   FROM (public.elements e
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((e.id = tasks.element_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: element_favorites Users can manage their own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own favorites" ON public.element_favorites USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: push_subscriptions Users can manage their own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own push subscriptions" ON public.push_subscriptions USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: element_work_groups Users can manage work groups in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage work groups in their projects" ON public.element_work_groups USING ((EXISTS ( SELECT 1
   FROM (public.elements e
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((e.id = element_work_groups.element_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: task_attachments Users can view attachments on accessible tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view attachments on accessible tasks" ON public.task_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.tasks t
     JOIN public.elements e ON ((e.id = t.element_id)))
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((t.id = task_attachments.task_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: task_comments Users can view comments on accessible tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view comments on accessible tasks" ON public.task_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.tasks t
     JOIN public.elements e ON ((e.id = t.element_id)))
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((t.id = task_comments.task_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: elements Users can view elements in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view elements in their projects" ON public.elements FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = elements.project_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: invitation_access Users can view invitation access for their company invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view invitation access for their company invitations" ON public.invitation_access FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.invitations i
  WHERE ((i.id = invitation_access.invitation_id) AND (public.is_supervisor(auth.uid()) OR public.has_company_access(auth.uid(), i.company_id))))));


--
-- Name: invitations Users can view invitation metadata in their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view invitation metadata in their companies" ON public.invitations FOR SELECT USING ((public.is_supervisor(auth.uid()) OR (public.has_role(auth.uid(), 'gerente'::public.app_role) AND public.has_company_access(auth.uid(), company_id))));


--
-- Name: meetings Users can view meetings in their elements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view meetings in their elements" ON public.meetings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.elements e
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((e.id = meetings.element_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: profiles Users can view profiles in their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view profiles in their companies" ON public.profiles FOR SELECT USING ((public.is_supervisor(auth.uid()) OR (user_id IN ( SELECT uc.user_id
   FROM public.user_companies uc
  WHERE (uc.company_id IN ( SELECT public.get_user_company_ids(auth.uid()) AS get_user_company_ids))))));


--
-- Name: projects Users can view projects in their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view projects in their companies" ON public.projects FOR SELECT USING (public.has_company_access(auth.uid(), company_id));


--
-- Name: status_configs Users can view status in their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view status in their companies" ON public.status_configs FOR SELECT USING (public.has_company_access(auth.uid(), company_id));


--
-- Name: tasks Users can view tasks in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tasks in their projects" ON public.tasks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.elements e
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((e.id = tasks.element_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: companies Users can view their assigned companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their assigned companies" ON public.companies FOR SELECT USING ((id IN ( SELECT public.get_user_company_ids(auth.uid()) AS get_user_company_ids)));


--
-- Name: user_companies Users can view their own company assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own company assignments" ON public.user_companies FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_element_access Users can view their own element access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own element access" ON public.user_element_access FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: element_favorites Users can view their own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own favorites" ON public.element_favorites FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_project_access Users can view their own project access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own project access" ON public.user_project_access FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_roles Users can view their own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: element_work_groups Users can view work groups in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view work groups in their projects" ON public.element_work_groups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.elements e
     JOIN public.projects p ON ((p.id = e.project_id)))
  WHERE ((e.id = element_work_groups.element_id) AND public.has_company_access(auth.uid(), p.company_id)))));


--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: element_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.element_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: element_work_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.element_work_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: elements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.elements ENABLE ROW LEVEL SECURITY;

--
-- Name: invitation_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitation_access ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: meetings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: status_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.status_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: task_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

--
-- Name: user_element_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_element_access ENABLE ROW LEVEL SECURITY;

--
-- Name: user_project_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_project_access ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;