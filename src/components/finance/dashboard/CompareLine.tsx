import { cn } from '@/lib/utils';
import { TONE, toneForSign, type Tone } from '@/lib/tone';
import { brl, pct } from '@/lib/dashboardInsights';
import { DeltaChip } from './DeltaChip';

interface CompareLineProps {
  /** Variação em % sobre o mês anterior (null = sem base: só mostra o valor anterior). */
  change: number | null;
  tone: Tone;
  /** "setembro" ou "setembro (1 a 5)" */
  label: string;
  previousValue: number;
  /** Para leitor de tela: "a setembro", "ao mesmo período de setembro (dias 1 a 5)". */
  reference?: string;
}

/** Descritivo: linha de comparação sob um card — selo de variação + o valor do mês anterior. */
export function CompareLine({ change, tone, label, previousValue, reference }: CompareLineProps) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <DeltaChip change={change} tone={tone} reference={reference} />
      <span>
        em {label}: <span className="tabular-nums">{brl(previousValue)}</span>
      </span>
    </div>
  );
}

interface MarginLineProps {
  income: number;
  balance: number;
  /** "setembro" ou "setembro (1 a 5)"; null = sem base de comparação. */
  previousLabel: string | null;
  previousBalance: number | null;
}

/** Descritivo: quanto da receita sobrou (ou faltou) e o balanço do mês anterior. */
export function MarginLine({ income, balance, previousLabel, previousBalance }: MarginLineProps) {
  const hasMargin = income > 0;
  const hasPrevious = previousLabel !== null && previousBalance !== null;
  if (!hasMargin && !hasPrevious) return null;
  return (
    <p className="mt-1.5 text-xs text-muted-foreground">
      {hasMargin && (
        <>
          <span className={cn('font-medium', TONE[toneForSign(balance)].text)}>
            {balance >= 0 ? 'Sobra' : 'Déficit'} de {pct((Math.abs(balance) / income) * 100)}
          </span>{' '}
          da receita
        </>
      )}
      {hasMargin && hasPrevious && ' · '}
      {hasPrevious && (
        <>
          em {previousLabel}: <span className="tabular-nums">{brl(previousBalance)}</span>
        </>
      )}
    </p>
  );
}
