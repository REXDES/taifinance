// Cálculos do dashboard (modos Visual e Descritivo). Tudo aqui é função pura — recebe
// números e devolve números/frases — para ser testável e para que NENHUM valor mostrado
// venha de uma IA: previsões e sugestões são regras sobre os dados cadastrados, e cada uma
// diz de onde tirou a conta.

import type { Tone } from './tone';
import type { DrillRequest } from './drillDown';

// ---------------------------------------------------------------- formatação

export const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** 12,4% (até 1 casa decimal; sem casa quando é inteiro). */
export const pct = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------- datas (locais, sem fuso)

const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** yyyy-MM-dd → Date local ao meio-dia (evita virar o dia anterior por fuso). */
export const fromISODate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

export const addDaysISO = (iso: string, days: number) => {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((fromISODate(toIso).getTime() - fromISODate(fromIso).getTime()) / 86_400_000);

export const formatBRDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export interface MonthRange {
  start: string;
  end: string;
  /** "outubro de 2026" */
  label: string;
  /** "outubro" */
  name: string;
}

/** Mês de `ref` deslocado em `offset` meses (-1 = mês anterior). */
export function monthRange(ref: Date, offset = 0): MonthRange {
  const first = new Date(ref.getFullYear(), ref.getMonth() + offset, 1, 12, 0, 0);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12, 0, 0);
  return {
    start: toISODate(first),
    end: toISODate(last),
    label: first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    name: first.toLocaleDateString('pt-BR', { month: 'long' }),
  };
}

// ---------------------------------------------------------------- totais e variação

export interface TxLike {
  type: 'income' | 'expense';
  amount: number | string;
  date: string;
  category_id?: string | null;
  category?: { name?: string | null; color?: string | null } | null;
}

export interface Totals {
  income: number;
  expense: number;
  incomeCount: number;
  expenseCount: number;
}

export function sumTransactions(transactions: TxLike[], start: string, end: string): Totals {
  const totals: Totals = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
  for (const t of transactions) {
    const day = t.date.slice(0, 10);
    if (day < start || day > end) continue;
    const amount = Number(t.amount);
    if (t.type === 'income') {
      totals.income += amount;
      totals.incomeCount += 1;
    } else {
      totals.expense += amount;
      totals.expenseCount += 1;
    }
  }
  return totals;
}

/**
 * Os lançamentos carregados cobrem o período inteiro a partir de `since`?
 * O servidor limita cada consulta a 1.000 linhas: se a lista chegou nesse teto e o lançamento
 * mais antigo que veio é posterior a `since`, pode faltar dado — e então NÃO mostramos
 * comparação (melhor sem número do que com número que talvez esteja errado).
 */
export const LOAD_LIMIT = 1000;

export function coversSince(transactions: TxLike[], since: string): boolean {
  if (transactions.length < LOAD_LIMIT) return true;
  let oldest = '9999-12-31';
  for (const t of transactions) {
    const day = t.date.slice(0, 10);
    if (day < oldest) oldest = day;
  }
  return oldest <= since;
}

/** Variação percentual; null quando não há base (anterior = 0). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type DeltaKind = 'income' | 'expense' | 'balance';

/**
 * Cor da variação, pelo SENTIDO: receita/resultado subindo é bom; despesa subindo pede
 * atenção. Variação pequena (< 1%) é neutra. Perigo fica reservado a saldo negativo e atrasos.
 */
export function deltaTone(kind: DeltaKind, change: number | null): Tone {
  if (change === null || Math.abs(change) < 1) return 'neutral';
  const up = change > 0;
  if (kind === 'expense') return up ? 'warning' : 'success';
  return up ? 'success' : 'warning';
}

// ---------------------------------------------------------------- comparação com o mês anterior

export interface Comparison {
  /** "setembro" */
  monthName: string;
  /** Para frases: "a setembro" (mês fechado) ou "ao mesmo período de setembro (dias 1 a 5)". */
  reference: string;
  /** Para rótulos curtos: "setembro" ou "setembro (1 a 5)". */
  label: string;
  /** true = o mês atual ainda está em andamento: comparamos só os primeiros N dias dos dois meses. */
  partial: boolean;
  /** Mês atual até hoje. */
  current: Totals;
  /** Mês anterior no mesmo trecho (dias 1 a N). */
  previous: Totals;
  currentRange: { start: string; end: string };
  previousRange: { start: string; end: string };
}

