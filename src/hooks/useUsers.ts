import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
}

interface Invitation {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
  company_id: string;
  is_used: boolean;
  expires_at: string;
  created_at: string;
}

export function useUsers(companyId: string | null) {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const fetchUsers = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      // 1. Buscar usuários da empresa via user_companies
      const { data: userCompanies, error: ucError } = await supabase
        .from('user_companies')
        .select('user_id')
        .eq('company_id', companyId);

      if (ucError) throw ucError;

      const userIdsFromCompany = (userCompanies || []).map(uc => uc.user_id);

      // 2. Buscar supervisores (têm acesso a todas as empresas)
      const { data: supervisorRoles, error: supervisorError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'supervisor');

      if (supervisorError) throw supervisorError;

      const supervisorIds = (supervisorRoles || []).map(sr => sr.user_id);

      // 3. Combinar IDs únicos
      const userIds = [...new Set([...userIdsFromCompany, ...supervisorIds])];

      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Buscar perfis
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Buscar roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Combinar dados
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: userRole?.role || 'operador',
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  const fetchInvitations = useCallback(async () => {
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_used', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
    }
  }, [companyId]);

  useEffect(() => {
    fetchUsers();
    fetchInvitations();
  }, [fetchUsers, fetchInvitations]);

  const createInvitation = async (email: string, role: AppRole, name: string, expiresAt: string, inviteCompanyId?: string, companyLimitValue?: number | null): Promise<{ id: string; tempPassword: string } | null> => {
    const targetCompanyId = inviteCompanyId || companyId;
    if (!targetCompanyId) return null;

    try {
      // Generate a secure token using the database function
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_invitation_token');
      
      if (tokenError || !tokenData) {
        throw tokenError || new Error('Failed to generate token');
      }
      
      const token = tokenData as string;
      
      // Use first 8 characters as the user-visible code for simplicity
      const visibleCode = token.substring(0, 8).toUpperCase();
      
      // Hash the visible code (not the full token) so validation works correctly
      const { data: hashData, error: hashError } = await supabase
        .rpc('hash_invitation_token', { token: visibleCode });
      
      if (hashError || !hashData) {
        throw hashError || new Error('Failed to hash token');
      }
      
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          email,
          role,
          name,
          company_id: targetCompanyId,
          temp_password: visibleCode, // Store the visible code for reference
          token_hash: hashData as string,
          expires_at: expiresAt,
          company_limit: role === 'gerente' ? companyLimitValue : null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Log audit action
      await logAction({
        action: 'invitation_created',
        entity_type: 'invitation',
        entity_id: data.id,
        company_id: targetCompanyId,
        details: { email, role, name },
      });

      toast({
        title: 'Convite criado',
        description: `Convite criado para ${name}. Copie o link e a senha para enviar ao convidado.`,
      });

      await fetchInvitations();
      // Return the visible code for display to user
      return { id: data.id, tempPassword: visibleCode };
    } catch (error: any) {
      toast({
        title: 'Erro ao criar convite',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      // Log audit action
      await logAction({
        action: 'invitation_deleted',
        entity_type: 'invitation',
        entity_id: invitationId,
        company_id: companyId || undefined,
      });

      toast({
        title: 'Convite removido',
      });

      await fetchInvitations();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover convite',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      // Log audit action
      await logAction({
        action: 'user_role_updated',
        entity_type: 'user_role',
        entity_id: userId,
        company_id: companyId || undefined,
        details: { newRole },
      });

      toast({
        title: 'Cargo atualizado',
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar cargo',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const removeUserFromCompany = async (userId: string) => {
    if (!companyId) return;

    try {
      const { error } = await supabase
        .from('user_companies')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId);

      if (error) throw error;

      // Log audit action
      await logAction({
        action: 'user_removed',
        entity_type: 'user',
        entity_id: userId,
        company_id: companyId,
      });

      toast({
        title: 'Usuário removido da empresa',
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover usuário',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return {
    users,
    invitations,
    loading,
    createInvitation,
    deleteInvitation,
    updateUserRole,
    removeUserFromCompany,
    refetch: fetchUsers,
  };
}
