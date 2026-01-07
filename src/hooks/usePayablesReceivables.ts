import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { addMonths, format } from 'date-fns';

export interface PayableReceivable {
  id: string;
  company_id: string;
  type: 'payable' | 'receivable';
  payment_type: 'single' | 'installment' | 'recurring';
  description: string;
  amount: number | null;
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
  is_amount_pending: boolean;
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

    // Para contas com valor pendente, não dividir parcelas
    const isAmountPending = data.is_amount_pending || data.amount === null;

    if (data.payment_type === 'single') {
      const { error } = await supabase
        .from('payables_receivables')
        .insert({ ...data, created_by: userId, is_amount_pending: isAmountPending });
      if (error) throw error;
    } else if (data.payment_type === 'installment' && installments) {
      // Se valor pendente, criar parcelas com amount null
      const installmentAmount = isAmountPending ? null : (data.amount as number) / installments;
      const records = [];
      
      // Create parent record
      const { data: parent, error: parentError } = await supabase
        .from('payables_receivables')
        .insert({
          ...data,
          created_by: userId,
          installment_number: 1,
          total_installments: installments,
          amount: installmentAmount,
          is_amount_pending: isAmountPending
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
          amount: installmentAmount,
          is_amount_pending: isAmountPending
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
        .insert({ ...data, created_by: userId, is_amount_pending: isAmountPending });
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

    // Update payable/receivable - also update amount if it was pending
    const updateData: any = {
      status: 'paid',
      paid_amount: paidAmount,
      paid_date: paidDate,
      paid_account_id: accountId,
      transaction_id: transaction.id,
      paid_by: userId,
      is_amount_pending: false
    };

    // Se o valor era pendente, atualizar o amount original
    if (record.is_amount_pending) {
      updateData.amount = paidAmount;
    }

    const { error: updateError } = await supabase
      .from('payables_receivables')
      .update(updateData)
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
          amount: record.is_amount_pending ? null : record.amount, // Manter null se era pendente
          due_date: nextDueDate,
          category_id: record.category_id,
          subcategory_id: record.subcategory_id,
          client_supplier_id: record.client_supplier_id,
          created_by: record.created_by,
          status: 'pending',
          is_amount_pending: record.is_amount_pending // Manter o status de valor pendente
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

  const deletePayableReceivable = async (id: string, deleteRelated: boolean = false) => {
    if (deleteRelated) {
      // Get the record to check its relationships
      const { data: record, error: fetchError } = await supabase
        .from('payables_receivables')
        .select('id, parent_id, payment_type, description, type, company_id, due_date')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Find the root parent ID (if this is a child) or use current ID (if this is parent)
      const rootId = record.parent_id || record.id;

      // Delete all related pending records (children with same parent OR same recurring pattern)
      if (record.payment_type === 'installment') {
        // For installments: delete all pending children and the parent if it's pending
        const { error: deleteChildrenError } = await supabase
          .from('payables_receivables')
          .delete()
          .eq('parent_id', rootId)
          .eq('status', 'pending')
          .gt('due_date', record.due_date);

        if (deleteChildrenError) throw deleteChildrenError;

        // If deleting from parent, also delete parent if pending
        if (!record.parent_id) {
          const { error } = await supabase
            .from('payables_receivables')
            .delete()
            .eq('id', id);
          if (error) throw error;
        } else {
          // Delete the current record
          const { error } = await supabase
            .from('payables_receivables')
            .delete()
            .eq('id', id);
          if (error) throw error;
        }
      } else if (record.payment_type === 'recurring') {
        // For recurring: delete all pending future occurrences with same description/type
        const { error } = await supabase
          .from('payables_receivables')
          .delete()
          .eq('company_id', record.company_id)
          .eq('description', record.description)
          .eq('type', record.type)
          .eq('payment_type', 'recurring')
          .eq('status', 'pending')
          .gte('due_date', record.due_date);

        if (error) throw error;
      }
    } else {
      // Delete only this record
      const { error } = await supabase
        .from('payables_receivables')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }
    
    await fetchPayablesReceivables();
  };

  const checkRelatedRecords = async (id: string): Promise<{ hasRelated: boolean; count: number; type: 'installment' | 'recurring' | null }> => {
    const { data: record, error: fetchError } = await supabase
      .from('payables_receivables')
      .select('id, parent_id, payment_type, description, type, company_id, due_date')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (record.payment_type === 'installment') {
      const rootId = record.parent_id || record.id;
      
      // Count pending children with future due dates
      const { count, error } = await supabase
        .from('payables_receivables')
        .select('id', { count: 'exact', head: true })
        .or(`parent_id.eq.${rootId},id.eq.${rootId}`)
        .eq('status', 'pending')
        .gt('due_date', record.due_date);

      if (error) throw error;
      
      return { hasRelated: (count || 0) > 0, count: count || 0, type: 'installment' };
    } else if (record.payment_type === 'recurring') {
      // Count pending future recurring with same description
      const { count, error } = await supabase
        .from('payables_receivables')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', record.company_id)
        .eq('description', record.description)
        .eq('type', record.type)
        .eq('payment_type', 'recurring')
        .eq('status', 'pending')
        .gt('due_date', record.due_date);

      if (error) throw error;
      
      return { hasRelated: (count || 0) > 0, count: count || 0, type: 'recurring' };
    }

    return { hasRelated: false, count: 0, type: null };
  };

  // Calculate totals - ignorar contas com valor pendente
  const totals = payablesReceivables.reduce(
    (acc, item) => {
      if (item.status === 'pending' && !item.is_amount_pending && item.amount !== null) {
        if (item.type === 'payable') {
          acc.totalPayable += Number(item.amount);
        } else {
          acc.totalReceivable += Number(item.amount);
        }
      }
      // Contar contas com valor pendente
      if (item.status === 'pending' && item.is_amount_pending) {
        acc.pendingCount += 1;
      }
      return acc;
    },
    { totalPayable: 0, totalReceivable: 0, pendingCount: 0 }
  );

  return {
    payablesReceivables,
    loading,
    totalPayable: totals.totalPayable,
    totalReceivable: totals.totalReceivable,
    pendingAmountCount: totals.pendingCount,
    createPayableReceivable,
    effectuatePayment,
    cancelPayableReceivable,
    deletePayableReceivable,
    checkRelatedRecords,
    refetch: fetchPayablesReceivables
  };
}
