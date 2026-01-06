import { useState, useMemo, Fragment } from 'react';
import { useAccounts, Account, AccountGroup } from '@/hooks/useAccounts';
import { useTransactions, Transaction } from '@/hooks/useTransactions';
import { useTransfers, Transfer } from '@/hooks/useTransfers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Entry unificado para exibir transações e transferências
interface AccountEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  categoryName?: string;
}

interface BalanceSheetPageProps { 
  companyId: string; 
}

export function BalanceSheetPage({ companyId }: BalanceSheetPageProps) {
  const { accounts, groups, totalBalance, loading: accLoading } = useAccounts(companyId);
  const { transactions, totalIncome, totalExpense, loading: txLoading } = useTransactions(companyId);
  const { transfers, loading: trLoading } = useTransfers(companyId);
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  
  const formatCurrency = (v: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Current month date range
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);

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

  // Build all entries for each account (transactions + transfers)
  const allEntriesByAccount = useMemo(() => {
    const byAccount: Map<string, AccountEntry[]> = new Map();
    
    // Add transactions
    transactions.forEach(tx => {
      if (!byAccount.has(tx.account_id)) {
        byAccount.set(tx.account_id, []);
      }
      byAccount.get(tx.account_id)!.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        categoryName: tx.category?.name,
      });
    });
    
    // Add transfers (each transfer creates 2 entries: out from source, in to destination)
    transfers.forEach(tr => {
      // Transfer out (from account)
      if (!byAccount.has(tr.from_account_id)) {
        byAccount.set(tr.from_account_id, []);
      }
      byAccount.get(tr.from_account_id)!.push({
        id: `${tr.id}-out`,
        date: tr.date,
        description: `Transferência para ${tr.to_account?.name || 'outra conta'}${tr.description ? ` - ${tr.description}` : ''}`,
        amount: tr.amount,
        type: 'transfer_out',
      });
      
      // Transfer in (to account)
      if (!byAccount.has(tr.to_account_id)) {
        byAccount.set(tr.to_account_id, []);
      }
      byAccount.get(tr.to_account_id)!.push({
        id: `${tr.id}-in`,
        date: tr.date,
        description: `Transferência de ${tr.from_account?.name || 'outra conta'}${tr.description ? ` - ${tr.description}` : ''}`,
        amount: tr.amount,
        type: 'transfer_in',
      });
    });
    
    // Sort entries by date (oldest first for balance calculation)
    byAccount.forEach((entries) => {
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    
    return byAccount;
  }, [transactions, transfers]);

  // Calculate opening balance for each account (sum of movements before current month)
  const accountOpeningBalances = useMemo(() => {
    const balances: Map<string, number> = new Map();
    
    accounts.forEach(account => {
      const entries = allEntriesByAccount.get(account.id) || [];
      let balance = Number(account.initial_balance);
      
      // Sum all entries before current month
      entries.forEach(entry => {
        const entryDate = parseISO(entry.date);
        if (isBefore(entryDate, currentMonthStart)) {
          if (entry.type === 'income' || entry.type === 'transfer_in') {
            balance += entry.amount;
          } else {
            balance -= entry.amount;
          }
        }
      });
      
      balances.set(account.id, balance);
    });
    
    return balances;
  }, [accounts, allEntriesByAccount, currentMonthStart]);

  // Get current month entries by account (filtered and sorted newest first for display)
  const currentMonthEntriesByAccount = useMemo(() => {
    const byAccount: Map<string, AccountEntry[]> = new Map();
    
    allEntriesByAccount.forEach((entries, accountId) => {
      const filtered = entries.filter(entry => {
        const entryDate = parseISO(entry.date);
        return entryDate >= currentMonthStart && entryDate <= currentMonthEnd;
      });
      // Sort newest first for display
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      byAccount.set(accountId, filtered);
    });
    
    return byAccount;
  }, [allEntriesByAccount, currentMonthStart, currentMonthEnd]);

  // Separate groups by type (ativo/passivo)
  const { ativoGroups, passivoGroups, ungroupedAccounts, ativoUngrouped, passivoUngrouped } = useMemo(() => {
    const ativo: AccountGroup[] = [];
    const passivo: AccountGroup[] = [];
    
    groups.forEach(group => {
      const hasAccounts = groupedData.has(group.id) && (groupedData.get(group.id)?.length || 0) > 0;
      if (hasAccounts) {
        if (group.type === 'passivo') {
          passivo.push(group);
        } else {
          ativo.push(group);
        }
      }
    });
    
    const ungrouped = groupedData.get(null) || [];
    
    return {
      ativoGroups: ativo,
      passivoGroups: passivo,
      ungroupedAccounts: ungrouped,
      ativoUngrouped: ungrouped, // Ungrouped accounts go to ativo by default
      passivoUngrouped: [] as Account[],
    };
  }, [groups, groupedData]);

  // Calculate totals by type
  const totals = useMemo(() => {
    let ativoTotal = 0;
    let passivoTotal = 0;
    let ativoOpening = 0;
    let passivoOpening = 0;

    // Calculate grouped accounts
    groups.forEach(group => {
      const groupAccounts = groupedData.get(group.id) || [];
      const groupBalance = groupAccounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0);
      const groupOpening = groupAccounts.reduce((sum, acc) => sum + (accountOpeningBalances.get(acc.id) || Number(acc.initial_balance)), 0);
      
      if (group.type === 'passivo') {
        passivoTotal += groupBalance;
        passivoOpening += groupOpening;
      } else {
        ativoTotal += groupBalance;
        ativoOpening += groupOpening;
      }
    });

    // Add ungrouped to ativo
    const ungrouped = groupedData.get(null) || [];
    ungrouped.forEach(acc => {
      ativoTotal += Number(acc.current_balance);
      ativoOpening += accountOpeningBalances.get(acc.id) || Number(acc.initial_balance);
    });

    return { ativoTotal, passivoTotal, ativoOpening, passivoOpening };
  }, [groups, groupedData, accountOpeningBalances]);

  // Calculate group totals
  const getGroupOpeningBalance = (groupId: string | null): number => {
    const groupAccounts = groupedData.get(groupId) || [];
    return groupAccounts.reduce((sum, acc) => sum + (accountOpeningBalances.get(acc.id) || Number(acc.initial_balance)), 0);
  };

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

  if (accLoading || txLoading || trLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderAccountRows = (groupAccounts: Account[]) => {
    return groupAccounts.map((account) => {
      const isAccountExpanded = expandedAccounts.has(account.id);
      const accountEntries = currentMonthEntriesByAccount.get(account.id) || [];
      const openingBalance = accountOpeningBalances.get(account.id) || Number(account.initial_balance);

      return (
        <Fragment key={account.id}>
          {/* Account Row */}
          <TableRow className="bg-background hover:bg-muted/50">
            <TableCell className="pl-8">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => toggleAccount(account.id)}
                disabled={accountEntries.length === 0}
              >
                {accountEntries.length > 0 ? (
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
                {accountEntries.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({accountEntries.length} lançamentos)
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(openingBalance)}
            </TableCell>
            <TableCell className={`text-right ${Number(account.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Number(account.current_balance))}
            </TableCell>
          </TableRow>

          {/* Entry Rows (when account is expanded) */}
          {isAccountExpanded && accountEntries.map((entry) => {
            const getEntryStyle = () => {
              switch (entry.type) {
                case 'income':
                  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                case 'expense':
                  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                case 'transfer_in':
                  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                case 'transfer_out':
                  return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
              }
            };
            const getEntryLabel = () => {
              switch (entry.type) {
                case 'income': return 'R';
                case 'expense': return 'D';
                case 'transfer_in': return 'T↓';
                case 'transfer_out': return 'T↑';
              }
            };
            const isPositive = entry.type === 'income' || entry.type === 'transfer_in';
            
            return (
              <TableRow key={entry.id} className="bg-muted/20 text-sm">
                <TableCell></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 pl-12">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getEntryStyle()}`}>
                      {getEntryLabel()}
                    </span>
                    <span className="text-muted-foreground">
                      {format(new Date(entry.date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                    <span>{entry.description}</span>
                    {entry.categoryName && (
                      <span className="text-xs text-muted-foreground">
                        [{entry.categoryName}]
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell></TableCell>
                <TableCell className={`text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : '-'}{formatCurrency(entry.amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </Fragment>
      );
    });
  };

  const renderGroupRows = (groupList: AccountGroup[]) => {
    return groupList.map((group) => {
      const isGroupExpanded = expandedGroups.has(group.id);
      const groupTotal = getGroupTotal(group.id);
      const groupAccounts = groupedData.get(group.id) || [];
      const groupOpeningBalance = getGroupOpeningBalance(group.id);

      return (
        <Fragment key={group.id}>
          {/* Group Row */}
          <TableRow className="bg-accent/30 hover:bg-accent/50 font-medium">
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
              {formatCurrency(groupOpeningBalance)}
            </TableCell>
            <TableCell className={`text-right font-medium ${groupTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(groupTotal)}
            </TableCell>
          </TableRow>

          {/* Account Rows (when group is expanded) */}
          {isGroupExpanded && renderAccountRows(groupAccounts)}
        </Fragment>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Balancete Geral</h1>
        <p className="text-muted-foreground">
          Mês vigente: {format(currentMonthStart, 'MMMM/yyyy', { locale: ptBR })}
        </p>
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

      {/* ATIVO Card */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="bg-green-50 dark:bg-green-900/20">
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-green-600" />
            Ativo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
              {/* Ativo Groups */}
              {renderGroupRows(ativoGroups)}

              {/* Ungrouped Accounts (go to ativo) */}
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
                      {formatCurrency(getGroupOpeningBalance(null))}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${getGroupTotal(null) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(getGroupTotal(null))}
                    </TableCell>
                  </TableRow>

                  {expandedGroups.has('ungrouped') && renderAccountRows(ungroupedAccounts)}
                </>
              )}

              {/* Total Ativo Row */}
              <TableRow className="font-bold bg-green-100 dark:bg-green-900/30 border-t-2 border-green-300 dark:border-green-700">
                <TableCell></TableCell>
                <TableCell>TOTAL ATIVO</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totals.ativoOpening)}
                </TableCell>
                <TableCell className={`text-right ${totals.ativoTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.ativoTotal)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* PASSIVO Card */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="bg-red-50 dark:bg-red-900/20">
          <CardTitle className="flex items-center gap-2">
            <ArrowDownCircle className="w-5 h-5 text-red-600" />
            Passivo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
              {/* Passivo Groups */}
              {passivoGroups.length > 0 ? (
                renderGroupRows(passivoGroups)
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum grupo passivo cadastrado
                  </TableCell>
                </TableRow>
              )}

              {/* Total Passivo Row */}
              <TableRow className="font-bold bg-red-100 dark:bg-red-900/30 border-t-2 border-red-300 dark:border-red-700">
                <TableCell></TableCell>
                <TableCell>TOTAL PASSIVO</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totals.passivoOpening)}
                </TableCell>
                <TableCell className={`text-right ${totals.passivoTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.passivoTotal)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Total Geral Card */}
      <Card className="border-primary/30">
        <CardContent className="py-4">
          <Table>
            <TableBody>
              <TableRow className="font-bold bg-primary/10 border-t-2 border-primary">
                <TableCell className="w-[50px]"></TableCell>
                <TableCell>TOTAL GERAL (Ativo - Passivo)</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totals.ativoOpening - totals.passivoOpening)}
                </TableCell>
                <TableCell className={`text-right ${(totals.ativoTotal - totals.passivoTotal) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.ativoTotal - totals.passivoTotal)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
