import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, addMonths, subMonths, eachMonthOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePayablesReceivables } from '@/hooks/usePayablesReceivables';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PayablesReceivablesFlowPageProps {
  companyId: string;
}

type PeriodType = 'month' | 'quarter' | 'semester' | 'year';

export function PayablesReceivablesFlowPage({ companyId }: PayablesReceivablesFlowPageProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const { startDate, endDate, periodLabel } = useMemo(() => {
    let start: Date, end: Date, label: string;
    
    switch (periodType) {
      case 'month':
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        label = format(currentDate, 'MMMM yyyy', { locale: ptBR });
        break;
      case 'quarter':
        start = startOfQuarter(currentDate);
        end = endOfQuarter(currentDate);
        const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
        label = `${quarter}º Trimestre ${format(currentDate, 'yyyy')}`;
        break;
      case 'semester':
        const semester = currentDate.getMonth() < 6 ? 1 : 2;
        start = semester === 1 ? startOfYear(currentDate) : new Date(currentDate.getFullYear(), 6, 1);
        end = semester === 1 ? new Date(currentDate.getFullYear(), 5, 30) : endOfYear(currentDate);
        label = `${semester}º Semestre ${format(currentDate, 'yyyy')}`;
        break;
      case 'year':
        start = startOfYear(currentDate);
        end = endOfYear(currentDate);
        label = format(currentDate, 'yyyy');
        break;
      default:
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        label = format(currentDate, 'MMMM yyyy', { locale: ptBR });
    }
    
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      periodLabel: label
    };
  }, [currentDate, periodType]);

  const { payablesReceivables, loading } = usePayablesReceivables(companyId, {
    startDate,
    endDate
  });

  const chartData = useMemo(() => {
    if (periodType === 'month') {
      // Group by week
      const start = new Date(startDate);
      const end = new Date(endDate);
      const weeks = eachWeekOfInterval({ start, end }, { locale: ptBR });
      
      return weeks.map((weekStart, index) => {
        const weekEnd = endOfWeek(weekStart, { locale: ptBR });
        const weekRecords = payablesReceivables.filter(r => {
          const date = new Date(r.due_date);
          return date >= weekStart && date <= weekEnd;
        });
        
        const payable = weekRecords.filter(r => r.type === 'payable' && r.status === 'pending')
          .reduce((sum, r) => sum + Number(r.amount), 0);
        const receivable = weekRecords.filter(r => r.type === 'receivable' && r.status === 'pending')
          .reduce((sum, r) => sum + Number(r.amount), 0);
        
        return {
          name: `Sem ${index + 1}`,
          'A Pagar': payable,
          'A Receber': receivable,
          'Saldo': receivable - payable
        };
      });
    } else {
      // Group by month
      const start = new Date(startDate);
      const end = new Date(endDate);
      const months = eachMonthOfInterval({ start, end });
      
      return months.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthRecords = payablesReceivables.filter(r => {
          const date = new Date(r.due_date);
          return date >= monthStart && date <= monthEnd;
        });
        
        const payable = monthRecords.filter(r => r.type === 'payable' && r.status === 'pending')
          .reduce((sum, r) => sum + Number(r.amount), 0);
        const receivable = monthRecords.filter(r => r.type === 'receivable' && r.status === 'pending')
          .reduce((sum, r) => sum + Number(r.amount), 0);
        
        return {
          name: format(month, 'MMM', { locale: ptBR }),
          'A Pagar': payable,
          'A Receber': receivable,
          'Saldo': receivable - payable
        };
      });
    }
  }, [payablesReceivables, periodType, startDate, endDate]);

  const totals = useMemo(() => {
    const pending = payablesReceivables.filter(r => r.status === 'pending');
    const payable = pending.filter(r => r.type === 'payable').reduce((sum, r) => sum + Number(r.amount), 0);
    const receivable = pending.filter(r => r.type === 'receivable').reduce((sum, r) => sum + Number(r.amount), 0);
    return { payable, receivable, balance: receivable - payable };
  }, [payablesReceivables]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const months = periodType === 'month' ? 1 : periodType === 'quarter' ? 3 : periodType === 'semester' ? 6 : 12;
    setCurrentDate(direction === 'prev' ? subMonths(currentDate, months) : addMonths(currentDate, months));
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(chartData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fluxo');
    XLSX.writeFile(wb, `fluxo_financeiro_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Fluxo Financeiro - Contas a Pagar/Receber', 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${periodLabel}`, 14, 22);

    const tableData = chartData.map(row => [
      row.name,
      formatCurrency(row['A Pagar']),
      formatCurrency(row['A Receber']),
      formatCurrency(row['Saldo'])
    ]);

    (doc as any).autoTable({
      startY: 28,
      head: [['Período', 'A Pagar', 'A Receber', 'Saldo']],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`fluxo_financeiro_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-foreground">Fluxo de Contas a Pagar/Receber</h1>
        <div className="flex items-center gap-4">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mensal</SelectItem>
              <SelectItem value="quarter">Trimestral</SelectItem>
              <SelectItem value="semester">Semestral</SelectItem>
              <SelectItem value="year">Anual</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigatePeriod('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[150px] text-center">{periodLabel}</span>
            <Button variant="outline" size="icon" onClick={() => navigatePeriod('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={exportToPDF}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total a Pagar</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.payable)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total a Receber</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.receivable)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Saldo Previsto</p>
          <p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totals.balance)}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="A Pagar" fill="#ef4444" />
            <Bar dataKey="A Receber" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">A Pagar</TableHead>
              <TableHead className="text-right">A Receber</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chartData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right text-red-600">{formatCurrency(row['A Pagar'])}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(row['A Receber'])}</TableCell>
                <TableCell className={`text-right font-medium ${row['Saldo'] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(row['Saldo'])}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-muted/50">
              <TableCell>Total</TableCell>
              <TableCell className="text-right text-red-600">{formatCurrency(totals.payable)}</TableCell>
              <TableCell className="text-right text-green-600">{formatCurrency(totals.receivable)}</TableCell>
              <TableCell className={`text-right ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totals.balance)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
