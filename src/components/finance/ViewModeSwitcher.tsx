import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/contexts/ViewModeContext';
import { VIEW_MODES, VIEW_MODE_INFO } from '@/lib/viewMode';
import { VIEW_MODE_ICON } from './viewModeIcons';

/**
 * Botão do header que abre a escolha do modo de visualização. Cada opção traz uma frase
 * dizendo o que muda — quem abre pela primeira vez entende sem precisar testar os três.
 */
export function ViewModeSwitcher() {
  const { mode, setMode } = useViewMode();
  const [open, setOpen] = useState(false);
  const CurrentIcon = VIEW_MODE_ICON[mode];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label={`Modo de visualização: ${VIEW_MODE_INFO[mode].label}`}
          title={`Modo de visualização: ${VIEW_MODE_INFO[mode].label}`}
        >
          <CurrentIcon className="h-5 w-5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(92vw,20rem)] p-2">
        <p className="px-2 pb-2 pt-1 text-sm font-semibold">Como você prefere ver o sistema?</p>
        <div role="radiogroup" aria-label="Modo de visualização" className="space-y-1">
          {VIEW_MODES.map((option) => {
            const Icon = VIEW_MODE_ICON[option];
            const selected = option === mode;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setMode(option);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors',
                  'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  selected && 'bg-accent/60',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                    selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {VIEW_MODE_INFO[option].label}
                    {selected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {VIEW_MODE_INFO[option].description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
