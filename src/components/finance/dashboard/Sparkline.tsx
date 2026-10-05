import { cn } from '@/lib/utils';

/** Linha mínima de tendência, sem eixos nem texto. Herda a cor do texto (currentColor). */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const width = 100;
  const height = 32;
  const pad = 2;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn('h-8 w-full', className)} aria-hidden>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill="currentColor" opacity="0.12" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
