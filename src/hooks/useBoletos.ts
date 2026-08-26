import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Boleto {
  id: string;
  company_id: string;
  barcode: string;
  description: string | null;
  recipient: string | null;
  amount: number | null;
  due_date: string | null;
  bank_code: string | null;
  bank_name: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paid_amount: number | null;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BoletoInsert = Omit<Boleto, 'id' | 'created_at' | 'updated_at'>;
export type BoletoUpdate = Partial<Omit<Boleto, 'id' | 'company_id' | 'created_at' | 'updated_at'>>;

export interface BoletoFilters {
  status?: Boleto['status'][];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const boletosTable = () => supabase.from('boletos' as any);

export function useBoletos(companyId: string, filters?: BoletoFilters) {
  const { user } = useAuth();
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [loading, setLoading] = useState(true);

  const statusKey = filters?.status?.join(',') ?? '';

  const fetchBoletos = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      let query = boletosTable()
        .select('*')
        .eq('company_id', companyId)
        .order('due_date', { ascending: true });

      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBoletos((data ?? []) as unknown as Boleto[]);
    } catch (err) {
      console.error('Erro ao carregar boletos:', err);
      toast.error('Erro ao carregar boletos.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, statusKey]);

  useEffect(() => { fetchBoletos(); }, [fetchBoletos]);

  const createBoleto = useCallback(async (data: Partial<Omit<BoletoInsert, 'company_id' | 'created_by'>> & { barcode: string }) => {
    if (!user?.id) return false;
    try {
      const { error } = await boletosTable().insert({
        ...data,
        company_id: companyId,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success('Boleto adicionado.');
      await fetchBoletos();
      return true;
    } catch (err) {
      console.error('Erro ao criar boleto:', err);
      toast.error('Erro ao salvar boleto.');
      return false;
    }
  }, [companyId, user?.id, fetchBoletos]);

  const updateBoleto = useCallback(async (id: string, data: BoletoUpdate) => {
    try {
      const { error } = await boletosTable().update(data).eq('id', id);
      if (error) throw error;
      toast.success('Boleto atualizado.');
      await fetchBoletos();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar boleto:', err);
      toast.error('Erro ao atualizar boleto.');
      return false;
    }
  }, [fetchBoletos]);

  const markAsPaid = useCallback(async (id: string, paidAmount: number, paidAt: string) => {
    return updateBoleto(id, { status: 'paid', paid_amount: paidAmount, paid_at: paidAt });
  }, [updateBoleto]);

  const deleteBoleto = useCallback(async (id: string) => {
    try {
      const { error } = await boletosTable().delete().eq('id', id);
      if (error) throw error;
      toast.success('Boleto removido.');
      await fetchBoletos();
      return true;
    } catch (err) {
      console.error('Erro ao remover boleto:', err);
      toast.error('Erro ao remover boleto.');
      return false;
    }
  }, [fetchBoletos]);

  // Auto-mark overdue on load
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const overdueIds = boletos
      .filter(b => b.status === 'pending' && b.due_date && b.due_date < today)
      .map(b => b.id);

    if (overdueIds.length === 0) return;

    boletosTable()
      .update({ status: 'overdue' })
      .in('id', overdueIds)
      .then(({ error }) => {
        if (!error) fetchBoletos();
      });
  }, [boletos, fetchBoletos]);

  const counts = {
    pending: boletos.filter(b => b.status === 'pending').length,
    overdue: boletos.filter(b => b.status === 'overdue').length,
    paid: boletos.filter(b => b.status === 'paid').length,
    all: boletos.length,
  };

  return {
    boletos,
    loading,
    counts,
    createBoleto,
    updateBoleto,
    markAsPaid,
    deleteBoleto,
    refetch: fetchBoletos,
  };
}
