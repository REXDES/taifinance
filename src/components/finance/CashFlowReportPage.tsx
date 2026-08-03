import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Download, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransfers } from '@/hooks/useTransfers';
import { useUsers } from '@/hooks/useUsers';
import { useCompanies } from '@/hooks/useCompanies';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const { toast } = useToast();

  const { accounts, loading: accountsLoading } = useAccounts(companyId);
  const { transactions, loading: transactionsLoading } = useTransactions(companyId);
  const { transfers, loading: transfersLoading } = useTransfers(companyId);
  const { users } = useUsers(companyId);
  const { companies } = useCompanies();
  const { profile } = useProfile();

  const loading = accountsLoading || transactionsLoading || transfersLoading;
  
  const companyName = companies.find(c => c.id === companyId)?.name || 'Empresa';
  const currentUserName = profile?.full_name || profile?.email || 'Usuário';

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
    const periodEntries = flowData.filter(e => !e.isInitialBalance && e.category !== 'Transferência');
    const totalIncome = periodEntries.reduce((sum, e) => sum + e.income, 0);
    const totalExpense = periodEntries.reduce((sum, e) => sum + e.expense, 0);
    const initialBalances = flowData.filter(e => e.isInitialBalance);
    const totalInitial = initialBalances.reduce((sum, e) => sum + e.income - e.expense, 0);
    
    return {
      income: totalIncome,
      expense: totalExpense,
      initialBalance: totalInitial,
      finalBalance: flowData.length > 0 ? flowData[flowData.length - 1].runningBalance : 0,
    };
  }, [flowData]);

  const formatCurrencyPlain = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportToExcel = () => {
    if (flowData.length === 0) {
      toast({ title: 'Sem dados para exportar', variant: 'destructive' });
      return;
    }

    const wb = XLSX.utils.book_new();
    
    // Header data
    const headerData = [
      ['FLUXO FINANCEIRO'],
      [`Empresa: ${companyName}`],
      [`Emitido por: ${currentUserName}`],
      [`Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`],
      [`Data de emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['Data', 'Conta', 'Categoria', 'Descrição', 'Saída', 'Entrada', 'Saldo', 'Usuário'],
    ];

    // Data rows
    const dataRows = flowData.map(entry => [
      format(parseISO(entry.date), 'dd/MM/yyyy'),
      entry.accountName,
      entry.category,
      entry.description,
      entry.expense > 0 ? formatCurrencyPlain(entry.expense) : '',
      entry.income > 0 ? formatCurrencyPlain(entry.income) : '',
      formatCurrencyPlain(entry.runningBalance),
      entry.userName,
    ]);

    // Footer with totals
    const footerData = [
      [],
      ['', '', '', 'TOTAIS:', formatCurrencyPlain(totals.expense), formatCurrencyPlain(totals.income), formatCurrencyPlain(totals.finalBalance), ''],
      [`Saldo Inicial: ${formatCurrency(totals.initialBalance)}`],
      [`Total Entradas: ${formatCurrency(totals.income)}`],
      [`Total Saídas: ${formatCurrency(totals.expense)}`],
      [`Saldo Final: ${formatCurrency(totals.finalBalance)}`],
      [],
      ['Copyright © Tai Finance'],
    ];

    const allData = [...headerData, ...dataRows, ...footerData];
    const ws = XLSX.utils.aoa_to_sheet(allData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Data
      { wch: 20 }, // Conta
      { wch: 18 }, // Categoria
      { wch: 35 }, // Descrição
      { wch: 15 }, // Saída
      { wch: 15 }, // Entrada
      { wch: 15 }, // Saldo
      { wch: 20 }, // Usuário
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Fluxo Financeiro');
    
    const fileName = `fluxo-financeiro_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({ title: 'Excel exportado com sucesso' });
  };

  const exportToPDF = () => {
    if (flowData.length === 0) {
      toast({ title: 'Sem dados para exportar', variant: 'destructive' });
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FLUXO FINANCEIRO', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa: ${companyName}`, 14, 25);
    doc.text(`Emitido por: ${currentUserName}`, 14, 31);
    
    doc.setFontSize(10);
    doc.text(`Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`, pageWidth - 14, 25, { align: 'right' });
    doc.text(`Data de emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - 14, 31, { align: 'right' });

    // Table data
    const tableData = flowData.map(entry => [
      format(parseISO(entry.date), 'dd/MM/yyyy'),
      entry.accountName,
      entry.category,
      entry.description.length > 35 ? entry.description.substring(0, 35) + '...' : entry.description,
      entry.expense > 0 ? formatCurrencyPlain(entry.expense) : '-',
      entry.income > 0 ? formatCurrencyPlain(entry.income) : '-',
      formatCurrencyPlain(entry.runningBalance),
      entry.userName,
    ]);

    // Totals row
    tableData.push([
      '', '', '', 'TOTAIS:',
      formatCurrencyPlain(totals.expense),
      formatCurrencyPlain(totals.income),
      formatCurrencyPlain(totals.finalBalance),
      ''
    ]);

    autoTable(doc, {
      head: [['Data', 'Conta', 'Categoria', 'Descrição', 'Saída', 'Entrada', 'Saldo', 'Usuário']],
      body: tableData,
      startY: 38,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] }, // Light gray for alternate rows
      bodyStyles: { fillColor: [255, 255, 255] }, // White for other rows
      foot: [[
        { content: `Saldo Inicial: ${formatCurrency(totals.initialBalance)}`, colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8 } },
        { content: `Total Entradas: ${formatCurrency(totals.income)}`, colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8 } },
        { content: `Total Saídas: ${formatCurrency(totals.expense)}`, colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8 } },
        { content: `Saldo Final: ${formatCurrency(totals.finalBalance)}`, colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8 } },
      ]],
      footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0] },
      didDrawPage: () => {
        // Footer on each page
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Copyright © Tai Finance', pageWidth / 2, pageHeight - 10, { align: 'center' });
      },
    });

    const fileName = `fluxo-financeiro_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
    
    toast({ title: 'PDF exportado com sucesso' });
  };

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
          <div className="flex flex-wrap gap-4 items-center justify-between">
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
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
              {formatCurrency(totals.income)}
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
          <Table wrapperClassName="max-h-[65vh] border rounded-md">
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
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
        </CardContent>
      </Card>

    </div>
  );
}