/**
 * Compara o mês atual ATÉ HOJE com o mesmo trecho do mês anterior (dias 1 a N dos dois meses).
 * Comparar o mês em andamento com o anterior inteiro faria, por exemplo no dia 5, "despesas
 * caíram 80%" — número errado e ainda pintado de verde. Devolve null quando não há base
 * confiável: lista possivelmente cortada no teto de 1.000 linhas, ou sem lançamentos no trecho
 * do mês anterior (variação sobre zero não diz nada).
 */
export function compareWithPreviousMonth(allTransactions: TxLike[], today: string): Comparison | null {
  const ref = fromISODate(today);
  const month = monthRange(ref, 0);
  const prev = monthRange(ref, -1);
  if (!coversSince(allTransactions, prev.start)) return null;

  const day = Number(today.slice(8, 10));
  const lastPrevDay = addDaysISO(prev.start, day - 1);
  const previousEnd = lastPrevDay < prev.end ? lastPrevDay : prev.end;
  const currentRange = { start: month.start, end: today };
  const previousRange = { start: prev.start, end: previousEnd };

  const previous = sumTransactions(allTransactions, previousRange.start, previousRange.end);
  if (previous.incomeCount === 0 && previous.expenseCount === 0) return null;

  const partial = previousEnd < prev.end;
  const lastDay = Number(previousEnd.slice(8, 10));
  return {
    monthName: prev.name,
    reference: partial ? `ao mesmo período de ${prev.name} (dias 1 a ${lastDay})` : `a ${prev.name}`,
    label: partial ? `${prev.name} (1 a ${lastDay})` : prev.name,
    partial,
    current: sumTransactions(allTransactions, currentRange.start, currentRange.end),
    previous,
    currentRange,
    previousRange,
  };
}

// ---------------------------------------------------------------- categorias

export interface CategoryShare {
  key: string;
  name: string;
  color: string;
  value: number;
  /** % do total de despesas do mês. */
  share: number;
  count: number;
  categoryId: string | null;
  /** Despesa da categoria no mesmo trecho do mês anterior (null = sem base de comparação). */
  previousValue: number | null;
  /** Variação do mesmo trecho dos dois meses, em %. */
  change: number | null;
}

const NO_CATEGORY = 'Sem categoria';
const NONE_KEY = '__none__';

export interface CategoryCompare {
  /** Todos os lançamentos carregados (o mês anterior sai daqui). */
  transactions: TxLike[];
  /** Mês atual até hoje — o trecho que se compara com o mesmo trecho do mês anterior. */
  currentRange: { start: string; end: string };
  previousRange: { start: string; end: string };
}

/**
 * Participação de cada categoria nas despesas de `range` (o mês inteiro). A variação (`change`)
 * compara o mesmo trecho dos dois meses (ver `compareWithPreviousMonth`), nunca o mês em
 * andamento contra o mês anterior fechado. `compare` null = sem base confiável.
 */
export function categoryShares(
  transactions: TxLike[],
  range: { start: string; end: string },
  compare: CategoryCompare | null,
  maxRows = 6,
): CategoryShare[] {
  // Agrupa pelo ID da categoria (e não pelo nome): duas categorias com o mesmo nome não se
  // misturam, e o clique na linha filtra exatamente os lançamentos que ela somou.
  const bucket = (list: TxLike[], start: string, end: string) => {
    const map = new Map<string, { name: string; color: string; value: number; count: number; categoryId: string | null }>();
    for (const t of list) {
      const day = t.date.slice(0, 10);
      if (t.type !== 'expense' || day < start || day > end) continue;
      const key = t.category_id ?? NONE_KEY;
      const entry = map.get(key) ?? {
        name: t.category?.name || NO_CATEGORY,
        color: t.category?.color || '#8B5CF6',
        value: 0,
        count: 0,
        categoryId: t.category_id ?? null,
      };
      entry.value += Number(t.amount);
      entry.count += 1;
      map.set(key, entry);
    }
    return map;
  };

  const current = bucket(transactions, range.start, range.end);
  const currentSoFar = compare ? bucket(transactions, compare.currentRange.start, compare.currentRange.end) : null;
  const previousMap = compare ? bucket(compare.transactions, compare.previousRange.start, compare.previousRange.end) : null;
  const total = [...current.values()].reduce((s, e) => s + e.value, 0);
  if (total <= 0) return [];

  const rows: CategoryShare[] = [...current.entries()]
    .sort(([, a], [, b]) => b.value - a.value)
    .map(([key, e]) => {
      const prevValue = previousMap ? (previousMap.get(key)?.value ?? 0) : null;
      const soFar = currentSoFar?.get(key)?.value ?? 0;
      return {
        key,
        name: e.name,
        color: e.color,
        value: e.value,
        share: (e.value / total) * 100,
        count: e.count,
        categoryId: e.categoryId,
        previousValue: prevValue,
        change: prevValue === null ? null : percentChange(soFar, prevValue),
      };
    });

  if (rows.length <= maxRows) return rows;
  const head = rows.slice(0, maxRows - 1);
  const tail = rows.slice(maxRows - 1);
  const otherValue = tail.reduce((s, r) => s + r.value, 0);
  return [
    ...head,
    {
      key: '__others__',
      name: 'Outras categorias',
      color: '#94a3b8',
      value: otherValue,
      share: (otherValue / total) * 100,
      count: tail.reduce((s, r) => s + r.count, 0),
      categoryId: null,
      previousValue: null,
      change: null,
    },
  ];
}

