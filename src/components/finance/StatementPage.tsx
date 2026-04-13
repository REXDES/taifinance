import { useState } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import { useAccountStatement } from '@/hooks/useAccountStatement';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface StatementPageProps { companyId: string; }

export function StatementPage({ companyId }: StatementPageProps) {
  const { accounts } = useAccounts(companyId);
  const { categories } = useTransactionCategories(companyId);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: subcategories = [] } = useQuery({
    queryKey: ['subcategories', selectedCategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return [];
      const { data, error } = await supabase
        .from('transaction_subcategories')
        .select('id, name, category_id')
        .eq('category_id', selectedCategoryId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCategoryId,
  });

  const hasValidFilter = !!selectedAccountId || !!selectedCategoryId || !!selectedSubcategoryId;

  const { entries, account, loading, totals } = useAccountStatement(
    selectedAccountId || null,
    startDate || undefined,
    endDate || undefined,
    selectedCategoryId || undefined,
    selectedSubcategoryId || undefined,
    companyId
  );

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const getIcon = (type: string) => {
    if (type === 'income') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (type === 'expense') return <TrendingDown className="w-4 h-4 text-red-600" />;
    if (type === 'transfer_in') return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
    return <ArrowRightLeft className="w-4 h-4 text-orange-600" />;
  };

  const showAccountColumn = !selectedAccountId;
  const showBalanceColumn = !!selectedAccountId;

  const title = account
    ? `Movimentações - ${account.name}`
    : selectedCategoryId
      ? `Movimentações por Categoria`
      : 'Movimentações';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Extrato</h1>
        <p className="text-muted-foreground">Filtre por conta ou categoria/subcategoria para visualizar movimentações</p>
      </div>

      <Card><CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <Label>Conta {!selectedCategoryId && !selectedSubcategoryId ? '*' : ''}</Label>
            <Select value={selectedAccountId || 'all'} onValueChange={(v) => setSelectedAccountId(v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria {!selectedAccountId ? '*' : ''}</Label>
            <Select value={selectedCategoryId || 'all'} onValueChange={(v) => { setSelectedCategoryId(v === 'all' ? '' : v); setSelectedSubcategoryId(''); }}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subcategoria</Label>
            <Select value={selectedSubcategoryId || 'all'} onValueChange={(v) => setSelectedSubcategoryId(v === 'all' ? '' : v)} disabled={!selectedCategoryId}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as subcategorias</SelectItem>
                {subcategories.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Data Inicial</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><Label>Data Final</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
        {!hasValidFilter && (
          <p className="text-sm text-amber-600 mt-3">Selecione ao menos uma conta ou uma categoria para visualizar o extrato.</p>
        )}
      </CardContent></Card>

      {hasValidFilter && !loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Entradas</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(totals.income)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saídas</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-red-600">{formatCurrency(totals.expense)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Resultado</CardTitle></CardHeader><CardContent><div className={`text-xl font-bold ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totals.net)}</div></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>
            {entries.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhuma movimentação encontrada.</p> : (
              <Table><TableHeader><TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                {showAccountColumn && <TableHead>Conta</TableHead>}
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {showBalanceColumn && <TableHead className="text-right">Saldo</TableHead>}
              </TableRow></TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{new Date(e.date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell><div className="flex items-center gap-2">{getIcon(e.type)}<span>{e.description}</span></div></TableCell>
                      {showAccountColumn && <TableCell className="text-muted-foreground">{e.accountName || '-'}</TableCell>}
                      <TableCell className="text-muted-foreground">{e.category ? `${e.category}${e.subcategory ? ` / ${e.subcategory}` : ''}` : e.relatedAccount || '-'}</TableCell>
                      <TableCell className={`text-right ${e.type === 'income' || e.type === 'transfer_in' ? 'text-green-600' : 'text-red-600'}`}>{e.type === 'income' || e.type === 'transfer_in' ? '+' : '-'}{formatCurrency(e.amount)}</TableCell>
                      {showBalanceColumn && <TableCell className={`text-right font-medium ${e.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(e.balance)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </>
      )}
      {loading && <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}
    </div>
  );
}
