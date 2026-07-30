import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Loads the current user's effective permissions and exposes a `can(key)` helper.
 * Supervisor bypasses everything (always true).
 * If no row exists for a permission key, default to ALLOWED (compatibility for
 * users whose supervisor hasn't customised the matrix yet).
 */
export function usePermissions() {
  const { user } = useAuth();
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [allowedMap, setAllowedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) { setLoading(false); return; }
      setLoading(true);

      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (roleRow?.role === 'supervisor') {
        setIsSupervisor(true);
        setAllowedMap({});
        setLoading(false);
        return;
      }
      setIsSupervisor(false);

      const { data: perms } = await (supabase as any).rpc('get_user_permissions', { _user_id: user.id });
      if (cancelled) return;

      const map: Record<string, boolean> = {};
      (perms || []).forEach((p: any) => { map[p.permission_key] = !!p.allowed; });
      setAllowedMap(map);
      // Se a matriz já foi configurada para o cargo deste usuário, ela é a fonte da verdade:
      // qualquer key sem registro é considerada BLOQUEADA.
      setConfigured((perms || []).length > 0);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const can = (key: string) => {
    if (isSupervisor) return true;
    if (key in allowedMap) return allowedMap[key];
    return !configured; // matriz configurada => nega o que não foi liberado
  };


  return { can, isSupervisor, loading };
}
