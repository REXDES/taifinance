import { useState, useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp, ArrowUpDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CategoryReportPageProps {
  companyId: string;
}

type ReportType = 'expense' | 'income' | 'all';
type PeriodType = 'current' | 'previous' | 'custom' | 'compare';

interface CategorySummary {
  id: string;
  name: string;
  color: string;
  type: string;
  total: number;
  budget?: number | null;
  subcategories: SubcategorySummary[];
}

interface SubcategorySummary {
  id: string;
  name: string;
  total: number;
}

interface PeriodData {
  label: string;
  startDate: string;
  endDate: string;
  categories: CategorySummary[];
  totalIncome: number;
  totalExpense: number;
}

export function CategoryReportPage({ companyId }: CategoryReportPageProps) {
  const [reportType, setReportType] = useState<ReportType>('expense');
  const [periodType, setPeriodType] = useState<PeriodType>('current');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string> | null>(null);
  const [hasInitializedExpanded, setHasInitializedExpanded] = useState(false);

  // Calculate date ranges based on period type
  const { currentPeriod, previousPeriod } = useMemo(() => {
    const now = new Date();
    const currentStart = startOfMonth(now);
    const currentEnd = endOfMonth(now);
    const previousStart = startOfMonth(subMonths(now, 1));
    const previousEnd = endOfMonth(subMonths(now, 1));

    return {
      currentPeriod: {
        start: format(currentStart, 'yyyy-MM-dd'),
        end: format(currentEnd, 'yyyy-MM-dd'),
        label: format(currentStart, 'MMMM yyyy', { locale: ptBR }),
      },
      previousPeriod: {
        start: format(previousStart, 'yyyy-MM-dd'),
        end: format(previousEnd, 'yyyy-MM-dd'),
        label: format(previousStart, 'MMMM yyyy', { locale: ptBR }),
      },
    };
  }, []);

  // Determine filter dates
  const filterDates = useMemo(() => {
    if (periodType === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    if (periodType === 'previous') {
      return { startDate: previousPeriod.start, endDate: previousPeriod.end };
    }
    // current or compare - fetch all transactions (we'll filter in useMemo)
    if (periodType === 'compare') {
      return { startDate: previousPeriod.start, endDate: currentPeriod.end };
    }
    return { startDate: currentPeriod.start, endDate: currentPeriod.end };
  }, [periodType, customStartDate, customEndDate, currentPeriod, previousPeriod]);

  const { transactions, loading } = useTransactions(companyId, {
    startDate: filterDates.startDate,
    endDate: filterDates.endDate,
    type: reportType !== 'all' ? reportType : undefined,
  });

  const { categories } = useTransactionCategories(companyId);

  // Build report data
  const reportData = useMemo((): PeriodData[] => {
    const buildPeriodData = (
      txs: typeof transactions,
      label: string,
      startDate: string,
      endDate: string
    ): PeriodData => {
      const categoryMap = new Map<string, CategorySummary>();

      // Initialize categories
      categories.forEach((cat) => {
        if (reportType !== 'all' && cat.type !== reportType && cat.type !== 'both') return;
        categoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          type: cat.type,
          total: 0,
          budget: cat.monthly_budget,
          subcategories: [],
        });
      });

      // Aggregate transactions
      const subcatTotals = new Map<string, { name: string; total: number; categoryId: string }>();

      txs.forEach((t) => {
        if (!t.category_id) return;
        const cat = categoryMap.get(t.category_id);
        if (!cat) return;

        cat.total += t.amount;

        if (t.subcategory_id && t.subcategory) {
          const existing = subcatTotals.get(t.subcategory_id);
          if (existing) {
            existing.total += t.amount;
          } else {
            subcatTotals.set(t.subcategory_id, {
              name: t.subcategory.name,
              total: t.amount,
              categoryId: t.category_id,
            });
          }
        }
      });

      // Add subcategories to their categories
      subcatTotals.forEach((subcat, id) => {
        const cat = categoryMap.get(subcat.categoryId);
        if (cat) {
          cat.subcategories.push({
            id,
            name: subcat.name,
            total: subcat.total,
          });
        }
      });

      // Sort subcategories by total
      categoryMap.forEach((cat) => {
        cat.subcategories.sort((a, b) => b.total - a.total);
      });

      const categoriesArray = Array.from(categoryMap.values())
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total);

      const totalIncome = txs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = txs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        label,
        startDate,
        endDate,
        categories: categoriesArray,
        totalIncome,
        totalExpense,
      };
    };

    if (periodType === 'compare') {
      const currentTxs = transactions.filter((t) => {
        const date = t.date;
        return date >= currentPeriod.start && date <= currentPeriod.end;
      });
      const previousTxs = transactions.filter((t) => {
        const date = t.date;
        return date >= previousPeriod.start && date <= previousPeriod.end;
      });

      return [
        buildPeriodData(
          currentTxs,
          currentPeriod.label,
          currentPeriod.start,
          currentPeriod.end
        ),
        buildPeriodData(
          previousTxs,
          previousPeriod.label,
          previousPeriod.start,
          previousPeriod.end
        ),
      ];
    }

    const label =
      periodType === 'current'
        ? currentPeriod.label
        : periodType === 'previous'
        ? previousPeriod.label
        : `${format(parseISO(customStartDate || currentPeriod.start), 'dd/MM/yyyy')} - ${format(
            parseISO(customEndDate || currentPeriod.end),
            'dd/MM/yyyy'
          )}`;

    return [buildPeriodData(transactions, label, filterDates.startDate, filterDates.endDate)];
  }, [
    transactions,
    categories,
    reportType,
    periodType,
    currentPeriod,
    previousPeriod,
    customStartDate,
    customEndDate,
    filterDates,
  ]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const toggleCategory = (categoryId: string) => {
    const current = expandedCategories || new Set<string>();
    const newExpanded = new Set(current);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Initialize with all categories collapsed
  if (!hasInitializedExpanded && reportData.length > 0) {
    setExpandedCategories(new Set());
    setHasInitializedExpanded(true);
  }

  const getVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatório por Categoria</h1>
        <p className="text-muted-foreground">
          Análise detalhada de gastos e receitas por categoria e subcategoria
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">
                    <span className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      Despesas
                    </span>
                  </SelectItem>
                  <SelectItem value="income">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      Receitas
                    </span>
                  </SelectItem>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4" />
                      Todos
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Período</Label>
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Mês Atual</SelectItem>
                  <SelectItem value="previous">Mês Anterior</SelectItem>
                  <SelectItem value="compare">Comparar Meses</SelectItem>
                  <SelectItem value="custom">Período Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodType === 'custom' && (
              <>
                <div>
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {periodType === 'compare' && reportData.length === 2 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {reportData.map((period, index) => (
            <PeriodCard
              key={period.label}
              period={period}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
              formatCurrency={formatCurrency}
              reportType={reportType}
              comparisonPeriod={index === 0 ? reportData[1] : reportData[0]}
              getVariation={getVariation}
              isCurrentPeriod={index === 0}
            />
          ))}
        </div>
      ) : (
        reportData.map((period) => (
          <PeriodCard
            key={period.label}
            period={period}
            expandedCategories={expandedCategories}
            onToggleCategory={toggleCategory}
            formatCurrency={formatCurrency}
            reportType={reportType}
          />
        ))
      )}
    </div>
  );
}

