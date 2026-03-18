import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BankConnection {
  id: string;
  company_id: string;
  name: string;
  client_id: string;
  account_id: string | null;
  agency: string | null;
  account_number: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export interface BankBalance {
  accountId?: string;
  agency?: string;
  accountNumber?: string;
  status?: string;
  balance?: number;
  [key: string]: unknown;
}

export interface ExtractEntry {
  id?: string;
  date?: string;
  description?: string;
  amount?: number;
  type?: string;
  status?: string;
  [key: string]: unknown;
}

export function useBankConnections(companyId: string | null) {
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['bank-connections', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bank_connections')
        .select('id, company_id, name, client_id, account_id, agency, account_number, is_active, last_sync_at, created_at')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BankConnection[];
    },
    enabled: !!companyId,
  });

  const testConnection = async (clientId: string, clientSecret: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await supabase.functions.invoke('bank-api-proxy', {
      body: { action: 'test', clientId, clientSecret },
    });

    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  const createConnection = useMutation({
    mutationFn: async (params: {
      name: string;
      clientId: string;
      clientSecret: string;
      accountId?: string;
      agency?: string;
      accountNumber?: string;
    }) => {
      if (!companyId) throw new Error('No company selected');
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('bank_connections')
        .insert({
          company_id: companyId,
          name: params.name,
          client_id: params.clientId,
          client_secret: params.clientSecret,
          account_id: params.accountId || null,
          agency: params.agency || null,
          account_number: params.accountNumber || null,
          created_by: user?.id || null,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections', companyId] });
      toast.success('Conta bancária conectada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error('Erro ao conectar conta: ' + err.message);
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from('bank_connections')
        .update({ is_active: false })
        .eq('id', connectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-connections', companyId] });
      toast.success('Conta desconectada');
    },
  });

  const fetchBalance = async (connectionId: string): Promise<BankBalance> => {
    const res = await supabase.functions.invoke('bank-api-proxy', {
      body: { action: 'balance', connectionId },
    });
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  const fetchExtract = async (
    connectionId: string,
    filters?: { startDate?: string; endDate?: string; type?: string; status?: string; page?: number; limit?: number }
  ): Promise<unknown> => {
    const res = await supabase.functions.invoke('bank-api-proxy', {
      body: { action: 'extract', connectionId, filters },
    });
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  return {
    connections,
    isLoading,
    testConnection,
    createConnection,
    deleteConnection,
    fetchBalance,
    fetchExtract,
  };
}
