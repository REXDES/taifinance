import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag as TagIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { useFinanceTags, FinanceTag } from '@/hooks/useFinanceTags';

interface TagsPageProps { companyId: string }

const PRESET_COLORS = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981',
  '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6',
  '#f97316', '#84cc16', '#06b6d4', '#a855f7',
];

export function TagsPage({ companyId }: TagsPageProps) {
  const { tags, usageCounts, loading, createTag, updateTag, deleteTag } = useFinanceTags(companyId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinanceTag | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName(''); setColor(PRESET_COLORS[0]); setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (tag: FinanceTag) => {
    setEditing(tag);
    setName(tag.name); setColor(tag.color); setDescription(tag.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const ok = editing
      ? await updateTag(editing.id, { name: name.trim(), color, description: description.trim() || null as any })
      : !!(await createTag({ name: name.trim(), color, description: description.trim() || undefined }));
    setSaving(false);
    if (ok) setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteTag(deleteTarget.id);
    if (ok) setDeleteTarget(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TagIcon className="w-6 h-6" /> Tags
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Classificações livres para marcar lançamentos, contas e transferências. Não interferem na árvore de categorias.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nova Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <Card className="p-12 text-center">
          <TagIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma tag cadastrada ainda.</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Criar primeira tag
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tags.map(tag => (
            <Card key={tag.id} className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <Badge
                  variant="outline"
                  className="border-0 text-sm"
                  style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
                >
                  {tag.name}
                </Badge>
                {tag.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{tag.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(tag)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(tag)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Tag' : 'Nova Tag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Obra X, Cliente VIP, Urgente" autoFocus />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Pré-visualização</Label>
              <div className="mt-1">
                <Badge variant="outline" className="border-0" style={{ backgroundColor: `${color}22`, color }}>
                  {name.trim() || 'sua tag'}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir tag"
        description={`A tag "${deleteTarget?.name}" será removida de todos os registros vinculados.`}
      />
    </div>
  );
}
