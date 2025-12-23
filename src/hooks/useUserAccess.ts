import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProjectAccess {
  id: string;
  project_id: string;
  project_name?: string;
}

interface ElementAccess {
  id: string;
  element_id: string;
  element_name?: string;
  project_name?: string;
}

interface InvitationAccess {
  id: string;
  invitation_id: string;
  project_id: string | null;
  element_id: string | null;
}

export function useUserAccess(userId: string | null) {
  const [projectAccess, setProjectAccess] = useState<ProjectAccess[]>([]);
  const [elementAccess, setElementAccess] = useState<ElementAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAccess = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch project access
      const { data: projectData, error: projectError } = await supabase
        .from('user_project_access')
        .select('id, project_id')
        .eq('user_id', userId);

      if (projectError) throw projectError;

      // Fetch element access
      const { data: elementData, error: elementError } = await supabase
        .from('user_element_access')
        .select('id, element_id')
        .eq('user_id', userId);

      if (elementError) throw elementError;

      setProjectAccess(projectData || []);
      setElementAccess(elementData || []);
    } catch (error: any) {
      console.error('Error fetching user access:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  const addProjectAccess = async (projectId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_project_access')
        .insert({ user_id: userId, project_id: projectId });

      if (error) throw error;

      toast({ title: 'Acesso ao projeto adicionado' });
      await fetchAccess();
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Usuário já tem acesso a este projeto' });
      } else {
        toast({
          title: 'Erro ao adicionar acesso',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const removeProjectAccess = async (projectId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_project_access')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId);

      if (error) throw error;

      toast({ title: 'Acesso ao projeto removido' });
      await fetchAccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover acesso',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addElementAccess = async (elementId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_element_access')
        .insert({ user_id: userId, element_id: elementId });

      if (error) throw error;

      toast({ title: 'Acesso ao elemento adicionado' });
      await fetchAccess();
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Usuário já tem acesso a este elemento' });
      } else {
        toast({
          title: 'Erro ao adicionar acesso',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const removeElementAccess = async (elementId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_element_access')
        .delete()
        .eq('user_id', userId)
        .eq('element_id', elementId);

      if (error) throw error;

      toast({ title: 'Acesso ao elemento removido' });
      await fetchAccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover acesso',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return {
    projectAccess,
    elementAccess,
    loading,
    addProjectAccess,
    removeProjectAccess,
    addElementAccess,
    removeElementAccess,
    refetch: fetchAccess,
  };
}

export function useInvitationAccess(invitationId: string | null) {
  const [access, setAccess] = useState<InvitationAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAccess = useCallback(async () => {
    if (!invitationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invitation_access')
        .select('*')
        .eq('invitation_id', invitationId);

      if (error) throw error;
      setAccess(data || []);
    } catch (error: any) {
      console.error('Error fetching invitation access:', error);
    } finally {
      setLoading(false);
    }
  }, [invitationId]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  const addAccess = async (projectId: string | null, elementId: string | null) => {
    if (!invitationId) return;

    try {
      const { error } = await supabase
        .from('invitation_access')
        .insert({ 
          invitation_id: invitationId, 
          project_id: projectId,
          element_id: elementId 
        });

      if (error) throw error;
      await fetchAccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar acesso',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const removeAccess = async (accessId: string) => {
    try {
      const { error } = await supabase
        .from('invitation_access')
        .delete()
        .eq('id', accessId);

      if (error) throw error;
      await fetchAccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover acesso',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return {
    access,
    loading,
    addAccess,
    removeAccess,
    refetch: fetchAccess,
  };
}