// ---------------------------------------------------------------- contas em aberto e previsão

export interface OpenItem {
  type: 'payable' | 'receivable';
  amount: number | string | null;
  due_date: string;
}

export interface Bucket {
  count: number;
  total: number;
  /** Dias de atraso da conta mais antiga (0 se nenhuma estiver atrasada). */
  oldestDays: number;
}

const emptyBucket = (): Bucket => ({ count: 0, total: 0, oldestDays: 0 });

function addTo(bucket: Bucket, amount: number | string | null, daysLate: number) {
  bucket.count += 1;
  bucket.total += Number(amount ?? 0);
  bucket.oldestDays = Math.max(bucket.oldestDays, daysLate);
}

export interface OpenSummary {
  /** Quantas contas em aberto foram consideradas (0 = nada carregado ou nada em aberto). */
  total: number;
  overduePayable: Bucket;
  overdueReceivable: Bucket;
  /** A pagar de hoje até hoje + 7 dias. */
  dueSoonPayable: Bucket;
}

export const DUE_SOON_DAYS = 7;

export function summarizeOpen(items: OpenItem[], today: string): OpenSummary {
  const out: OpenSummary = { total: items.length, overduePayable: emptyBucket(), overdueReceivable: emptyBucket(), dueSoonPayable: emptyBucket() };
  const soonLimit = addDaysISO(today, DUE_SOON_DAYS);
  for (const item of items) {
    const due = item.due_date.slice(0, 10);
    if (due < today) {
      addTo(item.type === 'payable' ? out.overduePayable : out.overdueReceivable, item.amount, daysBetween(due, today));
    } else if (item.type === 'payable' && due <= soonLimit) {
      addTo(out.dueSoonPayable, item.amount, 0);
    }
  }
  return out;
}

export interface Projection {
  /** Balanço realizado do mês até agora (receitas − despesas). */
  realized: number;
  /** A receber em aberto com vencimento até o fim do mês (inclui atrasadas). */
  receivable: Bucket;
  /** A pagar em aberto com vencimento até o fim do mês (inclui atrasadas). */
  payable: Bucket;
  /** Contas em aberto sem valor definido: contadas, mas sem valor na soma. */
  unknownValueCount: number;
  projected: number;
  monthEnd: string;
}

/**
 * Previsão de fechamento do mês = balanço já realizado + o que está a receber − o que está a
 * pagar, considerando só contas JÁ CADASTRADAS com vencimento até o fim do mês. Não adivinha
 * gastos futuros: é a soma dos compromissos conhecidos.
 */
export function projectMonthEnd(realized: number, items: OpenItem[], today: string, monthEnd: string): Projection {
  const receivable = emptyBucket();
  const payable = emptyBucket();
  let unknownValueCount = 0;
  for (const item of items) {
    const due = item.due_date.slice(0, 10);
    if (due > monthEnd) continue;
    const late = due < today ? daysBetween(due, today) : 0;
    // Conta sem valor definido entra na CONTAGEM (para bater com a lista) mas soma zero.
    if (item.amount === null || item.amount === undefined) unknownValueCount += 1;
    addTo(item.type === 'payable' ? payable : receivable, item.amount, late);
  }
  return {
    realized,
    receivable,
    payable,
    unknownValueCount,
    projected: realized + receivable.total - payable.total,
    monthEnd,
  };
}

