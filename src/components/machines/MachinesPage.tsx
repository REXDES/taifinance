import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useMachines, useMachineTypes, Machine } from '@/hooks/useMachinesModule';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';

interface Props { companyId: string; }

const STATUS_LABEL: Record<string, string> = { available: 'Disponível', rented: 'Locada', maintenance: 'Em manutenção', sold: 'Vendida' };

export function MachinesPage({ companyId }: Props) {
  const { machines, refetch, loading } = useMachines(companyId);
  const { types, refetch: refetchTypes } = useMachineTypes(companyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);
  const [filter, setFilter] = useState<'all' | 'new_purchase' | 'pre_existing'>('all');

  const empty = {
    name: '', brand: '', model: '', year: '', destination: '', type_id: 'none',
    acquisition_value: '', acquisition_date: '', acquisition_source: 'pre_existing' as 'new_purchase' | 'pre_existing',
    current_horimeter: '', preventive_maintenance_interval_hours: '',
    status: 'available' as Machine['status'], notes: '',
  };
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (m: Machine) => {
    setEditing(m);
    setForm({
      name: m.name, brand: m.brand || '', model: m.model || '', year: m.year?.toString() || '',
      destination: m.destination || '', type_id: m.type_id || 'none',
      acquisition_value: m.acquisition_value?.toString() || '',
      acquisition_date: m.acquisition_date || '',
      acquisition_source: m.acquisition_source,
      current_horimeter: m.current_horimeter?.toString() || '',
      preventive_maintenance_interval_hours: m.preventive_maintenance_interval_hours?.toString() || '',
      status: m.status, notes: m.notes || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório');
    const payload: any = {
      company_id: companyId, name: form.name, brand: form.brand || null, model: form.model || null,
      year: form.year ? parseInt(form.year) : null, destination: form.destination || null,
      type_id: form.type_id !== 'none' ? form.type_id : null,
      acquisition_value: parseFloat(form.acquisition_value || '0'),
      acquisition_date: form.acquisition_date || null,
      acquisition_source: form.acquisition_source,
      current_horimeter: parseFloat(form.current_horimeter || '0'),
      preventive_maintenance_interval_hours: form.preventive_maintenance_interval_hours ? parseFloat(form.preventive_maintenance_interval_hours) : null,
      status: form.status, notes: form.notes || null,
    };
    if (editing) {
      const { error } = await (supabase as any).from('machines').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
      toast.success('Máquina atualizada');
    } else {
      const { error } = await (supabase as any).from('machines').insert(payload);
      if (error) return toast.error(error.message);
      toast.success('Máquina cadastrada');
    }
    setOpen(false); refetch();
  };

  const addType = async () => {
    const name = window.prompt('Nome do tipo (ex.: Trator, Implemento, Ferramenta):');
    if (!name?.trim()) return;
    const { error } = await (supabase as any).from('machine_types').insert({ company_id: companyId, name: name.trim() });
    if (error) return toast.error(error.message);
    refetchTypes();
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from('machines').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Excluída'); setDeleteTarget(null); refetch();
  };

  const filtered = machines.filter(m => filter === 'all' ? true : m.acquisition_source === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Máquinas, Equipamentos e Ferramentas</h1>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="new_purchase">Adquiridas (novas)</SelectItem>
              <SelectItem value="pre_existing">Pré-existentes</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Marca/Modelo</TableHead><TableHead>Ano</TableHead>
              <TableHead>Horímetro</TableHead><TableHead>Origem</TableHead><TableHead>Status</TableHead>
              <TableHead>Valor</TableHead><TableHead className="w-32"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={8}>Carregando...</TableCell></TableRow> :
                filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma máquina cadastrada</TableCell></TableRow> :
                filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{[m.brand, m.model].filter(Boolean).join(' ') || '-'}</TableCell>
                    <TableCell>{m.year || '-'}</TableCell>
                    <TableCell>{Number(m.current_horimeter).toFixed(1)}h</TableCell>
                    <TableCell>
                      <Badge variant={m.acquisition_source === 'pre_existing' ? 'secondary' : 'default'}>
                        {m.acquisition_source === 'pre_existing' ? 'Pré-existente' : 'Adquirida'}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline">{STATUS_LABEL[m.status]}</Badge></TableCell>
                    <TableCell>R$ {Number(m.acquisition_value).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(m)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Máquina</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  <Select value={form.type_id} onValueChange={v => setForm({ ...form, type_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem tipo</SelectItem>
                      {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={addType}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Marca</Label><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
              <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
              <div><Label>Ano</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
            </div>
            <div><Label>Destinação</Label><Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="Ex.: Locação, Uso interno" /></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem *</Label>
                <Select value={form.acquisition_source} onValueChange={(v: any) => setForm({ ...form, acquisition_source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_existing">Já existente (sem efeito financeiro)</SelectItem>
                    <SelectItem value="new_purchase">Aquisição nova</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor de aquisição</Label><Input type="number" step="0.01" value={form.acquisition_value} onChange={e => setForm({ ...form, acquisition_value: e.target.value })} /></div>
              <div><Label>Data de aquisição</Label><Input type="date" value={form.acquisition_date} onChange={e => setForm({ ...form, acquisition_date: e.target.value })} /></div>
            </div>

            {form.acquisition_source === 'new_purchase' && !editing && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                Atenção: aquisições novas devem ser lançadas separadamente em Contas a Pagar (à vista ou parcelado) para gerar o efeito financeiro.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Horímetro atual</Label><Input type="number" step="0.1" value={form.current_horimeter} onChange={e => setForm({ ...form, current_horimeter: e.target.value })} /></div>
              <div><Label>Manut. preventiva (h)</Label><Input type="number" step="1" value={form.preventive_maintenance_interval_hours} onChange={e => setForm({ ...form, preventive_maintenance_interval_hours: e.target.value })} /></div>
            </div>

            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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
        title="Excluir máquina"
        description={`Excluir "${deleteTarget?.name}"?`}
      />
    </div>
  );
}
