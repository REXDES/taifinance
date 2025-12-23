import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Account } from './useAccounts';

export interface Transfer {
  id: string;
  company_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description: string | null;
  date: string;
  created_by: string | null;
  created_at: string;
  from_account?: Account;
  to_account?: Account;
}

export function useTransfers(companyId: string | null) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTransfers = useCallback(async () => {
    if (!companyId) {
      setTransfers([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('transfers')
        .select(`
          *,
          from_account:accounts!transfers_from_account_id_fkey(*),
          to_account:accounts!transfers_to_account_id_fkey(*)
        `)
        .eq('company_id', companyId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransfers((data || []).map(t => ({
        ...t,
        amount: Number(t.amount),
      })));
    } catch (error: any) {
      console.error('Error fetching transfers:', error);
      toast({ title: 'Erro ao carregar transferências', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const createTransfer = useCallback(async (data: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    description?: string;
    date: string;
  }) => {
    if (!companyId) return null;

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: transfer, error } = await supabase
        .from('transfers')
        .insert({
          company_id: companyId,
          from_account_id: data.from_account_id,
          to_account_id: data.to_account_id,
          amount: data.amount,
          description: data.description || null,
          date: data.date,
          created_by: user?.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchTransfers();
      toast({ title: 'Transferência realizada com sucesso' });
      return transfer;
    } catch (error: any) {
      toast({ title: 'Erro ao realizar transferência', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [companyId, fetchTransfers, toast]);

  const deleteTransfer = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('transfers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchTransfers();
      toast({ title: 'Transferência excluída com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao excluir transferência', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchTransfers, toast]);

  return {
    transfers,
    loading,
    createTransfer,
    deleteTransfer,
    refetch: fetchTransfers,
  };
}
