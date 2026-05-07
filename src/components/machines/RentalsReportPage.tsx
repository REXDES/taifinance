import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Ban, CheckCircle2 } from 'lucide-react';
import { useRentals, Rental } from '@/hooks/useMachinesModule';
import { useClientsSuppliers } from '@/hooks/useClientsSuppliers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { recalculatePendingInstallments, deletePendingInstallments } from '@/lib/machinesFinance';

interface Props { companyId: string; }
const UNIT_LABEL: Record<string, string> = { hour: 'Hora', day: 'Dia', week: 'Semana', month: 'Mês' };

export function RentalsReportPage({ companyId }: Props) {
  const { rentals, refetch, loading } = useRentals(companyId);
  const { clientsSuppliers } = useClientsSuppliers(companyId);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Rental | null>(null);
  const [editForm, setEditForm] = useState({ qty: '', unit_price: '', total_amount: '' });
  const [closing, setClosing] = useState<Rental | null>(null);
  const [horimeterEnd, setHorimeterEnd] = useState('');

  const filtered = rentals.filter(r => statusFilter === 'all' || r.status === statusFilter);

  const openEdit = (r: Rental) => {
    setEditing(r);
    setEditForm({ qty: r.qty.toString(), unit_price: r.unit_price.toString(), total_amount: r.total_amount.toString() });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const newTotal = parseFloat(editForm.total_amount || '0') || (parseFloat(editForm.qty) * parseFloat(editForm.unit_price));
    const { error } = await (supabase as any).from('rentals').update({
      qty: parseFloat(editForm.qty), unit_price: parseFloat(editForm.unit_price), total_amount: newTotal,
    }).eq('id', editing.id);
    if (error) return toast.error(error.message);

    if (editing.payment_mode === 'installments') {
      try {
        await recalculatePendingInstallments({ rentalId: editing.id, newTotal });
        toast.success('Locação atualizada e parcelas pendentes recalculadas');
      } catch (e: any) { toast.error('Erro ao recalcular: ' + e.message); }
    } else {
      // Update transaction value
      if (editing.transaction_id) {
        await (supabase as any).from('transactions').update({ amount: newTotal }).eq('id', editing.transaction_id);
      }
      toast.success('Locação atualizada');
    }
    setEditing(null); refetch();
  };

  const cancel = async (r: Rental) => {
    if (!window.confirm(`Cancelar a locação? ${r.payment_mode === 'installments' ? 'Parcelas pendentes serão removidas (parcelas pagas permanecem).' : 'A transação será excluída.'}`)) return;
    const { error } = await (supabase as any).from('rentals').update({ status: 'cancelled' }).eq('id', r.id);
    if (error) return toast.error(error.message);

    if (r.payment_mode === 'installments') {
      try { await deletePendingInstallments({ rentalId: r.id }); } catch {}
    } else if (r.transaction_id) {
      await (supabase as any).from('transactions').delete().eq('id', r.transaction_id);
    }

    // Free machines
    const { data: rms } = await (supabase as any).from('rental_machines').select('machine_id').eq('rental_id', r.id);
    if (rms) for (const rm of rms) await (supabase as any).from('machines').update({ status: 'available' }).eq('id', rm.machine_id);

    toast.success('Locação cancelada'); refetch();
  };

  const finish = async () => {
    if (!closing) return;
    const { error } = await (supabase as any).from('rentals').update({
      status: 'finished',
      horimeter_end: horimeterEnd ? parseFloat(horimeterEnd) : null,
      end_date: new Date().toISOString().slice(0, 10),
    }).eq('id', closing.id);
    if (error) return toast.error(error.message);

    const { data: rms } = await (supabase as any).from('rental_machines').select('machine_id').eq('rental_id', closing.id);
    if (rms) {
      for (const rm of rms) {
        await (supabase as any).from('machines').update({ status: 'available' }).eq('id', rm.machine_id);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Relatório de Locações</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="finished">Encerradas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Cliente</TableHead><TableHead>Período</TableHead><TableHead>Qtd</TableHead>
            <TableHead>Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
            <TableHead className="w-40">Ações</TableHead>
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
                    <TableCell><Badge variant="outline">{r.payment_mode === 'cash' ? 'À vista' : `${r.installments_count}x`}</Badge></TableCell>
                    <TableCell><Badge>{r.status === 'active' ? 'Ativa' : r.status === 'finished' ? 'Encerrada' : 'Cancelada'}</Badge></TableCell>
                    <TableCell>
                      {r.status === 'active' && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setClosing(r)} title="Encerrar"><CheckCircle2 className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => cancel(r)} title="Cancelar"><Ban className="w-4 h-4" /></Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Locação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              {editing?.payment_mode === 'installments'
                ? 'Alterar o valor recalculará apenas as parcelas pendentes (parcelas já pagas permanecem inalteradas).'
                : 'A transação à vista vinculada será atualizada com o novo valor.'}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Quantidade</Label><Input type="number" step="0.5" value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value })} /></div>
              <div><Label>Preço unit.</Label><Input type="number" step="0.01" value={editForm.unit_price} onChange={e => setEditForm({ ...editForm, unit_price: e.target.value })} /></div>
              <div><Label>Total</Label><Input type="number" step="0.01" value={editForm.total_amount} onChange={e => setEditForm({ ...editForm, total_amount: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close */}
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
    </div>
  );
}
