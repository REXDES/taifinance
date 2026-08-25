import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type SplitScope = 'global' | 'category' | 'client_supplier' | 'tag';
export type SplitValueType = 'percent' | 'fixed';

export interface SplitRule {
  id: string;
  company_id: string;
  recipient_id: string;
  scope: SplitScope;
  scope_ref_id: string | null;
  value_type: SplitValueType;
  value: number;
  priority: number;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type NewRule = Omit<SplitRule, 'id' | 'created_at' | 'updated_at' | 'company_id'>;

export function useSplitRules(companyId: string | null) {
  const [rules, setRules] = useState<SplitRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    if (!companyId) { setRules([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('split_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar regras', description: error.message, variant: 'destructive' });
    } else {
      setRules((data || []).map((r: any) => ({ ...r, value: Number(r.value) })));
    }
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (input: Partial<NewRule> & { recipient_id: string; value: number }) => {
    if (!companyId) return null;
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      scope: 'global' as SplitScope,
      value_type: 'percent' as SplitValueType,
      priority: 0,
      active: true,
      scope_ref_id: null,
      ...input,
      company_id: companyId,
      created_by: userData?.user?.id || null,
    };
    const { data, error } = await (supabase as any).from('split_rules').insert(payload).select().single();
    if (error) { toast({ title: 'Erro ao criar regra', description: error.message, variant: 'destructive' }); return null; }
    await fetch();
    return data;
  }, [companyId, fetch, toast]);

  const update = useCallback(async (id: string, input: Partial<NewRule>) => {
    const { error } = await (supabase as any).from('split_rules').update(input).eq('id', id);
    if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return false; }
    await fetch();
    return true;
  }, [fetch, toast]);

  const remove = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from('split_rules').delete().eq('id', id);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return false; }
    await fetch();
    return true;
  }, [fetch, toast]);

  return { rules, loading, create, update, remove, refetch: fetch };
}