// ---------------------------------------------------------------- frases dinâmicas

export interface Segment {
  text: string;
  tone?: Tone;
  bold?: boolean;
}

export interface SummaryInput {
  monthLabel: string;
  /** Usado só para avisar que não há base quando a comparação é null. */
  prevMonthName?: string | null;
  income: number;
  expense: number;
  /** null = sem base confiável de comparação. */
  comparison: Pick<Comparison, 'reference' | 'current' | 'previous'> | null;
}

const trend = (change: number, up: string, down: string) => (change > 0 ? up : down);

/** Parágrafos curtos (cada um uma lista de trechos, alguns coloridos) sobre o mês. */
export function buildMonthSummary(input: SummaryInput): Segment[][] {
  const { monthLabel, income, expense, comparison, prevMonthName } = input;
  if (income === 0 && expense === 0) {
    return [[{ text: `Ainda não há lançamentos em ${monthLabel}.` }]];
  }

  const balance = income - expense;
  const paragraphs: Segment[][] = [];

  paragraphs.push([
    { text: `Em ${monthLabel} você recebeu ` },
    { text: brl(income), tone: 'success', bold: true },
    { text: ' e gastou ' },
    { text: brl(expense), tone: 'danger', bold: true },
    { text: '.' },
  ]);

  const share = income > 0 ? ` (${pct((Math.abs(balance) / income) * 100)} da receita)` : '';
  paragraphs.push([
    { text: 'Resultado até agora: ' },
    { text: `${balance >= 0 ? 'sobra' : 'déficit'} de ${brl(Math.abs(balance))}`, tone: balance >= 0 ? 'success' : 'danger', bold: true },
    { text: `${share}.` },
  ]);

  if (!comparison && prevMonthName) {
    paragraphs.push([{ text: `Ainda não há base para comparar com ${prevMonthName}.` }]);
  }

  if (comparison) {
    const incomeChange = percentChange(comparison.current.income, comparison.previous.income);
    const expenseChange = percentChange(comparison.current.expense, comparison.previous.expense);
    const parts: Segment[] = [{ text: `Em relação ${comparison.reference}: ` }];
    if (incomeChange !== null) {
      parts.push({ text: `receitas ${trend(incomeChange, 'subiram', 'caíram')} ${pct(Math.abs(incomeChange))}`, tone: deltaTone('income', incomeChange), bold: true });
    } else {
      parts.push({ text: 'receitas sem base de comparação' });
    }
    parts.push({ text: ' e ' });
    if (expenseChange !== null) {
      parts.push({ text: `despesas ${trend(expenseChange, 'subiram', 'caíram')} ${pct(Math.abs(expenseChange))}`, tone: deltaTone('expense', expenseChange), bold: true });
    } else {
      parts.push({ text: 'despesas sem base de comparação' });
    }
    parts.push({ text: '.' });
    paragraphs.push(parts);
  }

  return paragraphs;
}

// ---------------------------------------------------------------- sugestões (regras)

export interface Insight {
  id: string;
  tone: Tone;
  title: string;
  detail?: string;
  /** 'rule' = regra sobre os números; 'ai' fica reservado para sugestões geradas por IA. */
  source: 'rule' | 'ai';
  /** Abre a tela de detalhe já filtrada (e conferida) ao clicar. */
  drill?: DrillRequest;
}

export interface InsightInput {
  today: string;
  month: MonthRange;
  income: number;
  expense: number;
  incomeCount: number;
  expenseCount: number;
  /** null = sem base confiável de comparação. */
  comparison: Comparison | null;
  open: OpenSummary;
  /** null = lista de contas em aberto possivelmente incompleta: sem previsão. */
  projection: Projection | null;
  topCategory: CategoryShare | null;
}

const VARIATION_THRESHOLD = 10; // % — abaixo disso não vale destaque
const CONCENTRATION_THRESHOLD = 40; // % do total de despesas numa categoria
const MIN_DAYS_FOR_VARIATION = 7; // mês em andamento: antes disso a amostra é pequena demais para alarmar
const MAX_INSIGHTS = 6;

const TONE_ORDER: Record<Tone, number> = { danger: 0, warning: 1, info: 2, success: 3, neutral: 4 };

