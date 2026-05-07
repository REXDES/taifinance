import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Tag, Package, Wallet, Percent } from 'lucide-react';
import { useMachines, useMachineTypes, Machine } from '@/hooks/useMachinesModule';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';

interface Props { companyId: string; }

const STATUS_LABEL: Record<string, string> = { available: 'Disponível', rented: 'Locada', maintenance: 'Em manutenção', sold: 'Vendida' };

type MachineExt = Machine & {
  category?: string | null;
  sale_price?: number | null;
  rental_price_daily?: number | null;
  rental_price_weekly?: number | null;
  rental_price_monthly?: number | null;
};

const CATEGORY_LABEL: Record<string, string> = { maquina: 'Máquina', equipamento: 'Equipamento', ferramenta: 'Ferramenta' };

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function MachinesPage({ companyId }: Props) {
  const { machines, refetch, loading } = useMachines(companyId) as { machines: MachineExt[]; refetch: () => void; loading: boolean };
  const { types, refetch: refetchTypes } = useMachineTypes(companyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MachineExt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MachineExt | null>(null);
  const [filter, setFilter] = useState<'all' | 'new_purchase' | 'pre_existing'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'maquina' | 'equipamento' | 'ferramenta'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Machine['status']>('all');
  const [priceTarget, setPriceTarget] = useState<MachineExt | null>(null);
  const [priceForm, setPriceForm] = useState({ sale_price: '', rental_price_daily: '', rental_price_weekly: '', rental_price_monthly: '' });

  const empty = {
    name: '', brand: '', model: '', year: '', destination: '', type_id: 'none',
    category: 'equipamento' as 'maquina' | 'equipamento' | 'ferramenta',
    acquisition_value: '', acquisition_date: '', acquisition_source: 'pre_existing' as 'new_purchase' | 'pre_existing',
    current_horimeter: '', preventive_maintenance_interval_hours: '',
    status: 'available' as Machine['status'], notes: '',
  };
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (m: MachineExt) => {
    setEditing(m);
    setForm({
      name: m.name, brand: m.brand || '', model: m.model || '', year: m.year?.toString() || '',
      destination: m.destination || '', type_id: m.type_id || 'none',
      category: ((m as any).category || 'equipamento') as any,
      acquisition_value: m.acquisition_value?.toString() || '',
      acquisition_date: m.acquisition_date || '',
      acquisition_source: m.acquisition_source,
      current_horimeter: m.current_horimeter?.toString() || '',
      preventive_maintenance_interval_hours: m.preventive_maintenance_interval_hours?.toString() || '',
      status: m.status, notes: m.notes || '',
    });
    setOpen(true);
  };

  const openPrices = (m: MachineExt) => {
    setPriceTarget(m);
    setPriceForm({
      sale_price: m.sale_price?.toString() || '',
      rental_price_daily: m.rental_price_daily?.toString() || '',
      rental_price_weekly: m.rental_price_weekly?.toString() || '',
      rental_price_monthly: m.rental_price_monthly?.toString() || '',
    });
  };

  const savePrices = async () => {
    if (!priceTarget) return;
    const payload: any = {
      sale_price: priceForm.sale_price ? parseFloat(priceForm.sale_price) : null,
      rental_price_daily: priceForm.rental_price_daily ? parseFloat(priceForm.rental_price_daily) : null,
      rental_price_weekly: priceForm.rental_price_weekly ? parseFloat(priceForm.rental_price_weekly) : null,
      rental_price_monthly: priceForm.rental_price_monthly ? parseFloat(priceForm.rental_price_monthly) : null,
    };
    const { error } = await (supabase as any).from('machines').update(payload).eq('id', priceTarget.id);
    if (error) return toast.error(error.message);
    toast.success('Preços atualizados');
    setPriceTarget(null);
    refetch();
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório');
    const payload: any = {
      company_id: companyId, name: form.name, brand: form.brand || null, model: form.model || null,
      year: form.year ? parseInt(form.year) : null, destination: form.destination || null,
      type_id: form.type_id !== 'none' ? form.type_id : null,
      category: form.category,
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

  const filtered = machines.filter(m => {
    if (filter !== 'all' && m.acquisition_source !== filter) return false;
    if (categoryFilter !== 'all' && (m.category || 'equipamento') !== categoryFilter) return false;
    if (typeFilter !== 'all' && (m.type_id || 'none') !== typeFilter) return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    return true;
  });

  const stats = useMemo(() => {
    const totalValue = filtered.reduce((s, m) => s + Number(m.acquisition_value || 0), 0);
    const total = filtered.length;
    const rented = filtered.filter(m => m.status === 'rented').length;
    const pct = total > 0 ? (rented / total) * 100 : 0;
    return { totalValue, total, rented, pct };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Inventário</h1>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo item</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={categoryFilter} onValueChange={(v: any) => setCategoryFilter(v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="maquina">Máquina</SelectItem>
            <SelectItem value="equipamento">Equipamento</SelectItem>
            <SelectItem value="ferramenta">Ferramenta</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="none">Sem tipo</SelectItem>
            {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="new_purchase">Adquiridas (novas)</SelectItem>
            <SelectItem value="pre_existing">Pré-existentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valor total</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(stats.totalValue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Itens cadastrados</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Itens locados</CardTitle>
            <Tag className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.rented}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">% locado</CardTitle>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.pct.toFixed(1)}%</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Marca/Modelo</TableHead><TableHead>Ano</TableHead>
              <TableHead>Horímetro</TableHead><TableHead>Origem</TableHead><TableHead>Status</TableHead>
              <TableHead>Valor</TableHead><TableHead className="w-40"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={9}>Carregando...</TableCell></TableRow> :
                filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum item encontrado</TableCell></TableRow> :
                filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell><Badge variant="secondary">{CATEGORY_LABEL[m.category || 'equipamento']}</Badge></TableCell>
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
                      <Button size="icon" variant="ghost" onClick={() => openPrices(m)} title="Preços de venda e locação"><Tag className="w-4 h-4" /></Button>
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

      <Dialog open={!!priceTarget} onOpenChange={(o) => !o && setPriceTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Preços sugeridos — {priceTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Preço de venda</Label>
              <Input type="number" step="0.01" value={priceForm.sale_price} onChange={e => setPriceForm({ ...priceForm, sale_price: e.target.value })} />
            </div>
            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-2">Locação</div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Diária</Label><Input type="number" step="0.01" value={priceForm.rental_price_daily} onChange={e => setPriceForm({ ...priceForm, rental_price_daily: e.target.value })} /></div>
                <div><Label className="text-xs">Semanal</Label><Input type="number" step="0.01" value={priceForm.rental_price_weekly} onChange={e => setPriceForm({ ...priceForm, rental_price_weekly: e.target.value })} /></div>
                <div><Label className="text-xs">Mensal</Label><Input type="number" step="0.01" value={priceForm.rental_price_monthly} onChange={e => setPriceForm({ ...priceForm, rental_price_monthly: e.target.value })} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceTarget(null)}>Cancelar</Button>
            <Button onClick={savePrices}>Salvar</Button>
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
