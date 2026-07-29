import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RolePermission {
  role_key: string;
  permission_key: string;
  allowed: boolean;
}

export function useRolePermissions() {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('role_permissions')
      .select('role_key, permission_key, allowed');
    if (error) {
      toast({ title: 'Erro ao carregar permissões', description: error.message, variant: 'destructive' });
    } else {
      setPermissions((data || []) as RolePermission[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isAllowed = (roleKey: string, permKey: string) => {
    const row = permissions.find(p => p.role_key === roleKey && p.permission_key === permKey);
    return row?.allowed ?? false;
  };

  const setAllowed = async (roleKey: string, permKey: string, allowed: boolean) => {
    // optimistic update
    setPermissions(prev => {
      const idx = prev.findIndex(p => p.role_key === roleKey && p.permission_key === permKey);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], allowed };
        return clone;
      }
      return [...prev, { role_key: roleKey, permission_key: permKey, allowed }];
    });

    const { error } = await (supabase as any)
      .from('role_permissions')
      .upsert(
        { role_key: roleKey, permission_key: permKey, allowed },
        { onConflict: 'role_key,permission_key' },
      );
    if (error) {
      toast({ title: 'Erro ao salvar permissão', description: error.message, variant: 'destructive' });
      await fetchAll();
    }
  };

  return { permissions, loading, isAllowed, setAllowed, refetch: fetchAll };
}
