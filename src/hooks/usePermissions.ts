import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface EffectivePermission {
  permission_key: string;
  allowed: boolean;
}

/**
 * Loads the current user's effective permissions and exposes a `can(key)` helper.
 * Supervisor bypasses everything (always true).
 * Custom roles are always strict: only explicitly allowed keys are available.
 * Legacy base roles remain compatible while they have no configured matrix.
 */
export function usePermissions() {
  const { user } = useAuth();
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [allowedMap, setAllowedMap] = useState<Record<string, boolean>>({});
  const [configured, setConfigured] = useState(false);
  const [hasCustomRole, setHasCustomRole] = useState(false);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) {
        setAllowedMap({});
        setConfigured(false);
        setHasCustomRole(false);
        setLoading(false);
        return;
      }
      setLoading(true);

      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role, custom_role_id')
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
      setHasCustomRole(!!roleRow?.custom_role_id);

      const { data: perms, error } = await supabase.rpc('get_user_permissions', { _user_id: user.id });
      if (cancelled) return;

      const map: Record<string, boolean> = {};
      ((perms || []) as EffectivePermission[]).forEach((permission) => {
        map[permission.permission_key] = !!permission.allowed;
      });
      setAllowedMap(map);
      // Se a matriz já foi configurada para o cargo deste usuário, ela é a fonte da verdade:
      // qualquer key sem registro é considerada BLOQUEADA.
      // Em caso de erro, cargos customizados continuam fechados por segurança.
      setConfigured(!!roleRow?.custom_role_id || (!error && (perms || []).length > 0));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const can = useCallback((key: string) => {
    if (isSupervisor) return true;
    if (loading) return false;
    if (key in allowedMap) return allowedMap[key];
    return !configured && !hasCustomRole;
  }, [allowedMap, configured, hasCustomRole, isSupervisor, loading]);


  return { can, isSupervisor, loading };
}
