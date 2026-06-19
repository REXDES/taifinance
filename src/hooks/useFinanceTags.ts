import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FinanceTag {
  id: string;
  company_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type TagEntity = 'transaction' | 'payable_receivable' | 'transfer';

const JUNCTION: Record<TagEntity, { table: 'transaction_tags' | 'payable_receivable_tags' | 'transfer_tags'; fk: string }> = {
  transaction: { table: 'transaction_tags', fk: 'transaction_id' },
  payable_receivable: { table: 'payable_receivable_tags', fk: 'payable_receivable_id' },
  transfer: { table: 'transfer_tags', fk: 'transfer_id' },
};

export function useFinanceTags(companyId: string | null) {
  const [tags, setTags] = useState<FinanceTag[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    if (!companyId) { setTags([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('finance_tags')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) {
      toast({ title: 'Erro ao carregar tags', description: error.message, variant: 'destructive' });
    } else {
      setTags(data || []);
    }
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const createTag = useCallback(async (input: { name: string; color?: string; description?: string }) => {
    if (!companyId) return null;
    const name = input.name.trim();
    if (!name) return null;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('finance_tags')
      .insert({
        company_id: companyId,
        name,
        color: input.color || '#6366f1',
        description: input.description || null,
        created_by: userData?.user?.id || null,
      })
      .select()
      .single();
    if (error) {
      if ((error as any).code === '23505') {
        toast({ title: 'Tag já existe', description: 'Já existe uma tag com este nome.', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao criar tag', description: error.message, variant: 'destructive' });
      }
      return null;
    }
    await fetch();
    return data;
  }, [companyId, fetch, toast]);

  const updateTag = useCallback(async (id: string, input: Partial<Pick<FinanceTag, 'name' | 'color' | 'description'>>) => {
    const { error } = await supabase.from('finance_tags').update(input).eq('id', id);
    if (error) { toast({ title: 'Erro ao atualizar tag', description: error.message, variant: 'destructive' }); return false; }
    await fetch();
    return true;
  }, [fetch, toast]);

  const deleteTag = useCallback(async (id: string) => {
    const { error } = await supabase.from('finance_tags').delete().eq('id', id);
    if (error) { toast({ title: 'Erro ao excluir tag', description: error.message, variant: 'destructive' }); return false; }
    await fetch();
    toast({ title: 'Tag excluída' });
    return true;
  }, [fetch, toast]);

  return { tags, loading, createTag, updateTag, deleteTag, refetch: fetch };
}

/** Replace the set of tags for a given entity record. */
export async function setEntityTags(entity: TagEntity, recordId: string, tagIds: string[]) {
  const { table, fk } = JUNCTION[entity];
  const sb = supabase as any;
  const { error: delErr } = await sb.from(table).delete().eq(fk, recordId);
  if (delErr) throw delErr;
  if (tagIds.length === 0) return;
  const rows = tagIds.map(tag_id => ({ [fk]: recordId, tag_id }));
  const { error: insErr } = await sb.from(table).insert(rows);
  if (insErr) throw insErr;
}

/** Fetch tags grouped by record id for a list of records. */
export async function fetchTagsForRecords(entity: TagEntity, recordIds: string[]): Promise<Record<string, FinanceTag[]>> {
  if (recordIds.length === 0) return {};
  const { table, fk } = JUNCTION[entity];
  const sb = supabase as any;
  const { data, error } = await sb
    .from(table)
    .select(`${fk}, tag:finance_tags(*)`)
    .in(fk, recordIds);
  if (error) throw error;
  const map: Record<string, FinanceTag[]> = {};
  (data || []).forEach((row: any) => {
    const rid = row[fk] as string;
    if (!map[rid]) map[rid] = [];
    if (row.tag) map[rid].push(row.tag as FinanceTag);
  });
  return map;
}

/** Return record ids that have ANY of the given tag ids. */
export async function findRecordIdsByTags(entity: TagEntity, tagIds: string[]): Promise<string[]> {
  if (tagIds.length === 0) return [];
  const { table, fk } = JUNCTION[entity];
  const { data, error } = await supabase.from(table).select(fk).in('tag_id', tagIds);
  if (error) throw error;
  return Array.from(new Set((data || []).map((r: any) => r[fk] as string)));
}