interface PeriodCardProps {
  period: PeriodData;
  expandedCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  formatCurrency: (value: number) => string;
  reportType: ReportType;
  comparisonPeriod?: PeriodData;
  getVariation?: (current: number, previous: number) => number;
  isCurrentPeriod?: boolean;
}

function PeriodCard({
  period,
  expandedCategories,
  onToggleCategory,
  formatCurrency,
  reportType,
  comparisonPeriod,
  getVariation,
  isCurrentPeriod,
}: PeriodCardProps) {
  const total =
    reportType === 'expense'
      ? period.totalExpense
      : reportType === 'income'
      ? period.totalIncome
      : period.totalIncome - period.totalExpense;

  const comparisonTotal = comparisonPeriod
    ? reportType === 'expense'
      ? comparisonPeriod.totalExpense
      : reportType === 'income'
      ? comparisonPeriod.totalIncome
      : comparisonPeriod.totalIncome - comparisonPeriod.totalExpense
    : 0;

  const variation = getVariation && comparisonPeriod ? getVariation(total, comparisonTotal) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="capitalize">{period.label}</span>
          <div className="text-right">
            <div
              className={`text-xl font-bold ${
                reportType === 'expense'
                  ? 'text-red-600'
                  : reportType === 'income'
                  ? 'text-green-600'
                  : total >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {formatCurrency(total)}
            </div>
            {comparisonPeriod && isCurrentPeriod && (
              <div
                className={`text-sm ${
                  variation > 0
                    ? reportType === 'expense'
                      ? 'text-red-500'
                      : 'text-green-500'
                    : variation < 0
                    ? reportType === 'expense'
                      ? 'text-green-500'
                      : 'text-red-500'
                    : 'text-muted-foreground'
                }`}
              >
                {variation > 0 ? '+' : ''}
                {variation.toFixed(1)}% vs anterior
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {period.categories.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma transação encontrada para este período
          </p>
        ) : (
          <div className="space-y-2">
            {period.categories.map((cat) => {
              const percentage = total > 0 ? (cat.total / total) * 100 : 0;
              const hasSubcategories = cat.subcategories.length > 0;
              const isExpanded = expandedCategories?.has(cat.id) ?? false;

              // Find comparison category
              const comparisonCat = comparisonPeriod?.categories.find((c) => c.id === cat.id);
              const catVariation =
                getVariation && comparisonCat ? getVariation(cat.total, comparisonCat.total) : null;

              return (
                <div key={cat.id} className="border rounded-lg">
                  <div
                    className={`flex items-center gap-3 p-3 ${
                      hasSubcategories ? 'cursor-pointer hover:bg-accent/50' : ''
                    }`}
                    onClick={() => hasSubcategories && onToggleCategory(cat.id)}
                  >
                    {hasSubcategories ? (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{cat.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {percentage.toFixed(1)}% do total
                        {cat.budget && cat.budget > 0 && (
                          <span className="ml-2">
                            • Orçamento: {formatCurrency(cat.budget)}
                            {cat.total > cat.budget && (
                              <span className="text-red-500 ml-1">
                                ({formatCurrency(cat.total - cat.budget)} acima)
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium">{formatCurrency(cat.total)}</div>
                      {catVariation !== null && isCurrentPeriod && (
                        <div
                          className={`text-xs ${
                            catVariation > 0
                              ? reportType === 'expense'
                                ? 'text-red-500'
                                : 'text-green-500'
                              : catVariation < 0
                              ? reportType === 'expense'
                                ? 'text-green-500'
                                : 'text-red-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {catVariation > 0 ? '+' : ''}
                          {catVariation.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {hasSubcategories && isExpanded && (
                    <div className="border-t bg-muted/30">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subcategoria</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">% Categoria</TableHead>
                            <TableHead className="text-right">% Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cat.subcategories.map((sub) => {
                            const subPercentageOfCat = cat.total > 0 ? (sub.total / cat.total) * 100 : 0;
                            const subPercentageOfTotal = total > 0 ? (sub.total / total) * 100 : 0;
                            return (
                              <TableRow key={sub.id}>
                                <TableCell className="font-medium">{sub.name}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(sub.total)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {subPercentageOfCat.toFixed(1)}%
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {subPercentageOfTotal.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
