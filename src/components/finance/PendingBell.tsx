import { useState } from 'react';
import { Bell, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { startDrillDown } from '@/lib/drillDown';
import type { FinanceView } from '@/pages/Finance';
import { usePendingItems, type PendingAccess, type PendingItem, type PendingSeverity } from '@/hooks/usePendingItems';

// Único lugar com as cores das pendências — tons discretos, sem fundo colorido nas
// linhas: a cor aparece só num ponto e no contador, o resto segue o tema.
const SEVERITY: Record<PendingSeverity, { dot: string; badge: string; label: string }> = {
  urgent: { dot: 'bg-red-500', badge: 'bg-red-500 text-white', label: 'Urgente' },
  attention: { dot: 'bg-amber-500', badge: 'bg-amber-500 text-white', label: 'Atenção' },
  info: { dot: 'bg-muted-foreground/40', badge: '', label: 'Informativo' },
};

interface PendingBellProps {
  companyId: string | null;
  access: PendingAccess;
  onNavigate: (view: FinanceView) => void;
}

export function PendingBell({ companyId, access, onNavigate }: PendingBellProps) {
  const [open, setOpen] = useState(false);
  const { items, actionableCount, topSeverity, loading, error, refetch } = usePendingItems(companyId, access);
  const [refreshing, setRefreshing] = useState(false);

  if (!companyId) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void refetch();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const go = (item: PendingItem) => {
    setOpen(false);
    // Com drill: a tela de destino abre já filtrada e confere o total com o número desta linha.
    if (item.drill) startDrillDown(item.drill);
    onNavigate(item.view);
  };

  const actionable = items.filter((i) => i.severity !== 'info');
  const upcoming = items.filter((i) => i.severity === 'info');

  const renderRow = (item: PendingItem) => (
    <button
      key={item.kind}
      type="button"
      onClick={() => go(item)}
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', SEVERITY[item.severity].dot)} aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="sr-only">{SEVERITY[item.severity].label}: </span>
        <span className="block text-sm font-medium text-foreground leading-snug">{item.title}</span>
        {item.detail && <span className="block mt-0.5 text-xs text-muted-foreground leading-snug">{item.detail}</span>}
      </span>
      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );

  const badgeText = actionableCount > 9 ? '9+' : String(actionableCount);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground"
          aria-label={
            actionableCount > 0
              ? `Pendências: ${actionableCount} ${actionableCount === 1 ? 'item pede' : 'itens pedem'} ação`
              : 'Pendências'
          }
          title="Pendências"
        >
          <Bell className="h-5 w-5" />
          {actionableCount > 0 && topSeverity && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 font-semibold text-center',
                SEVERITY[topSeverity].badge,
              )}
              aria-hidden
            >
              {badgeText}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Pendências</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Atualizar pendências"
            title="Atualizar"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Não foi possível carregar agora.</p>
              <Button variant="link" size="sm" onClick={handleRefresh}>
                Tentar de novo
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="text-sm font-medium">Tudo em dia</p>
              <p className="text-xs text-muted-foreground">Nenhuma pendência por aqui.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {actionable.map(renderRow)}
              {upcoming.length > 0 && (
                <>
                  {actionable.length > 0 && (
                    <p className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Nos próximos dias
                    </p>
                  )}
                  {upcoming.map(renderRow)}
                </>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
