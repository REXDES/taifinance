import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClientSupplier {
  id: string;
  company_id: string;
  name: string;
  type: 'client' | 'supplier' | 'both';
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientsSuppliers(companyId: string | null) {
  const [clientsSuppliers, setClientsSuppliers] = useState<ClientSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClientsSuppliers = useCallback(async () => {
    if (!companyId) {
      setClientsSuppliers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients_suppliers')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;
      setClientsSuppliers((data || []) as ClientSupplier[]);
    } catch (error) {
      console.error('Error fetching clients/suppliers:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchClientsSuppliers();
  }, [fetchClientsSuppliers]);

  const createClientSupplier = async (data: Omit<ClientSupplier, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: newRecord, error } = await supabase
      .from('clients_suppliers')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    await fetchClientsSuppliers();
    return newRecord;
  };

  const updateClientSupplier = async (id: string, data: Partial<ClientSupplier>) => {
    const { error } = await supabase
      .from('clients_suppliers')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    await fetchClientsSuppliers();
  };

  const deleteClientSupplier = async (id: string) => {
    const { error } = await supabase
      .from('clients_suppliers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchClientsSuppliers();
  };

  return {
    clientsSuppliers,
    loading,
    createClientSupplier,
    updateClientSupplier,
    deleteClientSupplier,
    refetch: fetchClientsSuppliers
  };
}
