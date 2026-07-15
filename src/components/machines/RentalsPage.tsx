import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Ban, CheckCircle2, Trash2, Wallet, Boxes, CalendarClock } from 'lucide-react';
import { useRentals, useMachines, useRentalKits, Rental } from '@/hooks/useMachinesModule';
import { useClientsSuppliers } from '@/hooks/useClientsSuppliers';
import { useOperators } from '@/hooks/useMachinesModule';
import { useAccounts } from '@/hooks/useAccounts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { generateRentalReceivables, addDays, addMonths, recalculatePendingInstallments, deletePendingInstallments } from '@/lib/machinesFinance';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';

interface Props { companyId: string; }

const UNIT_LABEL: Record<string, string> = { hour: 'Hora', day: 'Dia', week: 'Semana', month: 'Mês' };

function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function addByUnit(start: string, unit: Rental['unit'], qty: number): string {
  if (unit === 'month') return addMonths(start, qty);
  if (unit === 'week') return addDays(start, qty * 7);
  if (unit === 'day') return addDays(start, qty);
  return start;
}

function defaultFrequency(unit: Rental['unit']): 'monthly' | 'weekly' | 'daily' {
  if (unit === 'month') return 'monthly';
  if (unit === 'week') return 'weekly';
  return 'daily';
}

function suggestedInstallments(duration: number, unit: Rental['unit'], freq: 'monthly' | 'weekly' | 'daily'): number {
  if (!duration || duration <= 0) return 1;
  const durationDays = unit === 'month' ? duration * 30 : unit === 'week' ? duration * 7 : unit === 'day' ? duration : 0;
  const periodDays = freq === 'monthly' ? 30 : freq === 'weekly' ? 7 : 1;
  if (durationDays === 0) return 1;
  return Math.max(1, Math.round(durationDays / periodDays));
}

