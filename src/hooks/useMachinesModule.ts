import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MachineType { id: string; company_id: string; name: string; }
export interface MachineCategory { id: string; company_id: string; name: string; }
export interface Machine {
  id: string; company_id: string; type_id: string | null; name: string;
  brand: string | null; model: string | null; year: number | null; destination: string | null;
  acquisition_value: number; acquisition_date: string | null; acquisition_source: 'new_purchase' | 'pre_existing';
  current_horimeter: number; preventive_maintenance_interval_hours: number | null;
  status: 'disponivel' | 'locada' | 'vendida' | 'reservada' | 'demonstracao' | 'indisponivel';
  technical_status?: 'operacional' | 'em_manutencao' | 'em_teste' | 'descarte';
  location?: string | null;
  usage_purpose?: string[] | null;
  notes: string | null;
}
export interface Operator { id: string; company_id: string; name: string; document: string | null; phone: string | null; notes: string | null; }
export interface Mechanic { id: string; company_id: string; name: string; document: string | null; phone: string | null; specialty: string | null; notes: string | null; }
export interface MaintenanceRecord {
  id: string; company_id: string; machine_id: string; mechanic_id: string | null;
  start_date: string; end_date: string | null; description: string | null; horimeter_at_service: number | null;
  total_cost: number; payment_mode: 'cash' | 'installments' | 'none';
  status: 'in_progress' | 'completed' | 'cancelled'; transaction_id: string | null;
  paid_account_id?: string | null;
  has_travel?: boolean; travel_vehicle_id?: string | null; travel_km?: number | null; travel_notes?: string | null;
  machine?: Machine; mechanic?: Mechanic | null;
}

export interface RentalPriceTable {
  id: string; company_id: string; machine_id: string; unit: 'hour' | 'day' | 'week' | 'month';
  min_qty: number; max_qty: number | null; price: number; valid_from: string | null; valid_to: string | null;
}
export interface RentalKit { id: string; company_id: string; name: string; description: string | null; items?: { id: string; machine_id: string; machine?: Machine }[] }
export interface Rental {
  id: string; company_id: string; client_id: string | null; operator_id: string | null; kit_id: string | null;
  start_date: string; end_date: string | null; unit: 'hour' | 'day' | 'week' | 'month';
  qty: number; unit_price: number; total_amount: number;
  horimeter_start: number | null; horimeter_end: number | null;
  payment_mode: 'cash' | 'installments'; installments_count: number | null;
  billing_frequency: 'monthly' | 'weekly' | 'daily' | null;
  paid_account_id: string | null; transaction_id: string | null;
  status: 'active' | 'finished' | 'cancelled'; notes: string | null;
  rental_machines?: { machine_id: string; machine?: Machine }[];
}

function useTable<T>(table: string, companyId: string | null, select = '*') {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    if (!companyId) { setData([]); setLoading(false); return; }
    setLoading(true);
    const { data: rows, error } = await (supabase as any).from(table).select(select).eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) { console.error(`fetch ${table}`, error); toast.error(`Erro ao carregar ${table}`); }
    setData((rows || []) as T[]);
    setLoading(false);
  }, [companyId, table, select]);
  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useMachineTypes(companyId: string | null) {
  const r = useTable<MachineType>('machine_types', companyId);
  return { types: r.data, loading: r.loading, refetch: r.refetch };
}
export function useMachineCategories(companyId: string | null) {
  const r = useTable<MachineCategory>('machine_categories', companyId);
  return { categories: r.data, loading: r.loading, refetch: r.refetch };
}
export function useMachines(companyId: string | null) {
  const r = useTable<Machine>('machines', companyId);
  return { machines: r.data, loading: r.loading, refetch: r.refetch };
}
export function useOperators(companyId: string | null) {
  const r = useTable<Operator>('operators', companyId);
  return { operators: r.data, loading: r.loading, refetch: r.refetch };
}
export function useMechanics(companyId: string | null) {
  const r = useTable<Mechanic>('mechanics', companyId);
  return { mechanics: r.data, loading: r.loading, refetch: r.refetch };
}
export function useMaintenanceRecords(companyId: string | null) {
  const [data, setData] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    if (!companyId) { setData([]); setLoading(false); return; }
    setLoading(true);
    const { data: rows, error } = await (supabase as any)
      .from('maintenance_records')
      .select('*, machine:machines(*), mechanic:mechanics(*)')
      .eq('company_id', companyId)
      .order('start_date', { ascending: false });
    if (error) { console.error(error); toast.error('Erro ao carregar manutenções'); }
    setData((rows || []) as MaintenanceRecord[]);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { fetch(); }, [fetch]);
  return { records: data, loading, refetch: fetch };
}
export function useRentalPriceTables(companyId: string | null) {
  const r = useTable<RentalPriceTable>('rental_price_tables', companyId);
  return { tables: r.data, loading: r.loading, refetch: r.refetch };
}
export function useRentalKits(companyId: string | null) {
  const [kits, setKits] = useState<RentalKit[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    if (!companyId) { setKits([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('rental_kits')
      .select('*, items:rental_kit_items(id, machine_id, machine:machines(*))')
      .eq('company_id', companyId);
    if (error) { console.error(error); }
    setKits((data || []) as RentalKit[]);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { fetch(); }, [fetch]);
  return { kits, loading, refetch: fetch };
}
export function useRentals(companyId: string | null) {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    if (!companyId) { setRentals([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('rentals')
      .select('*, rental_machines(machine_id, machine:machines(*))')
      .eq('company_id', companyId)
      .order('start_date', { ascending: false });
    if (error) { console.error(error); toast.error('Erro ao carregar locações'); }
    setRentals((data || []) as Rental[]);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { fetch(); }, [fetch]);
  return { rentals, loading, refetch: fetch };
}

export function useCompanyMachinesFlag(companyId: string | null) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    if (!companyId) { setEnabled(false); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any).from('companies').select('machines_module_enabled').eq('id', companyId).maybeSingle();
    setEnabled(!!data?.machines_module_enabled);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { refetch(); }, [refetch]);
  return { enabled, loading, refetch };
}
