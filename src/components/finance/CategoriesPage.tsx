import { useState } from 'react';
import { useTransactionCategories, TransactionCategory, TransactionSubcategory } from '@/hooks/useTransactionCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface CategoriesPageProps { companyId: string; }

interface DraggableSubcategoryProps {
  subcategory: TransactionSubcategory;
  onEdit: () => void;
  onDelete: () => void;
}

function DraggableSubcategory({ subcategory, onEdit, onDelete }: DraggableSubcategoryProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: subcategory.id,
    data: { subcategory },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-2 rounded bg-background group"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-sm">{subcategory.name}</span>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

interface DroppableCategoryProps {
  category: TransactionCategory;
  isExpanded: boolean;
  onToggle: () => void;
  onAddSub: () => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onEditSub: (sub: TransactionSubcategory) => void;
  onDeleteSub: (sub: TransactionSubcategory) => void;
  typeLabels: Record<string, string>;
  formatCurrency: (value: number) => string;
  isOver: boolean;
}

function DroppableCategory({
  category,
  isExpanded,
  onToggle,
  onAddSub,
  onEditCategory,
  onDeleteCategory,
  onEditSub,
  onDeleteSub,
  typeLabels,
  formatCurrency,
  isOver,
}: DroppableCategoryProps) {
  const { setNodeRef } = useDroppable({
    id: `category-${category.id}`,
    data: { categoryId: category.id },
  });

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        ref={setNodeRef}
        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
          isOver ? 'bg-primary/20 ring-2 ring-primary' : 'bg-accent/50'
        }`}
      >
        <CollapsibleTrigger className="flex items-center gap-2 flex-1">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
          <span className="font-medium">{category.name}</span>
          <span className="text-xs text-muted-foreground">({typeLabels[category.type]})</span>
          {category.monthly_budget && (
            <span className="text-xs text-muted-foreground">• Orç: {formatCurrency(category.monthly_budget)}</span>
          )}
          <span className="text-xs text-muted-foreground">• {category.subcategories?.length || 0} sub</span>
        </CollapsibleTrigger>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onAddSub}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEditCategory}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDeleteCategory}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
      <CollapsibleContent>
        <div className="ml-8 mt-1 space-y-1">
          {category.subcategories?.map((sub) => (
            <DraggableSubcategory
              key={sub.id}
              subcategory={sub}
              onEdit={() => onEditSub(sub)}
              onDelete={() => onDeleteSub(sub)}
            />
          ))}
          {(!category.subcategories || category.subcategories.length === 0) && (
            <p className="text-sm text-muted-foreground py-2 text-center">
              {isOver ? 'Solte aqui para mover' : 'Nenhuma subcategoria'}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CategoriesPage({ companyId }: CategoriesPageProps) {
  const {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    moveSubcategory,
    deleteSubcategory,
  } = useTransactionCategories(companyId);

  const [showDialog, setShowDialog] = useState(false);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TransactionCategory | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<{ id: string; name: string; categoryId: string } | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: '', type: 'expense' as 'income' | 'expense' | 'both', color: '#8B5CF6', monthly_budget: '' });
  const [subName, setSubName] = useState('');
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<TransactionCategory | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const typeLabels: Record<string, string> = { income: 'Receita', expense: 'Despesa', both: 'Ambos' };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSave = async () => {
    const budgetValue = form.monthly_budget ? parseFloat(form.monthly_budget) : null;
    if (editingCategory) await updateCategory(editingCategory.id, { name: form.name, type: form.type, color: form.color, monthly_budget: budgetValue });
    else await createCategory({ name: form.name, type: form.type, color: form.color, monthly_budget: budgetValue });
    setShowDialog(false);
    setEditingCategory(null);
    setForm({ name: '', type: 'expense', color: '#8B5CF6', monthly_budget: '' });
  };

  const handleSaveSub = async () => {
    if (editingSubcategory) {
      await updateSubcategory(editingSubcategory.id, subName);
      setEditingSubcategory(null);
    } else if (selectedCategoryId && subName) {
      await createSubcategory(selectedCategoryId, subName);
    }
    setShowSubDialog(false);
    setSubName('');
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedCategories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCategories(next);
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    await deleteCategory(deleteCategoryTarget.id);
    setDeleteCategoryTarget(null);
  };

  const handleDeleteSub = async () => {
    if (!deleteSubTarget) return;
    await deleteSubcategory(deleteSubTarget.id);
    setDeleteSubTarget(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    if (over) {
      setOverId(over.id as string);
    } else {
      setOverId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const subcategoryId = active.id as string;
    const overId = over.id as string;

    // Extract category ID from droppable ID (format: "category-{id}")
    if (!overId.startsWith('category-')) return;
    
    const targetCategoryId = overId.replace('category-', '');

    // Find the subcategory and its current category
    let currentCategoryId: string | null = null;
    for (const cat of categories) {
      const found = cat.subcategories?.find(sub => sub.id === subcategoryId);
      if (found) {
        currentCategoryId = cat.id;
        break;
      }
    }

    // Only move if dropping to a different category
    if (currentCategoryId && currentCategoryId !== targetCategoryId) {
      await moveSubcategory(subcategoryId, targetCategoryId);
      // Auto-expand target category to show moved subcategory
      setExpandedCategories(prev => new Set([...prev, targetCategoryId]));
    }
  };

  const getActiveSubcategory = () => {
    if (!activeId) return null;
    for (const cat of categories) {
      const found = cat.subcategories?.find(sub => sub.id === activeId);
      if (found) return found;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeSubcategory = getActiveSubcategory();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-muted-foreground">Gerencie grupos e sub-grupos • Arraste subcategorias entre categorias</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingCategory(null); setForm({ name: '', type: 'expense', color: '#8B5CF6', monthly_budget: '' }); }}>
              <Plus className="w-4 h-4 mr-2" />Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Editar' : 'Nova'} Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <div>
                <Label>Orçamento Mensal (opcional)</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={form.monthly_budget} onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })} />
              </div>
              <Button onClick={handleSave} className="w-full" disabled={!form.name}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-4">
          {categories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma categoria.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-2">
                {categories.map((cat) => (
                  <DroppableCategory
                    key={cat.id}
                    category={cat}
                    isExpanded={expandedCategories.has(cat.id)}
                    onToggle={() => toggleExpand(cat.id)}
                    onAddSub={() => {
                      setSelectedCategoryId(cat.id);
                      setEditingSubcategory(null);
                      setSubName('');
                      setShowSubDialog(true);
                    }}
                    onEditCategory={() => {
                      setEditingCategory(cat);
                      setForm({ name: cat.name, type: cat.type, color: cat.color, monthly_budget: cat.monthly_budget?.toString() || '' });
                      setShowDialog(true);
                    }}
                    onDeleteCategory={() => setDeleteCategoryTarget(cat)}
                    onEditSub={(sub) => {
                      setEditingSubcategory({ id: sub.id, name: sub.name, categoryId: cat.id });
                      setSubName(sub.name);
                      setShowSubDialog(true);
                    }}
                    onDeleteSub={(sub) => setDeleteSubTarget({ id: sub.id, name: sub.name })}
                    typeLabels={typeLabels}
                    formatCurrency={formatCurrency}
                    isOver={overId === `category-${cat.id}`}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeSubcategory ? (
                  <div className="flex items-center gap-2 p-2 rounded bg-background shadow-lg border">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{activeSubcategory.name}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSubDialog} onOpenChange={(open) => { setShowSubDialog(open); if (!open) setEditingSubcategory(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? 'Editar' : 'Nova'} Subcategoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={subName} onChange={(e) => setSubName(e.target.value)} />
            </div>
            <Button onClick={handleSaveSub} className="w-full" disabled={!subName}>
              {editingSubcategory ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteCategoryTarget}
        onOpenChange={(open) => !open && setDeleteCategoryTarget(null)}
        onConfirm={handleDeleteCategory}
        title="Excluir categoria"
        itemName={deleteCategoryTarget?.name}
        itemType="categoria"
        description={`Você está prestes a excluir a categoria "${deleteCategoryTarget?.name}".`}
        warningMessage="Todas as subcategorias também serão removidas. Lançamentos existentes podem perder a categoria."
      />

      <DeleteConfirmDialog
        open={!!deleteSubTarget}
        onOpenChange={(open) => !open && setDeleteSubTarget(null)}
        onConfirm={handleDeleteSub}
        title="Excluir subcategoria"
        itemName={deleteSubTarget?.name}
        itemType="subcategoria"
        description={`Você está prestes a excluir a subcategoria "${deleteSubTarget?.name}".`}
        warningMessage="Lançamentos existentes podem perder a subcategoria."
      />
    </div>
  );
}