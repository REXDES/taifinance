import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, GripVertical, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Status {
  id: string;
  name: string;
  color: string;
  priority: number;
}

interface StatusConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: Status[];
  onCreateStatus: (name: string, color: string) => Promise<void>;
  onUpdateStatus: (id: string, name: string, color: string) => Promise<void>;
  onDeleteStatus: (id: string) => Promise<void>;
  onReorderStatuses?: (statuses: Status[]) => Promise<void>;
}

interface SortableStatusItemProps {
  status: Status;
  isEditing: boolean;
  editName: string;
  editColor: string;
  loading: boolean;
  canDelete: boolean;
  colorOptions: { name: string; value: string }[];
  onStartEdit: (status: Status) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEditNameChange: (name: string) => void;
  onEditColorChange: (color: string) => void;
}

function SortableStatusItem({
  status,
  isEditing,
  editName,
  editColor,
  loading,
  canDelete,
  colorOptions,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditNameChange,
  onEditColorChange,
}: SortableStatusItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id, disabled: isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md border border-border bg-background',
        isEditing && 'bg-accent',
        isDragging && 'shadow-lg'
      )}
    >
      {isEditing ? (
        <>
          <div className="flex-1 space-y-2">
            <Input
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              placeholder="Nome do status"
              className="h-8"
            />
            <div className="flex flex-wrap gap-1">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onEditColorChange(color.value)}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-transform',
                    editColor === color.value 
                      ? 'border-foreground scale-110' 
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: `hsl(${color.value})` }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onSaveEdit}
              disabled={loading || !editName.trim()}
            >
              <Check className="w-4 h-4 text-green-500" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onCancelEdit}
              disabled={loading}
            >
              <X className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: `hsl(${status.color})` }}
          />
          <span className="flex-1 text-sm font-medium">{status.name}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onStartEdit(status)}
            disabled={loading}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(status.id)}
            disabled={loading || !canDelete}
            title={!canDelete ? 'Não é possível excluir o último status' : 'Excluir status'}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  );
}

const colorOptions = [
  { name: 'Cinza', value: '220 13% 46%' },
  { name: 'Azul', value: '217 91% 60%' },
  { name: 'Verde', value: '142 76% 36%' },
  { name: 'Amarelo', value: '38 92% 50%' },
  { name: 'Laranja', value: '25 95% 53%' },
  { name: 'Vermelho', value: '0 72% 51%' },
  { name: 'Rosa', value: '340 82% 52%' },
  { name: 'Roxo', value: '262 83% 58%' },
  { name: 'Ciano', value: '174 84% 38%' },
];

export function StatusConfigDialog({
  open,
  onOpenChange,
  statuses,
  onCreateStatus,
  onUpdateStatus,
  onDeleteStatus,
  onReorderStatuses,
}: StatusConfigDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('220 13% 46%');
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setIsCreating(false);
      setNewName('');
      setNewColor('220 13% 46%');
    }
  }, [open]);

  const handleStartEdit = (status: Status) => {
    setEditingId(status.id);
    setEditName(status.name);
    setEditColor(status.color);
    setIsCreating(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setLoading(true);
    await onUpdateStatus(editingId, editName.trim(), editColor);
    setLoading(false);
    handleCancelEdit();
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setNewName('');
    setNewColor('220 13% 46%');
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewName('');
    setNewColor('220 13% 46%');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    await onCreateStatus(newName.trim(), newColor);
    setLoading(false);
    handleCancelCreate();
  };

  const handleDelete = async (id: string) => {
    if (statuses.length <= 1) return;
    setLoading(true);
    await onDeleteStatus(id);
    setLoading(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorderStatuses) {
      const oldIndex = statuses.findIndex((s) => s.id === active.id);
      const newIndex = statuses.findIndex((s) => s.id === over.id);

      const newOrder = arrayMove(statuses, oldIndex, newIndex).map((status, index) => ({
        ...status,
        priority: index,
      }));

      setLoading(true);
      await onReorderStatuses(newOrder);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Status</DialogTitle>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={statuses.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {statuses.map((status) => (
                <SortableStatusItem
                  key={status.id}
                  status={status}
                  isEditing={editingId === status.id}
                  editName={editName}
                  editColor={editColor}
                  loading={loading}
                  canDelete={statuses.length > 1}
                  colorOptions={colorOptions}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onDelete={handleDelete}
                  onEditNameChange={setEditName}
                  onEditColorChange={setEditColor}
                />
              ))}

              {isCreating && (
                <div className="flex items-center gap-2 p-2 rounded-md border border-primary bg-accent">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nome do novo status"
                      className="h-8"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-1">
                      {colorOptions.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setNewColor(color.value)}
                          className={cn(
                            'w-6 h-6 rounded-full border-2 transition-transform',
                            newColor === color.value 
                              ? 'border-foreground scale-110' 
                              : 'border-transparent hover:scale-105'
                          )}
                          style={{ backgroundColor: `hsl(${color.value})` }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleCreate}
                      disabled={loading || !newName.trim()}
                    >
                      <Check className="w-4 h-4 text-green-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleCancelCreate}
                      disabled={loading}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>

        {!isCreating && !editingId && (
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={handleStartCreate}
            disabled={loading}
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Status
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
