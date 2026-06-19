import { useState, useMemo, useEffect } from 'react';
import { TagPicker } from './TagPicker';
import TagBadges from './TagBadges';
import { findRecordIdsByTags, fetchTagsForRecords } from '@/hooks/useFinanceTags';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { usePayablesReceivables } from '@/hooks/usePayablesReceivables';
import { useUsers } from '@/hooks/useUsers';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PayablesReceivablesReportPageProps {
  companyId: string;
}

export function PayablesReceivablesReportPage({ companyId }: PayablesReceivablesReportPageProps) {
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    type: '' as '' | 'payable' | 'receivable',
    status: [] as ('pending' | 'paid' | 'cancelled')[]
  });

  const { payablesReceivables, loading, totalPayable, totalReceivable } = usePayablesReceivables(companyId, {
    startDate: filters.startDate,
    endDate: filters.endDate,
    type: filters.type || undefined,
    status: filters.status.length > 0 ? filters.status : undefined
  });

  const { users } = useUsers(companyId);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [allowedIds, setAllowedIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (filterTagIds.length === 0) { setAllowedIds(null); return; }
    findRecordIdsByTags('payable_receivable', filterTagIds)
      .then(ids => { if (!cancelled) setAllowedIds(new Set(ids)); })
      .catch(() => { if (!cancelled) setAllowedIds(new Set()); });
    return () => { cancelled = true; };
  }, [filterTagIds.join(',')]);

  const displayedRecords = useMemo(() => {
    if (!allowedIds) return payablesReceivables;
    return payablesReceivables.filter(r => allowedIds.has(r.id));
  }, [payablesReceivables, allowedIds]);

  const [rowTags, setRowTags] = useState<Record<string, any[]>>({});
  useEffect(() => {
    let cancelled = false;
    const ids = payablesReceivables.map(r => r.id);
    if (ids.length === 0) { setRowTags({}); return; }
    fetchTagsForRecords('payable_receivable', ids).then(m => { if (!cancelled) setRowTags(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [payablesReceivables]);


  const getUserName = (userId: string | null) => {
    if (!userId) return '-';
    const user = users.find(u => u.user_id === userId);
    return user?.full_name || user?.email || '-';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'paid': return 'Pago';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'payable' ? 'A Pagar' : 'A Receber';
  };

  const exportToExcel = () => {
    const data = payablesReceivables.map(record => ({
      'Vencimento': format(new Date(record.due_date), 'dd/MM/yyyy'),
      'Tipo': getTypeLabel(record.type),
      'Descrição': record.description,
      'Cliente/Fornecedor': record.client_supplier?.name || '-',
      'Categoria': record.category?.name || '-',
      'Valor': Number(record.amount),
      'Status': getStatusLabel(record.status),
      'Data Pagamento': record.paid_date ? format(new Date(record.paid_date), 'dd/MM/yyyy') : '-',
      'Valor Pago': record.paid_amount || '-',
      'Criado por': getUserName(record.created_by),
      'Efetivado por': getUserName(record.paid_by)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contas');
    XLSX.writeFile(wb, `contas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Relatório de Contas a Pagar/Receber', 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${format(new Date(filters.startDate), 'dd/MM/yyyy')} a ${format(new Date(filters.endDate), 'dd/MM/yyyy')}`, 14, 22);

    const tableData = payablesReceivables.map(record => [
      format(new Date(record.due_date), 'dd/MM/yyyy'),
      getTypeLabel(record.type),
      record.description,
      record.client_supplier?.name || '-',
      formatCurrency(Number(record.amount)),
      getStatusLabel(record.status)
    ]);

    (doc as any).autoTable({
      startY: 28,
      head: [['Vencimento', 'Tipo', 'Descrição', 'Cliente/Forn.', 'Valor', 'Status']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`contas_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Relatório de Contas a Pagar/Receber</h1>
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

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Data Inicial</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <Label>Data Final</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={filters.type || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, type: v === "all" ? "" : v as any }))}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="payable">A Pagar</SelectItem>
                <SelectItem value="receivable">A Receber</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <div className="flex flex-wrap gap-3 mt-2">
              {[
                { value: 'pending', label: 'Pendente' },
                { value: 'paid', label: 'Pago' },
                { value: 'cancelled', label: 'Cancelado' }
              ].map((status) => (
                <div key={status.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`report-status-${status.value}`}
                    checked={filters.status.includes(status.value as any)}
                    onCheckedChange={(checked) => {
                      const newStatus = checked 
                        ? [...filters.status, status.value as 'pending' | 'paid' | 'cancelled']
                        : filters.status.filter(s => s !== status.value);
                      setFilters(prev => ({ ...prev, status: newStatus }));
                    }}
                  />
                  <label
                    htmlFor={`report-status-${status.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {status.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total a Pagar</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPayable)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total a Receber</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceivable)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className={`text-2xl font-bold ${totalReceivable - totalPayable >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalReceivable - totalPayable)}
          </p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Cliente/Fornecedor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado por</TableHead>
              <TableHead>Efetivado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nenhuma conta encontrada
                </TableCell>
              </TableRow>
            ) : (
              displayedRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{format(new Date(record.due_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={record.type === 'payable' ? 'text-red-600' : 'text-green-600'}>
                      {getTypeLabel(record.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{record.description}</TableCell>
                  <TableCell>{record.client_supplier?.name || '-'}</TableCell>
                  <TableCell>{record.category?.name || '-'}</TableCell>
                  <TableCell className={record.type === 'payable' ? 'text-red-600' : 'text-green-600'}>
                    {formatCurrency(Number(record.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      record.status === 'paid' ? 'text-green-600' :
                      record.status === 'cancelled' ? 'text-red-600' : 'text-yellow-600'
                    }>
                      {getStatusLabel(record.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{getUserName(record.created_by)}</TableCell>
                  <TableCell>{getUserName(record.paid_by)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
