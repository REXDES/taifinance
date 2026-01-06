import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransfers } from '@/hooks/useTransfers';
import { usePatrimonialEvolution } from '@/hooks/usePatrimonialEvolution';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface FinanceDashboardProps {
  companyId: string;
}

export function FinanceDashboard({ companyId }: FinanceDashboardProps) {
  const { accounts, groups, totalAtivo, totalPassivo, totalGeral, loading: accountsLoading } = useAccounts(companyId);
  
  // Get current month transactions
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const { transactions, totalIncome, totalExpense, loading: transactionsLoading } = useTransactions(companyId, {
    startDate: startOfMonth,
    endDate: endOfMonth,
  });

  // Get all transactions and transfers for evolution chart
  const { transactions: allTransactions, loading: allTxLoading } = useTransactions(companyId);
  const { transfers, loading: transfersLoading } = useTransfers(companyId);

  // Calculate patrimonial evolution
  const patrimonialData = usePatrimonialEvolution({
    accounts,
    groups,
    transactions: allTransactions,
    transfers,
    monthsBack: 6,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}K`;
    }
    return `R$ ${value.toFixed(0)}`;
  };

  const loading = accountsLoading || transactionsLoading || allTxLoading || transfersLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das suas finanças</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Geral</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalAtivo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalAtivo)}
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground flex justify-between">
                <span>Passivo:</span>
                <span className={totalPassivo >= 0 ? 'text-red-500' : 'text-green-500'}>{formatCurrency(totalPassivo)}</span>
              </p>
              <p className="text-xs font-medium flex justify-between border-t pt-1">
                <span>Total Geral:</span>
                <span className={totalGeral >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(totalGeral)}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              {transactions.filter(t => t.type === 'income').length} lançamento{transactions.filter(t => t.type === 'income').length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpense)}
            </div>
            <p className="text-xs text-muted-foreground">
              {transactions.filter(t => t.type === 'expense').length} lançamento{transactions.filter(t => t.type === 'expense').length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balanço do Mês</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalIncome - totalExpense)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receitas - Despesas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patrimonial Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução Patrimonial</CardTitle>
        </CardHeader>
        <CardContent>
          {patrimonialData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Dados insuficientes para exibir o gráfico.
            </p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={patrimonialData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="monthLabel" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatCurrencyShort}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Mês: ${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ativo"
                    name="Ativo"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="passivo"
                    name="Passivo"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total Geral"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>Contas</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma conta cadastrada. Vá para Contas para adicionar.
            </p>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: account.color }}
                    />
                    <div>
                      <p className="font-medium text-foreground">{account.name}</p>
                      {account.group && (
                        <p className="text-xs text-muted-foreground">{account.group.name}</p>
                      )}
                    </div>
                  </div>
                  <span className={`font-semibold ${Number(account.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Number(account.current_balance))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma transação neste mês.
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    {transaction.type === 'income' ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString('pt-BR')} • {transaction.account?.name}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
