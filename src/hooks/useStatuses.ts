import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Status {
  id: string;
  name: string;
  color: string;
  priority: number;
  company_id: string;
}

export function useStatuses(companyId: string | null) {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchStatuses = useCallback(async () => {
    if (!companyId) {
      setStatuses([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('status_configs')
      .select('*')
      .eq('company_id', companyId)
      .order('priority', { ascending: true });

    if (error) {
      toast({
        title: 'Erro ao carregar status',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setStatuses(data || []);
    }
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const createDefaultStatuses = useCallback(async () => {
    if (!companyId) return;

    // Verificar se já existem status para esta empresa
    const { data: existing } = await supabase
      .from('status_configs')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);
    
    if (existing && existing.length > 0) {
      // Já existem status, apenas recarregar
      await fetchStatuses();
      return;
    }

    const defaultStatuses = [
      { name: 'A fazer', color: '220 13% 46%', priority: 0 },
      { name: 'Em andamento', color: '217 91% 60%', priority: 1 },
      { name: 'Em revisão', color: '38 92% 50%', priority: 2 },
      { name: 'Concluído', color: '142 76% 36%', priority: 3 },
    ];

    const { data, error } = await supabase
      .from('status_configs')
      .insert(defaultStatuses.map(s => ({ ...s, company_id: companyId })))
      .select();

    if (error) {
      toast({
        title: 'Erro ao criar status padrão',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setStatuses(data || []);
  }, [companyId, toast, fetchStatuses]);

  const createStatus = useCallback(async (name: string, color: string) => {
    if (!companyId) return;

    const maxPriority = statuses.length > 0 
      ? Math.max(...statuses.map(s => s.priority)) + 1 
      : 0;

    const { data, error } = await supabase
      .from('status_configs')
      .insert({ name, color, priority: maxPriority, company_id: companyId })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao criar status',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setStatuses(prev => [...prev, data]);
    toast({ title: 'Status criado com sucesso' });
  }, [companyId, statuses, toast]);

  const updateStatus = useCallback(async (id: string, name: string, color: string) => {
    const { error } = await supabase
      .from('status_configs')
      .update({ name, color })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setStatuses(prev => prev.map(s => s.id === id ? { ...s, name, color } : s));
    toast({ title: 'Status atualizado com sucesso' });
  }, [toast]);

  const deleteStatus = useCallback(async (id: string) => {
    // Check if any tasks are using this status
    const { data: tasksUsingStatus } = await supabase
      .from('tasks')
      .select('id')
      .eq('status_id', id)
      .limit(1);

    if (tasksUsingStatus && tasksUsingStatus.length > 0) {
      toast({
        title: 'Não é possível excluir',
        description: 'Existem tarefas usando este status. Altere o status das tarefas antes de excluir.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('status_configs')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir status',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setStatuses(prev => prev.filter(s => s.id !== id));
    toast({ title: 'Status excluído com sucesso' });
  }, [toast]);

  const reorderStatuses = useCallback(async (newOrder: Status[]) => {
    // Update local state optimistically
    setStatuses(newOrder);

    // Update all priorities in database
    const updates = newOrder.map((status, index) =>
      supabase
        .from('status_configs')
        .update({ priority: index })
        .eq('id', status.id)
    );

    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);

    if (hasError) {
      toast({
        title: 'Erro ao reordenar status',
        description: 'Não foi possível salvar a nova ordem',
        variant: 'destructive',
      });
      await fetchStatuses(); // Revert to database state
      return;
    }

    toast({ title: 'Ordem atualizada com sucesso' });
  }, [toast, fetchStatuses]);

  return {
    statuses,
    loading,
    createDefaultStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
    refetch: fetchStatuses,
  };
}