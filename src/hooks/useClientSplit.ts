import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { SplitScope, SplitValueType } from '@/hooks/useSplitRules';
import type { ClientSupplier } from '@/hooks/useClientsSuppliers';

export interface ClientSplitRule {
  id: string;
  company_id: string;
  client_supplier_id: string | null;
  recipient_id: string;
  scope: SplitScope;
  scope_ref_id: string | null;
  value_type: SplitValueType;
  value: number;
  priority: number;
  active: boolean;
  notes: string | null;
}

export interface ClientSplitRuleInput {
  scope: SplitScope;
  scope_ref_id: string | null;
  value_type: SplitValueType;
  value: number;
  priority: number;
  active: boolean;
  notes: string | null;
}

/**
 * Regras de split de PIX gerenciadas dentro do cadastro de clientes/fornecedores.
 * O recebedor é sempre um cliente/fornecedor; a linha técnica em `split_recipients`
 * é mantida em sincronia automaticamente (compatibilidade com a execução do split).
 */
export function useClientSplit(companyId: string | null) {
  const [rules, setRules] = useState<ClientSplitRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRules = useCallback(async () => {
    if (!companyId) { setRules([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('split_rules')
      .select('*')
      .eq('company_id', companyId)
      .not('client_supplier_id', 'is', null)
      .order('priority', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar regras de split', description: error.message, variant: 'destructive' });
    } else {
      setRules((data || []).map((r: any) => ({ ...r, value: Number(r.value) })));
    }
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const rulesFor = useCallback(
    (clientId: string) => rules.filter(r => r.client_supplier_id === clientId),
    [rules],
  );

  /** Garante o registro técnico do recebedor a partir dos dados PIX do cadastro. */
  const ensureRecipient = useCallback(async (client: ClientSupplier): Promise<string | null> => {
    if (!companyId) return null;
    const payload = {
      name: client.name,
      document: client.document,
      pix_key: client.pix_key || '',
      pix_key_type: client.pix_key_type || 'random',
      bank_name: client.bank_name ?? null,
      bank_branch: client.bank_branch ?? null,
      bank_account: client.bank_account ?? null,
      active: true,
    };

    const { data: existing } = await (supabase as any)
      .from('split_recipients')
      .select('id')
      .eq('company_id', companyId)
      .ilike('name', client.name)
      .maybeSingle();

    if (existing?.id) {
      await (supabase as any).from('split_recipients').update(payload).eq('id', existing.id);
      return existing.id;
    }

    const { data: created, error } = await (supabase as any)
      .from('split_recipients')
      .insert({ ...payload, company_id: companyId })
      .select('id')
      .single();
    if (error) {
      toast({ title: 'Erro ao preparar recebedor', description: error.message, variant: 'destructive' });
      return null;
    }
    return created.id;
  }, [companyId, toast]);

  const createRule = useCallback(async (client: ClientSupplier, input: ClientSplitRuleInput) => {
    if (!companyId) return false;
    const recipientId = await ensureRecipient(client);
    if (!recipientId) return false;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('split_rules').insert({
      ...input,
      company_id: companyId,
      client_supplier_id: client.id,
      recipient_id: recipientId,
      created_by: userData?.user?.id || null,
    });
    if (error) {
      toast({ title: 'Erro ao criar regra', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchRules();
    return true;
  }, [companyId, ensureRecipient, fetchRules, toast]);

  const updateRule = useCallback(async (id: string, input: Partial<ClientSplitRuleInput>) => {
    const { error } = await (supabase as any).from('split_rules').update(input).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar regra', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchRules();
    return true;
  }, [fetchRules, toast]);

  const removeRule = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from('split_rules').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir regra', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchRules();
    return true;
  }, [fetchRules, toast]);

  /** Mantém os dados PIX do recebedor técnico atualizados após editar o cadastro. */
  const syncRecipient = useCallback(async (client: ClientSupplier) => {
    if (!client.pix_key) return;
    if (!rules.some(r => r.client_supplier_id === client.id)) return;
    await ensureRecipient(client);
  }, [ensureRecipient, rules]);

  return { rules, loading, rulesFor, createRule, updateRule, removeRule, syncRecipient, refetch: fetchRules };
}
