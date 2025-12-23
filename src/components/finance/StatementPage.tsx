import { useState } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import { useAccountStatement } from '@/hooks/useAccountStatement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';

interface StatementPageProps { companyId: string; }

export function StatementPage({ companyId }: StatementPageProps) {
  const { accounts } = useAccounts(companyId);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { entries, account, loading, totals } = useAccountStatement(selectedAccountId || null, startDate || undefined, endDate || undefined);
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const getIcon = (type: string) => {
    if (type === 'income') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (type === 'expense') return <TrendingDown className="w-4 h-4 text-red-600" />;
    if (type === 'transfer_in') return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
    return <ArrowRightLeft className="w-4 h-4 text-orange-600" />;
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Extrato</h1><p className="text-muted-foreground">Acompanhe as movimentações com saldo acumulado</p></div>
      <Card><CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Label>Conta *</Label><Select value={selectedAccountId} onValueChange={setSelectedAccountId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Data Inicial</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><Label>Data Final</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
      </CardContent></Card>
      {selectedAccountId && !loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Entradas</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(totals.income)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saídas</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-red-600">{formatCurrency(totals.expense)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Resultado</CardTitle></CardHeader><CardContent><div className={`text-xl font-bold ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totals.net)}</div></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Movimentações - {account?.name}</CardTitle></CardHeader><CardContent>
            {entries.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhuma movimentação encontrada.</p> : (
              <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}><TableCell>{new Date(e.date).toLocaleDateString('pt-BR')}</TableCell><TableCell><div className="flex items-center gap-2">{getIcon(e.type)}<span>{e.description}</span></div></TableCell><TableCell className="text-muted-foreground">{e.category ? `${e.category}${e.subcategory ? ` / ${e.subcategory}` : ''}` : e.relatedAccount || '-'}</TableCell><TableCell className={`text-right ${e.type === 'income' || e.type === 'transfer_in' ? 'text-green-600' : 'text-red-600'}`}>{e.type === 'income' || e.type === 'transfer_in' ? '+' : '-'}{formatCurrency(e.amount)}</TableCell><TableCell className={`text-right font-medium ${e.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(e.balance)}</TableCell></TableRow>
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
