import type { ReactNode } from 'react';
import { CircleArrowDown, CircleArrowUp, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { brl } from '@/lib/dashboardInsights';
import { TONE, toneForSign, type Tone } from '@/lib/tone';
import { KpiTile, type KpiDelta } from './KpiTile';
import { Sparkline } from './Sparkline';

export type VisualTarget = 'accounts' | 'income' | 'expense' | 'balance' | 'week-payable' | 'week-receivable';

interface WeekFigure {
  total: number;
  count: number;
}

interface DashboardVisualProps {
  /** "outubro de 2026" */
  monthLabel: string;
  /** Faixa de atalhos (já renderizada pelo container). */
  shortcuts?: ReactNode;
  balance: number;
  /** Total geral dos últimos meses, para a tendência no fundo do tile de saldo. */
  trend?: number[];
  income: { value: number; delta: KpiDelta | null };
  expense: { value: number; delta: KpiDelta | null };
  result: { value: number };
  week: { payable: WeekFigure; receivable: WeekFigure };
  onSelect?: (target: VisualTarget) => void;
}

const ICON = 'h-5 w-5 md:h-6 md:w-6';

const CountBadge = ({ count }: { count: number }) =>
  count > 0 ? (
    <span className="rounded-full bg-muted/40 px-2.5 py-0.5 text-xs font-semibold tabular-nums">
      {count}
      <span className="sr-only"> {count === 1 ? 'conta' : 'contas'}</span>
    </span>
  ) : null;

/**
 * Dashboard do modo Visual: o essencial em números grandes e ícones, com o tile inteiro
 * como botão. Sem tabelas, gráficos pesados nem parágrafos — quase um painel de KPIs.
 */
export function DashboardVisual({
  monthLabel,
  shortcuts,
  balance,
  trend,
  income,
  expense,
  result,
  week,
  onSelect,
}: DashboardVisualProps) {
  const pick = (target: VisualTarget) => (onSelect ? () => onSelect(target) : undefined);
  const balanceTone: Tone = balance < 0 ? 'danger' : 'info';
  const resultTone = toneForSign(result.value);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{monthLabel}</p>
      </div>

      <section aria-label="Resumo do mês" className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiTile
          icon={<Wallet className={ICON} />}
          tone={balanceTone}
          valueTone={balance < 0 ? 'danger' : undefined}
          label="Saldo ativo"
          value={brl(balance)}
          onClick={pick('accounts')}
          backdrop={trend && trend.length > 1 ? <Sparkline values={trend} className={`h-12 opacity-40 ${TONE[balanceTone].text}`} /> : undefined}
        />
        <KpiTile
          icon={<TrendingUp className={ICON} />}
          tone="success"
          label="Receitas do mês"
          value={brl(income.value)}
          delta={income.delta}
          onClick={pick('income')}
        />
        <KpiTile
          icon={<TrendingDown className={ICON} />}
          tone="danger"
          label="Despesas do mês"
          value={brl(expense.value)}
          delta={expense.delta}
          onClick={pick('expense')}
        />
        <KpiTile
          icon={<Scale className={ICON} />}
          tone={resultTone}
          valueTone={result.value < 0 ? 'danger' : undefined}
          label="Balanço do mês"
          value={brl(result.value)}
          onClick={pick('balance')}
        />
      </section>

      <section aria-labelledby="visual-week" className="space-y-3">
        <h2 id="visual-week" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Esta semana
        </h2>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <KpiTile
            icon={<CircleArrowDown className={ICON} />}
            tone={week.payable.count > 0 ? 'danger' : 'neutral'}
            label="A pagar"
            ariaLabel={`A pagar na semana: ${brl(week.payable.total)}`}
            value={brl(week.payable.total)}
            badge={<CountBadge count={week.payable.count} />}
            onClick={pick('week-payable')}
          />
          <KpiTile
            icon={<CircleArrowUp className={ICON} />}
            tone={week.receivable.count > 0 ? 'success' : 'neutral'}
            label="A receber"
            ariaLabel={`A receber na semana: ${brl(week.receivable.total)}`}
            value={brl(week.receivable.total)}
            badge={<CountBadge count={week.receivable.count} />}
            onClick={pick('week-receivable')}
          />
        </div>
      </section>

      {shortcuts}
    </div>
  );
}
