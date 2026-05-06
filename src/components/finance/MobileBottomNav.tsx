import { cn } from '@/lib/utils';
import { Home, Zap, ArrowUpDown, CreditCard, Menu } from 'lucide-react';
import { FinanceView } from '@/pages/Finance';

interface MobileBottomNavProps {
  currentView: FinanceView;
  onChangeView: (view: FinanceView) => void;
  onOpenMenu: () => void;
  isAdminMode?: boolean;
}

interface NavTab {
  view: FinanceView | null;
  label: string;
  icon: React.ReactNode;
  action?: () => void;
}

export function MobileBottomNav({ currentView, onChangeView, onOpenMenu, isAdminMode }: MobileBottomNavProps) {
  const tabs: NavTab[] = isAdminMode
    ? [
        { view: 'admin-dashboard', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
        { view: 'audit-logs', label: 'Auditoria', icon: <ArrowUpDown className="w-5 h-5" /> },
        { view: null, label: 'Menu', icon: <Menu className="w-5 h-5" />, action: onOpenMenu },
      ]
    : [
        { view: 'dashboard', label: 'Início', icon: <Home className="w-5 h-5" /> },
        { view: 'quick-entry', label: 'Lançar', icon: <Zap className="w-5 h-5" /> },
        { view: 'transactions', label: 'Lançamentos', icon: <ArrowUpDown className="w-5 h-5" /> },
        { view: 'payables-receivables', label: 'P/R', icon: <CreditCard className="w-5 h-5" /> },
        { view: null, label: 'Menu', icon: <Menu className="w-5 h-5" />, action: onOpenMenu },
      ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => {
          const isActive = tab.view !== null && currentView === tab.view;
          const handleClick = tab.action ?? (() => tab.view && onChangeView(tab.view));

          return (
            <button
              key={tab.view ?? 'menu'}
              onClick={handleClick}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className={cn(
                'flex items-center justify-center w-10 h-6 rounded-full transition-colors',
                isActive && 'bg-primary/10'
              )}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
