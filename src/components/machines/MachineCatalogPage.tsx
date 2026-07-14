import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMachineTypes, useMachineCategories } from '@/hooks/useMachinesModule';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';

interface Props { companyId: string; }

type Row = { id: string; name: string };

function CrudList({
  title,
  items,
  loading,
  onCreate,
  onRename,
  onDelete,
  placeholder,
}: {
  title: string;
  items: Row[];
  loading: boolean;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  placeholder: string;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const startEdit = (r: Row) => { setEditingId(r.id); setEditingName(r.name); };
  const cancelEdit = () => { setEditingId(null); setEditingName(''); };
  const confirmEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await onRename(editingId, editingName.trim());
    cancelEdit();
  };
  const confirmCreate = async () => {
    if (!newName.trim()) return;
    await onCreate(newName.trim());
    setNewName('');
  };

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder={placeholder} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmCreate()} />
          <Button onClick={confirmCreate}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="w-40 text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={2}>Carregando...</TableCell></TableRow> :
              items.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Nenhum registro</TableCell></TableRow> :
              items.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    {editingId === r.id ? (
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit(); }} autoFocus />
                    ) : r.name}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === r.id ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={confirmEdit} title="Salvar"><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit} title="Cancelar"><X className="w-4 h-4" /></Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(r)}><Trash2 className="w-4 h-4" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title={`Excluir "${deleteTarget?.name}"?`}
        description="Itens vinculados a este registro precisarão ser reclassificados manualmente."
        onConfirm={async () => { if (deleteTarget) { await onDelete(deleteTarget.id); setDeleteTarget(null); } }}
      />
    </Card>
  );
}

export function MachineCatalogPage({ companyId }: Props) {
  const { categories, loading: loadingCats, refetch: refetchCats } = useMachineCategories(companyId);
  const { types, loading: loadingTypes, refetch: refetchTypes } = useMachineTypes(companyId);

  const createIn = (table: string, refetch: () => void) => async (name: string) => {
    const { error } = await (supabase as any).from(table).insert({ company_id: companyId, name });
    if (error) { toast.error(error.message); return; }
    toast.success('Adicionado'); refetch();
  };
  const renameIn = (table: string, refetch: () => void) => async (id: string, name: string) => {
    const { error } = await (supabase as any).from(table).update({ name }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Atualizado'); refetch();
  };
  const deleteIn = (table: string, refetch: () => void) => async (id: string) => {
    const { error } = await (supabase as any).from(table).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Excluído'); refetch();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Cadastros de Máquinas</h1>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="types">Tipos</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-4">
          <CrudList
            title="Categorias"
            placeholder="Ex.: Máquina, Equipamento, Ferramenta, Veículo..."
            items={categories}
            loading={loadingCats}
            onCreate={createIn('machine_categories', refetchCats)}
            onRename={renameIn('machine_categories', refetchCats)}
            onDelete={deleteIn('machine_categories', refetchCats)}
          />
        </TabsContent>
        <TabsContent value="types" className="mt-4">
          <CrudList
            title="Tipos"
            placeholder="Ex.: Trator, Retroescavadeira, Furadeira..."
            items={types}
            loading={loadingTypes}
            onCreate={createIn('machine_types', refetchTypes)}
            onRename={renameIn('machine_types', refetchTypes)}
            onDelete={deleteIn('machine_types', refetchTypes)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
