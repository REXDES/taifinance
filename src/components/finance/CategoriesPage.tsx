import { useState } from 'react';
import { useTransactionCategories, TransactionCategory } from '@/hooks/useTransactionCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface CategoriesPageProps { companyId: string; }

export function CategoriesPage({ companyId }: CategoriesPageProps) {
  const { categories, loading, createCategory, updateCategory, deleteCategory, createSubcategory, deleteSubcategory } = useTransactionCategories(companyId);
  const [showDialog, setShowDialog] = useState(false);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TransactionCategory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: '', type: 'expense' as 'income' | 'expense' | 'both', color: '#8B5CF6', monthly_budget: '' });
  const [subName, setSubName] = useState('');

  const typeLabels = { income: 'Receita', expense: 'Despesa', both: 'Ambos' };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSave = async () => {
    const budgetValue = form.monthly_budget ? parseFloat(form.monthly_budget) : null;
    if (editingCategory) await updateCategory(editingCategory.id, { name: form.name, type: form.type, color: form.color, monthly_budget: budgetValue });
    else await createCategory({ name: form.name, type: form.type, color: form.color, monthly_budget: budgetValue });
    setShowDialog(false); setEditingCategory(null); setForm({ name: '', type: 'expense', color: '#8B5CF6', monthly_budget: '' });
  };

  const handleSaveSub = async () => {
    if (selectedCategoryId && subName) { await createSubcategory(selectedCategoryId, subName); setShowSubDialog(false); setSubName(''); }
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedCategories);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedCategories(next);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Categorias</h1><p className="text-muted-foreground">Gerencie grupos e sub-grupos</p></div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild><Button onClick={() => { setEditingCategory(null); setForm({ name: '', type: 'expense', color: '#8B5CF6', monthly_budget: '' }); }}><Plus className="w-4 h-4 mr-2" />Nova Categoria</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{editingCategory ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Tipo</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Receita</SelectItem><SelectItem value="expense">Despesa</SelectItem><SelectItem value="both">Ambos</SelectItem></SelectContent></Select></div>
              <div><Label>Cor</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
              <div><Label>Orçamento Mensal (opcional)</Label><Input type="number" step="0.01" placeholder="0,00" value={form.monthly_budget} onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })} /></div>
              <Button onClick={handleSave} className="w-full" disabled={!form.name}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="pt-4">
        {categories.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhuma categoria.</p> : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <Collapsible key={cat.id} open={expandedCategories.has(cat.id)} onOpenChange={() => toggleExpand(cat.id)}>
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                  <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                    {expandedCategories.has(cat.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-xs text-muted-foreground">({typeLabels[cat.type]})</span>
                    {cat.monthly_budget && <span className="text-xs text-muted-foreground">• Orç: {formatCurrency(cat.monthly_budget)}</span>}
                    <span className="text-xs text-muted-foreground">• {cat.subcategories?.length || 0} sub</span>
                  </CollapsibleTrigger>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedCategoryId(cat.id); setShowSubDialog(true); }}><Plus className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingCategory(cat); setForm({ name: cat.name, type: cat.type, color: cat.color, monthly_budget: cat.monthly_budget?.toString() || '' }); setShowDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => confirm('Excluir?') && deleteCategory(cat.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="ml-8 mt-1 space-y-1">
                    {cat.subcategories?.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-2 rounded bg-background">
                        <span className="text-sm">{sub.name}</span>
                        <Button variant="ghost" size="icon" onClick={() => confirm('Excluir?') && deleteSubcategory(sub.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent></Card>
      <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}><DialogContent><DialogHeader><DialogTitle>Nova Subcategoria</DialogTitle></DialogHeader>
        <div className="space-y-4"><div><Label>Nome</Label><Input value={subName} onChange={(e) => setSubName(e.target.value)} /></div><Button onClick={handleSaveSub} className="w-full" disabled={!subName}>Criar</Button></div>
      </DialogContent></Dialog>
    </div>
  );
}
