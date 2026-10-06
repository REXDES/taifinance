import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TONE, type Tone } from '@/lib/tone';
import { DeltaChip } from './DeltaChip';

export interface KpiDelta {
  change: number | null;
  tone: Tone;
  /** Base da comparação ("ao mês anterior", "ao mesmo período de setembro…"), para leitor de tela. */
  reference?: string;
}

interface KpiTileProps {
  icon: ReactNode;
  /** Cor do ícone e do selo. */
  tone: Tone;
  label: string;
  value: string;
  /** Se informado, o número também ganha a cor do tom (ex.: saldo negativo em vermelho). */
  valueTone?: Tone;
  delta?: KpiDelta | null;
  /** Ocupa o lugar do selo de variação (ex.: quantidade de contas). */
  badge?: ReactNode;
  /** Desenho discreto no fundo do tile (ex.: tendência) — não altera a altura. */
  backdrop?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * Tile do modo Visual: ícone, número grande e rótulo curto — nada além disso. O tile inteiro
 * é o botão (alvo de toque grande). O número se ajusta à largura do tile (container query) e à
 * quantidade de caracteres, então valores longos continuam inteiros, sem cortar nem abreviar.
 */
export function KpiTile({ icon, tone, label, value, valueTone, delta, badge, backdrop, onClick, ariaLabel }: KpiTileProps) {
  const className = cn(
    'group relative flex min-h-[8.25rem] w-full flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm md:min-h-[9.25rem] md:p-5',
    onClick &&
      'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
  );

  const content = (
    <>
      {backdrop && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden rounded-b-2xl" aria-hidden>
          {backdrop}
        </div>
      )}
      <div className="relative flex items-start justify-between gap-2">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full md:h-12 md:w-12',
            TONE[tone].softBg,
            TONE[tone].text,
          )}
          aria-hidden
        >
          {icon}
        </span>
        {delta ? <DeltaChip change={delta.change} tone={delta.tone} reference={delta.reference} /> : badge}
      </div>

      <div className="relative min-w-0">
        <div className="[container-type:inline-size]">
          <p
            className={cn('whitespace-nowrap font-bold leading-none tracking-tight tabular-nums', valueTone && TONE[valueTone].text)}
            style={
              {
                // largura de um número em negrito ≈ 0,62em por caractere
                '--chars': value.length,
                fontSize: 'clamp(0.75rem, calc(100cqw / (var(--chars) * 0.62)), 2.25rem)',
              } as CSSProperties
            }
          >
            {value}
          </p>
        </div>
        <p className="mt-2 text-[11px] font-medium uppercase leading-snug tracking-wide text-muted-foreground sm:text-xs">{label}</p>
      </div>
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className} aria-label={ariaLabel ?? `${label}: ${value}`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
