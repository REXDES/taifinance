import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useRentals, useMachines, useRentalKits, Rental } from '@/hooks/useMachinesModule';
import { useClientsSuppliers } from '@/hooks/useClientsSuppliers';
import { useOperators } from '@/hooks/useMachinesModule';
import { useAccounts } from '@/hooks/useAccounts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { generateRentalReceivables } from '@/lib/machinesFinance';

interface Props { companyId: string; }

const UNIT_LABEL: Record<string, string> = { hour: 'Hora', day: 'Dia', week: 'Semana', month: 'Mês' };

export function RentalsPage({ companyId }: Props) {
  const { user } = useAuth();
  const { rentals, refetch, loading } = useRentals(companyId);
  const { machines } = useMachines(companyId);
  const { kits } = useRentalKits(companyId);
  const { operators } = useOperators(companyId);
  const { clientsSuppliers } = useClientsSuppliers(companyId);
  const { accounts } = useAccounts(companyId);

  const [open, setOpen] = useState(false);
  const empty = {
    client_id: '', operator_id: 'none', kit_id: 'none', machine_ids: [] as string[],
    start_date: new Date().toISOString().slice(0, 10), end_date: '',
    unit: 'day' as Rental['unit'], qty: '1', unit_price: '', total_amount: '',
    horimeter_start: '', payment_mode: 'cash' as 'cash' | 'installments',
    installments_count: '1', billing_frequency: 'monthly' as 'monthly' | 'weekly' | 'daily',
    paid_account_id: 'none', notes: '',
  };
  const [form, setForm] = useState(empty);

  const openNew = () => { setForm(empty); setOpen(true); };

  const calcTotal = () => {
    const q = parseFloat(form.qty || '0');
    const p = parseFloat(form.unit_price || '0');
    return q * p;
  };

  const save = async () => {
    if (!form.client_id) return toast.error('Selecione o cliente');
    if (form.kit_id === 'none' && form.machine_ids.length === 0) return toast.error('Selecione ao menos uma máquina ou kit');
    const total = parseFloat(form.total_amount || '') || calcTotal();
    if (total <= 0) return toast.error('Valor total deve ser maior que zero');
    if (form.payment_mode === 'cash' && form.paid_account_id === 'none') return toast.error('Selecione a conta de recebimento');

    const rentalPayload: any = {
      company_id: companyId,
      client_id: form.client_id,
      operator_id: form.operator_id !== 'none' ? form.operator_id : null,
      kit_id: form.kit_id !== 'none' ? form.kit_id : null,
      start_date: form.start_date, end_date: form.end_date || null,
      unit: form.unit, qty: parseFloat(form.qty || '1'),
      unit_price: parseFloat(form.unit_price || '0'),
      total_amount: total,
      horimeter_start: form.horimeter_start ? parseFloat(form.horimeter_start) : null,
      payment_mode: form.payment_mode,
      installments_count: form.payment_mode === 'installments' ? parseInt(form.installments_count) : null,
      billing_frequency: form.payment_mode === 'installments' ? form.billing_frequency : null,
      paid_account_id: form.payment_mode === 'cash' && form.paid_account_id !== 'none' ? form.paid_account_id : null,
      notes: form.notes || null, status: 'active', created_by: user?.id ?? null,
    };

    const { data: rental, error } = await (supabase as any).from('rentals').insert(rentalPayload).select().single();
    if (error) return toast.error(error.message);

    // Link machines (or kit items)
    let machineIds = form.machine_ids;
    if (form.kit_id !== 'none') {
      const kit = kits.find(k => k.id === form.kit_id);
      machineIds = kit?.items?.map(i => i.machine_id) || [];
    }
    if (machineIds.length > 0) {
      await (supabase as any).from('rental_machines').insert(
        machineIds.map(mid => ({ rental_id: rental.id, machine_id: mid }))
      );
      // Mark machines as rented + log horimeter
      for (const mid of machineIds) {
        await (supabase as any).from('machines').update({ status: 'rented' }).eq('id', mid);
      }
      if (form.horimeter_start) {
        await (supabase as any).from('machine_horimeter_logs').insert(
          machineIds.map(mid => ({ machine_id: mid, reading: parseFloat(form.horimeter_start), source: 'rental_start', reference_id: rental.id }))
        );
      }
    }

    // Financial
    try {
      if (form.payment_mode === 'cash') {
        const { data: tx } = await (supabase as any).from('transactions').insert({
          company_id: companyId, account_id: form.paid_account_id, type: 'income',
          amount: total, description: `Locação #${rental.id.slice(0, 8)}`,
          date: form.start_date, created_by: user?.id ?? null,
        }).select().single();
        if (tx) await (supabase as any).from('rentals').update({ transaction_id: tx.id }).eq('id', rental.id);
      } else {
        await generateRentalReceivables({
          companyId, rentalId: rental.id,
          description: `Locação para ${clientsSuppliers.find(c => c.id === form.client_id)?.name || 'cliente'}`,
          totalAmount: total, startDate: form.start_date,
          installments: parseInt(form.installments_count || '1'),
          frequency: form.billing_frequency,
          clientId: form.client_id, userId: user?.id,
        });
      }
    } catch (e: any) { toast.error('Erro ao gerar lançamento financeiro: ' + e.message); }

    toast.success('Locação criada');
    setOpen(false); refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Locações</h1>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Locação</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Cliente</TableHead><TableHead>Período</TableHead><TableHead>Unidade</TableHead>
            <TableHead>Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow> :
              rentals.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma locação</TableCell></TableRow> :
              rentals.map(r => {
                const client = clientsSuppliers.find(c => c.id === r.client_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{client?.name || '-'}</TableCell>
                    <TableCell>{new Date(r.start_date + 'T00:00:00').toLocaleDateString('pt-BR')} {r.end_date ? `→ ${new Date(r.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</TableCell>
                    <TableCell>{r.qty} {UNIT_LABEL[r.unit]}</TableCell>
                    <TableCell>R$ {Number(r.total_amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline">{r.payment_mode === 'cash' ? 'À vista' : `${r.installments_count}x ${r.billing_frequency === 'monthly' ? 'mensal' : r.billing_frequency === 'weekly' ? 'semanal' : 'diário'}`}</Badge></TableCell>
                    <TableCell><Badge>{r.status === 'active' ? 'Ativa' : r.status === 'finished' ? 'Encerrada' : 'Cancelada'}</Badge></TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
          <DialogHeader><DialogTitle>Nova Locação</DialogTitle></DialogHeader>
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
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                  {machines.filter(m => m.status === 'available').map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.machine_ids.includes(m.id)}
                        onChange={e => setForm({
                          ...form,
                          machine_ids: e.target.checked
                            ? [...form.machine_ids, m.id]
                            : form.machine_ids.filter(id => id !== m.id)
                        })} />
                      {m.name}
                    </label>
                  ))}
                  {machines.filter(m => m.status === 'available').length === 0 && <span className="text-xs text-muted-foreground col-span-2">Nenhuma máquina disponível</span>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início *</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={(v: any) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(UNIT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Quantidade</Label><Input type="number" step="0.5" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
              <div><Label>Preço unitário</Label><Input type="number" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor total</Label><Input type="number" step="0.01" value={form.total_amount || calcTotal().toFixed(2)} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
              <div><Label>Horímetro inicial</Label><Input type="number" step="0.1" value={form.horimeter_start} onChange={e => setForm({ ...form, horimeter_start: e.target.value })} /></div>
            </div>

            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.payment_mode} onValueChange={(v: any) => setForm({ ...form, payment_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">À vista (lança como receita)</SelectItem>
                  <SelectItem value="installments">A prazo (gera parcelas em Contas a Receber)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.payment_mode === 'cash' ? (
              <div>
                <Label>Conta de recebimento</Label>
                <Select value={form.paid_account_id} onValueChange={v => setForm({ ...form, paid_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nº de parcelas</Label><Input type="number" min="1" value={form.installments_count} onChange={e => setForm({ ...form, installments_count: e.target.value })} /></div>
                <div>
                  <Label>Periodicidade</Label>
                  <Select value={form.billing_frequency} onValueChange={(v: any) => setForm({ ...form, billing_frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="daily">Diária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Criar locação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