export function RentalsPage({ companyId }: Props) {
  const { user } = useAuth();
  const { rentals, refetch, loading } = useRentals(companyId);
  const { machines } = useMachines(companyId);
  const { kits } = useRentalKits(companyId);
  const { operators } = useOperators(companyId);
  const { clientsSuppliers } = useClientsSuppliers(companyId);
  const { accounts } = useAccounts(companyId);

  // ---------- Filtros ----------
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [machineFilter, setMachineFilter] = useState<string>('');

  const filtered = useMemo(() => rentals.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (clientFilter !== 'all' && r.client_id !== clientFilter) return false;
    if (fromDate && r.start_date < fromDate) return false;
    if (toDate && r.start_date > toDate) return false;
    return true;
  }), [rentals, statusFilter, clientFilter, fromDate, toDate]);

  const filteredMachines = useMemo(() => {
    const term = machineFilter.trim().toLowerCase();
    return machines.filter(m =>
      (m.status === 'disponivel' || originalMachineIds.includes(m.id)) &&
      (!term ||
        m.name.toLowerCase().includes(term) ||
        (m.brand || '').toLowerCase().includes(term) ||
        (m.model || '').toLowerCase().includes(term))
    );
  }, [machines, machineFilter, originalMachineIds]);

  // ---------- Resumos ----------
  const activeRentals = useMemo(() => rentals.filter(r => r.status === 'active'), [rentals]);
  const totalActiveAmount = useMemo(() => activeRentals.reduce((s, r) => s + Number(r.total_amount || 0), 0), [activeRentals]);
  const totalActiveItems = useMemo(() => activeRentals.reduce((s, r) => s + (r.rental_machines?.length || 0), 0), [activeRentals]);

  const [monthReceivable, setMonthReceivable] = useState(0);
  useEffect(() => {
    (async () => {
      const now = new Date();
      const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastStr = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
      const { data } = await (supabase as any)
        .from('payables_receivables')
        .select('amount, is_amount_pending')
        .eq('company_id', companyId).eq('type', 'receivable').eq('status', 'pending')
        .not('rental_id', 'is', null).gte('due_date', first).lte('due_date', lastStr);
      const total = (data || []).filter((r: any) => !r.is_amount_pending).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      setMonthReceivable(total);
    })();
  }, [companyId, rentals]);

  // ---------- Form Nova / Editar ----------
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalMachineIds, setOriginalMachineIds] = useState<string[]>([]);
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  const empty = {
    client_id: '', operator_id: 'none', kit_id: 'none', machine_ids: [] as string[],
    start_date: todayLocal(), end_date: '',
    unit: 'day' as Rental['unit'], duration: '1', unit_price: '', total_amount: '',
    horimeter_start: '', payment_mode: 'cash' as 'cash' | 'installments',
    installments_count: '1', installments_manual: false,
    billing_frequency: 'daily' as 'monthly' | 'weekly' | 'daily',
    first_due_offset: '1' as '0' | '1',
    paid_account_id: 'none', notes: '',
  };
  const [form, setForm] = useState(empty);
  const openNew = () => {
    setEditingId(null); setOriginalMachineIds([]); setOriginalTotal(0);
    setForm({ ...empty, start_date: todayLocal() });
    setOpen(true);
  };
  const openEdit = (r: Rental) => {
    const machineIds = (r.rental_machines || []).map(rm => rm.machine_id);
    setEditingId(r.id);
    setOriginalMachineIds(machineIds);
    setOriginalTotal(Number(r.total_amount || 0));
    setForm({
      client_id: r.client_id || '',
      operator_id: r.operator_id || 'none',
      kit_id: r.kit_id || 'none',
      machine_ids: machineIds,
      start_date: r.start_date,
      end_date: r.end_date || '',
      unit: r.unit,
      duration: String(r.qty ?? 1),
      unit_price: String(r.unit_price ?? ''),
      total_amount: String(r.total_amount ?? ''),
      horimeter_start: r.horimeter_start != null ? String(r.horimeter_start) : '',
      payment_mode: r.payment_mode,
      installments_count: r.installments_count ? String(r.installments_count) : '1',
      installments_manual: true,
      billing_frequency: (r.billing_frequency as any) || 'daily',
      first_due_offset: '1',
      paid_account_id: r.paid_account_id || 'none',
      notes: r.notes || '',
    });
    setOpen(true);
  };

  const computedEnd = useMemo(() => {
    const dur = parseFloat(form.duration || '0');
    if (!form.start_date || !dur) return '';
    return addByUnit(form.start_date, form.unit, dur);
  }, [form.start_date, form.unit, form.duration]);

  useEffect(() => { setForm(f => ({ ...f, end_date: computedEnd })); }, [computedEnd]);
  useEffect(() => { setForm(f => ({ ...f, billing_frequency: defaultFrequency(f.unit) })); }, [form.unit]);

  const suggestedQty = suggestedInstallments(parseFloat(form.duration || '0'), form.unit, form.billing_frequency);
  useEffect(() => {
    if (!form.installments_manual && form.payment_mode === 'installments') {
      setForm(f => ({ ...f, installments_count: String(suggestedQty) }));
    }
  }, [suggestedQty, form.payment_mode, form.installments_manual]);

  const calcTotal = () => {
    const q = parseFloat(form.duration || '0');
    const p = parseFloat(form.unit_price || '0');
    return q * p;
  };

  const save = async () => {
    if (!form.client_id) return toast.error('Selecione o cliente');
    if (form.kit_id === 'none' && form.machine_ids.length === 0) return toast.error('Selecione ao menos uma máquina ou kit');
    const total = parseFloat(form.total_amount || '') || calcTotal();
    if (total <= 0) return toast.error('Valor total deve ser maior que zero');
    if (form.paid_account_id === 'none') return toast.error('Selecione a conta de recebimento');

    const rentalPayload: any = {
      company_id: companyId,
      client_id: form.client_id,
      operator_id: form.operator_id !== 'none' ? form.operator_id : null,
      kit_id: form.kit_id !== 'none' ? form.kit_id : null,
      start_date: form.start_date, end_date: form.end_date || null,
      unit: form.unit, qty: parseFloat(form.duration || '1'),
      unit_price: parseFloat(form.unit_price || '0'),
      total_amount: total,
      horimeter_start: form.horimeter_start ? parseFloat(form.horimeter_start) : null,
      payment_mode: form.payment_mode,
      installments_count: form.payment_mode === 'installments' ? parseInt(form.installments_count) : null,
      billing_frequency: form.payment_mode === 'installments' ? form.billing_frequency : null,
      paid_account_id: form.paid_account_id !== 'none' ? form.paid_account_id : null,
      notes: form.notes || null,
    };

    let rentalId: string | null = editingId;
    if (editingId) {
      const { error } = await (supabase as any).from('rentals').update(rentalPayload).eq('id', editingId);
      if (error) return toast.error(error.message);
    } else {
      const { data: rental, error } = await (supabase as any).from('rentals').insert({
        ...rentalPayload, status: 'active', created_by: user?.id ?? null,
      }).select().single();
      if (error) return toast.error(error.message);
      rentalId = rental.id;
    }

    // Máquinas alvo (via kit ou seleção)
    let machineIds = form.machine_ids;
    if (form.kit_id !== 'none') {
      const kit = kits.find(k => k.id === form.kit_id);
      machineIds = kit?.items?.map(i => i.machine_id) || [];
    }

    if (editingId) {
      const toRemove = originalMachineIds.filter(id => !machineIds.includes(id));
      const toAdd = machineIds.filter(id => !originalMachineIds.includes(id));
      if (toRemove.length) {
        await (supabase as any).from('rental_machines').delete().eq('rental_id', rentalId).in('machine_id', toRemove);
        for (const mid of toRemove) await (supabase as any).from('machines').update({ status: 'disponivel' }).eq('id', mid);
      }
      if (toAdd.length) {
        await (supabase as any).from('rental_machines').insert(toAdd.map(mid => ({ rental_id: rentalId, machine_id: mid })));
        for (const mid of toAdd) await (supabase as any).from('machines').update({ status: 'locada' }).eq('id', mid);
      }
    } else if (machineIds.length > 0) {
      await (supabase as any).from('rental_machines').insert(machineIds.map(mid => ({ rental_id: rentalId, machine_id: mid })));
      for (const mid of machineIds) await (supabase as any).from('machines').update({ status: 'locada' }).eq('id', mid);
      if (form.horimeter_start) {
        await (supabase as any).from('machine_horimeter_logs').insert(
          machineIds.map(mid => ({ machine_id: mid, reading: parseFloat(form.horimeter_start), source: 'rental_start', reference_id: rentalId }))
        );
      }
    }

    try {
      if (editingId) {
        if (form.payment_mode === 'installments') {
          if (Math.abs(total - originalTotal) > 0.001) {
            await recalculatePendingInstallments({ rentalId: rentalId!, newTotal: total });
          }
        } else {
          const { data: cur } = await (supabase as any).from('rentals').select('transaction_id').eq('id', rentalId).maybeSingle();
          if (cur?.transaction_id) {
            await (supabase as any).from('transactions').update({
              amount: total, date: form.start_date,
              account_id: form.paid_account_id !== 'none' ? form.paid_account_id : null,
            }).eq('id', cur.transaction_id);
          }
        }
      } else {
        if (form.payment_mode === 'cash') {
          const { data: tx } = await (supabase as any).from('transactions').insert({
            company_id: companyId, account_id: form.paid_account_id, type: 'income',
            amount: total, description: `Locação #${rentalId!.slice(0, 8)}`,
            date: form.start_date, created_by: user?.id ?? null,
          }).select().single();
          if (tx) await (supabase as any).from('rentals').update({ transaction_id: tx.id }).eq('id', rentalId);
        } else {
          await generateRentalReceivables({
            companyId, rentalId: rentalId!,
            description: `Locação para ${clientsSuppliers.find(c => c.id === form.client_id)?.name || 'cliente'}`,
            totalAmount: total, startDate: form.start_date,
            installments: parseInt(form.installments_count || '1'),
            frequency: form.billing_frequency,
            clientId: form.client_id, userId: user?.id,
            firstDueOffset: form.first_due_offset === '0' ? 0 : 1,
          });
        }
      }
    } catch (e: any) { toast.error('Erro ao processar lançamento financeiro: ' + e.message); }

    toast.success(editingId ? 'Locação atualizada' : 'Locação criada');
    setOpen(false); setEditingId(null); refetch();
  };


  // ---------- Cancelar / Encerrar / Excluir ----------
  const cancel = async (r: Rental) => {
    if (!window.confirm(`Cancelar a locação? ${r.payment_mode === 'installments' ? 'Parcelas pendentes serão removidas (parcelas pagas permanecem).' : 'A transação à vista será excluída.'}`)) return;
    const { error } = await (supabase as any).from('rentals').update({ status: 'cancelled' }).eq('id', r.id);
    if (error) return toast.error(error.message);
    if (r.payment_mode === 'installments') { try { await deletePendingInstallments({ rentalId: r.id }); } catch {} }
    else if (r.transaction_id) { await (supabase as any).from('transactions').delete().eq('id', r.transaction_id); }
    const { data: rms } = await (supabase as any).from('rental_machines').select('machine_id').eq('rental_id', r.id);
    if (rms) for (const rm of rms) await (supabase as any).from('machines').update({ status: 'disponivel' }).eq('id', rm.machine_id);
    toast.success('Locação cancelada'); refetch();
  };

  const [closing, setClosing] = useState<Rental | null>(null);
  const [horimeterEnd, setHorimeterEnd] = useState('');
  const finish = async () => {
    if (!closing) return;
    const { error } = await (supabase as any).from('rentals').update({
      status: 'finished',
      horimeter_end: horimeterEnd ? parseFloat(horimeterEnd) : null,
      end_date: todayLocal(),
    }).eq('id', closing.id);
    if (error) return toast.error(error.message);
    const { data: rms } = await (supabase as any).from('rental_machines').select('machine_id').eq('rental_id', closing.id);
    if (rms) {
      for (const rm of rms) {
        await (supabase as any).from('machines').update({ status: 'disponivel' }).eq('id', rm.machine_id);
        if (horimeterEnd) {
          await (supabase as any).from('machine_horimeter_logs').insert({
            machine_id: rm.machine_id, reading: parseFloat(horimeterEnd), source: 'rental_end', reference_id: closing.id,
          });
          await (supabase as any).from('machines').update({ current_horimeter: parseFloat(horimeterEnd) }).eq('id', rm.machine_id);
        }
      }
    }
    toast.success('Locação encerrada'); setClosing(null); setHorimeterEnd(''); refetch();
  };

  const [deleting, setDeleting] = useState<Rental | null>(null);
  const doDelete = async () => {
    if (!deleting) return;
    try {
      // Remove parcelas pendentes a receber (preserva pagas)
      await deletePendingInstallments({ rentalId: deleting.id });
      // Verifica se ainda existem parcelas (pagas) ou transação à vista vinculadas
      const { data: remaining } = await (supabase as any)
        .from('payables_receivables').select('id').eq('rental_id', deleting.id).limit(1);
      if (remaining && remaining.length > 0) {
        toast.error('Existem parcelas pagas vinculadas. Não é possível excluir a locação.');
        setDeleting(null); return;
      }
      // Libera máquinas e remove vínculos
      const { data: rms } = await (supabase as any).from('rental_machines').select('machine_id').eq('rental_id', deleting.id);
      if (rms) for (const rm of rms) await (supabase as any).from('machines').update({ status: 'disponivel' }).eq('id', rm.machine_id);
      await (supabase as any).from('rental_machines').delete().eq('rental_id', deleting.id);
      // Transação à vista (se houver)
      if (deleting.transaction_id) await (supabase as any).from('transactions').delete().eq('id', deleting.transaction_id);
      const { error } = await (supabase as any).from('rentals').delete().eq('id', deleting.id);
      if (error) throw error;
      toast.success('Locação excluída');
      setDeleting(null); refetch();
    } catch (e: any) { toast.error('Erro ao excluir: ' + e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Locações</h1>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Locação</Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary"><Wallet className="w-5 h-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">Contratos vigentes</div>
            <div className="text-xl font-semibold">R$ {totalActiveAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className="text-[11px] text-muted-foreground">{activeRentals.length} ativa(s)</div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary"><Boxes className="w-5 h-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">Itens locados</div>
            <div className="text-xl font-semibold">{totalActiveItems}</div>
            <div className="text-[11px] text-muted-foreground">em contratos ativos</div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary"><CalendarClock className="w-5 h-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">A receber este mês</div>
            <div className="text-xl font-semibold">R$ {monthReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className="text-[11px] text-muted-foreground">parcelas pendentes</div>
          </div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <Card><CardContent className="p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="finished">Encerradas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clientsSuppliers.filter(c => c.type !== 'supplier').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Início de</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Início até</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Cliente</TableHead><TableHead>Período</TableHead><TableHead>Qtd</TableHead>
            <TableHead>Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
            <TableHead className="w-44">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7}>Carregando...</TableCell></TableRow> :
              filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma locação</TableCell></TableRow> :
              filtered.map(r => {
                const client = clientsSuppliers.find(c => c.id === r.client_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{client?.name || '-'}</TableCell>
                    <TableCell className="text-xs">{new Date(r.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}{r.end_date ? ` → ${new Date(r.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</TableCell>
                    <TableCell>{r.qty} {UNIT_LABEL[r.unit]}</TableCell>
                    <TableCell>R$ {Number(r.total_amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline">{r.payment_mode === 'cash' ? 'À vista' : `${r.installments_count}x ${r.billing_frequency === 'monthly' ? 'mensal' : r.billing_frequency === 'weekly' ? 'semanal' : 'diário'}`}</Badge></TableCell>
                    <TableCell><Badge>{r.status === 'active' ? 'Ativa' : r.status === 'finished' ? 'Encerrada' : 'Cancelada'}</Badge></TableCell>
                    <TableCell>
                      {r.status === 'active' && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setClosing(r)} title="Encerrar"><CheckCircle2 className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => cancel(r)} title="Cancelar"><Ban className="w-4 h-4" /></Button>
                        </>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(r)} title="Excluir"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Nova Locação */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Locação' : 'Nova Locação'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientsSuppliers.filter(c => c.type !== 'supplier').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Operador (opcional)</Label>
                <Select value={form.operator_id} onValueChange={v => setForm({ ...form, operator_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem operador</SelectItem>
                    {operators.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Kit (opcional)</Label>
              <Select value={form.kit_id} onValueChange={v => setForm({ ...form, kit_id: v, machine_ids: [] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar máquinas individualmente</SelectItem>
                  {kits.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.kit_id === 'none' && (
              <div>
                <Label>Máquinas / Implementos</Label>
                <Input
                  placeholder="Filtrar por nome, marca ou modelo..."
                  value={machineFilter}
                  onChange={e => setMachineFilter(e.target.value)}
                  className="mb-2"
                />
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                  {filteredMachines.map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.machine_ids.includes(m.id)}
                        onChange={e => setForm({
                          ...form,
                          machine_ids: e.target.checked
                            ? [...form.machine_ids, m.id]
                            : form.machine_ids.filter(id => id !== m.id)
                        })} />
                      <span className="truncate" title={`${m.name}${m.brand ? ` - ${m.brand}` : ''}${m.model ? ` ${m.model}` : ''}`}>
                        {m.name}
                        {m.brand || m.model ? <span className="text-muted-foreground text-xs ml-1">({[m.brand, m.model].filter(Boolean).join(' ')})</span> : null}
                      </span>
                    </label>
                  ))}
                  {filteredMachines.length === 0 && <span className="text-xs text-muted-foreground col-span-2">Nenhuma máquina encontrada</span>}
                </div>
              </div>
            )}

            <div className="border rounded p-3 space-y-3 bg-muted/30">
              <div className="text-sm font-medium">Contrato</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início *</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div>
                  <Label>Fim (auto)</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Duração *</Label>
                  <Input type="number" step="0.5" min="0" value={form.duration}
                    onChange={e => setForm({ ...form, duration: e.target.value, installments_manual: false })} />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.unit} onValueChange={(v: any) => setForm({ ...form, unit: v, installments_manual: false })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(UNIT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço por {UNIT_LABEL[form.unit].toLowerCase()}</Label>
                <Input type="number" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value, total_amount: '' })} />
              </div>
              <div>
                <Label>Valor total</Label>
                <Input type="number" step="0.01" value={form.total_amount || calcTotal().toFixed(2)} onChange={e => setForm({ ...form, total_amount: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Horímetro inicial</Label>
              <Input type="number" step="0.1" value={form.horimeter_start} onChange={e => setForm({ ...form, horimeter_start: e.target.value })} />
            </div>

            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.payment_mode} onValueChange={(v: any) => setForm({ ...form, payment_mode: v, installments_manual: false })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">À vista (lança como receita)</SelectItem>
                  <SelectItem value="installments">A prazo (gera parcelas em Contas a Receber)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Conta de recebimento *</Label>
              <Select value={form.paid_account_id} onValueChange={v => setForm({ ...form, paid_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {form.payment_mode === 'cash'
                  ? 'A receita será lançada nesta conta na data de início.'
                  : 'Conta padrão para baixa das parcelas a receber.'}
              </p>
            </div>

            {form.payment_mode === 'installments' && (
              <div className="border rounded p-3 space-y-3 bg-muted/30">
                <div className="text-sm font-medium">Cobrança recorrente</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Periodicidade</Label>
                    <Select value={form.billing_frequency} onValueChange={(v: any) => setForm({ ...form, billing_frequency: v, installments_manual: false })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="daily">Diária</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nº de parcelas</Label>
                    <Input type="number" min="1" value={form.installments_count}
                      onChange={e => setForm({ ...form, installments_count: e.target.value, installments_manual: true })} />
                    <p className="text-xs text-muted-foreground mt-1">
                      Sugerido pelo contrato: {suggestedQty}
                      {form.installments_manual && <button type="button" className="ml-2 underline" onClick={() => setForm({ ...form, installments_manual: false, installments_count: String(suggestedQty) })}>usar sugestão</button>}
                    </p>
                  </div>
                </div>
                <div>
                  <Label>1ª parcela vence</Label>
                  <Select value={form.first_due_offset} onValueChange={(v: any) => setForm({ ...form, first_due_offset: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Após 1 período (recomendado)</SelectItem>
                      <SelectItem value="0">Na data de início do contrato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={save}>{editingId ? 'Salvar alterações' : 'Criar locação'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Encerrar */}
      <Dialog open={!!closing} onOpenChange={() => setClosing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Encerrar Locação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Horímetro final</Label><Input type="number" step="0.1" value={horimeterEnd} onChange={e => setHorimeterEnd(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">As máquinas vinculadas voltarão a ficar disponíveis.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosing(null)}>Cancelar</Button>
            <Button onClick={finish}>Encerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <DeleteConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onConfirm={doDelete}
        title="Excluir locação"
        description="A locação será removida permanentemente. As parcelas a receber pendentes vinculadas também serão excluídas. Parcelas já pagas impedirão a exclusão."
      />
    </div>
  );
}
