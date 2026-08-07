import { Fragment, useMemo, useState } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useFinanceTags, setEntityTags } from '@/hooks/useFinanceTags';
import { useRecordTags } from '@/hooks/useRecordTags';
import { TagPicker } from '@/components/finance/TagPicker';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, Tags as TagsIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';


interface TagReportPageProps {
  companyId: string;
}

type ReportType = 'all' | 'income' | 'expense';
type PeriodType = 'current' | 'previous' | 'custom';

interface Leaf {
  key: string;
  label: string;
  total: number;
  count: number;
}
interface SubNode extends Leaf {
  accounts: Leaf[];
}
interface CatNode extends Leaf {
  subcategories: SubNode[];
}
interface TagNode extends Leaf {
  color: string;
  categories: CatNode[];
}

const currency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function TagReportPage({ companyId }: TagReportPageProps) {
  const [reportType, setReportType] = useState<ReportType>('all');
  const [periodType, setPeriodType] = useState<PeriodType>('current');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tagRefreshKey, setTagRefreshKey] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  const periods = useMemo(() => {
    const now = new Date();
    return {
      current: {
        start: format(startOfMonth(now), 'yyyy-MM-dd'),
        end: format(endOfMonth(now), 'yyyy-MM-dd'),
      },
      previous: {
        start: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
        end: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
      },
    };
  }, []);

  const filterDates = useMemo(() => {
    if (periodType === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    if (periodType === 'previous') {
      return { startDate: periods.previous.start, endDate: periods.previous.end };
    }
    return { startDate: periods.current.start, endDate: periods.current.end };
  }, [periodType, customStart, customEnd, periods]);

  const { transactions, loading } = useTransactions(companyId, {
    startDate: filterDates.startDate,
    endDate: filterDates.endDate,
    type: reportType !== 'all' ? reportType : undefined,
  });

  const { tags } = useFinanceTags(companyId);
  const txIds = useMemo(() => transactions.map((t) => t.id), [transactions]);
  const tagsMap = useRecordTags('transaction', txIds, tagRefreshKey);

  const assignTag = async (txId: string, tagIds: string[]) => {
    setSavingId(txId);
    try {
      await setEntityTags('transaction', txId, tagIds);
      setTagRefreshKey((k) => k + 1);
      toast({ title: 'Tag atribuída' });
    } catch (e: any) {
      toast({ title: 'Erro ao atribuir tag', description: e.message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const { nodes, untagged, grandTotal } = useMemo(() => {
    const map = new Map<string, TagNode>();
    const untaggedItems: (typeof transactions) = [];
    let untaggedTotal = 0;
    let untaggedCount = 0;
    let total = 0;

    const signed = (t: (typeof transactions)[number]) =>
      t.type === 'income' ? t.amount : -t.amount;

    transactions.forEach((t) => {
      const value = signed(t);
      total += value;
      const txTags = tagsMap[t.id] || [];
      if (txTags.length === 0) {
        untaggedTotal += value;
        untaggedCount += 1;
        untaggedItems.push(t);
        return;
      }
      txTags.forEach((tag) => {
        let node = map.get(tag.id);
        if (!node) {
          node = {
            key: tag.id,
            label: tag.name,
            color: tag.color,
            total: 0,
            count: 0,
            categories: [],
          };
          map.set(tag.id, node);
        }
        node.total += value;
        node.count += 1;

        const catKey = t.category?.id || 'sem-categoria';
        const catLabel = t.category?.name || 'Sem categoria';
        let cat = node.categories.find((c) => c.key === catKey);
        if (!cat) {
          cat = { key: catKey, label: catLabel, total: 0, count: 0, subcategories: [] };
          node.categories.push(cat);
        }
        cat.total += value;
        cat.count += 1;

        const subKey = t.subcategory?.id || 'sem-subcategoria';
        const subLabel = t.subcategory?.name || 'Sem subcategoria';
        let sub = cat.subcategories.find((s) => s.key === subKey);
        if (!sub) {
          sub = { key: subKey, label: subLabel, total: 0, count: 0, accounts: [] };
          cat.subcategories.push(sub);
        }
        sub.total += value;
        sub.count += 1;

        const accKey = t.account_id || 'sem-conta';
        const accLabel = t.account?.name || 'Sem conta';
        let acc = sub.accounts.find((a) => a.key === accKey);
        if (!acc) {
          acc = { key: accKey, label: accLabel, total: 0, count: 0 };
          sub.accounts.push(acc);
        }
        acc.total += value;
        acc.count += 1;
      });
    });

    const sortByAbs = <T extends Leaf>(arr: T[]) =>
      arr.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    const list = sortByAbs(Array.from(map.values()));
    list.forEach((tag) => {
      sortByAbs(tag.categories).forEach((cat) => {
        sortByAbs(cat.subcategories).forEach((sub) => sortByAbs(sub.accounts));
      });
    });

    return {
      nodes: list,
      untagged: { total: untaggedTotal, count: untaggedCount, items: untaggedItems },
      grandTotal: total,
    };
  }, [transactions, tagsMap]);


  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense };
  }, [transactions]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const unusedTags = tags.length - nodes.length;

  const amountClass = (v: number) => (v >= 0 ? 'text-emerald-600' : 'text-destructive');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TagsIcon className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">Relatório por Tag</h1>
      </div>

      <Card>
        <CardContent className="pt-6 grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mês atual</SelectItem>
                <SelectItem value="previous">Mês anterior</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === 'custom' && (
            <>
              <div className="space-y-2">
                <Label>De</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Até</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xl font-bold text-emerald-600">{currency(totals.income)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="text-xl font-bold text-destructive">{currency(totals.expense)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Resultado</CardTitle></CardHeader>
          <CardContent>
            <span className={`text-xl font-bold ${amountClass(grandTotal)}`}>{currency(grandTotal)}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Totais por Tag
            {unusedTags > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {unusedTags} tag(s) sem movimento no período
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table wrapperClassName="max-h-[65vh] overflow-auto accessible-scrollbar">
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Tag / Categoria / Subcategoria / Conta</TableHead>
                <TableHead className="text-right w-28">Lançamentos</TableHead>
                <TableHead className="text-right w-40">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!loading && nodes.length === 0 && untagged.count === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum lançamento no período</TableCell></TableRow>
              )}
              {nodes.map((tag) => {
                const tagOpen = expanded.has(tag.key);
                return (
                  <Fragment key={tag.key}>
                    <TableRow className="cursor-pointer font-medium" onClick={() => toggle(tag.key)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tagOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Badge style={{ backgroundColor: tag.color, color: '#fff' }}>{tag.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{tag.count}</TableCell>
                      <TableCell className={`text-right ${amountClass(tag.total)}`}>{currency(tag.total)}</TableCell>
                    </TableRow>
                    {tagOpen && tag.categories.map((cat) => {
                      const catKey = `${tag.key}:${cat.key}`;
                      const catOpen = expanded.has(catKey);
                      return (
                        <Fragment key={catKey}>
                          <TableRow className="cursor-pointer bg-muted/30" onClick={() => toggle(catKey)}>
                            <TableCell>
                              <div className="flex items-center gap-2 pl-6">
                                {catOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                <span>{cat.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{cat.count}</TableCell>
                            <TableCell className={`text-right ${amountClass(cat.total)}`}>{currency(cat.total)}</TableCell>
                          </TableRow>
                          {catOpen && cat.subcategories.map((sub) => {
                            const subKey = `${catKey}:${sub.key}`;
                            const subOpen = expanded.has(subKey);
                            return (
                              <Fragment key={subKey}>
                                <TableRow className="cursor-pointer" onClick={() => toggle(subKey)}>
                                  <TableCell>
                                    <div className="flex items-center gap-2 pl-12 text-sm">
                                      {subOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                      <span>{sub.label}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right text-sm">{sub.count}</TableCell>
                                  <TableCell className={`text-right text-sm ${amountClass(sub.total)}`}>{currency(sub.total)}</TableCell>
                                </TableRow>
                                {subOpen && sub.accounts.map((acc) => (
                                  <TableRow key={`${subKey}:${acc.key}`}>
                                    <TableCell>
                                      <span className="pl-[4.5rem] text-sm text-muted-foreground">{acc.label}</span>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">{acc.count}</TableCell>
                                    <TableCell className={`text-right text-sm ${amountClass(acc.total)}`}>{currency(acc.total)}</TableCell>
                                  </TableRow>
                                ))}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
              {untagged.count > 0 && (
                <Fragment>
                  <TableRow className="bg-muted/20 cursor-pointer" onClick={() => toggle('__untagged__')}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {expanded.has('__untagged__') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span className="text-muted-foreground italic">Sem tag</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{untagged.count}</TableCell>
                    <TableCell className={`text-right ${amountClass(untagged.total)}`}>{currency(untagged.total)}</TableCell>
                  </TableRow>
                  {expanded.has('__untagged__') && untagged.items.map((t) => (
                    <TableRow key={`untagged:${t.id}`}>
                      <TableCell>
                        <div className="pl-6 flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
                          <div className="text-sm min-w-0">
                            <span className="text-muted-foreground mr-2">
                              {format(new Date(`${t.date}T00:00:00`), 'dd/MM/yyyy')}
                            </span>
                            <span className="truncate">{t.description || 'Sem descrição'}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {t.category?.name}{t.subcategory?.name ? ` / ${t.subcategory.name}` : ''} · {t.account?.name}
                            </span>
                          </div>
                          <div className="md:ml-auto w-full md:w-64" onClick={(e) => e.stopPropagation()}>
                            <TagPicker
                              companyId={companyId}
                              value={[]}
                              onChange={(ids) => { if (ids.length > 0) assignTag(t.id, ids); }}
                              size="sm"
                              placeholder={savingId === t.id ? 'Salvando...' : 'Atribuir tag...'}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">1</TableCell>
                      <TableCell className={`text-right text-sm ${amountClass(t.type === 'income' ? t.amount : -t.amount)}`}>
                        {currency(t.type === 'income' ? t.amount : -t.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
