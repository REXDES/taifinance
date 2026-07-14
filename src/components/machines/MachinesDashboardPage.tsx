import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import {
  Truck, Wrench, CheckCircle2, Trash2, DollarSign, Package,
  TrendingUp, Calendar, AlertTriangle, Activity,
} from 'lucide-react';
import { useMachines, useRentals, useMachineCategories, useMachineTypes } from '@/hooks/useMachinesModule';

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const pct = (n: number) => `${n.toFixed(1)}%`;

interface Props { companyId: string; }

export function MachinesDashboardPage({ companyId }: Props) {
  const { machines, loading: mLoad } = useMachines(companyId);
  const { rentals, loading: rLoad } = useRentals(companyId);
  const { categories } = useMachineCategories(companyId);
  const { types } = useMachineTypes(companyId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const stats = useMemo(() => {
    const total = machines.length;
    const rented = machines.filter(m => m.status === 'locada').length;
    const available = machines.filter(m => m.status === 'disponivel').length;
    const reserved = machines.filter(m => m.status === 'reservada').length;
    const sold = machines.filter(m => m.status === 'vendida').length;
    const demo = machines.filter(m => m.status === 'demonstracao').length;
    const unavailable = machines.filter(m => m.status === 'indisponivel').length;

    const operational = machines.filter(m => (m as any).technical_status === 'operacional' || !(m as any).technical_status).length;
    const inMaintenance = machines.filter(m => (m as any).technical_status === 'em_manutencao').length;
    const inTest = machines.filter(m => (m as any).technical_status === 'em_teste').length;
    const discard = machines.filter(m => (m as any).technical_status === 'descarte').length;

    const totalValue = machines.reduce((s, m) => s + Number(m.acquisition_value || 0), 0);
    const rentedValue = machines.filter(m => m.status === 'locada').reduce((s, m) => s + Number(m.acquisition_value || 0), 0);
    const maintenanceValue = machines.filter(m => (m as any).technical_status === 'em_manutencao').reduce((s, m) => s + Number(m.acquisition_value || 0), 0);
    const availableValue = machines.filter(m => m.status === 'disponivel').reduce((s, m) => s + Number(m.acquisition_value || 0), 0);

    const pctRented = total ? (rented / total) * 100 : 0;
    const pctMaintenance = total ? (inMaintenance / total) * 100 : 0;
    const pctOperational = total ? (operational / total) * 100 : 0;
    const pctAvailable = total ? (available / total) * 100 : 0;

    // Active rentals overlapping current month
    const activeRentals = rentals.filter(r => {
      if (r.status !== 'active') return false;
      const s = new Date(r.start_date + 'T00:00:00');
      const e = r.end_date ? new Date(r.end_date + 'T00:00:00') : monthEnd;
      return s <= monthEnd && e >= monthStart;
    });

    const monthReceivable = activeRentals.reduce((s, r) => {
      const total = Number(r.total_amount || 0);
      if (r.payment_mode === 'installments' && r.installments_count && r.installments_count > 0) {
        return s + total / r.installments_count;
      }
      // cash: allocate if start_date within month
      const sd = new Date(r.start_date + 'T00:00:00');
      if (sd >= monthStart && sd <= monthEnd) return s + total;
      return s;
    }, 0);

    const activeRentalsTotal = activeRentals.reduce((s, r) => s + Number(r.total_amount || 0), 0);

    // By category (uses machines.category text)
    const byCategory: Record<string, number> = {};
    machines.forEach(m => {
      const key = (m as any).category || 'Sem categoria';
      byCategory[key] = (byCategory[key] || 0) + 1;
    });

    // By type
    const typeMap = new Map(types.map(t => [t.id, t.name]));
    const byType: Record<string, number> = {};
    machines.forEach(m => {
      const key = m.type_id ? (typeMap.get(m.type_id) || 'Sem tipo') : 'Sem tipo';
      byType[key] = (byType[key] || 0) + 1;
    });

    return {
      total, rented, available, reserved, sold, demo,
      operational, inMaintenance, inTest, discard,
      totalValue, rentedValue, maintenanceValue, availableValue,
      pctRented, pctMaintenance, pctOperational, pctAvailable,
      activeRentalsCount: activeRentals.length,
      monthReceivable, activeRentalsTotal,
      byCategory, byType,
    };
  }, [machines, rentals, types, monthStart.getTime(), monthEnd.getTime()]);

  if (mLoad || rLoad) {
    return <div className="p-6 text-muted-foreground">Carregando dashboard…</div>;
  }

  const kpi = (icon: React.ReactNode, label: string, value: string | number, sub?: string, tone?: string) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${tone || ''}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard - Máquinas & Locação</h1>
        <p className="text-sm text-muted-foreground">Visão geral do inventário, status operacional e locações vigentes</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpi(<Package className="w-6 h-6" />, 'Total de Itens', stats.total)}
        {kpi(<Truck className="w-6 h-6 text-blue-500" />, 'Locados', stats.rented, pct(stats.pctRented))}
        {kpi(<CheckCircle2 className="w-6 h-6 text-green-500" />, 'Operacionais', stats.operational, pct(stats.pctOperational))}
        {kpi(<Wrench className="w-6 h-6 text-orange-500" />, 'Em Manutenção', stats.inMaintenance, pct(stats.pctMaintenance))}
        {kpi(<Activity className="w-6 h-6 text-purple-500" />, 'Em Teste', stats.inTest)}
        {kpi(<Trash2 className="w-6 h-6 text-red-500" />, 'Descarte', stats.discard)}
      </div>

      {/* Valores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi(<DollarSign className="w-6 h-6" />, 'Valor Total do Inventário', brl(stats.totalValue))}
        {kpi(<DollarSign className="w-6 h-6 text-blue-500" />, 'Valor dos Itens Locados', brl(stats.rentedValue))}
        {kpi(<DollarSign className="w-6 h-6 text-orange-500" />, 'Valor em Manutenção', brl(stats.maintenanceValue))}
        {kpi(<DollarSign className="w-6 h-6 text-green-500" />, 'Valor Disponível', brl(stats.availableValue))}
      </div>

      {/* Locações do mês */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {kpi(<Calendar className="w-6 h-6 text-green-500" />, 'A Receber no Mês', brl(stats.monthReceivable), 'Locações vigentes no mês corrente')}
        {kpi(<TrendingUp className="w-6 h-6" />, 'Locações Ativas', stats.activeRentalsCount, `Total contratado: ${brl(stats.activeRentalsTotal)}`)}
        {kpi(<Package className="w-6 h-6" />, 'Disponíveis', stats.available, pct(stats.pctAvailable))}
      </div>

      {/* Status do inventário */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Status de Locação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Locadas" count={stats.rented} total={stats.total} color="bg-blue-500" />
            <StatusBar label="Disponíveis" count={stats.available} total={stats.total} color="bg-green-500" />
            <StatusBar label="Reservadas" count={stats.reserved} total={stats.total} color="bg-yellow-500" />
            <StatusBar label="Demonstração" count={stats.demo} total={stats.total} color="bg-purple-500" />
            <StatusBar label="Vendidas" count={stats.sold} total={stats.total} color="bg-gray-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status Técnico</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Operacionais" count={stats.operational} total={stats.total} color="bg-green-500" />
            <StatusBar label="Em Manutenção" count={stats.inMaintenance} total={stats.total} color="bg-orange-500" />
            <StatusBar label="Em Teste" count={stats.inTest} total={stats.total} color="bg-purple-500" />
            <StatusBar label="Descarte" count={stats.discard} total={stats.total} color="bg-red-500" />
          </CardContent>
        </Card>
      </div>

      {/* Por categoria e tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Itens por Categoria</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(stats.byCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between p-2 rounded-md bg-accent/40">
                      <span className="text-sm font-medium">{cat}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Itens por Tipo</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(stats.byType).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum tipo cadastrado</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {Object.entries(stats.byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([t, count]) => (
                    <div key={t} className="flex items-center justify-between p-2 rounded-md bg-accent/40">
                      <span className="text-sm font-medium">{t}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.discard > 0 && (
        <Card className="border-red-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-medium">Atenção: {stats.discard} {stats.discard === 1 ? 'item marcado' : 'itens marcados'} para descarte</p>
              <p className="text-xs text-muted-foreground">Revise o inventário para baixa contábil</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const p = total ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">{count} · {p.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
