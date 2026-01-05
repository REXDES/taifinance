-- Add invitation_limit column to user_roles table
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS invitation_limit integer DEFAULT NULL;