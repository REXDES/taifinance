import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransfers } from '@/hooks/useTransfers';
import { usePatrimonialEvolution } from '@/hooks/usePatrimonialEvolution';
import { usePayablesReceivables } from '@/hooks/usePayablesReceivables';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Calendar, ChevronRight } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { startOfWeek, endOfWeek, format, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useShortcutCards } from '@/hooks/useShortcutUsage';
import { ShortcutTiles } from '@/components/finance/ShortcutTiles';
import { useAuth } from '@/contexts/AuthContext';
import type { FinanceView } from '@/pages/Finance';
import { parseLocalDate, formatLocalISO, todayISO } from '@/lib/dateUtils';
import { startDrillDown, type DrillRequest } from '@/lib/drillDown';
import { useViewMode } from '@/contexts/ViewModeContext';
import {
  addDaysISO,
  analyzeMonth,
  compareWithPreviousMonth,
  deltaTone,
  DUE_SOON_DAYS,
  formatBRDate,
  monthRange,
  fromISODate,
  percentChange,
  type CategoryShare,
  type Insight,
} from '@/lib/dashboardInsights';
import { DashboardVisual, type VisualTarget } from './dashboard/DashboardVisual';
import { DashboardAnalysis, DashboardAnalysisSkeleton } from './dashboard/DashboardAnalysis';
import { CategoryBreakdown } from './dashboard/CategoryBreakdown';
import { CompareLine, MarginLine } from './dashboard/CompareLine';

interface FinanceDashboardProps {
  companyId: string;
  onNavigate?: (view: FinanceView) => void;
}

