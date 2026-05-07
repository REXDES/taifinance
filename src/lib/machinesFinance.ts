import { supabase } from '@/integrations/supabase/client';

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dueDateForInstallment(start: string, freq: 'monthly' | 'weekly' | 'daily', i: number): string {
  if (freq === 'monthly') return addMonths(start, i);
  if (freq === 'weekly') return addDays(start, i * 7);
  return addDays(start, i);
}

interface RentalReceivablesArgs {
  companyId: string;
  rentalId: string;
  description: string;
  totalAmount: number;
  startDate: string;
  installments: number;
  frequency: 'monthly' | 'weekly' | 'daily';
  clientId: string | null;
  userId?: string | null;
  /** 0 = primeira parcela vence na data de início; 1 = vence após 1 período (default) */
  firstDueOffset?: 0 | 1;
}

export async function generateRentalReceivables(args: RentalReceivablesArgs) {
  const { companyId, rentalId, description, totalAmount, startDate, installments, frequency, clientId, userId, firstDueOffset = 1 } = args;
  const installmentValue = +(totalAmount / installments).toFixed(2);
  const rows = Array.from({ length: installments }).map((_, i) => ({
    company_id: companyId,
    type: 'receivable',
    payment_type: installments > 1 ? 'installment' : 'single',
    description: installments > 1 ? `${description} (${i + 1}/${installments})` : description,
    amount: installmentValue,
    due_date: dueDateForInstallment(startDate, frequency, i + firstDueOffset),
    status: 'pending',
    client_supplier_id: clientId,
    rental_id: rentalId,
    installment_number: i + 1,
    total_installments: installments,
    created_by: userId ?? null,
  }));
  const { error } = await (supabase as any).from('payables_receivables').insert(rows);
  if (error) throw error;
}

interface MaintenancePayablesArgs {
  companyId: string;
  maintenanceId: string;
  description: string;
  totalAmount: number;
  startDate: string;
  installments: number;
  userId?: string | null;
}

export async function generateMaintenancePayables(args: MaintenancePayablesArgs) {
  const { companyId, maintenanceId, description, totalAmount, startDate, installments, userId } = args;
  const installmentValue = +(totalAmount / installments).toFixed(2);
  const rows = Array.from({ length: installments }).map((_, i) => ({
    company_id: companyId,
    type: 'payable',
    payment_type: installments > 1 ? 'installment' : 'single',
    description: installments > 1 ? `${description} (${i + 1}/${installments})` : description,
    amount: installmentValue,
    due_date: dueDateForInstallment(startDate, 'monthly', i),
    status: 'pending',
    maintenance_id: maintenanceId,
    installment_number: i + 1,
    total_installments: installments,
    created_by: userId ?? null,
  }));
  const { error } = await (supabase as any).from('payables_receivables').insert(rows);
  if (error) throw error;
}

export async function recalculatePendingInstallments(opts: {
  rentalId?: string; maintenanceId?: string; newTotal: number;
}) {
  const filterCol = opts.rentalId ? 'rental_id' : 'maintenance_id';
  const filterVal = opts.rentalId || opts.maintenanceId;
  const { data: all, error } = await (supabase as any)
    .from('payables_receivables').select('id, amount, status, paid_amount').eq(filterCol, filterVal);
  if (error) throw error;
  const paidSum = (all || []).filter((r: any) => r.status === 'paid').reduce((s: number, r: any) => s + Number(r.paid_amount || r.amount || 0), 0);
  const pending = (all || []).filter((r: any) => r.status !== 'paid');
  if (pending.length === 0) return;
  const remaining = Math.max(0, opts.newTotal - paidSum);
  const newAmt = +(remaining / pending.length).toFixed(2);
  await Promise.all(pending.map((p: any) =>
    (supabase as any).from('payables_receivables').update({ amount: newAmt }).eq('id', p.id)
  ));
}

export async function deletePendingInstallments(opts: { rentalId?: string; maintenanceId?: string }) {
  const filterCol = opts.rentalId ? 'rental_id' : 'maintenance_id';
  const filterVal = opts.rentalId || opts.maintenanceId;
  const { error } = await (supabase as any)
    .from('payables_receivables').delete().eq(filterCol, filterVal).neq('status', 'paid');
  if (error) throw error;
}
