import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface StatementEntry {
  id: string;
  date: string;
  description: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  amount: number;
  balance: number;
  category?: string;
  subcategory?: string;
  relatedAccount?: string;
}

export function useAccountStatement(accountId: string | null, startDate?: string, endDate?: string, categoryId?: string, subcategoryId?: string) {
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [account, setAccount] = useState<{ id: string; name: string; initial_balance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStatement = useCallback(async () => {
    if (!accountId) {
      setEntries([]);
      setAccount(null);
      setLoading(false);
      return;
    }

    try {
      // Fetch account info
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('id, name, initial_balance')
        .eq('id', accountId)
        .single();

      if (accountError) throw accountError;
      setAccount(accountData);

      // Fetch transactions
      let transactionsQuery = supabase
        .from('transactions')
        .select(`
          id, date, description, type, amount,
          category:transaction_categories(name),
          subcategory:transaction_subcategories(name)
        `)
        .eq('account_id', accountId)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });

      if (startDate) transactionsQuery = transactionsQuery.gte('date', startDate);
      if (endDate) transactionsQuery = transactionsQuery.lte('date', endDate);
      if (categoryId) transactionsQuery = transactionsQuery.eq('category_id', categoryId);

      // Fetch transfers (incoming)
      let transfersInQuery = supabase
        .from('transfers')
        .select(`
          id, date, description, amount,
          from_account:accounts!transfers_from_account_id_fkey(name)
        `)
        .eq('to_account_id', accountId)
        .order('date', { ascending: true });

      if (startDate) transfersInQuery = transfersInQuery.gte('date', startDate);
      if (endDate) transfersInQuery = transfersInQuery.lte('date', endDate);

      // Fetch transfers (outgoing)
      let transfersOutQuery = supabase
        .from('transfers')
        .select(`
          id, date, description, amount,
          to_account:accounts!transfers_to_account_id_fkey(name)
        `)
        .eq('from_account_id', accountId)
        .order('date', { ascending: true });

      if (startDate) transfersOutQuery = transfersOutQuery.gte('date', startDate);
      if (endDate) transfersOutQuery = transfersOutQuery.lte('date', endDate);

      const [transactionsRes, transfersInRes, transfersOutRes] = await Promise.all([
        transactionsQuery,
        transfersInQuery,
        transfersOutQuery,
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (transfersInRes.error) throw transfersInRes.error;
      if (transfersOutRes.error) throw transfersOutRes.error;

      // Combine and format entries
      const allEntries: StatementEntry[] = [];

      // Add transactions
      (transactionsRes.data || []).forEach((t: any) => {
        allEntries.push({
          id: t.id,
          date: t.date,
          description: t.description,
          type: t.type as 'income' | 'expense',
          amount: Number(t.amount),
          balance: 0, // Will calculate later
          category: t.category?.name,
          subcategory: t.subcategory?.name,
        });
      });

      // Add incoming transfers
      (transfersInRes.data || []).forEach((t: any) => {
        allEntries.push({
          id: `transfer-in-${t.id}`,
          date: t.date,
          description: t.description || `Transferência de ${t.from_account?.name}`,
          type: 'transfer_in',
          amount: Number(t.amount),
          balance: 0,
          relatedAccount: t.from_account?.name,
        });
      });

      // Add outgoing transfers
      (transfersOutRes.data || []).forEach((t: any) => {
        allEntries.push({
          id: `transfer-out-${t.id}`,
          date: t.date,
          description: t.description || `Transferência para ${t.to_account?.name}`,
          type: 'transfer_out',
          amount: Number(t.amount),
          balance: 0,
          relatedAccount: t.to_account?.name,
        });
      });

      // Sort by date
      allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance
      let runningBalance = Number(accountData.initial_balance);
      
      // If we have a start date filter, we need to calculate the balance up to that date
      if (startDate) {
        const { data: priorTransactions } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('account_id', accountId)
          .lt('date', startDate);

        const { data: priorTransfersIn } = await supabase
          .from('transfers')
          .select('amount')
          .eq('to_account_id', accountId)
          .lt('date', startDate);

        const { data: priorTransfersOut } = await supabase
          .from('transfers')
          .select('amount')
          .eq('from_account_id', accountId)
          .lt('date', startDate);

        (priorTransactions || []).forEach((t: any) => {
          if (t.type === 'income') {
            runningBalance += Number(t.amount);
          } else {
            runningBalance -= Number(t.amount);
          }
        });

        (priorTransfersIn || []).forEach((t: any) => {
          runningBalance += Number(t.amount);
        });

        (priorTransfersOut || []).forEach((t: any) => {
          runningBalance -= Number(t.amount);
        });
      }

      // Apply running balance to entries
      allEntries.forEach(entry => {
        if (entry.type === 'income' || entry.type === 'transfer_in') {
          runningBalance += entry.amount;
        } else {
          runningBalance -= entry.amount;
        }
        entry.balance = runningBalance;
      });

      setEntries(allEntries);
    } catch (error: any) {
      console.error('Error fetching statement:', error);
      toast({ title: 'Erro ao carregar extrato', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [accountId, startDate, endDate, categoryId, toast]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const totals = useMemo(() => {
    const income = entries
      .filter(e => e.type === 'income' || e.type === 'transfer_in')
      .reduce((sum, e) => sum + e.amount, 0);
    const expense = entries
      .filter(e => e.type === 'expense' || e.type === 'transfer_out')
      .reduce((sum, e) => sum + e.amount, 0);
    return { income, expense, net: income - expense };
  }, [entries]);

  return {
    entries,
    account,
    loading,
    totals,
    refetch: fetchStatement,
  };
}
