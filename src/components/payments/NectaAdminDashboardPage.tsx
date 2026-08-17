import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { nectaCall, centsToBRL, brl } from '@/hooks/useNectaApi';
import { AlertTriangle, Building2, Loader2, RefreshCw, TrendingUp, Users, Activity } from 'lucide-react';

const firstDayOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export function NectaAdminDashboardPage() {
  const [start, setStart] = useState(firstDayOfMonth());
  const [end, setEnd] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [activeCompare, setActiveCompare] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, st, ac, rk, mt] = await Promise.all([
        nectaCall('/sales/summary', 'GET', undefined, { startDate: start, endDate: end }).catch(() => null),
        nectaCall('/establishments/stats').catch(() => null),
        nectaCall('/establishments/count-and-compare', 'GET', undefined, { startDate: start, endDate: end }).catch(() => null),
        nectaCall('/sales/monthly-ranking').catch(() => null),
        nectaCall('/sales/count-payment-methods', 'GET', undefined, { startDate: start, endDate: end }).catch(() => null),
      ]);
      setSummary(s); setStats(st); setActiveCompare(ac);
      setRanking((rk as any)?.data ?? []);
      setMethods((mt as any)?.methods ?? []);
      if (!s && !st && !rk) setError('Não foi possível consultar a API. Verifique as credenciais em Pagamentos → Configurações.');
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const cards = [
    { title: 'Receita consolidada', value: brl(centsToBRL(summary?.totalAmount)), hint: `${summary?.totalSales ?? 0} transações`, icon: <TrendingUp className="w-4 h-4" /> },
    { title: 'Estabelecimentos', value: stats?.total ?? 0, hint: `${stats?.activeTotal ?? 0} ativos · ${stats?.pendingTotal ?? 0} pendentes`, icon: <Building2 className="w-4 h-4" /> },
    { title: 'Ativos no período', value: activeCompare?.total ?? 0, hint: activeCompare?.previousTotal !== undefined ? `período anterior: ${activeCompare.previousTotal}` : undefined, icon: <Users className="w-4 h-4" /> },
    { title: 'Pagas', value: brl(centsToBRL(summary?.paid?.amount)), hint: `${summary?.paid?.count ?? 0} transações`, icon: <Activity className="w-4 h-4" /> },
    { title: 'Pendentes', value: brl(centsToBRL(summary?.pending?.amount)), hint: `${summary?.pending?.count ?? 0} transações`, icon: <Activity className="w-4 h-4" /> },
    { title: 'Estornadas', value: brl(centsToBRL(summary?.reverted?.amount)), hint: `${summary?.reverted?.count ?? 0} transações`, icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pagamentos — Dashboard geral</h1>
          <p className="text-muted-foreground text-sm">Consolidado de todos os estabelecimentos do marketplace</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">De</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-[150px]" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-[150px]" /></div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>{c.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              {c.hint && <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 5 estabelecimentos por receita no mês</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Estabelecimento</TableHead><TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Transações</TableHead><TableHead className="text-right">Crescimento</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ranking.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>}
              {ranking.map((r: any) => (
                <TableRow key={r.establishmentId}>
                  <TableCell>{r.establishmentName}</TableCell>
                  <TableCell className="text-right">{brl(centsToBRL(r.revenue))}</TableCell>
                  <TableCell className="text-right">{r.transactions}</TableCell>
                  <TableCell className="text-right">{Number(r.growth ?? 0).toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Volume por método de pagamento</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Método</TableHead><TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Qtde</TableHead><TableHead className="text-right">Participação</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {methods.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>}
              {methods.map((m: any) => (
                <TableRow key={m.type}>
                  <TableCell>{m.label ?? m.type}</TableCell>
                  <TableCell className="text-right">{brl(centsToBRL(m.total))}</TableCell>
                  <TableCell className="text-right">{m.quantity}</TableCell>
                  <TableCell className="text-right">{Number(m.percentage ?? 0).toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
