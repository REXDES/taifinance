import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Account } from './useAccounts';
import { TransactionCategory, TransactionSubcategory } from './useTransactionCategories';

export interface Transaction {
  id: string;
  company_id: string;
  account_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  account?: Account;
  category?: TransactionCategory;
  subcategory?: TransactionSubcategory;
}

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  type?: 'income' | 'expense';
  accountId?: string;
  categoryId?: string;
}

export function useTransactions(companyId: string | null, filters?: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTransactions = useCallback(async () => {
    if (!companyId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          account:accounts(*),
          category:transaction_categories(*),
          subcategory:transaction_subcategories(*)
        `)
        .eq('company_id', companyId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.accountId) {
        query = query.eq('account_id', filters.accountId);
      }
      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setTransactions((data || []).map(t => ({
        id: t.id,
        company_id: t.company_id,
        account_id: t.account_id,
        category_id: t.category_id,
        subcategory_id: t.subcategory_id,
        type: t.type as 'income' | 'expense',
        amount: Number(t.amount),
        description: t.description,
        date: t.date,
        notes: t.notes,
        created_by: t.created_by,
        created_at: t.created_at,
        account: t.account as Account | undefined,
        category: t.category ? { ...t.category, type: t.category.type as 'income' | 'expense' | 'both' } : undefined,
        subcategory: t.subcategory as TransactionSubcategory | undefined,
      })));
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast({ title: 'Erro ao carregar transações', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, filters?.startDate, filters?.endDate, filters?.type, filters?.accountId, filters?.categoryId, toast]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const createTransaction = useCallback(async (data: {
    account_id: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    date: string;
    category_id?: string;
    subcategory_id?: string;
    notes?: string;
  }) => {
    if (!companyId) return null;

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: transaction, error } = await supabase
        .from('transactions')
        .insert({
          company_id: companyId,
          account_id: data.account_id,
          type: data.type,
          amount: data.amount,
          description: data.description,
          date: data.date,
          category_id: data.category_id || null,
          subcategory_id: data.subcategory_id || null,
          notes: data.notes || null,
          created_by: user?.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchTransactions();
      toast({ title: data.type === 'income' ? 'Receita lançada com sucesso' : 'Despesa lançada com sucesso' });
      return transaction;
    } catch (error: any) {
      toast({ title: 'Erro ao criar transação', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [companyId, fetchTransactions, toast]);

  const updateTransaction = useCallback(async (id: string, data: Partial<Transaction>) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      await fetchTransactions();
      toast({ title: 'Transação atualizada com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar transação', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchTransactions, toast]);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchTransactions();
      toast({ title: 'Transação excluída com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao excluir transação', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchTransactions, toast]);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    transactions,
    loading,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refetch: fetchTransactions,
  };
}
