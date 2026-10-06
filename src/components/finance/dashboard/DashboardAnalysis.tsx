import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Info,
  Lightbulb,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TONE, toneForSign, type Tone } from '@/lib/tone';
import { brl, formatBRDate, type Insight, type Projection, type Segment } from '@/lib/dashboardInsights';

const TONE_ICON: Record<Tone, typeof Info> = {
  danger: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  neutral: Info,
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const FOCUS_ROW =
  'transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

function SummaryCard({ summary }: { summary: Segment[][] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-muted-foreground" aria-hidden />
          Resumo do mês
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {summary.map((paragraph, index) => (
          <p key={index} className="text-sm leading-relaxed">
            {paragraph.map((segment, i) => (
              <span key={i} className={cn(segment.tone && TONE[segment.tone].text, segment.bold && 'font-semibold')}>
                {segment.text}
              </span>
            ))}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

interface BreakdownRowProps {
  sign: string;
  label: string;
  hint?: string;
  value: number;
  tone?: Tone;
  onClick?: () => void;
}

function BreakdownRow({ sign, label, hint, value, tone, onClick }: BreakdownRowProps) {
  const body = (
    <>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="w-3 shrink-0 text-center font-semibold text-muted-foreground" aria-hidden>
          {sign}
        </span>
        <span className="truncate text-sm">{label}</span>
        {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span className={cn('text-sm font-semibold tabular-nums', tone && TONE[tone].text)}>{brl(value)}</span>
        {onClick && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
      </span>
    </>
  );
  const base = 'flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5';
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(base, 'text-left', FOCUS_ROW)}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

interface ProjectionCardProps {
  projection: Projection | null;
  onOpenBucket?: (type: 'payable' | 'receivable') => void;
}

function ProjectionCard({ projection, onOpenBucket }: ProjectionCardProps) {
  if (!projection) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            Previsão para o fim do mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Há contas em aberto demais para somar com segurança aqui. Confira o total em Contas a Pagar/Receber.
          </p>
        </CardContent>
      </Card>
    );
  }

  const tone = toneForSign(projection.projected);
  const Icon = projection.projected < 0 ? TrendingDown : TrendingUp;
  const { receivable, payable, unknownValueCount } = projection;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
              Previsão para o fim do mês
            </CardTitle>
            <CardDescription className="mt-1">Até {formatBRDate(projection.monthEnd)}</CardDescription>
          </div>
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Estimativa
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', TONE[tone].text)}>
          <Icon className="h-6 w-6 shrink-0" aria-hidden />
          <span className="text-3xl font-bold tabular-nums">{brl(projection.projected)}</span>
          <span className="text-sm font-medium">
            {projection.projected < 0 ? 'no negativo' : projection.projected > 0 ? 'no positivo' : 'zerado'}
          </span>
        </div>

        <div className="divide-y rounded-lg border">
          <div className="py-1">
            <BreakdownRow sign="" label="Realizado no mês" value={projection.realized} tone={toneForSign(projection.realized)} />
          </div>
          <div className="py-1">
            <BreakdownRow
              sign="+"
              label="A receber"
              hint={plural(receivable.count, 'conta', 'contas')}
              value={receivable.total}
              onClick={receivable.count > 0 && onOpenBucket ? () => onOpenBucket('receivable') : undefined}
            />
          </div>
          <div className="py-1">
            <BreakdownRow
              sign="−"
              label="A pagar"
              hint={plural(payable.count, 'conta', 'contas')}
              value={payable.total}
              onClick={payable.count > 0 && onOpenBucket ? () => onOpenBucket('payable') : undefined}
            />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Soma o que já foi realizado às contas já cadastradas com vencimento até {formatBRDate(projection.monthEnd)}{' '}
          (inclui as atrasadas). Não estima gastos que ainda não foram lançados.
          {unknownValueCount > 0 &&
            ` ${plural(unknownValueCount, 'conta sem valor definido não entra', 'contas sem valor definido não entram')} na soma.`}
        </p>
      </CardContent>
    </Card>
  );
}

function InsightRow({ insight, onOpen }: { insight: Insight; onOpen?: (insight: Insight) => void }) {
  const Icon = TONE_ICON[insight.tone];
  const clickable = !!insight.drill && !!onOpen;
  const body = (
    <>
      <span
        className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', TONE[insight.tone].softBg, TONE[insight.tone].text)}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium leading-snug">
          {insight.title}
          {insight.source === 'ai' && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              <Sparkles className="h-2.5 w-2.5" aria-hidden /> IA
            </span>
          )}
        </span>
        {insight.detail && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{insight.detail}</span>}
      </span>
      {clickable && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const base = 'flex w-full items-start gap-3 rounded-lg p-2 text-left';
  return clickable ? (
    <button type="button" onClick={() => onOpen?.(insight)} className={cn(base, FOCUS_ROW)}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

interface InsightsCardProps {
  insights: Insight[];
  onOpenInsight?: (insight: Insight) => void;
  className?: string;
}

function InsightsCard({ insights, onOpenInsight, className }: InsightsCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
          Sugestões e alertas
        </CardTitle>
        <CardDescription>Do mais urgente ao menos urgente.</CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada a destacar por enquanto.</p>
        ) : (
          <ul className="space-y-1">
            {insights.map((insight) => (
              <li key={insight.id}>
                <InsightRow insight={insight} onOpen={onOpenInsight} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Calculado a partir dos seus lançamentos e contas cadastradas.
        </p>
      </CardContent>
    </Card>
  );
}

/** Placeholder enquanto as contas em aberto carregam (a previsão e os alertas dependem delas). */
export function DashboardAnalysisSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-5" aria-busy="true" aria-label="Carregando análise do mês">
      <div className="h-64 animate-pulse rounded-lg border bg-muted/30 lg:col-span-3" />
      <div className="h-64 animate-pulse rounded-lg border bg-muted/30 lg:col-span-2" />
    </div>
  );
}

interface DashboardAnalysisProps {
  summary: Segment[][];
  /** null = não dá para prever com segurança (lista de contas possivelmente incompleta). */
  projection: Projection | null;
  insights: Insight[];
  /** Abre o detalhe de uma sugestão (já filtrado e conferido). */
  onOpenInsight?: (insight: Insight) => void;
  /** Abre as contas que compõem a previsão. */
  onOpenBucket?: (type: 'payable' | 'receivable') => void;
}

/**
 * Descritivo: texto dinâmico sobre o mês, previsão de fechamento (rotulada como estimativa,
 * com a base de cálculo à vista) e sugestões — tudo calculado em código a partir dos dados.
 */
export function DashboardAnalysis({ summary, projection, insights, onOpenInsight, onOpenBucket }: DashboardAnalysisProps) {
  return (
    <section aria-label="Análise do mês" className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <SummaryCard summary={summary} />
        <ProjectionCard projection={projection} onOpenBucket={onOpenBucket} />
      </div>
      <InsightsCard insights={insights} onOpenInsight={onOpenInsight} className="lg:col-span-2" />
    </section>
  );
}
