import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { nectaCall, centsToBRL, brl } from '@/hooks/useNectaApi';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Activity, TrendingUp, Receipt, CreditCard, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';

interface Props { companyId: string }

const firstDayOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2, 220 70% 50%))', 'hsl(var(--muted-foreground))', 'hsl(var(--destructive))'];

export function NectaDashboardPage({ companyId }: Props) {
  const [start, setStart] = useState(firstDayOfMonth());
  const [end, setEnd] = useState(today());
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [compare, setCompare] = useState<any>(null);
  const [methods, setMethods] = useState<any[]>([]);
  const [months, setMonths] = useState<any[]>([]);
  const [local, setLocal] = useState({ open: 0, openCount: 0, paid: 0, paidCount: 0, recurring: 0 });

  const loadLocal = useCallback(async () => {
    const { data } = await (supabase as any).from('necta_sales')
      .select('amount, status, is_recurring, paid_at').eq('company_id', companyId);
    const rows = data ?? [];
    const openRows = rows.filter((r: any) => ['pending', 'issued', 'overdue'].includes(r.status));
    const paidRows = rows.filter((r: any) => r.status === 'paid' && (r.paid_at ?? '') >= start);
    setLocal({
      open: openRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
      openCount: openRows.length,
      paid: paidRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
      paidCount: paidRows.length,
      recurring: rows.filter((r: any) => r.is_recurring).length,
    });
  }, [companyId, start]);

  const loadApi = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [s, c, m, mm] = await Promise.all([
        nectaCall('/sales/summary', 'GET', undefined, { startDate: start, endDate: end }).catch(() => null),
        nectaCall('/sales/count-and-compare', 'GET', undefined, { startDate: start, endDate: end }).catch(() => null),
        nectaCall('/sales/count-payment-methods', 'GET', undefined, { startDate: start, endDate: end }).catch(() => null),
        nectaCall('/sales/sale-per-month-and-progress').catch(() => null),
      ]);
      setSummary(s);
      setCompare(c);
      setMethods((m as any)?.methods ?? []);
      setMonths((mm as any)?.months ?? []);
      if (!s && !c && !m && !mm) setApiError('Não foi possível consultar a API de Pagamentos agora. Verifique as credenciais em Configurações (Modo Administrativo).');
    } catch (e) {
      setApiError((e as Error).message);
    }
    setLoading(false);
  }, [start, end]);

  useEffect(() => { loadLocal(); loadApi(); }, [loadLocal, loadApi]);

  const totalPeriod = compare ? centsToBRL(compare.total) : centsToBRL(summary?.totalAmount);
  const previousTotal = compare ? centsToBRL(compare.previousTotal) : 0;
  const variation = previousTotal > 0 ? ((totalPeriod - previousTotal) / previousTotal) * 100 : null;
  const salesCount = Number(summary?.totalSales ?? 0);
  const ticket = salesCount > 0 ? centsToBRL(summary?.totalAmount) / salesCount : 0;

  const cards = [
    { title: 'Receita no período', value: brl(totalPeriod), hint: variation !== null ? `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}% vs. período anterior` : undefined, icon: <TrendingUp className="w-4 h-4" /> },
    { title: 'Transações', value: salesCount, hint: `${centsToBRL(summary?.pending?.amount) ? brl(centsToBRL(summary?.pending?.amount)) : brl(0)} pendentes`, icon: <Activity className="w-4 h-4" /> },
    { title: 'Ticket médio', value: brl(ticket), icon: <CreditCard className="w-4 h-4" /> },
    { title: 'Cobranças em aberto', value: brl(local.open), hint: `${local.openCount} cobrança(s)`, icon: <Receipt className="w-4 h-4" /> },
    { title: 'Cobranças pagas', value: brl(local.paid), hint: `${local.paidCount} no período`, icon: <Receipt className="w-4 h-4" /> },
    { title: 'Cobranças recorrentes', value: local.recurring, icon: <RefreshCw className="w-4 h-4" /> },
  ];

  const monthData = months.map((m: any) => ({ label: m.label ?? m.month, total: centsToBRL(m.total) }));
  const pieData = methods.map((m: any) => ({ name: m.label ?? m.type, value: centsToBRL(m.total) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pagamentos — Dashboard</h1>
          <p className="text-muted-foreground text-sm">Performance da operação de pagamentos</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">De</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-[150px]" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-[150px]" /></div>
          <Button variant="outline" size="sm" onClick={() => { loadApi(); loadLocal(); }} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {apiError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
              {c.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              {c.hint && <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Receita por mês (últimos 6 meses)</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {monthData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => brl(Number(v)).replace('R$', '')} />
                  <ReTooltip formatter={(v) => brl(Number(v))} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por método</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <ReTooltip formatter={(v) => brl(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {summary && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo por situação (API)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm">
            {[['Pagas', summary.paid, 'default'], ['Pendentes', summary.pending, 'secondary'], ['Canceladas', summary.canceled, 'outline'], ['Estornadas', summary.reverted, 'destructive']].map(([label, obj, variant]: any) => (
              <Badge key={label} variant={variant} className="text-xs py-1">
                {label}: {obj?.count ?? 0} · {brl(centsToBRL(obj?.amount))}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
