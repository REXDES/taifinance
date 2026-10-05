import { AlertTriangle, CheckCircle2, Download, Filter, Info, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sameMoney } from '@/lib/drillDown';

interface Figure {
  value: number;
  count: number;
}

interface DrillDownBannerProps {
  /** O que está sendo mostrado, em frase simples. Ex.: "Despesas · outubro de 2026". */
  description: string;
  /** Nome do número clicado na tela de origem. Ex.: "Despesas do Mês". */
  originLabel: string;
  /** O que a pessoa viu na origem. */
  expected: Figure;
  /** O que esta tela soma agora, com os filtros atuais. */
  actual: Figure;
  /** Singular e plural do que se conta. Ex.: ['lançamento', 'lançamentos']. */
  unit: [string, string];
  /** A pessoa mexeu nos filtros depois de chegar — o total já não é o do card. */
  changed: boolean;
  loading?: boolean;
  onClear: () => void;
  onRestore: () => void;
  onExport: () => void;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const countText = (f: Figure, unit: [string, string]) => `${f.count} ${f.count === 1 ? unit[0] : unit[1]}`;

/**
 * Faixa que aparece ao chegar de um número clicado. Diz o que está filtrado e
 * CONFIRMA (ou denuncia) que o total desta tela é o mesmo que a pessoa viu — é o
 * que dá certeza para usar o número. Também leva a exportação para planilha.
 */
export function DrillDownBanner({
  description,
  originLabel,
  expected,
  actual,
  unit,
  changed,
  loading,
  onClear,
  onRestore,
  onExport,
}: DrillDownBannerProps) {
  const matches = sameMoney(expected.value, actual.value) && expected.count === actual.count;

  let tone: 'ok' | 'warn' | 'neutral' = 'neutral';
  let message: string;
  if (loading) {
    message = 'Conferindo os números…';
  } else if (changed) {
    message = `Você alterou os filtros — este total já não é o do card «${originLabel}».`;
  } else if (matches) {
    tone = 'ok';
    message = `Confere com «${originLabel}»: ${brl(actual.value)} · ${countText(actual, unit)}.`;
  } else {
    tone = 'warn';
    message = `No card «${originLabel}» eram ${brl(expected.value)} (${countText(expected, unit)}); agora são ${brl(actual.value)} (${countText(actual, unit)}). Os dados mudaram desde que você clicou.`;
  }

  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : Info;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">Mostrando: {description}</span>
        </p>
        <p
          className={cn(
            'flex items-start gap-2 text-xs leading-snug',
            tone === 'ok' && 'text-emerald-700 dark:text-emerald-400',
            tone === 'warn' && 'text-amber-700 dark:text-amber-400',
            tone === 'neutral' && 'text-muted-foreground',
          )}
          role="status"
        >
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{message}</span>
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {changed && (
          <Button variant="outline" size="sm" onClick={onRestore}>
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Voltar ao filtro do card
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onExport} disabled={loading}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Exportar para Excel
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <X className="mr-1 h-3.5 w-3.5" />
          Limpar filtro
        </Button>
      </div>
    </div>
  );
}
