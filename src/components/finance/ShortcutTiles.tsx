import type { ShortcutDef } from '@/hooks/useShortcutUsage';
import type { FinanceView } from '@/pages/Finance';

interface ShortcutTilesProps {
  shortcuts: ShortcutDef[];
  onNavigate: (view: FinanceView) => void;
}

/**
 * Faixa de atalhos do dashboard.
 * Visual propositalmente diferente dos cards de informação: fundo translúcido,
 * borda e brilho azul (cor de ação) e ícone que acende ao passar o mouse,
 * para que fique claro que se trata de botões e não de números.
 */
export function ShortcutTiles({ shortcuts, onNavigate }: ShortcutTilesProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-shortcut">Atalhos</h2>
        <span className="text-xs text-muted-foreground">as telas que você mais usa</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {shortcuts.map((s) => (
          <button
            key={s.view}
            type="button"
            onClick={() => onNavigate(s.view)}
            className="group relative flex flex-col items-start p-4 md:p-5 rounded-xl border border-shortcut-border bg-shortcut-surface text-left overflow-hidden shadow-shortcut transition-all duration-300 hover:-translate-y-0.5 hover:border-shortcut/60 hover:bg-shortcut-surface-hover active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shortcut/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {/* Luz azul que surge sobre o tile ao passar o mouse */}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-shortcut/15 via-shortcut/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <span className="relative mb-3 w-11 h-11 rounded-lg border border-shortcut/25 bg-shortcut/10 text-shortcut flex items-center justify-center shadow-shortcut-glow transition-colors duration-300 group-hover:bg-shortcut group-hover:border-shortcut group-hover:text-shortcut-foreground">
              {s.icon}
            </span>

            <span className="relative block w-full text-sm md:text-base font-bold text-foreground truncate">
              {s.label}
            </span>
            <span className="relative block w-full mt-0.5 text-xs md:text-sm text-muted-foreground leading-snug line-clamp-2">
              {s.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
