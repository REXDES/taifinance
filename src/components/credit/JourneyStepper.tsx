import { CheckCircle2, Circle, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepDef {
  id: number;
  label: string;
  status: 'done' | 'current' | 'locked' | 'pending';
}

export function JourneyStepper({
  steps,
  active,
  onSelect,
}: {
  steps: StepDef[];
  active: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1 p-2 border-r min-w-[180px]">
      {steps.map((s) => {
        const disabled = s.status === 'locked';
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(s.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition',
              isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="shrink-0">
              {s.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {s.status === 'current' && <Loader2 className="w-4 h-4 text-primary animate-pulse" />}
              {s.status === 'pending' && <Circle className="w-4 h-4 text-muted-foreground" />}
              {s.status === 'locked' && <Lock className="w-4 h-4 text-muted-foreground" />}
            </span>
            <span className="flex-1">
              <span className="text-[10px] text-muted-foreground block leading-none">Etapa {s.id}</span>
              <span>{s.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
