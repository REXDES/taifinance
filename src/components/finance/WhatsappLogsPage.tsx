import { useMemo, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { useWhatsappLogs } from '@/hooks/useWhatsappLogs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, MessageCircle, RefreshCw, XCircle } from 'lucide-react';
import { formatLocalISO, parseLocalDate } from '@/lib/dateUtils';

interface Props { companyId: string }

const KIND_LABEL: Record<string, string> = {
  charge: 'Cobrança (Pagamentos)',
  pix: 'Cobrança PIX',
  reminder: 'Lembrete de vencimento',
  task: 'Lembrete de tarefa',
  text: 'Mensagem avulsa',
  test: 'Teste de conexão',
  gateway_reminder: 'Lembrete pelo gateway (solicitado)',
};

export function WhatsappLogsPage({ companyId }: Props) {
  const [startDate, setStartDate] = useState(formatLocalISO(startOfMonth(new Date())));
  const [endDate, setEndDate] = useState(formatLocalISO(new Date()));
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { logs, loading, refetch } = useWhatsappLogs(companyId, {
    startDate, endDate, kind, status, search,
  });

  const totals = useMemo(() => ({
    total: logs.length,
    success: logs.filter(l => l.success).length,
    failed: logs.filter(l => !l.success).length,
  }), [logs]);

  const formatDateTime = (value: string) => {
    const d = new Date(value);
    return isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy HH:mm');
  };

  const formatPhone = (phone: string) => {
    const n = String(phone).replace(/\D/g, '');
    const local = n.startsWith('55') ? n.slice(2) : n;
    if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    return phone;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          Envios por WhatsApp
        </h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Mensagens no período</p>
            <p className="text-2xl font-bold">{totals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Enviadas com sucesso</p>
            <p className="text-2xl font-bold text-emerald-600">{totals.success}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Com falha</p>
            <p className="text-2xl font-bold text-destructive">{totals.failed}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(KIND_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Resultado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Enviadas</SelectItem>
                <SelectItem value="failed">Com falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              placeholder="Nome, telefone ou descrição"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Carregando envios...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum envio no período selecionado.
                  </TableCell>
                </TableRow>
              ) : logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(log.created_at)}</TableCell>
                  <TableCell className="text-sm">{KIND_LABEL[log.kind] ?? log.kind}</TableCell>
                  <TableCell className="text-sm">{log.recipient_name || '—'}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatPhone(log.recipient_phone)}</TableCell>
                  <TableCell className="text-sm max-w-[260px] truncate" title={log.description ?? ''}>
                    {log.description || '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap">
                    {log.amount != null
                      ? `R$ ${Number(log.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {log.success ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Enviada
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-destructive/10 text-destructive border-destructive/20"
                        title={log.error_message ?? ''}
                      >
                        <XCircle className="w-3 h-3 mr-1" /> Falhou
                      </Badge>
                    )}
                    {!log.success && log.error_message && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-[260px] line-clamp-2">
                        {log.error_message}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
