-- Create invitation_company_access table for multi-company access
CREATE TABLE IF NOT EXISTS public.invitation_company_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (invitation_id, company_id)
);

-- Create invitation_account_group_access table
CREATE TABLE IF NOT EXISTS public.invitation_account_group_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  account_group_id UUID NOT NULL REFERENCES public.account_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (invitation_id, account_group_id)
);

-- Create invitation_account_access table
CREATE TABLE IF NOT EXISTS public.invitation_account_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (invitation_id, account_id)
);

-- Create user_account_group_access table
CREATE TABLE IF NOT EXISTS public.user_account_group_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_group_id UUID NOT NULL REFERENCES public.account_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_group_id)
);

-- Create user_account_access table
CREATE TABLE IF NOT EXISTS public.user_account_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id)
);

-- Enable RLS on all tables
ALTER TABLE public.invitation_company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_account_group_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_account_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_account_group_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_account_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invitation_company_access
CREATE POLICY "Supervisors can manage invitation company access"
ON public.invitation_company_access FOR ALL
USING (public.is_supervisor(auth.uid()));

-- RLS Policies for invitation_account_group_access
CREATE POLICY "Supervisors can manage invitation account group access"
ON public.invitation_account_group_access FOR ALL
USING (public.is_supervisor(auth.uid()));

-- RLS Policies for invitation_account_access
CREATE POLICY "Supervisors can manage invitation account access"
ON public.invitation_account_access FOR ALL
USING (public.is_supervisor(auth.uid()));

-- RLS Policies for user_account_group_access
CREATE POLICY "Supervisors can manage user account group access"
ON public.user_account_group_access FOR ALL
USING (public.is_supervisor(auth.uid()));

CREATE POLICY "Users can view their own account group access"
ON public.user_account_group_access FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policies for user_account_access
CREATE POLICY "Supervisors can manage user account access"
ON public.user_account_access FOR ALL
USING (public.is_supervisor(auth.uid()));

CREATE POLICY "Users can view their own account access"
ON public.user_account_access FOR SELECT
USING (auth.uid() = user_id);

-- Add access_all column to invitations table if not exists
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS access_all BOOLEAN DEFAULT true;