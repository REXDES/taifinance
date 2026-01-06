import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { addMonths, format } from 'date-fns';

export interface PayableReceivable {
  id: string;
  company_id: string;
  type: 'payable' | 'receivable';
  payment_type: 'single' | 'installment' | 'recurring';
  description: string;
  amount: number;
  due_date: string;
  category_id: string | null;
  subcategory_id: string | null;
  client_supplier_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  parent_id: string | null;
  status: 'pending' | 'paid' | 'cancelled';
  paid_amount: number | null;
  paid_date: string | null;
  paid_account_id: string | null;
  transaction_id: string | null;
  created_by: string | null;
  paid_by: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; color: string } | null;
  subcategory?: { id: string; name: string } | null;
  client_supplier?: { id: string; name: string; type: string } | null;
  account?: { id: string; name: string } | null;
}

export interface PayableReceivableFilters {
  startDate?: string;
  endDate?: string;
  type?: 'payable' | 'receivable';
  status?: 'pending' | 'paid' | 'cancelled';
  clientSupplierId?: string;
}

export function usePayablesReceivables(companyId: string | null, filters?: PayableReceivableFilters) {
  const [payablesReceivables, setPayablesReceivables] = useState<PayableReceivable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayablesReceivables = useCallback(async () => {
    if (!companyId) {
      setPayablesReceivables([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('payables_receivables')
        .select(`
          *,
          category:transaction_categories(id, name, color),
          subcategory:transaction_subcategories(id, name),
          client_supplier:clients_suppliers(id, name, type),
          account:accounts(id, name)
        `)
        .eq('company_id', companyId)
        .order('due_date', { ascending: true });

      if (filters?.startDate) {
        query = query.gte('due_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('due_date', filters.endDate);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.clientSupplierId) {
        query = query.eq('client_supplier_id', filters.clientSupplierId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPayablesReceivables((data || []) as PayableReceivable[]);
    } catch (error) {
      console.error('Error fetching payables/receivables:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, filters?.startDate, filters?.endDate, filters?.type, filters?.status, filters?.clientSupplierId]);

  useEffect(() => {
    fetchPayablesReceivables();
  }, [fetchPayablesReceivables]);

  const createPayableReceivable = async (
    data: Omit<PayableReceivable, 'id' | 'created_at' | 'updated_at' | 'category' | 'subcategory' | 'client_supplier' | 'account'>,
    installments?: number
  ) => {
    const { data: user } = await supabase.auth.getUser();
    const userId = user?.user?.id;

    if (data.payment_type === 'single') {
      const { error } = await supabase
        .from('payables_receivables')
        .insert({ ...data, created_by: userId });
      if (error) throw error;
    } else if (data.payment_type === 'installment' && installments) {
      const installmentAmount = data.amount / installments;
      const records = [];
      
      // Create parent record
      const { data: parent, error: parentError } = await supabase
        .from('payables_receivables')
        .insert({
          ...data,
          created_by: userId,
          installment_number: 1,
          total_installments: installments,
          amount: installmentAmount
        })
        .select()
        .single();
      
      if (parentError) throw parentError;

      // Create child installments
      for (let i = 2; i <= installments; i++) {
        records.push({
          ...data,
          created_by: userId,
          due_date: format(addMonths(new Date(data.due_date), i - 1), 'yyyy-MM-dd'),
          installment_number: i,
          total_installments: installments,
          parent_id: parent.id,
          amount: installmentAmount
        });
      }

      if (records.length > 0) {
        const { error } = await supabase
          .from('payables_receivables')
          .insert(records);
        if (error) throw error;
      }
    } else if (data.payment_type === 'recurring') {
      // Create only for next month
      const { error } = await supabase
        .from('payables_receivables')
        .insert({ ...data, created_by: userId });
      if (error) throw error;
    }

    await fetchPayablesReceivables();
  };

  const effectuatePayment = async (
    id: string,
    paidAmount: number,
    paidDate: string,
    accountId: string,
    transactionType: 'income' | 'expense'
  ) => {
    const { data: user } = await supabase.auth.getUser();
    const userId = user?.user?.id;

    // Get the payable/receivable record
    const { data: record, error: fetchError } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Create transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        company_id: record.company_id,
        account_id: accountId,
        type: transactionType,
        amount: paidAmount,
        description: record.description,
        date: paidDate,
        category_id: record.category_id,
        subcategory_id: record.subcategory_id,
        created_by: userId
      })
      .select()
      .single();

    if (transactionError) throw transactionError;

    // Update payable/receivable
    const { error: updateError } = await supabase
      .from('payables_receivables')
      .update({
        status: 'paid',
        paid_amount: paidAmount,
        paid_date: paidDate,
        paid_account_id: accountId,
        transaction_id: transaction.id,
        paid_by: userId
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // If recurring, create next month entry
    if (record.payment_type === 'recurring') {
      const nextDueDate = format(addMonths(new Date(record.due_date), 1), 'yyyy-MM-dd');
      const { error: recurringError } = await supabase
        .from('payables_receivables')
        .insert({
          company_id: record.company_id,
          type: record.type,
          payment_type: 'recurring',
          description: record.description,
          amount: record.amount,
          due_date: nextDueDate,
          category_id: record.category_id,
          subcategory_id: record.subcategory_id,
          client_supplier_id: record.client_supplier_id,
          created_by: record.created_by,
          status: 'pending'
        });
      if (recurringError) throw recurringError;
    }

    await fetchPayablesReceivables();
  };

  const cancelPayableReceivable = async (id: string) => {
    const { error } = await supabase
      .from('payables_receivables')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;
    await fetchPayablesReceivables();
  };

  const deletePayableReceivable = async (id: string) => {
    const { error } = await supabase
      .from('payables_receivables')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchPayablesReceivables();
  };

  // Calculate totals
  const totals = payablesReceivables.reduce(
    (acc, item) => {
      if (item.status === 'pending') {
        if (item.type === 'payable') {
          acc.totalPayable += Number(item.amount);
        } else {
          acc.totalReceivable += Number(item.amount);
        }
      }
      return acc;
    },
    { totalPayable: 0, totalReceivable: 0 }
  );

  return {
    payablesReceivables,
    loading,
    totalPayable: totals.totalPayable,
    totalReceivable: totals.totalReceivable,
    createPayableReceivable,
    effectuatePayment,
    cancelPayableReceivable,
    deletePayableReceivable,
    refetch: fetchPayablesReceivables
  };
}
