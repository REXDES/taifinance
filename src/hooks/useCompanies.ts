import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';

export interface Company {
  id: string;
  name: string;
  color: string;
  created_at: string;
  created_by?: string | null;
}

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async (name: string, color: string) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert({ name, color, created_by: user?.id })
        .select()
        .single();

      if (error) throw error;
      
      // Log audit action
      await logAction({
        action: 'company_created',
        entity_type: 'company',
        entity_id: data.id,
        company_id: data.id,
        details: { name, color },
      });

      setCompanies(prev => [...prev, data]);
      toast.success('Empresa criada com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast.error('Erro ao criar empresa');
      return null;
    }
  };

  const updateCompany = async (id: string, name: string, color: string) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .update({ name, color })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log audit action
      await logAction({
        action: 'company_updated',
        entity_type: 'company',
        entity_id: id,
        company_id: id,
        details: { name, color },
      });

      setCompanies(prev => prev.map(c => c.id === id ? data : c));
      toast.success('Empresa atualizada com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Error updating company:', error);
      toast.error('Erro ao atualizar empresa');
      return null;
    }
  };

  const deleteCompany = async (id: string) => {
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log audit action
      await logAction({
        action: 'company_deleted',
        entity_type: 'company',
        entity_id: id,
        company_id: id,
      });

      setCompanies(prev => prev.filter(c => c.id !== id));
      toast.success('Empresa excluída com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Error deleting company:', error);
      toast.error('Erro ao excluir empresa');
      return false;
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  return { companies, loading, createCompany, updateCompany, deleteCompany, refetch: fetchCompanies };
}