export function FinanceDashboard({ companyId, onNavigate }: FinanceDashboardProps) {
  const { user } = useAuth();
  const { mode, atLeast } = useViewMode();
  const isVisual = mode === 'visual';
  const isDetailed = atLeast('detailed');
  const [showSubcategories, setShowSubcategories] = useState(false);
  const shortcuts = useShortcutCards(user?.id, companyId);
  const { accounts, groups, totalAtivo, totalPassivo, totalGeral, loading: accountsLoading } = useAccounts(companyId);
  
  const { categories } = useTransactionCategories(companyId);

  // Get current month transactions
  const now = new Date();
  const startOfMonth = formatLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const endOfMonth = formatLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  
  const { transactions, totalIncome, totalExpense, loading: transactionsLoading } = useTransactions(companyId, {
    startDate: startOfMonth,
    endDate: endOfMonth,
  });

  // Drill-down: clicar num card abre Lançamentos já filtrado pelo mesmo período e tipo,
  // levando o valor/contagem que a pessoa está vendo para a tela confirmar que bate.
  const monthLabel = format(now, "MMMM 'de' yyyy", { locale: ptBR });
  const openTransactions = (metric: 'income' | 'expense' | 'balance') => {
    if (!onNavigate || transactionsLoading) return;
    const income = transactions.filter((t) => t.type === 'income');
    const expense = transactions.filter((t) => t.type === 'expense');
    const spec = {
      income: { label: 'Receitas do Mês', description: `Receitas · ${monthLabel}`, type: 'income' as const, value: totalIncome, count: income.length },
      expense: { label: 'Despesas do Mês', description: `Despesas · ${monthLabel}`, type: 'expense' as const, value: totalExpense, count: expense.length },
      balance: { label: 'Balanço do Mês', description: `Receitas e despesas · ${monthLabel}`, type: undefined, value: totalIncome - totalExpense, count: transactions.length },
    }[metric];
    startDrillDown({
      scope: 'transactions',
      filters: { startDate: startOfMonth, endDate: endOfMonth, type: spec.type },
      description: spec.description,
      origin: { label: spec.label, metric, value: spec.value, count: spec.count },
    });
    onNavigate('transactions');
  };
  const drillCard = (metric: 'income' | 'expense' | 'balance') =>
    onNavigate
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onClick: () => openTransactions(metric),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openTransactions(metric);
            }
          },
          className: 'group cursor-pointer transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        }
      : {};
  const drillHint = onNavigate ? (
    <p className="mt-2 flex items-center gap-0.5 text-xs text-muted-foreground transition-colors group-hover:text-primary">
      Ver os lançamentos <ChevronRight className="h-3 w-3" aria-hidden />
    </p>
  ) : null;

  // Get all transactions and transfers for evolution chart
  const { transactions: allTransactions, loading: allTxLoading } = useTransactions(companyId);
  const { transfers, loading: transfersLoading } = useTransfers(companyId);

  // Get week payables/receivables
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const { payablesReceivables: weekPR, loading: prLoading } = usePayablesReceivables(companyId, {
    startDate: format(weekStart, 'yyyy-MM-dd'),
    endDate: format(weekEnd, 'yyyy-MM-dd'),
    status: ['pending']
  });

  // Descritivo: contas em aberto (atrasadas, dos próximos dias e até o fim do mês) para a previsão
  // e os alertas. Fora do Descritivo o companyId vai nulo e a consulta nem é feita.
  const todayStr = todayISO();
  const soonLimit = addDaysISO(todayStr, DUE_SOON_DAYS);
  const { payablesReceivables: openItems, loading: openLoading } = usePayablesReceivables(
    isDetailed ? companyId : null,
    { status: ['pending'], endDate: endOfMonth > soonLimit ? endOfMonth : soonLimit },
  );

  // Group week payables/receivables by day
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekData = weekDays.map(day => {
    const dayItems = weekPR.filter(item => isSameDay(parseLocalDate(item.due_date), day));
    const payable = dayItems.filter(i => i.type === 'payable').reduce((sum, i) => sum + Number(i.amount), 0);
    const receivable = dayItems.filter(i => i.type === 'receivable').reduce((sum, i) => sum + Number(i.amount), 0);
    return {
      day,
      dayLabel: format(day, 'EEE', { locale: ptBR }),
      dayNumber: format(day, 'd'),
      payable,
      receivable,
      items: dayItems
    };
  });

  // Calculate patrimonial evolution
  const patrimonialData = usePatrimonialEvolution({
    accounts,
    groups,
    transactions: allTransactions,
    transfers,
    monthsBack: 6,
  });

  // Top expenses by subcategory (or category when no subcategory) – current month
  const topExpenses = (() => {
    const map = new Map<string, { name: string; value: number; color: string; budget: number; categoryId?: string; hasSub: boolean }>();
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const categoryName = t.category?.name;
        const subName = showSubcategories ? t.subcategory?.name : undefined;
        const name = subName
          ? (categoryName ? `${categoryName}/${subName}` : subName)
          : (categoryName || 'Sem categoria');
        const color = t.category?.color || '#8B5CF6';
        const key = name;
        const existing = map.get(key);
        if (existing) {
          existing.value += Number(t.amount);
        } else {
          map.set(key, {
            name,
            value: Number(t.amount),
            color,
            budget: 0,
            categoryId: (t as any).category_id,
            hasSub: !!subName,
          });
        }
      });
    // Attach category budget as reference on every bar belonging to a category with budget
    const result = Array.from(map.values()).map((item) => {
      if (item.categoryId) {
        const cat = categories.find((c) => c.id === item.categoryId);
        if (cat?.monthly_budget) item.budget = Number(cat.monthly_budget);
      }
      return item;
    });
    return result
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  })();

  const topExpensesMax = Math.max(
    1,
    ...topExpenses.flatMap((e) => [e.value, e.budget || 0])
  );



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

  const loading = accountsLoading || transactionsLoading || allTxLoading || transfersLoading || prLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ---- Visual e Descritivo: comparação com o mês anterior, análise e navegação por drill-down.
  // (O Balanceado é o dashboard de sempre e não usa nada disto.)
  const month = monthRange(fromISODate(todayStr), 0);
  // Mês em andamento x o MESMO trecho do mês anterior (dias 1 a N): comparar com o mês anterior
  // inteiro faria quase toda despesa parecer "em queda" nos primeiros dias do mês.
  const comparison = isVisual || isDetailed ? compareWithPreviousMonth(allTransactions, todayStr) : null;
  const incomeChange = comparison ? percentChange(comparison.current.income, comparison.previous.income) : null;
  const expenseChange = comparison ? percentChange(comparison.current.expense, comparison.previous.expense) : null;
  const incomeCount = transactions.filter((t) => t.type === 'income').length;
  const expenseCount = transactions.length - incomeCount;

  const analysis = isDetailed
    ? analyzeMonth({
        today: todayStr,
        monthTransactions: transactions,
        allTransactions,
        comparison,
        income: totalIncome,
        expense: totalExpense,
        incomeCount,
        expenseCount,
        openItems,
      })
    : null;

  const openDrill = (request: DrillRequest) => {
    if (!onNavigate) return;
    startDrillDown(request);
    onNavigate(request.scope === 'transactions' ? 'transactions' : 'payables-receivables');
  };

  const openPayables = (
    type: 'payable' | 'receivable',
    range: { startDate: string; endDate: string },
    description: string,
    label: string,
    figure: { total: number; count: number },
  ) =>
    openDrill({
      scope: 'payables-receivables',
      filters: { ...range, type, status: ['pending'] },
      description,
      origin: { label, metric: type === 'payable' ? 'payable-open' : 'receivable-open', value: figure.total, count: figure.count },
    });

  const weekFigure = (type: 'payable' | 'receivable') => {
    const items = weekPR.filter((i) => i.type === type);
    return { total: items.reduce((sum, i) => sum + Number(i.amount ?? 0), 0), count: items.length };
  };

  const openWeek = (type: 'payable' | 'receivable') =>
    openPayables(
      type,
      { startDate: format(weekStart, 'yyyy-MM-dd'), endDate: format(weekEnd, 'yyyy-MM-dd') },
      `${type === 'payable' ? 'Contas a pagar' : 'Contas a receber'} · semana de ${format(weekStart, 'dd/MM')} a ${format(weekEnd, 'dd/MM')}`,
      type === 'payable' ? 'A pagar na semana' : 'A receber na semana',
      weekFigure(type),
    );

  const openProjectionBucket = (type: 'payable' | 'receivable') => {
    const figure = analysis?.projection?.[type];
    if (!figure) return;
    openPayables(
      type,
      { startDate: '', endDate: month.end },
      `${type === 'payable' ? 'Contas a pagar' : 'Contas a receber'} em aberto · vencimento até ${formatBRDate(month.end)}`,
      type === 'payable' ? 'A pagar até o fim do mês' : 'A receber até o fim do mês',
      figure,
    );
  };

  const openCategory = (row: CategoryShare) => {
    if (!row.categoryId) return;
    openDrill({
      scope: 'transactions',
      filters: { startDate: month.start, endDate: month.end, type: 'expense', categoryId: row.categoryId },
      description: `Despesas · ${row.name} · ${month.label}`,
      origin: { label: `Despesas — ${row.name}`, metric: 'expense', value: row.value, count: row.count },
    });
  };

  const openInsight = (insight: Insight) => {
    if (insight.drill) openDrill(insight.drill);
  };

  const handleVisualSelect = (target: VisualTarget) => {
    if (!onNavigate) return;
    if (target === 'accounts') onNavigate('accounts');
    else if (target === 'week-payable') openWeek('payable');
    else if (target === 'week-receivable') openWeek('receivable');
    else openTransactions(target);
  };

  if (isVisual) {
    return (
      <DashboardVisual
        monthLabel={monthLabel}
        shortcuts={onNavigate ? <ShortcutTiles shortcuts={shortcuts} onNavigate={onNavigate} compact /> : undefined}
        balance={totalAtivo}
        trend={patrimonialData.map((point) => point.ativo)}
        income={{ value: totalIncome, delta: { change: incomeChange, tone: deltaTone('income', incomeChange), reference: comparison?.reference } }}
        expense={{ value: totalExpense, delta: { change: expenseChange, tone: deltaTone('expense', expenseChange), reference: comparison?.reference } }}
        result={{ value: totalIncome - totalExpense }}
        week={{ payable: weekFigure('payable'), receivable: weekFigure('receivable') }}
        onSelect={onNavigate ? handleVisualSelect : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das suas finanças</p>
      </div>

      {/* Atalhos — funções mais usadas pelo usuário (padrões até haver histórico) */}
      {onNavigate && <ShortcutTiles shortcuts={shortcuts} onNavigate={onNavigate} />}


      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Ativo</CardTitle>
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

        <Card {...drillCard('income')}>
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
            {isDetailed && comparison && (
              <CompareLine
                change={incomeChange}
                tone={deltaTone('income', incomeChange)}
                label={comparison.label}
                previousValue={comparison.previous.income}
                reference={comparison.reference}
              />
            )}
            {drillHint}
          </CardContent>
        </Card>

        <Card {...drillCard('expense')}>
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
            {isDetailed && comparison && (
              <CompareLine
                change={expenseChange}
                tone={deltaTone('expense', expenseChange)}
                label={comparison.label}
                previousValue={comparison.previous.expense}
                reference={comparison.reference}
              />
            )}
            {drillHint}
          </CardContent>
        </Card>

        <Card {...drillCard('balance')}>
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
            {isDetailed && (
              <MarginLine
                income={totalIncome}
                balance={totalIncome - totalExpense}
                previousLabel={comparison?.label ?? null}
                previousBalance={comparison ? comparison.previous.income - comparison.previous.expense : null}
              />
            )}
            {drillHint}
          </CardContent>
        </Card>
      </div>

      {/* Descritivo: resumo em texto, previsão do mês e sugestões */}
      {isDetailed &&
        (openLoading ? (
          <DashboardAnalysisSkeleton />
        ) : (
          analysis && (
            <DashboardAnalysis
              summary={analysis.summary}
              projection={analysis.projection}
              insights={analysis.insights}
              onOpenInsight={onNavigate ? openInsight : undefined}
              onOpenBucket={onNavigate ? openProjectionBucket : undefined}
            />
          )
        ))}

      {/* Week Payables/Receivables */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Contas da Semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekData.map(({ day, dayLabel, dayNumber, payable, receivable, items }) => {
              const isToday = isSameDay(day, now);
              return (
                <div
                  key={dayNumber}
                  className={`p-2 rounded-lg border text-center ${
                    isToday ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <p className={`text-xs font-medium uppercase ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {dayLabel}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {dayNumber}
                  </p>
                  {items.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {receivable > 0 && (
                        <p className="text-xs text-green-600 font-medium">
                          +{formatCurrencyShort(receivable)}
                        </p>
                      )}
                      {payable > 0 && (
                        <p className="text-xs text-red-600 font-medium">
                          -{formatCurrencyShort(payable)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">-</p>
                  )}
                </div>
              );
            })}
          </div>
          {weekPR.length === 0 && (
            <p className="text-muted-foreground text-center py-2 text-sm">
              Nenhuma conta pendente esta semana.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top Expenses Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-4">
          <CardTitle>Maiores Despesas do Mês</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="toggle-subcategories"
              checked={showSubcategories}
              onCheckedChange={setShowSubcategories}
            />
            <Label htmlFor="toggle-subcategories" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
              Detalhar subcategorias
            </Label>
          </div>
        </CardHeader>
        <CardContent>
          {topExpenses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma despesa registrada neste mês.
            </p>
          ) : (
            <div style={{ height: Math.max(220, topExpenses.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topExpenses}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis
                    type="number"
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatCurrencyShort}
                    domain={[0, topExpensesMax]}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                    width={140}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p: any = payload[0].payload;
                      const over = p.budget > 0 && p.value > p.budget;
                      const diff = p.budget > 0 ? Math.abs(p.value - p.budget) : 0;
                      return (
                        <div className="rounded-md border bg-card p-2 text-xs shadow-md">
                          <div className="font-medium mb-1">{p.name}</div>
                          <div>Despesa: {formatCurrency(p.value)}</div>
                          {p.budget > 0 && (
                            <>
                              <div>Orçamento: {formatCurrency(p.budget)}</div>
                              <div className={over ? 'text-destructive font-medium' : 'text-primary font-medium'}>
                                {over ? `Excedente: ${formatCurrency(diff)}` : `Disponível: ${formatCurrency(diff)}`}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name="Despesa"
                    radius={[0, 4, 4, 0]}
                    background={{ fill: 'transparent' }}
                    shape={(props: any) => {
                      const { x, y, width, height, fill, payload, background } = props;
                      const fullW = background?.width ?? width;
                      const baseX = background?.x ?? x;
                      const budget = payload?.budget ?? 0;
                      const over = budget > 0 && payload.value > budget;
                      return (
                        <g>
                          <rect x={x} y={y} width={Math.max(0, width)} height={height} fill={fill} rx={4} ry={4} />
                          {budget > 0 && (() => {
                            const bx = baseX + (budget / topExpensesMax) * fullW;
                            return (
                              <g>
                                <line
                                  x1={bx}
                                  x2={bx}
                                  y1={y - 4}
                                  y2={y + height + 4}
                                  stroke={over ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                                  strokeWidth={2}
                                  strokeDasharray="4 3"
                                />
                                <circle cx={bx} cy={y - 4} r={2.5} fill={over ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                              </g>
                            );
                          })()}
                        </g>
                      );
                    }}
                  >
                    {topExpenses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>

                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Descritivo: peso de cada categoria nas despesas, com variação sobre o mês anterior */}
      {isDetailed && analysis && (
        <CategoryBreakdown
          rows={analysis.categories}
          comparisonReference={comparison?.reference ?? null}
          partial={comparison?.partial ?? false}
          monthLabel={monthLabel}
          onSelect={onNavigate ? openCategory : undefined}
        />
      )}

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
                      <p className="font-medium text-foreground">{transaction.subcategory?.name || transaction.category?.name || transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {parseLocalDate(transaction.date).toLocaleDateString('pt-BR')} • {transaction.account?.name}
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
