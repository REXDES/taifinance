import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { useMachineTags, MachineTag } from '@/hooks/useMachineTags';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';

const PALETTE = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#0ea5e9', '#84cc16'];

interface Props { companyId: string; open: boolean; onOpenChange: (o: boolean) => void; }

export function MachineTagsManagerDialog({ companyId, open, onOpenChange }: Props) {
  const { tags, createTag, updateTag, deleteTag } = useMachineTags(companyId);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<MachineTag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MachineTag | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const created = await createTag({ name, color, description });
    if (created) { setName(''); setDescription(''); setColor(PALETTE[0]); }
  };

  const startEdit = (t: MachineTag) => {
    setEditing(t); setEditName(t.name); setEditColor(t.color); setEditDesc(t.description || '');
  };
  const saveEdit = async () => {
    if (!editing) return;
    const ok = await updateTag(editing.id, { name: editName, color: editColor, description: editDesc });
    if (ok) setEditing(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg overflow-y-auto max-h-[85vh]">
          <DialogHeader><DialogTitle>Tags / Lembretes de itens</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="border rounded-md p-3 space-y-2 bg-muted/30">
              <Label className="text-xs">Nova tag</Label>
              <Input placeholder="Ex.: Trocar óleo, Revisar freios..." value={name} onChange={e => setName(e.target.value)} />
              <Textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              <div className="flex items-center gap-2 flex-wrap">
                {PALETTE.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
                <Button size="sm" onClick={handleCreate} className="ml-auto"><Plus className="w-4 h-4 mr-1" />Criar</Button>
              </div>
            </div>

            <div className="space-y-1">
              {tags.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag cadastrada</p>}
              {tags.map(t => (
                <div key={t.id} className="flex items-center gap-2 border rounded-md p-2">
                  {editing?.id === t.id ? (
                    <div className="flex-1 space-y-2">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} />
                      <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} />
                      <div className="flex items-center gap-1 flex-wrap">
                        {PALETTE.map(c => (
                          <button key={c} type="button" onClick={() => setEditColor(c)}
                            className={`w-5 h-5 rounded-full border-2 ${editColor === c ? 'border-foreground' : 'border-transparent'}`}
                            style={{ backgroundColor: c }} />
                        ))}
                        <Button size="icon" variant="ghost" onClick={saveEdit} className="ml-auto"><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{t.name}</div>
                        {t.description && <div className="text-xs text-muted-foreground truncate">{t.description}</div>}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(t)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(t)}><Trash2 className="w-4 h-4" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) { await deleteTag(deleteTarget.id); setDeleteTarget(null); } }}
        title="Excluir tag"
        description={`Excluir a tag "${deleteTarget?.name}"? Ela será removida de todos os itens.`}
      />
    </>
  );
}
