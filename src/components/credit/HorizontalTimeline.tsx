import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  labels: string[];
  current: number; // 1-based
  compact?: boolean;
  className?: string;
}

export function HorizontalTimeline({ labels, current, compact = false, className }: Props) {
  return (
    <div className={cn('flex items-center w-full', className)}>
      {labels.map((label, i) => {
        const id = i + 1;
        const done = id < current;
        const isCurrent = id === current;
        const last = i === labels.length - 1;
        return (
          <div key={id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={cn(
                  'rounded-full border flex items-center justify-center transition',
                  compact ? 'w-3.5 h-3.5 text-[8px]' : 'w-6 h-6 text-[10px]',
                  done && 'bg-emerald-500 border-emerald-500 text-white',
                  isCurrent && 'bg-primary border-primary text-primary-foreground ring-2 ring-primary/30 scale-110',
                  !done && !isCurrent && 'bg-background border-muted-foreground/30 text-muted-foreground'
                )}
                title={`Etapa ${id} — ${label}`}
              >
                {done ? <Check className={compact ? 'w-2 h-2' : 'w-3 h-3'} /> : id}
              </div>
              {!compact && (
                <span
                  className={cn(
                    'text-[10px] whitespace-nowrap',
                    isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              )}
            </div>
            {!last && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-1 transition',
                  compact ? '-mt-0' : '-mt-4',
                  done ? 'bg-emerald-500' : 'bg-muted-foreground/20'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