const lateDetail = (b: Bucket) =>
  [b.total > 0 ? brl(b.total) : null, b.oldestDays > 0 ? `a mais antiga venceu há ${plural(b.oldestDays, 'dia', 'dias')}` : null]
    .filter(Boolean)
    .join(' · ');

export function buildInsights(input: InsightInput): Insight[] {
  const { today, month, comparison, open, projection, topCategory } = input;
  const elapsedDays = Number(today.slice(8, 10));
  const yesterday = addDaysISO(today, -1);
  const soonEnd = addDaysISO(today, DUE_SOON_DAYS);
  const out: Insight[] = [];

  if (open.overduePayable.count > 0) {
    out.push({
      id: 'overdue-payable',
      tone: 'danger',
      source: 'rule',
      title: `${plural(open.overduePayable.count, 'conta a pagar em atraso', 'contas a pagar em atraso')}`,
      detail: lateDetail(open.overduePayable),
      drill: {
        scope: 'payables-receivables',
        filters: { startDate: '', endDate: yesterday, type: 'payable', status: ['pending'] },
        description: `Contas a pagar atrasadas · vencidas até ${formatBRDate(yesterday)}`,
        origin: { label: 'Contas a pagar atrasadas', metric: 'payable-open', value: open.overduePayable.total, count: open.overduePayable.count },
      },
    });
  }

  if (open.overdueReceivable.count > 0) {
    out.push({
      id: 'overdue-receivable',
      tone: 'warning',
      source: 'rule',
      title: `${plural(open.overdueReceivable.count, 'conta a receber em atraso', 'contas a receber em atraso')}`,
      detail: lateDetail(open.overdueReceivable),
      drill: {
        scope: 'payables-receivables',
        filters: { startDate: '', endDate: yesterday, type: 'receivable', status: ['pending'] },
        description: `Contas a receber atrasadas · vencidas até ${formatBRDate(yesterday)}`,
        origin: { label: 'Contas a receber atrasadas', metric: 'receivable-open', value: open.overdueReceivable.total, count: open.overdueReceivable.count },
      },
    });
  }

  if (open.dueSoonPayable.count > 0) {
    out.push({
      id: 'due-soon-payable',
      tone: 'info',
      source: 'rule',
      title: `${plural(open.dueSoonPayable.count, 'conta a pagar vence', 'contas a pagar vencem')} nos próximos ${DUE_SOON_DAYS} dias`,
      detail: open.dueSoonPayable.total > 0 ? brl(open.dueSoonPayable.total) : undefined,
      drill: {
        scope: 'payables-receivables',
        filters: { startDate: today, endDate: soonEnd, type: 'payable', status: ['pending'] },
        description: `Contas a pagar · vencem de ${formatBRDate(today)} a ${formatBRDate(soonEnd)}`,
        origin: { label: 'Contas a pagar dos próximos dias', metric: 'payable-open', value: open.dueSoonPayable.total, count: open.dueSoonPayable.count },
      },
    });
  }

  if (projection && (projection.receivable.count > 0 || projection.payable.count > 0)) {
    out.push(
      projection.projected < 0
        ? {
            id: 'projection-negative',
            tone: 'danger',
            source: 'rule',
            title: 'O mês pode fechar no negativo',
            detail: `Pelas contas já cadastradas, a previsão até ${formatBRDate(projection.monthEnd)} é de ${brl(projection.projected)}.`,
          }
        : {
            id: 'projection-positive',
            tone: 'success',
            source: 'rule',
            title: 'Previsão de fechar o mês no positivo',
            detail: `Pelas contas já cadastradas, a previsão até ${formatBRDate(projection.monthEnd)} é de ${brl(projection.projected)}.`,
          },
    );
  }

  if (comparison && (!comparison.partial || elapsedDays >= MIN_DAYS_FOR_VARIATION)) {
    const { currentRange } = comparison;
    const periodText =
      currentRange.end >= month.end ? month.label : `${formatBRDate(currentRange.start)} a ${formatBRDate(currentRange.end)}`;
    for (const kind of ['expense', 'income'] as const) {
      const current = comparison.current[kind];
      const previous = comparison.previous[kind];
      const change = percentChange(current, previous);
      if (change === null || Math.abs(change) < VARIATION_THRESHOLD) continue;
      const up = change > 0;
      const noun = kind === 'expense' ? 'Despesas' : 'Receitas';
      out.push({
        id: `${kind}-variation`,
        tone: deltaTone(kind, change),
        source: 'rule',
        title: `${noun} ${up ? 'subiram' : 'caíram'} ${pct(Math.abs(change))} em relação ${comparison.reference}`,
        detail: `${brl(Math.abs(current - previous))} ${up ? 'a mais' : 'a menos'} (${brl(previous)} → ${brl(current)}).`,
        drill: {
          scope: 'transactions',
          filters: { startDate: currentRange.start, endDate: currentRange.end, type: kind },
          description: `${noun} · ${periodText}`,
          origin: {
            label: `${noun} — ${periodText}`,
            metric: kind,
            value: current,
            count: kind === 'expense' ? comparison.current.expenseCount : comparison.current.incomeCount,
          },
        },
      });
    }
  }

  if (topCategory && topCategory.categoryId && topCategory.share >= CONCENTRATION_THRESHOLD) {
    out.push({
      id: 'category-concentration',
      tone: 'info',
      source: 'rule',
      title: `${topCategory.name} concentra ${pct(topCategory.share)} das despesas do mês`,
      detail: `${brl(topCategory.value)} de ${brl(input.expense)}.`,
      drill: {
        scope: 'transactions',
        filters: { startDate: month.start, endDate: month.end, type: 'expense', categoryId: topCategory.categoryId },
        description: `Despesas · ${topCategory.name} · ${month.label}`,
        origin: { label: `Despesas — ${topCategory.name}`, metric: 'expense', value: topCategory.value, count: topCategory.count },
      },
    });
  }

  // Só afirma "nenhuma em atraso" quando há contas em aberto à vista: com a lista vazia não dá
  // para distinguir "nada em atraso" de "não consegui carregar", e uma garantia falsa é pior que silêncio.
  const hasOverdue = open.overduePayable.count > 0 || open.overdueReceivable.count > 0;
  if (!hasOverdue && open.total > 0) {
    out.push({
      id: 'no-overdue',
      tone: 'success',
      source: 'rule',
      title: 'Nenhuma conta em atraso',
      detail: 'Não há contas vencidas em aberto.',
    });
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, MAX_INSIGHTS);
}

