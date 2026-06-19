import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTransactions, Transaction } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Filter, Target, Sparkles } from 'lucide-react';
import { AiCategoryHelper } from './AiCategoryHelper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { TagPicker } from './TagPicker';
import TagBadges from './TagBadges';
import { useRecordTags } from '@/hooks/useRecordTags';
import { setEntityTags, findRecordIdsByTags } from '@/hooks/useFinanceTags';

interface TransactionsPageProps {
  companyId: string;
}

export function TransactionsPage({ companyId }: TransactionsPageProps) {
  const [filters, setFilters] = useState<{
    startDate?: string;
    endDate?: string;
    type?: 'income' | 'expense';
    accountId?: string;
  }>({});
  
  const {
    transactions,
    loading,
    totalIncome,
    totalExpense,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactions(companyId, filters);

  const { accounts } = useAccounts(companyId);
  const { categories } = useTransactionCategories(companyId);

  const [showDialog, setShowDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [filterTagIds, setFilterTagIdsRaw] = useState<string[]>([]);
  const [tagFilteredIds, setTagFilteredIds] = useState<Set<string> | null>(null);
  const setFilterTagIds = async (ids: string[]) => {
    setFilterTagIdsRaw(ids);
    if (ids.length === 0) { setTagFilteredIds(null); return; }
    try {
      const recs = await findRecordIdsByTags('transaction', ids);
      setTagFilteredIds(new Set(recs));
    } catch { setTagFilteredIds(new Set()); }
  };

  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (searchText.trim()) {
      const term = searchText.toLowerCase().trim();
      list = list.filter(t => t.description.toLowerCase().includes(term));
    }
    if (tagFilteredIds) list = list.filter(t => tagFilteredIds.has(t.id));
    return list;
  }, [transactions, searchText, tagFilteredIds]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    account_id: '',
    category_id: '',
    subcategory_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    tags: [] as string[],
  });
  const [tagRefresh, setTagRefresh] = useState(0);

  // Calculate current month's spending per category with budget
  const budgetSummary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return categories
      .filter(cat => cat.monthly_budget && cat.monthly_budget > 0)
      .map(cat => {
        const spent = transactions
          .filter(t => {
            const tDate = new Date(t.date + 'T00:00:00');
            return t.category_id === cat.id && 
                   t.type === 'expense' &&
                   tDate.getMonth() === currentMonth &&
                   tDate.getFullYear() === currentYear;
          })
          .reduce((sum, t) => sum + t.amount, 0);

        const budget = cat.monthly_budget || 0;
        const remaining = budget - spent;
        const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

        return {
          category: cat,
          spent,
          budget,
          remaining,
          percentage,
          isOverBudget: spent > budget,
        };
      });
  }, [categories, transactions]);
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleSave = async () => {
    let recordId: string | null = null;
    if (editingTransaction) {
      const ok = await updateTransaction(editingTransaction.id, {
        account_id: form.account_id,
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date,
        notes: form.notes || null,
      });
      if (ok) recordId = editingTransaction.id;
    } else {
      const created = await createTransaction({
        account_id: form.account_id,
        category_id: form.category_id || undefined,
        subcategory_id: form.subcategory_id || undefined,
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date,
        notes: form.notes,
      });
      if (created) recordId = (created as any).id;
    }
    if (recordId) {
      try { await setEntityTags('transaction', recordId, form.tags); } catch (e) { /* ignore */ }
      setTagRefresh(r => r + 1);
    }
    setShowDialog(false);
    setEditingTransaction(null);
    resetForm();
  };

  const resetForm = () => {
    setForm({
      type: 'expense',
      account_id: '',
      category_id: '',
      subcategory_id: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      tags: [],
    });
  };

  const handleEdit = async (transaction: Transaction) => {
    setEditingTransaction(transaction);
    let existingTags: string[] = [];
    try {
      const { fetchTagsForRecords } = await import('@/hooks/useFinanceTags');
      const map = await fetchTagsForRecords('transaction', [transaction.id]);
      existingTags = (map[transaction.id] || []).map(t => t.id);
    } catch {}
    setForm({
      type: transaction.type,
      account_id: transaction.account_id,
      category_id: transaction.category_id || '',
      subcategory_id: transaction.subcategory_id || '',
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: transaction.date,
      notes: transaction.notes || '',
      tags: existingTags,
    });
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTransaction(deleteTarget.id);
    setDeleteTarget(null);
  };

  const filteredCategories = categories.filter(
    c => c.type === form.type || c.type === 'both'
  );

  // selectedCategory variable removed - now using flat subcategory selection

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lançamentos</h1>
          <p className="text-muted-foreground">Gerencie suas receitas e despesas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) {
              setEditingTransaction(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Lançamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>
                  {editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-4">
                  <Tabs value={form.type} onValueChange={(v) => setForm({ ...form, type: v as 'income' | 'expense', category_id: '', subcategory_id: '' })}>
                    <TabsList className="w-full">
                      <TabsTrigger value="expense" className="flex-1">
                        <TrendingDown className="w-4 h-4 mr-2" />
                        Despesa
                      </TabsTrigger>
                      <TabsTrigger value="income" className="flex-1">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Receita
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div>
                    <Label>Conta *</Label>
                    <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Valor *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>

                  <div>
                    <Label>Descrição *</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Ex: Compra no supermercado"
                    />
                  </div>

                  <div>
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Subcategoria *</Label>
                      <AiCategoryHelper
                        type={form.type}
                        categories={filteredCategories}
                        initialDescription={form.description}
                        onSelectCategory={(categoryId, subcategoryId) => {
                          if (subcategoryId) {
                            setForm({
                              ...form,
                              category_id: categoryId,
                              subcategory_id: subcategoryId,
                            });
                          } else if (categoryId) {
                            setForm({
                              ...form,
                              category_id: categoryId,
                              subcategory_id: '',
                            });
                          }
                        }}
                        trigger={
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            Ajude-me
                          </button>
                        }
                      />
                    </div>
                    <Select 
                      value={form.subcategory_id} 
                      onValueChange={(v) => {
                        // Find the category_id from the subcategory
                        const subcat = filteredCategories
                          .flatMap(c => (c.subcategories || []).map(s => ({ ...s, category_id: c.id })))
                          .find(s => s.id === v);
                        setForm({ 
                          ...form, 
                          subcategory_id: v, 
                          category_id: subcat?.category_id || '' 
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma subcategoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((category) => (
                          category.subcategories && category.subcategories.length > 0 && (
                            <div key={category.id}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                                {category.name}
                              </div>
                              {category.subcategories.map((sub) => (
                                <SelectItem key={sub.id} value={sub.id}>
                                  <span className="ml-4">{sub.name}</span>
                                </SelectItem>
                              ))}
                            </div>
                          )
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Observações adicionais"
                    />
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleSave} 
                className="w-full mt-4"
                disabled={!form.account_id || !form.amount || !form.description || !form.subcategory_id}
              >
                {editingTransaction ? 'Salvar' : 'Criar Lançamento'}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label>Descrição</Label>
                <Input
                  type="text"
                  placeholder="Buscar por descrição..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <div>
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={filters.type || 'all'} onValueChange={(v) => setFilters({ ...filters, type: v === 'all' ? undefined : v as 'income' | 'expense' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="income">Receitas</SelectItem>
                    <SelectItem value="expense">Despesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conta</Label>
                <Select value={filters.accountId || 'all'} onValueChange={(v) => setFilters({ ...filters, accountId: v === 'all' ? undefined : v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Balanço</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalIncome - totalExpense)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Summary */}
      {budgetSummary.length > 0 && (
        <Collapsible open={showBudget} onOpenChange={setShowBudget}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Target className="w-4 h-4" />
                  Orçamento do Mês
                  <span className="text-xs text-muted-foreground ml-auto">
                    {showBudget ? 'Clique para recolher' : 'Clique para expandir'}
                  </span>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {budgetSummary.map(({ category, spent, budget, remaining, percentage, isOverBudget }) => (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                        <span className="font-medium text-sm">{category.name}</span>
                      </div>
                      <div className="text-sm">
                        <span className={isOverBudget ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          {formatCurrency(spent)}
                        </span>
                        <span className="text-muted-foreground"> / {formatCurrency(budget)}</span>
                      </div>
                    </div>
                    <Progress 
                      value={percentage} 
                      className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : ''}`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{percentage.toFixed(0)}% utilizado</span>
                      <span className={isOverBudget ? 'text-red-600' : remaining > 0 ? 'text-green-600' : ''}>
                        {isOverBudget 
                          ? `${formatCurrency(Math.abs(remaining))} acima` 
                          : `${formatCurrency(remaining)} disponível`}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Transactions List */}
      <Card>
        <CardContent className="pt-4">
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum lançamento encontrado. Clique em "Novo Lançamento" para adicionar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{new Date(transaction.date + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {transaction.type === 'income' ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          {transaction.notes && (
                            <p className="text-xs text-muted-foreground">{transaction.notes}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{transaction.account?.name || '-'}</TableCell>
                    <TableCell>
                      {transaction.subcategory ? (
                        <div>
                          <span className="text-xs text-muted-foreground">{transaction.category?.name || ''}</span>
                          <span className="block font-medium">{transaction.subcategory.name}</span>
                        </div>
                      ) : (
                        transaction.category?.name || '-'
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(transaction)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(transaction)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir lançamento"
        itemName={deleteTarget?.description}
        itemType="lançamento"
        description={`Você está prestes a excluir o lançamento "${deleteTarget?.description}" no valor de ${deleteTarget ? formatCurrency(deleteTarget.amount) : ''}.`}
        warningMessage="Esta ação não pode ser desfeita. O saldo da conta será recalculado automaticamente."
      />
    </div>
  );
}
