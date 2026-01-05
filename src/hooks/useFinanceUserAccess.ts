import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanyAccess {
  id: string;
  company_id: string;
}

interface AccountGroupAccess {
  id: string;
  account_group_id: string;
}

interface AccountAccess {
  id: string;
  account_id: string;
}

interface UserRoleInfo {
  role: 'supervisor' | 'gerente' | 'operador';
  company_limit: number | null;
  invitation_limit: number | null;
}

export function useFinanceUserAccess(userId: string | null) {
  const [companyAccess, setCompanyAccess] = useState<CompanyAccess[]>([]);
  const [accountGroupAccess, setAccountGroupAccess] = useState<AccountGroupAccess[]>([]);
  const [accountAccess, setAccountAccess] = useState<AccountAccess[]>([]);
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAccess = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch all access types in parallel
      const [companyRes, groupRes, accountRes, roleRes] = await Promise.all([
        supabase
          .from('user_companies')
          .select('id, company_id')
          .eq('user_id', userId),
        supabase
          .from('user_account_group_access')
          .select('id, account_group_id')
          .eq('user_id', userId),
        supabase
          .from('user_account_access')
          .select('id, account_id')
          .eq('user_id', userId),
        supabase
          .from('user_roles')
          .select('role, company_limit, invitation_limit')
          .eq('user_id', userId)
          .single()
      ]);

      if (companyRes.error) throw companyRes.error;
      if (groupRes.error) throw groupRes.error;
      if (accountRes.error) throw accountRes.error;

      setCompanyAccess(companyRes.data || []);
      setAccountGroupAccess(groupRes.data || []);
      setAccountAccess(accountRes.data || []);
      setRoleInfo(roleRes.data || null);
    } catch (error: any) {
      console.error('Error fetching finance user access:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  // Company access methods
  const addCompanyAccess = async (companyId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_companies')
        .insert({ user_id: userId, company_id: companyId });

      if (error) throw error;
      toast({ title: 'Acesso à empresa adicionado' });
      await fetchAccess();
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Usuário já tem acesso a esta empresa' });
      } else {
        toast({ title: 'Erro ao adicionar acesso', description: error.message, variant: 'destructive' });
      }
    }
  };

  const removeCompanyAccess = async (companyId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_companies')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId);

      if (error) throw error;
      toast({ title: 'Acesso à empresa removido' });
      await fetchAccess();
    } catch (error: any) {
      toast({ title: 'Erro ao remover acesso', description: error.message, variant: 'destructive' });
    }
  };

  // Account group access methods
  const addAccountGroupAccess = async (accountGroupId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_account_group_access')
        .insert({ user_id: userId, account_group_id: accountGroupId });

      if (error) throw error;
      toast({ title: 'Acesso ao grupo adicionado' });
      await fetchAccess();
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Usuário já tem acesso a este grupo' });
      } else {
        toast({ title: 'Erro ao adicionar acesso', description: error.message, variant: 'destructive' });
      }
    }
  };

  const removeAccountGroupAccess = async (accountGroupId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_account_group_access')
        .delete()
        .eq('user_id', userId)
        .eq('account_group_id', accountGroupId);

      if (error) throw error;
      toast({ title: 'Acesso ao grupo removido' });
      await fetchAccess();
    } catch (error: any) {
      toast({ title: 'Erro ao remover acesso', description: error.message, variant: 'destructive' });
    }
  };

  // Account access methods
  const addAccountAccess = async (accountId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_account_access')
        .insert({ user_id: userId, account_id: accountId });

      if (error) throw error;
      toast({ title: 'Acesso à conta adicionado' });
      await fetchAccess();
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Usuário já tem acesso a esta conta' });
      } else {
        toast({ title: 'Erro ao adicionar acesso', description: error.message, variant: 'destructive' });
      }
    }
  };

  const removeAccountAccess = async (accountId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_account_access')
        .delete()
        .eq('user_id', userId)
        .eq('account_id', accountId);

      if (error) throw error;
      toast({ title: 'Acesso à conta removido' });
      await fetchAccess();
    } catch (error: any) {
      toast({ title: 'Erro ao remover acesso', description: error.message, variant: 'destructive' });
    }
  };

  // Update role and company limit
  const updateRole = async (newRole: 'supervisor' | 'gerente' | 'operador') => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;
      toast({ title: 'Cargo atualizado' });
      await fetchAccess();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar cargo', description: error.message, variant: 'destructive' });
    }
  };

  const updateCompanyLimit = async (limit: number | null) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ company_limit: limit })
        .eq('user_id', userId);

      if (error) throw error;
      toast({ title: 'Limite de empresas atualizado' });
      await fetchAccess();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar limite', description: error.message, variant: 'destructive' });
    }
  };

  const updateInvitationLimit = async (limit: number | null) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ invitation_limit: limit })
        .eq('user_id', userId);

      if (error) throw error;
      toast({ title: 'Limite de convites atualizado' });
      await fetchAccess();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar limite', description: error.message, variant: 'destructive' });
    }
  };

  // Check methods
  const hasCompanyAccess = (companyId: string) => companyAccess.some(c => c.company_id === companyId);
  const hasAccountGroupAccess = (groupId: string) => accountGroupAccess.some(g => g.account_group_id === groupId);
  const hasAccountAccess = (accountId: string) => accountAccess.some(a => a.account_id === accountId);

  return {
    companyAccess,
    accountGroupAccess,
    accountAccess,
    roleInfo,
    loading,
    addCompanyAccess,
    removeCompanyAccess,
    addAccountGroupAccess,
    removeAccountGroupAccess,
    addAccountAccess,
    removeAccountAccess,
    updateRole,
    updateCompanyLimit,
    updateInvitationLimit,
    hasCompanyAccess,
    hasAccountGroupAccess,
    hasAccountAccess,
    refetch: fetchAccess,
  };
}
