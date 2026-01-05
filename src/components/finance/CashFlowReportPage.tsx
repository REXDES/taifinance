import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransfers } from '@/hooks/useTransfers';
import { useUsers } from '@/hooks/useUsers';

interface CashFlowReportPageProps {
  companyId: string;
}

interface FlowEntry {
  id: string;
  date: string;
  accountId: string;
  accountName: string;
  category: string;
  description: string;
  income: number;
  expense: number;
  runningBalance: number;
  userId: string | null;
  userName: string;
  isInitialBalance?: boolean;
}

export function CashFlowReportPage({ companyId }: CashFlowReportPageProps) {
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(today));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(today));

  const { accounts, loading: accountsLoading } = useAccounts(companyId);
  const { transactions, loading: transactionsLoading } = useTransactions(companyId);
  const { transfers, loading: transfersLoading } = useTransfers(companyId);
  const { users } = useUsers(companyId);

  const loading = accountsLoading || transactionsLoading || transfersLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return '-';
    const user = users.find(u => u.user_id === userId);
    return user?.full_name || user?.email || '-';
  };

  const flowData = useMemo(() => {
    if (loading) return [];

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Calculate opening balance for each account (transactions before start date)
    const openingBalances: Record<string, number> = {};
    
    accounts.forEach(account => {
      let balance = account.initial_balance || 0;

      // Add transactions before period
      transactions
        .filter(t => t.account_id === account.id && t.date < startDateStr)
        .forEach(t => {
          if (t.type === 'income') {
            balance += t.amount;
          } else {
            balance -= t.amount;
          }
        });

      // Add transfers before period
      transfers
        .filter(t => t.date < startDateStr)
        .forEach(t => {
          if (t.from_account_id === account.id) {
            balance -= t.amount;
          }
          if (t.to_account_id === account.id) {
            balance += t.amount;
          }
        });

      openingBalances[account.id] = balance;
    });

    const entries: FlowEntry[] = [];

    // Add initial balance entries for each account
    accounts.forEach(account => {
      entries.push({
        id: `initial-${account.id}`,
        date: startDateStr,
        accountId: account.id,
        accountName: account.name,
        category: 'Saldo Inicial',
        description: `Saldo inicial - ${account.name}`,
        income: openingBalances[account.id] >= 0 ? openingBalances[account.id] : 0,
        expense: openingBalances[account.id] < 0 ? Math.abs(openingBalances[account.id]) : 0,
        runningBalance: 0, // Will be calculated later
        userId: null,
        userName: '-',
        isInitialBalance: true,
      });
    });

    // Add transactions within period
    transactions
      .filter(t => t.date >= startDateStr && t.date <= endDateStr)
      .forEach(t => {
        const account = accounts.find(a => a.id === t.account_id);
        entries.push({
          id: t.id,
          date: t.date,
          accountId: t.account_id,
          accountName: account?.name || 'Conta desconhecida',
          category: t.category?.name || 'Sem categoria',
          description: t.description,
          income: t.type === 'income' ? t.amount : 0,
          expense: t.type === 'expense' ? t.amount : 0,
          runningBalance: 0,
          userId: t.created_by,
          userName: getUserName(t.created_by),
          isInitialBalance: false,
        });
      });

    // Add transfers within period (as two entries: one expense, one income)
    transfers
      .filter(t => t.date >= startDateStr && t.date <= endDateStr)
      .forEach(t => {
        const fromAccount = accounts.find(a => a.id === t.from_account_id);
        const toAccount = accounts.find(a => a.id === t.to_account_id);

        // Expense from source account
        entries.push({
          id: `${t.id}-out`,
          date: t.date,
          accountId: t.from_account_id,
          accountName: fromAccount?.name || 'Conta desconhecida',
          category: 'Transferência',
          description: `Transferência para ${toAccount?.name || 'conta'}${t.description ? ` - ${t.description}` : ''}`,
          income: 0,
          expense: t.amount,
          runningBalance: 0,
          userId: t.created_by,
          userName: getUserName(t.created_by),
          isInitialBalance: false,
        });

        // Income to destination account
        entries.push({
          id: `${t.id}-in`,
          date: t.date,
          accountId: t.to_account_id,
          accountName: toAccount?.name || 'Conta desconhecida',
          category: 'Transferência',
          description: `Transferência de ${fromAccount?.name || 'conta'}${t.description ? ` - ${t.description}` : ''}`,
          income: t.amount,
          expense: 0,
          runningBalance: 0,
          userId: t.created_by,
          userName: getUserName(t.created_by),
          isInitialBalance: false,
        });
      });

    // Sort by date (initial balances first, then by date)
    entries.sort((a, b) => {
      if (a.isInitialBalance && !b.isInitialBalance) return -1;
      if (!a.isInitialBalance && b.isInitialBalance) return 1;
      if (a.isInitialBalance && b.isInitialBalance) {
        return a.accountName.localeCompare(b.accountName);
      }
      return a.date.localeCompare(b.date) || a.accountName.localeCompare(b.accountName);
    });

    // Calculate running balance
    let runningBalance = 0;
    entries.forEach(entry => {
      runningBalance += entry.income - entry.expense;
      entry.runningBalance = runningBalance;
    });

    return entries;
  }, [accounts, transactions, transfers, startDate, endDate, loading, users]);

  const totals = useMemo(() => {
    const totalIncome = flowData.reduce((sum, e) => sum + e.income, 0);
    const totalExpense = flowData.reduce((sum, e) => sum + e.expense, 0);
    const initialBalances = flowData.filter(e => e.isInitialBalance);
    const totalInitial = initialBalances.reduce((sum, e) => sum + e.income - e.expense, 0);
    
    return {
      income: totalIncome,
      expense: totalExpense,
      initialBalance: totalInitial,
      finalBalance: flowData.length > 0 ? flowData[flowData.length - 1].runningBalance : 0,
    };
  }, [flowData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">De:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(startDate, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Até:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(endDate, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Inicial</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.initialBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(totals.initialBalance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totals.income - totals.initialBalance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totals.expense)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Final</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.finalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(totals.finalBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flow Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Saída</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flowData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum lançamento encontrado no período
                    </TableCell>
                  </TableRow>
                ) : (
                  flowData.map((entry) => (
                    <TableRow 
                      key={entry.id} 
                      className={entry.isInitialBalance ? 'bg-muted/50 font-medium' : ''}
                    >
                      <TableCell>{format(parseISO(entry.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{entry.accountName}</TableCell>
                      <TableCell>{entry.category}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {entry.expense > 0 ? formatCurrency(entry.expense) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {entry.income > 0 ? formatCurrency(entry.income) : '-'}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${entry.runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(entry.runningBalance)}
                      </TableCell>
                      <TableCell>{entry.userName}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
