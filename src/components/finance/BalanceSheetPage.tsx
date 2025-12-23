import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BalanceSheetPageProps { companyId: string; }

export function BalanceSheetPage({ companyId }: BalanceSheetPageProps) {
  const { accounts, groups, totalBalance, loading: accLoading } = useAccounts(companyId);
  const { totalIncome, totalExpense, loading: txLoading } = useTransactions(companyId);
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (accLoading || txLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Balancete Geral</h1><p className="text-muted-foreground">Visão consolidada das finanças</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Receitas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Despesas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo Total</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalBalance)}</div></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Saldo por Conta</CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Conta</TableHead><TableHead>Grupo</TableHead><TableHead className="text-right">Saldo Inicial</TableHead><TableHead className="text-right">Saldo Atual</TableHead></TableRow></TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}><TableCell><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color }} />{a.name}</div></TableCell><TableCell className="text-muted-foreground">{a.group?.name || '-'}</TableCell><TableCell className="text-right">{formatCurrency(Number(a.initial_balance))}</TableCell><TableCell className={`text-right font-medium ${Number(a.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Number(a.current_balance))}</TableCell></TableRow>
            ))}
            <TableRow className="font-bold bg-accent/50"><TableCell colSpan={3}>TOTAL</TableCell><TableCell className={`text-right ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalBalance)}</TableCell></TableRow>
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
