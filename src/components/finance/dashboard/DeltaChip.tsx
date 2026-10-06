import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE, type Tone } from '@/lib/tone';
import { pct } from '@/lib/dashboardInsights';

interface DeltaChipProps {
  /** Variação em % (null = sem base de comparação: não mostra nada). */
  change: number | null;
  tone: Tone;
  /** Base da comparação, para leitor de tela: "ao mês anterior" (padrão) ou "ao mesmo período de setembro". */
  reference?: string;
  className?: string;
}

/**
 * Selo de variação: seta + percentual, na cor do tom (o sentido bom/ruim já vem em `tone`).
 * A cor nunca vai sozinha: a seta e o texto para leitor de tela dizem se subiu ou caiu.
 */
export function DeltaChip({ change, tone, reference = 'ao mês anterior', className }: DeltaChipProps) {
  if (change === null) return null;
  const flat = Math.abs(change) < 0.5;
  const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        TONE[tone].softBg,
        TONE[tone].text,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {flat ? 'estável' : pct(Math.abs(change))}
      <span className="sr-only">
        {flat ? '' : change > 0 ? ' de alta' : ' de queda'} em relação {reference}
      </span>
    </span>
  );
}
