import { useState } from 'react';
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
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    account_id: '',
    category_id: '',
    subcategory_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleSave = async () => {
    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, {
        account_id: form.account_id,
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date,
        notes: form.notes || null,
      });
    } else {
      await createTransaction({
        account_id: form.account_id,
        category_id: form.category_id || undefined,
        subcategory_id: form.subcategory_id || undefined,
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date,
        notes: form.notes,
      });
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
    });
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setForm({
      type: transaction.type,
      account_id: transaction.account_id,
      category_id: transaction.category_id || '',
      subcategory_id: transaction.subcategory_id || '',
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: transaction.date,
      notes: transaction.notes || '',
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      await deleteTransaction(id);
    }
  };

  const filteredCategories = categories.filter(
    c => c.type === form.type || c.type === 'both'
  );

  const selectedCategory = categories.find(c => c.id === form.category_id);

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
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
                </DialogTitle>
              </DialogHeader>
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
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v, subcategory_id: '' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
                  <div>
                    <Label>Subcategoria</Label>
                    <Select value={form.subcategory_id} onValueChange={(v) => setForm({ ...form, subcategory_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma subcategoria (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedCategory.subcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Observações adicionais"
                  />
                </div>

                <Button 
                  onClick={handleSave} 
                  className="w-full"
                  disabled={!form.account_id || !form.amount || !form.description}
                >
                  {editingTransaction ? 'Salvar' : 'Criar Lançamento'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                {transactions.map((transaction) => (
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
                      {transaction.category?.name || '-'}
                      {transaction.subcategory && (
                        <span className="text-muted-foreground"> / {transaction.subcategory.name}</span>
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
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(transaction.id)}>
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
    </div>
  );
}
