import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

export function useCustomRoles() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('custom_roles')
      .select('*')
      .order('name');
    if (error) {
      toast({ title: 'Erro ao carregar cargos', description: error.message, variant: 'destructive' });
    } else {
      setRoles((data || []) as CustomRole[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const createRole = async (name: string, description: string, color: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from('custom_roles')
      .insert({ name, description: description || null, color, created_by: userData.user?.id });
    if (error) {
      toast({ title: 'Erro ao criar cargo', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Cargo criado' });
    await fetchRoles();
    return true;
  };

  const updateRole = async (id: string, patch: Partial<Pick<CustomRole, 'name' | 'description' | 'color'>>) => {
    const { error } = await (supabase as any).from('custom_roles').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar cargo', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Cargo atualizado' });
    await fetchRoles();
    return true;
  };

  const deleteRole = async (id: string) => {
    const { error } = await (supabase as any).from('custom_roles').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir cargo', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Cargo excluído' });
    await fetchRoles();
    return true;
  };

  return { roles, loading, createRole, updateRole, deleteRole, refetch: fetchRoles };
}
