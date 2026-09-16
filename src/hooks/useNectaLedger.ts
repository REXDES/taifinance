import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NectaLedgerEntry {
  id: string;
  company_id: string;
  account_id: string | null;
  necta_entry_id: string;
  entry_type: string;
  date: string;
  description: string;
  counterparty: string | null;
  amount: number;
  direction: 'in' | 'out';
  necta_sale_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  category_source: 'auto' | 'memory' | 'manual' | null;
  category?: { id: string; name: string; color: string } | null;
  subcategory?: { id: string; name: string } | null;
}

/** Chave de memória: mesma normalização usada no backend. */
export function normalizePattern(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\d{2,}/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ').slice(0, 6).join(' ');
}

/**
 * Grava a categorização feita pelo usuário e guarda a memória para que
 * lançamentos parecidos sejam categorizados sozinhos nas próximas consultas.
 */
export async function categorizeNectaEntry(
  entry: NectaLedgerEntry,
  categoryId: string | null,
  subcategoryId: string | null,
) {
  const { error } = await (supabase as any)
    .from('necta_ledger_entries')
    .update({ category_id: categoryId, subcategory_id: subcategoryId, category_source: 'manual' })
    .eq('id', entry.id);
  if (error) throw error;

  const pattern = normalizePattern(entry.counterparty, entry.description);
  if (!pattern || !categoryId) return;

  const { data: existing } = await (supabase as any)
    .from('finance_categorization_memory')
    .select('id, hits')
    .eq('company_id', entry.company_id).eq('scope', 'ledger').eq('pattern', pattern)
    .maybeSingle();

  if (existing?.id) {
    await (supabase as any).from('finance_categorization_memory')
      .update({ category_id: categoryId, subcategory_id: subcategoryId, hits: (existing.hits ?? 1) + 1 })
      .eq('id', existing.id);
  } else {
    await (supabase as any).from('finance_categorization_memory').insert({
      company_id: entry.company_id, scope: 'ledger', pattern,
      category_id: categoryId, subcategory_id: subcategoryId,
    });
  }
}

/** Aplica a memória existente a todas as linhas ainda sem categoria. */
export async function applyMemoryToPendingEntries(companyId: string): Promise<number> {
  const [{ data: entries }, { data: memory }] = await Promise.all([
    (supabase as any).from('necta_ledger_entries')
      .select('id, description, counterparty').eq('company_id', companyId).is('category_id', null),
    (supabase as any).from('finance_categorization_memory')
      .select('pattern, category_id, subcategory_id').eq('company_id', companyId).eq('scope', 'ledger'),
  ]);
  if (!entries?.length || !memory?.length) return 0;
  const byPattern = new Map<string, any>(memory.map((m: any) => [m.pattern, m]));
  let applied = 0;
  for (const entry of entries) {
    const hit = byPattern.get(normalizePattern(entry.counterparty, entry.description));
    if (!hit?.category_id) continue;
    await (supabase as any).from('necta_ledger_entries').update({
      category_id: hit.category_id, subcategory_id: hit.subcategory_id, category_source: 'memory',
    }).eq('id', entry.id);
    applied += 1;
  }
  return applied;
}

export function useNectaLedger(companyId: string | null, accountId?: string | null) {
  const [entries, setEntries] = useState<NectaLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!companyId) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    let query = (supabase as any)
      .from('necta_ledger_entries')
      .select('*, category:transaction_categories(id, name, color), subcategory:transaction_subcategories(id, name)')
      .eq('company_id', companyId)
      .order('date', { ascending: false });
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query;
    if (error) console.error('Error fetching Necta ledger:', error);
    setEntries((data ?? []) as NectaLedgerEntry[]);
    setLoading(false);
  }, [companyId, accountId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  /** Atualiza o espelho a partir da Necta. */
  const sync = useCallback(async () => {
    if (!companyId) return;
    const { error } = await supabase.functions.invoke('necta-api', {
      body: { action: 'sync_ledger', company_id: companyId },
    });
    if (error) throw new Error(error.message);
    await fetchEntries();
  }, [companyId, fetchEntries]);

  return { entries, loading, refetch: fetchEntries, sync };
}
