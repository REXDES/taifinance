import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WhatsappLog {
  id: string;
  company_id: string | null;
  kind: string;
  template_name: string | null;
  recipient_name: string | null;
  recipient_phone: string;
  description: string | null;
  amount: number | null;
  method: string | null;
  success: boolean;
  error_message: string | null;
  provider_message_id: string | null;
  created_at: string;
}

export interface WhatsappLogFilters {
  startDate: string;
  endDate: string;
  kind: string;
  status: string;
  search: string;
}

export function useWhatsappLogs(companyId: string | undefined, filters: WhatsappLogFilters) {
  const { initialSessionResolved } = useAuth();
  const [logs, setLogs] = useState<WhatsappLog[]>([]);
  const [loading, setLoading] = useState(false);

  const { startDate, endDate, kind, status, search } = filters;

  const fetchLogs = useCallback(async () => {
    if (!initialSessionResolved || !companyId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('whatsapp_message_logs')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (kind !== 'all') query = query.eq('kind', kind);
      if (status !== 'all') query = query.eq('success', status === 'success');

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data ?? []) as WhatsappLog[];
      const term = search.trim().toLowerCase();
      if (term) {
        rows = rows.filter(r =>
          (r.recipient_name || '').toLowerCase().includes(term) ||
          (r.recipient_phone || '').toLowerCase().includes(term) ||
          (r.description || '').toLowerCase().includes(term)
        );
      }
      setLogs(rows);
    } catch (err) {
      console.error('Erro ao carregar envios de WhatsApp:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [initialSessionResolved, companyId, startDate, endDate, kind, status, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
}
