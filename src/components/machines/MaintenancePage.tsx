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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useMaintenanceRecords, useMachines, useMechanics, MaintenanceRecord } from '@/hooks/useMachinesModule';
import { useAccounts } from '@/hooks/useAccounts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { generateMaintenancePayables, deletePendingInstallments } from '@/lib/machinesFinance';
import { TagPicker } from '@/components/finance/TagPicker';

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
  const [tab, setTab] = useState('dados');

  const empty = {
    machine_id: '', mechanic_id: 'none', start_date: new Date().toISOString().slice(0, 10),
    end_date: '', description: '', horimeter_at_service: '',
    total_cost: '', payment_mode: 'cash' as 'cash' | 'installments',
    installments: '1', status: 'in_progress' as MaintenanceRecord['status'],
    paid_account_id: 'none',
    tag_ids: [] as string[],
    has_travel: false, travel_vehicle_id: 'none', travel_km: '', travel_notes: '',
  };
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setTab('dados'); setOpen(true); };
  const openEdit = (r: MaintenanceRecord) => {
    setEditing(r);
    setForm({
      machine_id: r.machine_id, mechanic_id: r.mechanic_id || 'none',
      start_date: r.start_date, end_date: r.end_date || '',
      description: r.description || '', horimeter_at_service: r.horimeter_at_service?.toString() || '',
      total_cost: r.total_cost?.toString() || '', payment_mode: (r.payment_mode === 'none' ? 'cash' : r.payment_mode) as 'cash' | 'installments',
      installments: '1', status: r.status,
      paid_account_id: r.paid_account_id || 'none',
      tag_ids: [],
      has_travel: !!r.has_travel,
      travel_vehicle_id: r.travel_vehicle_id || 'none',
      travel_km: r.travel_km != null ? String(r.travel_km) : '',
      travel_notes: r.travel_notes || '',
    });
    setTab('dados');
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
      paid_account_id: form.paid_account_id !== 'none' ? form.paid_account_id : null,
      has_travel: form.has_travel,
      travel_vehicle_id: form.has_travel && form.travel_vehicle_id !== 'none' ? form.travel_vehicle_id : null,
      travel_km: form.has_travel && form.travel_km ? parseFloat(form.travel_km) : null,
      travel_notes: form.has_travel ? (form.travel_notes || null) : null,
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
      if (cost > 0 && form.paid_account_id !== 'none') {
        try {
          const inst = form.payment_mode === 'cash' ? 1 : Math.max(1, parseInt(form.installments || '1'));
          await generateMaintenancePayables({
            companyId, maintenanceId: data.id,
            description: `Manutenção: ${form.description || 'sem descrição'}`,
            totalAmount: cost, startDate: form.start_date, installments: inst, userId: user?.id,
            tagIds: form.tag_ids,
          });
          toast.success('Manutenção registrada. Pagamento agendado em Contas a Pagar.');
        } catch (e: any) { toast.error('Erro no agendamento financeiro: ' + e.message); }
      } else {
        toast.success('Manutenção registrada (sem lançamento financeiro)');
      }
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
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
              <TabsTrigger value="deslocamento">Deslocamento</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-3 mt-4">
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
            </TabsContent>

            <TabsContent value="pagamento" className="space-y-3 mt-4">
              {!editing ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Forma de pagamento</Label>
                      <Select value={form.payment_mode} onValueChange={(v: any) => setForm({ ...form, payment_mode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">À vista</SelectItem>
                          <SelectItem value="installments">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.payment_mode === 'installments' && (
                      <div><Label>Nº de parcelas</Label><Input type="number" min="1" value={form.installments} onChange={e => setForm({ ...form, installments: e.target.value })} /></div>
                    )}
                  </div>
                  <div>
                    <Label>Conta de pagamento (baixa)</Label>
                    <Select value={form.paid_account_id} onValueChange={v => setForm({ ...form, paid_account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não lançar no financeiro</SelectItem>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {form.paid_account_id === 'none'
                        ? 'Sem conta selecionada, nenhum título será gerado.'
                        : form.payment_mode === 'cash'
                          ? 'Será gerado 1 título pendente em Contas a Pagar (vence na data de início). A movimentação bancária só acontece ao marcar como pago.'
                          : 'Serão geradas parcelas pendentes em Contas a Pagar. Cada parcela vira transação bancária apenas na baixa.'}
                    </p>
                  </div>
                  <div>
                    <Label>Tags</Label>
                    <TagPicker
                      companyId={companyId}
                      value={form.tag_ids}
                      onChange={ids => setForm({ ...form, tag_ids: ids })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Aplicadas a todos os títulos gerados.</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">A forma de pagamento e as parcelas não podem ser alteradas após a criação. Ajustes de valor devem ser feitos diretamente em Contas a Pagar.</p>
              )}
            </TabsContent>

            <TabsContent value="deslocamento" className="space-y-3 mt-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Haverá deslocamento de equipe?</Label>
                  <p className="text-xs text-muted-foreground">Informe veículo e km previstos.</p>
                </div>
                <Switch checked={form.has_travel} onCheckedChange={v => setForm({ ...form, has_travel: v })} />
              </div>
              {form.has_travel && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Veículo</Label>
                      <Select value={form.travel_vehicle_id} onValueChange={v => setForm({ ...form, travel_vehicle_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não informado</SelectItem>
                          {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Km previstos</Label>
                      <Input type="number" step="0.1" value={form.travel_km} onChange={e => setForm({ ...form, travel_km: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Observações do deslocamento</Label>
                    <Textarea value={form.travel_notes} onChange={e => setForm({ ...form, travel_notes: e.target.value })} />
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
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