// ---------------------------------------------------------------- análise completa do mês

export interface AnalysisInput {
  /** Hoje (yyyy-MM-dd): define o mês analisado e o trecho comparado. */
  today: string;
  /** Lançamentos do mês (os mesmos dos cards). */
  monthTransactions: TxLike[];
  /** Todos os lançamentos carregados (base do mês anterior). */
  allTransactions: TxLike[];
  comparison: Comparison | null;
  /** Totais exatamente como estão nos cards. */
  income: number;
  expense: number;
  incomeCount: number;
  expenseCount: number;
  /** Contas a pagar/receber em aberto com vencimento até o fim do mês ou os próximos 7 dias. */
  openItems: OpenItem[];
}

export interface MonthAnalysis {
  month: MonthRange;
  summary: Segment[][];
  insights: Insight[];
  categories: CategoryShare[];
  /** null quando a lista de contas em aberto pode estar incompleta. */
  projection: Projection | null;
}

export function analyzeMonth(input: AnalysisInput): MonthAnalysis {
  const { today, comparison, income, expense } = input;
  const ref = fromISODate(today);
  const month = monthRange(ref, 0);
  const open = summarizeOpen(input.openItems, today);
  // Se a consulta bateu no teto de linhas, a soma de contas em aberto pode estar incompleta.
  const projection =
    input.openItems.length < LOAD_LIMIT ? projectMonthEnd(income - expense, input.openItems, today, month.end) : null;
  const categories = categoryShares(
    input.monthTransactions,
    month,
    comparison
      ? { transactions: input.allTransactions, currentRange: comparison.currentRange, previousRange: comparison.previousRange }
      : null,
  );

  return {
    month,
    projection,
    categories,
    summary: buildMonthSummary({
      monthLabel: month.label,
      prevMonthName: monthRange(ref, -1).name,
      income,
      expense,
      comparison,
    }),
    insights: buildInsights({
      today,
      month,
      income,
      expense,
      incomeCount: input.incomeCount,
      expenseCount: input.expenseCount,
      comparison,
      open,
      projection,
      topCategory: categories[0] ?? null,
    }),
  };
}
