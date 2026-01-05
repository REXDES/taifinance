import { useState, useMemo } from 'react';
import { useAccounts, Account, AccountGroup } from '@/hooks/useAccounts';
import { useTransactions, Transaction } from '@/hooks/useTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BalanceSheetPageProps { 
  companyId: string; 
}

export function BalanceSheetPage({ companyId }: BalanceSheetPageProps) {
  const { accounts, groups, totalBalance, loading: accLoading } = useAccounts(companyId);
  const { transactions, totalIncome, totalExpense, loading: txLoading } = useTransactions(companyId);
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  
  const formatCurrency = (v: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Group accounts by group_id
  const groupedData = useMemo(() => {
    const grouped: Map<string | null, Account[]> = new Map();
    
    accounts.forEach(account => {
      const groupId = account.group_id;
      if (!grouped.has(groupId)) {
        grouped.set(groupId, []);
      }
      grouped.get(groupId)!.push(account);
    });
    
    return grouped;
  }, [accounts]);

  // Get transactions by account
  const transactionsByAccount = useMemo(() => {
    const byAccount: Map<string, Transaction[]> = new Map();
    
    transactions.forEach(tx => {
      if (!byAccount.has(tx.account_id)) {
        byAccount.set(tx.account_id, []);
      }
      byAccount.get(tx.account_id)!.push(tx);
    });
    
    return byAccount;
  }, [transactions]);

  // Calculate group totals
  const getGroupTotal = (groupId: string | null): number => {
    const groupAccounts = groupedData.get(groupId) || [];
    return groupAccounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleAccount = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  if (accLoading || txLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Separate groups and ungrouped accounts
  const groupsWithAccounts = groups.filter(g => groupedData.has(g.id) && (groupedData.get(g.id)?.length || 0) > 0);
  const ungroupedAccounts = groupedData.get(null) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Balancete Geral</h1>
        <p className="text-muted-foreground">Visão consolidada das finanças</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Total Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              Total Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Saldo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hierarchical Balance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Saldo por Grupo e Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Saldo Inicial</TableHead>
                <TableHead className="text-right">Saldo Atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Groups with accounts */}
              {groupsWithAccounts.map((group) => {
                const isGroupExpanded = expandedGroups.has(group.id);
                const groupTotal = getGroupTotal(group.id);
                const groupAccounts = groupedData.get(group.id) || [];
                const groupInitialBalance = groupAccounts.reduce((sum, acc) => sum + Number(acc.initial_balance), 0);

                return (
                  <>
                    {/* Group Row */}
                    <TableRow key={group.id} className="bg-accent/30 hover:bg-accent/50 font-medium">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleGroup(group.id)}
                        >
                          {isGroupExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: group.color }} 
                          />
                          <span className="font-semibold">{group.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({groupAccounts.length} {groupAccounts.length === 1 ? 'conta' : 'contas'})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(groupInitialBalance)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${groupTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(groupTotal)}
                      </TableCell>
                    </TableRow>

                    {/* Account Rows (when group is expanded) */}
                    {isGroupExpanded && groupAccounts.map((account) => {
                      const isAccountExpanded = expandedAccounts.has(account.id);
                      const accountTransactions = transactionsByAccount.get(account.id) || [];

                      return (
                        <>
                          {/* Account Row */}
                          <TableRow key={account.id} className="bg-background hover:bg-muted/50">
                            <TableCell className="pl-8">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleAccount(account.id)}
                                disabled={accountTransactions.length === 0}
                              >
                                {accountTransactions.length > 0 ? (
                                  isAccountExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )
                                ) : (
                                  <div className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 pl-4">
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: account.color }} 
                                />
                                <span>{account.name}</span>
                                {accountTransactions.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    ({accountTransactions.length} lançamentos)
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(Number(account.initial_balance))}
                            </TableCell>
                            <TableCell className={`text-right ${Number(account.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(Number(account.current_balance))}
                            </TableCell>
                          </TableRow>

                          {/* Transaction Rows (when account is expanded) */}
                          {isAccountExpanded && accountTransactions.map((tx) => (
                            <TableRow key={tx.id} className="bg-muted/20 text-sm">
                              <TableCell></TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 pl-12">
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    tx.type === 'income' 
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  }`}>
                                    {tx.type === 'income' ? 'R' : 'D'}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {format(new Date(tx.date), 'dd/MM/yyyy', { locale: ptBR })}
                                  </span>
                                  <span>{tx.description}</span>
                                  {tx.category && (
                                    <span className="text-xs text-muted-foreground">
                                      [{tx.category.name}]
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell className={`text-right ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
                  </>
                );
              })}

              {/* Ungrouped Accounts */}
              {ungroupedAccounts.length > 0 && (
                <>
                  <TableRow className="bg-accent/30 hover:bg-accent/50 font-medium">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleGroup('ungrouped')}
                      >
                        {expandedGroups.has('ungrouped') ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                        <span className="font-semibold">Sem Grupo</span>
                        <span className="text-xs text-muted-foreground">
                          ({ungroupedAccounts.length} {ungroupedAccounts.length === 1 ? 'conta' : 'contas'})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(ungroupedAccounts.reduce((sum, acc) => sum + Number(acc.initial_balance), 0))}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${getGroupTotal(null) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(getGroupTotal(null))}
                    </TableCell>
                  </TableRow>

                  {expandedGroups.has('ungrouped') && ungroupedAccounts.map((account) => {
                    const isAccountExpanded = expandedAccounts.has(account.id);
                    const accountTransactions = transactionsByAccount.get(account.id) || [];

                    return (
                      <>
                        <TableRow key={account.id} className="bg-background hover:bg-muted/50">
                          <TableCell className="pl-8">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleAccount(account.id)}
                              disabled={accountTransactions.length === 0}
                            >
                              {accountTransactions.length > 0 ? (
                                isAccountExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )
                              ) : (
                                <div className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 pl-4">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: account.color }} 
                              />
                              <span>{account.name}</span>
                              {accountTransactions.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ({accountTransactions.length} lançamentos)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(account.initial_balance))}
                          </TableCell>
                          <TableCell className={`text-right ${Number(account.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(Number(account.current_balance))}
                          </TableCell>
                        </TableRow>

                        {isAccountExpanded && accountTransactions.map((tx) => (
                          <TableRow key={tx.id} className="bg-muted/20 text-sm">
                            <TableCell></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 pl-12">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  tx.type === 'income' 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {tx.type === 'income' ? 'R' : 'D'}
                                </span>
                                <span className="text-muted-foreground">
                                  {format(new Date(tx.date), 'dd/MM/yyyy', { locale: ptBR })}
                                </span>
                                <span>{tx.description}</span>
                                {tx.category && (
                                  <span className="text-xs text-muted-foreground">
                                    [{tx.category.name}]
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className={`text-right ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })}
                </>
              )}

              {/* Total Row */}
              <TableRow className="font-bold bg-primary/10 border-t-2 border-primary">
                <TableCell></TableCell>
                <TableCell>TOTAL GERAL</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(accounts.reduce((sum, acc) => sum + Number(acc.initial_balance), 0))}
                </TableCell>
                <TableCell className={`text-right ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalBalance)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
