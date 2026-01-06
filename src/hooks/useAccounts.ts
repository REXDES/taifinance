import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AccountGroup {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string;
  type: 'ativo' | 'passivo';
  created_at: string;
}

export interface Account {
  id: string;
  company_id: string;
  group_id: string | null;
  name: string;
  description: string | null;
  initial_balance: number;
  current_balance: number;
  color: string;
  is_active: boolean;
  created_at: string;
  group?: AccountGroup;
}

export function useAccounts(companyId: string | null) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAccounts = useCallback(async () => {
    if (!companyId) {
      setAccounts([]);
      setGroups([]);
      setLoading(false);
      return;
    }

    try {
      const [accountsRes, groupsRes] = await Promise.all([
        supabase
          .from('accounts')
          .select('*, group:account_groups(*)')
          .eq('company_id', companyId)
          .order('name'),
        supabase
          .from('account_groups')
          .select('*')
          .eq('company_id', companyId)
          .order('name')
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (groupsRes.error) throw groupsRes.error;

      setAccounts((accountsRes.data || []) as Account[]);
      setGroups((groupsRes.data || []) as AccountGroup[]);
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      toast({ title: 'Erro ao carregar contas', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const createAccount = useCallback(async (data: {
    name: string;
    description?: string;
    group_id?: string;
    initial_balance?: number;
    color?: string;
  }) => {
    if (!companyId) return null;

    try {
      const { data: account, error } = await supabase
        .from('accounts')
        .insert({
          company_id: companyId,
          name: data.name,
          description: data.description || null,
          group_id: data.group_id || null,
          initial_balance: data.initial_balance || 0,
          current_balance: data.initial_balance || 0,
          color: data.color || '#10B981',
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchAccounts();
      toast({ title: 'Conta criada com sucesso' });
      return account;
    } catch (error: any) {
      toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [companyId, fetchAccounts, toast]);

  const updateAccount = useCallback(async (id: string, data: Partial<Account>) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      await fetchAccounts();
      toast({ title: 'Conta atualizada com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar conta', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchAccounts, toast]);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchAccounts();
      toast({ title: 'Conta excluída com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao excluir conta', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchAccounts, toast]);

  const createGroup = useCallback(async (data: { name: string; description?: string; color?: string; type?: 'ativo' | 'passivo' }) => {
    if (!companyId) return null;

    try {
      const { data: group, error } = await supabase
        .from('account_groups')
        .insert({
          company_id: companyId,
          name: data.name,
          description: data.description || null,
          color: data.color || '#3B82F6',
          type: data.type || 'ativo',
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchAccounts();
      toast({ title: 'Grupo criado com sucesso' });
      return group;
    } catch (error: any) {
      toast({ title: 'Erro ao criar grupo', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [companyId, fetchAccounts, toast]);

  const updateGroup = useCallback(async (id: string, data: Partial<AccountGroup>) => {
    try {
      const { error } = await supabase
        .from('account_groups')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      await fetchAccounts();
      toast({ title: 'Grupo atualizado com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar grupo', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchAccounts, toast]);

  const deleteGroup = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('account_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchAccounts();
      toast({ title: 'Grupo excluído com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao excluir grupo', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchAccounts, toast]);

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0);

  return {
    accounts,
    groups,
    loading,
    totalBalance,
    createAccount,
    updateAccount,
    deleteAccount,
    createGroup,
    updateGroup,
    deleteGroup,
    refetch: fetchAccounts,
  };
}
