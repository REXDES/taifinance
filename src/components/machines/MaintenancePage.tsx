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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useMaintenanceRecords, useMachines, useMechanics, MaintenanceRecord } from '@/hooks/useMachinesModule';
import { useAccounts } from '@/hooks/useAccounts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { generateMaintenancePayables, deletePendingInstallments } from '@/lib/machinesFinance';

interface Props { companyId: string; }

export function MaintenancePage({ companyId }: Props) {
  const { user } = useAuth();
  const { records, refetch, loading } = useMaintenanceRecords(companyId);
  const { machines } = useMachines(companyId);
  const { mechanics } = useMechanics(companyId);
  const { accounts } = useAccounts(companyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);

  const empty = {
    machine_id: '', mechanic_id: 'none', start_date: new Date().toISOString().slice(0, 10),
    end_date: '', description: '', horimeter_at_service: '',
    total_cost: '', payment_mode: 'cash' as 'cash' | 'installments',
    installments: '1', status: 'in_progress' as MaintenanceRecord['status'],
    paid_account_id: 'none',
  };
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: MaintenanceRecord) => {
    setEditing(r);
    setForm({
      machine_id: r.machine_id, mechanic_id: r.mechanic_id || 'none',
      start_date: r.start_date, end_date: r.end_date || '',
      description: r.description || '', horimeter_at_service: r.horimeter_at_service?.toString() || '',
      total_cost: r.total_cost?.toString() || '', payment_mode: (r.payment_mode === 'none' ? 'cash' : r.payment_mode) as 'cash' | 'installments',
      installments: '1', status: r.status,
      paid_account_id: 'none',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.machine_id) return toast.error('Selecione a máquina');
    const cost = parseFloat(form.total_cost || '0');
    const payload: any = {
      company_id: companyId, machine_id: form.machine_id,
      mechanic_id: form.mechanic_id !== 'none' ? form.mechanic_id : null,
      start_date: form.start_date, end_date: form.end_date || null,
      description: form.description || null,
      horimeter_at_service: form.horimeter_at_service ? parseFloat(form.horimeter_at_service) : null,
      total_cost: cost, payment_mode: form.payment_mode,
      status: form.status, created_by: user?.id ?? null,
    };
    const techStatus = form.status === 'in_progress' ? 'em_manutencao' : 'operacional';
    if (editing) {
      const { error } = await (supabase as any).from('maintenance_records').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
      await (supabase as any).from('machines').update({ technical_status: techStatus }).eq('id', form.machine_id);
      toast.success('Atualizada');
    } else {
      const { data, error } = await (supabase as any).from('maintenance_records').insert(payload).select().single();
      if (error) return toast.error(error.message);
      await (supabase as any).from('machines').update({ technical_status: techStatus }).eq('id', form.machine_id);
      // Lançamento financeiro só se conta de pagamento foi informada
      if (cost > 0 && form.paid_account_id !== 'none') {
        try {
          if (form.payment_mode === 'cash') {
            const { data: tx } = await (supabase as any).from('transactions').insert({
              company_id: companyId, account_id: form.paid_account_id, type: 'expense',
              amount: cost, description: `Manutenção: ${form.description || 'sem descrição'}`,
              date: form.start_date, created_by: user?.id ?? null,
            }).select().single();
            if (tx) await (supabase as any).from('maintenance_records').update({ transaction_id: tx.id }).eq('id', data.id);
          } else {
            const inst = Math.max(1, parseInt(form.installments || '1'));
            await generateMaintenancePayables({
              companyId, maintenanceId: data.id,
              description: `Manutenção: ${form.description || 'sem descrição'}`,
              totalAmount: cost, startDate: form.start_date, installments: inst, userId: user?.id,
            });
          }
        } catch (e: any) { toast.error('Erro no lançamento financeiro: ' + e.message); }
      }
      toast.success(form.paid_account_id === 'none' ? 'Manutenção registrada (sem lançamento financeiro)' : 'Manutenção registrada');
    }
    setOpen(false); refetch();
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try { await deletePendingInstallments({ maintenanceId: deleteTarget.id }); } catch {}
    const { error } = await (supabase as any).from('maintenance_records').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Manutenção excluída e parcelas pendentes removidas');
    setDeleteTarget(null); refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manutenções</h1>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Máquina</TableHead><TableHead>Mecânico</TableHead><TableHead>Início</TableHead>
            <TableHead>Custo</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
            <TableHead className="w-32"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7}>Carregando...</TableCell></TableRow> :
              records.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell></TableRow> :
              records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.machine?.name || '-'}</TableCell>
                  <TableCell>{r.mechanic?.name || '-'}</TableCell>
                  <TableCell>{new Date(r.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>R$ {Number(r.total_cost).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline">{r.payment_mode === 'cash' ? 'À vista' : r.payment_mode === 'installments' ? 'Parcelado' : '-'}</Badge></TableCell>
                  <TableCell><Badge>{r.status === 'in_progress' ? 'Em andamento' : r.status === 'completed' ? 'Concluída' : 'Cancelada'}</Badge></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(r)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl overflow-y-auto max-h-[85vh]">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Manutenção</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Máquina *</Label>
                <Select value={form.machine_id} onValueChange={v => setForm({ ...form, machine_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mecânico</Label>
                <Select value={form.mechanic_id} onValueChange={v => setForm({ ...form, mechanic_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informado</SelectItem>
                    {mechanics.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início *</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Horímetro no serviço</Label><Input type="number" step="0.1" value={form.horimeter_at_service} onChange={e => setForm({ ...form, horimeter_at_service: e.target.value })} /></div>
              <div><Label>Custo total (R$)</Label><Input type="number" step="0.01" value={form.total_cost} onChange={e => setForm({ ...form, total_cost: e.target.value })} /></div>
            </div>
            {!editing && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Forma de pagamento</Label>
                    <Select value={form.payment_mode} onValueChange={(v: any) => setForm({ ...form, payment_mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">À vista</SelectItem>
                        <SelectItem value="installments">Parcelado (Contas a Pagar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.payment_mode === 'installments' && (
                    <div><Label>Nº de parcelas</Label><Input type="number" min="1" value={form.installments} onChange={e => setForm({ ...form, installments: e.target.value })} /></div>
                  )}
                </div>
                <div>
                  <Label>Conta de pagamento</Label>
                  <Select value={form.paid_account_id} onValueChange={v => setForm({ ...form, paid_account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não lançar no financeiro</SelectItem>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.paid_account_id === 'none'
                      ? 'Sem conta selecionada, nenhum lançamento será gerado.'
                      : form.payment_mode === 'cash'
                        ? 'A despesa será lançada nesta conta na data de início.'
                        : 'Conta padrão para baixa das parcelas a pagar.'}
                  </p>
                </div>
              </>
            )}
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Excluir manutenção"
        warningMessage="Parcelas pendentes vinculadas serão removidas. Parcelas já pagas permanecem."
      />
    </div>
  );
}
