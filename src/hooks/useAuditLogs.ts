import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Json | null;
  company_id: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string | null;
  company_name?: string;
}

interface UseAuditLogsOptions {
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string;
  companyId?: string;
}

export const useAuditLogs = (options: UseAuditLogsOptions = {}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate + 'T23:59:59');
      }
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }
      if (options.action) {
        query = query.eq('action', options.action);
      }
      if (options.companyId) {
        query = query.eq('company_id', options.companyId);
      }

      const { data: logsData, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        setLogs([]);
        return;
      }

      if (!logsData || logsData.length === 0) {
        setLogs([]);
        return;
      }

      // Get unique user IDs and company IDs
      const userIds = [...new Set(logsData.map(log => log.user_id))];
      const companyIds = [...new Set(logsData.map(log => log.company_id).filter(Boolean))] as string[];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      // Fetch companies
      const { data: companies } = companyIds.length > 0
        ? await supabase
            .from('companies')
            .select('id, name')
            .in('id', companyIds)
        : { data: [] };

      // Create lookup maps
      const profileMap = new Map<string, { email: string; full_name: string | null }>();
      profiles?.forEach(p => profileMap.set(p.user_id, p));
      
      const companyMap = new Map<string, string>();
      companies?.forEach(c => companyMap.set(c.id, c.name));

      const enrichedLogs: AuditLog[] = logsData.map(log => ({
        ...log,
        user_email: profileMap.get(log.user_id)?.email,
        user_name: profileMap.get(log.user_id)?.full_name,
        company_name: log.company_id ? companyMap.get(log.company_id) : undefined,
      }));

      setLogs(enrichedLogs);
    } catch (error) {
      console.error('Error in useAuditLogs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [options.startDate, options.endDate, options.userId, options.action, options.companyId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
};
