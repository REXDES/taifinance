import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useCompanyPaymentsFlag(companyId: string | null) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    if (!companyId) { setEnabled(false); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('companies')
      .select('payments_module_enabled')
      .eq('id', companyId)
      .maybeSingle();
    setEnabled(!!data?.payments_module_enabled);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { refetch(); }, [refetch]);
  return { enabled, loading, refetch };
}
