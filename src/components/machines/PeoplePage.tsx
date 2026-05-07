import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { useOperators, useMechanics, Operator, Mechanic } from '@/hooks/useMachinesModule';

interface Props { companyId: string; kind: 'operator' | 'mechanic'; }

export function PeoplePage({ companyId, kind }: Props) {
  const isOp = kind === 'operator';
  const opData = useOperators(companyId);
  const mecData = useMechanics(companyId);
  const list: any[] = isOp ? opData.operators : mecData.mechanics;
  const refetch = isOp ? opData.refetch : mecData.refetch;
  const tableName = isOp ? 'operators' : 'mechanics';

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const empty = { name: '', document: '', phone: '', specialty: '', notes: '' };
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({ name: r.name, document: r.document || '', phone: r.phone || '', specialty: r.specialty || '', notes: r.notes || '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório');
    const payload: any = {
      company_id: companyId, name: form.name,
      document: form.document || null, phone: form.phone || null, notes: form.notes || null,
    };
    if (!isOp) payload.specialty = form.specialty || null;
    const op = editing
      ? (supabase as any).from(tableName).update(payload).eq('id', editing.id)
      : (supabase as any).from(tableName).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success('Salvo'); setOpen(false); refetch();
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from(tableName).delete().eq('id', deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    setDeleteTarget(null); refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{isOp ? 'Operadores' : 'Mecânicos'}</h1>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead><TableHead>Documento</TableHead><TableHead>Telefone</TableHead>
            {!isOp && <TableHead>Especialidade</TableHead>}
            <TableHead className="w-32"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.length === 0 ? <TableRow><TableCell colSpan={isOp ? 4 : 5} className="text-center py-8 text-muted-foreground">Nenhum cadastro</TableCell></TableRow> :
              list.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.document || '-'}</TableCell>
                  <TableCell>{r.phone || '-'}</TableCell>
                  {!isOp && <TableCell>{r.specialty || '-'}</TableCell>}
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} {isOp ? 'Operador' : 'Mecânico'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Documento</Label><Input value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            {!isOp && <div><Label>Especialidade</Label><Input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} /></div>}
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} onConfirm={doDelete} title="Excluir" itemName={deleteTarget?.name} />
    </div>
  );
}
