import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MachineTag {
  id: string;
  company_id: string;
  name: string;
  color: string;
  description: string | null;
}

export function useMachineTags(companyId: string | null) {
  const [tags, setTags] = useState<MachineTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!companyId) { setTags([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('machine_tags').select('*').eq('company_id', companyId).order('name');
    if (error) toast.error('Erro ao carregar tags: ' + error.message);
    setTags((data || []) as MachineTag[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createTag = useCallback(async (input: { name: string; color?: string; description?: string }) => {
    if (!companyId) return null;
    const name = input.name.trim();
    if (!name) return null;
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any).from('machine_tags').insert({
      company_id: companyId,
      name,
      color: input.color || '#6366f1',
      description: input.description || null,
      created_by: u?.user?.id || null,
    }).select().single();
    if (error) {
      if ((error as any).code === '23505') toast.error('Já existe uma tag com este nome');
      else toast.error(error.message);
      return null;
    }
    await fetch();
    return data as MachineTag;
  }, [companyId, fetch]);

  const updateTag = useCallback(async (id: string, input: Partial<Pick<MachineTag, 'name' | 'color' | 'description'>>) => {
    const { error } = await (supabase as any).from('machine_tags').update(input).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetch();
    return true;
  }, [fetch]);

  const deleteTag = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from('machine_tags').delete().eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetch();
    toast.success('Tag excluída');
    return true;
  }, [fetch]);

  return { tags, loading, createTag, updateTag, deleteTag, refetch: fetch };
}

export async function setMachineTags(machineId: string, tagIds: string[]) {
  const sb = supabase as any;
  const { error: delErr } = await sb.from('machine_tag_links').delete().eq('machine_id', machineId);
  if (delErr) throw delErr;
  if (tagIds.length === 0) return;
  const rows = tagIds.map(tag_id => ({ machine_id: machineId, tag_id }));
  const { error: insErr } = await sb.from('machine_tag_links').insert(rows);
  if (insErr) throw insErr;
}

export async function fetchMachineTagsMap(machineIds: string[]): Promise<Record<string, MachineTag[]>> {
  if (machineIds.length === 0) return {};
  const { data, error } = await (supabase as any)
    .from('machine_tag_links')
    .select('machine_id, tag:machine_tags(*)')
    .in('machine_id', machineIds);
  if (error) throw error;
  const map: Record<string, MachineTag[]> = {};
  (data || []).forEach((r: any) => {
    if (!map[r.machine_id]) map[r.machine_id] = [];
    if (r.tag) map[r.machine_id].push(r.tag as MachineTag);
  });
  return map;
}
