import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/tone';
import { brl, deltaTone, pct, type CategoryShare } from '@/lib/dashboardInsights';
import { DeltaChip } from './DeltaChip';

interface CategoryBreakdownProps {
  rows: CategoryShare[];
  /** Base da comparação ("a setembro", "ao mesmo período de setembro…"); null = sem base para comparar. */
  comparisonReference: string | null;
  /** A comparação é só dos primeiros dias dos dois meses (mês em andamento). */
  partial?: boolean;
  monthLabel: string;
  /** Clicar numa categoria abre os lançamentos dela. Só linhas com `categoryId` são clicáveis. */
  onSelect?: (row: CategoryShare) => void;
}

interface RowBodyProps {
  row: CategoryShare;
  compare: boolean;
  partial: boolean;
  reference?: string;
}

function RowBody({ row, compare, partial, reference }: RowBodyProps) {
  // "novo" só faz sentido contra o mês inteiro: nos primeiros dias, uma categoria que não
  // apareceu no mesmo trecho do mês anterior pode ter sido paga só mais tarde (dia 7, não dia 5).
  const isNew = compare && !partial && row.previousValue === 0;
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
          <span className="truncate text-sm font-medium">{row.name}</span>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {row.count} {row.count === 1 ? 'lançamento' : 'lançamentos'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {isNew ? (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', TONE.info.softBg, TONE.info.text)}>novo</span>
          ) : (
            compare && <DeltaChip change={row.change} tone={deltaTone('expense', row.change)} reference={reference} />
          )}
          <span className="text-sm font-semibold tabular-nums">{brl(row.value)}</span>
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${Math.max(row.share, 1)}%`, backgroundColor: row.color }} />
        </div>
        <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">{pct(row.share)}</span>
      </div>
    </>
  );
}

/**
 * Descritivo: quanto cada categoria pesa nas despesas do mês, e se subiu ou caiu em relação
 * ao mês anterior. Cada linha com categoria identificada abre os lançamentos dela já filtrados.
 */
export function CategoryBreakdown({ rows, comparisonReference, partial = false, monthLabel, onSelect }: CategoryBreakdownProps) {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const compare = comparisonReference !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Participação por categoria</CardTitle>
        <CardDescription>
          Quanto cada categoria pesa nas despesas de {monthLabel}
          {compare ? `, com a variação em relação ${comparisonReference}` : ''}.
          {onSelect ? ' Selecione uma categoria para ver os lançamentos.' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {rows.map((row) => {
            const clickable = !!onSelect && !!row.categoryId;
            return (
              <li key={row.key}>
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => onSelect?.(row)}
                    className="w-full rounded-lg p-2 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label={`${row.name}: ${brl(row.value)}, ${pct(row.share)} das despesas. Ver lançamentos`}
                  >
                    <RowBody row={row} compare={compare} partial={partial} reference={comparisonReference ?? undefined} />
                  </button>
                ) : (
                  <div className="p-2">
                    <RowBody row={row} compare={compare} partial={partial} reference={comparisonReference ?? undefined} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex justify-between border-t pt-3 text-sm font-semibold">
          <span>Total de despesas</span>
          <span className="tabular-nums">{brl(total)}</span>
        </p>
      </CardContent>
    </Card>
  );
}
