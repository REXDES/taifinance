import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WorkGroupMember {
  id: string;
  element_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export function useElementWorkGroup(elementId: string | null) {
  const [members, setMembers] = useState<WorkGroupMember[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMembers = useCallback(async () => {
    if (!elementId) {
      setMembers([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('element_work_groups')
        .select(`
          id,
          element_id,
          user_id,
          added_by,
          created_at
        `)
        .eq('element_id', elementId);

      if (error) throw error;

      // Fetch profiles for members
      const userIds = (data || []).map(m => m.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .in('user_id', userIds);

        const membersWithProfiles = (data || []).map(member => ({
          ...member,
          profile: profiles?.find(p => p.user_id === member.user_id),
        }));
        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      console.error('Error fetching work group members:', error);
    } finally {
      setLoading(false);
    }
  }, [elementId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = async (userId: string) => {
    if (!elementId) return false;

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('element_work_groups')
        .insert({
          element_id: elementId,
          user_id: userId,
          added_by: userData.user?.id,
        });

      if (error) throw error;

      toast({ title: 'Membro adicionado ao grupo' });
      await fetchMembers();
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({
          title: 'Usuário já está no grupo',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao adicionar membro',
          description: error.message,
          variant: 'destructive',
        });
      }
      return false;
    }
  };

  const removeMember = async (userId: string) => {
    if (!elementId) return false;

    try {
      const { error } = await supabase
        .from('element_work_groups')
        .delete()
        .eq('element_id', elementId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({ title: 'Membro removido do grupo' });
      await fetchMembers();
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao remover membro',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    members,
    loading,
    addMember,
    removeMember,
    refetch: fetchMembers,
  };
}
