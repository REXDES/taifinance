import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Project {
  id: string;
  name: string;
  color: string;
  company_id: string;
  description: string | null;
  created_at: string;
}

export function useProjects(companyId: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    if (!companyId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      toast.error('Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (name: string, color: string) => {
    if (!companyId) return null;

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({ name, color, company_id: companyId })
        .select()
        .single();

      if (error) throw error;
      setProjects(prev => [...prev, data]);
      toast.success('Projeto criado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast.error('Erro ao criar projeto');
      return null;
    }
  };

  const updateProject = async (id: string, name: string, color: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ name, color })
        .eq('id', id);

      if (error) throw error;
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name, color } : p));
      toast.success('Projeto atualizado com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast.error('Erro ao atualizar projeto');
      return false;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success('Projeto excluído com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error('Erro ao excluir projeto');
      return false;
    }
  };

  const duplicateProject = async (id: string) => {
    if (!companyId) return null;

    try {
      const projectToDuplicate = projects.find(p => p.id === id);
      if (!projectToDuplicate) return null;

      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: `${projectToDuplicate.name} (cópia)`,
          color: projectToDuplicate.color,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) throw error;
      setProjects(prev => [...prev, data]);
      toast.success('Projeto duplicado com sucesso!');
      return data;
    } catch (error: any) {
      console.error('Error duplicating project:', error);
      toast.error('Erro ao duplicar projeto');
      return null;
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [companyId]);

  return { projects, loading, createProject, updateProject, deleteProject, duplicateProject, refetch: fetchProjects };
}
