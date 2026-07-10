import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SplitRecipient {
  id: string;
  company_id: string;
  name: string;
  document: string | null;
  pix_key: string;
  pix_key_type: string;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type NewRecipient = Omit<SplitRecipient, 'id' | 'created_at' | 'updated_at' | 'company_id'>;

export function useSplitRecipients(companyId: string | null) {
  const [recipients, setRecipients] = useState<SplitRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    if (!companyId) { setRecipients([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('split_recipients')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) {
      toast({ title: 'Erro ao carregar destinatários', description: error.message, variant: 'destructive' });
    } else {
      setRecipients(data || []);
    }
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (input: Partial<NewRecipient> & { name: string; pix_key: string; pix_key_type: string }) => {
    if (!companyId) return null;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any)
      .from('split_recipients')
      .insert({ ...input, company_id: companyId, created_by: userData?.user?.id || null })
      .select().single();
    if (error) { toast({ title: 'Erro ao criar destinatário', description: error.message, variant: 'destructive' }); return null; }
    await fetch();
    return data;
  }, [companyId, fetch, toast]);

  const update = useCallback(async (id: string, input: Partial<NewRecipient>) => {
    const { error } = await (supabase as any).from('split_recipients').update(input).eq('id', id);
    if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return false; }
    await fetch();
    return true;
  }, [fetch, toast]);

  const remove = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from('split_recipients').delete().eq('id', id);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return false; }
    await fetch();
    return true;
  }, [fetch, toast]);

  return { recipients, loading, create, update, remove, refetch: fetch };
}
