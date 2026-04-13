import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Home, 
  Wallet, 
  ArrowUpDown, 
  ArrowRightLeft, 
  BarChart3, 
  FileText, 
  Tags,
  PanelLeftClose,
  PanelLeft,
  Building2,
  Plus,
  Settings,
  Users,
  UserPlus,
  FolderCog,
  Receipt,
  ClipboardList,
  PieChart,
  Activity,
  FileSearch,
  CreditCard,
  Calendar,
  TrendingUp,
  Zap,
  Landmark,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { FinanceView } from '@/pages/Finance';

interface Company {
  id: string;
  name: string;
  color: string;
}

interface FinanceSidebarProps {
  companies: Company[];
  selectedCompanyId: string | null;
  onSelectCompany: (id: string) => void;
  currentView: FinanceView;
  onChangeView: (view: FinanceView) => void;
  isSupervisor?: boolean;
  isGerente?: boolean;
  canCreateCompany?: boolean;
  companyLimit?: number | null;
  companiesCreated?: number;
  canInvite?: boolean;
  invitationLimit?: number | null;
  invitationsCreated?: number;
  onCreateCompany?: () => void;
  onManageCompanies?: () => void;
  onOpenUsers?: () => void;
  onOpenInvitations?: () => void;
  onOpenCompanySettings?: () => void;
}

// Main menu items (not in submenus)
const mainMenuItems: { view: FinanceView; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
  { view: 'quick-entry', label: 'Lance Rápido', icon: <Zap className="w-4 h-4" /> },
  { view: 'bank-digital', label: 'Banco Digital', icon: <Landmark className="w-4 h-4" /> },
];

// Sub-menu items for "Transações"
const transacoesMenuItems: { view: FinanceView; label: string; icon: React.ReactNode }[] = [
  { view: 'transactions', label: 'Lançamentos', icon: <ArrowUpDown className="w-4 h-4" /> },
  { view: 'transfers', label: 'Transferências', icon: <ArrowRightLeft className="w-4 h-4" /> },
  { view: 'payables-receivables', label: 'Contas a Pagar/Receber', icon: <CreditCard className="w-4 h-4" /> },
];

// Sub-menu items for "Relatórios" - Balancete (main item, not in submenu)
const relatoriosMainItems: { view: FinanceView; label: string; icon: React.ReactNode }[] = [
  { view: 'balance', label: 'Balancete', icon: <BarChart3 className="w-4 h-4" /> },
];

// Sub-menu items for "Relatórios > Movimentações"
const movimentacoesMenuItems: { view: FinanceView; label: string; icon: React.ReactNode }[] = [
  { view: 'statement', label: 'Extrato', icon: <FileText className="w-4 h-4" /> },
  { view: 'category-report', label: 'Por Categoria', icon: <PieChart className="w-4 h-4" /> },
  { view: 'cash-flow', label: 'Fluxo Financeiro', icon: <Activity className="w-4 h-4" /> },
];

// Sub-menu items for "Relatórios > Pagar/Receber"
const pagarReceberMenuItems: { view: FinanceView; label: string; icon: React.ReactNode }[] = [
  { view: 'payables-receivables-report', label: 'Contas a Pagar/Receber', icon: <FileSearch className="w-4 h-4" /> },
  { view: 'payables-receivables-calendar', label: 'Calendário Financeiro', icon: <Calendar className="w-4 h-4" /> },
  { view: 'payables-receivables-flow', label: 'Fluxo de Contas', icon: <TrendingUp className="w-4 h-4" /> },
];

// All relatórios items combined for collapsed view
const allRelatoriosItems = [...relatoriosMainItems, ...movimentacoesMenuItems, ...pagarReceberMenuItems];

// Sub-menu items for "Cadastros"
const cadastrosMenuItems: { view: FinanceView; label: string; icon: React.ReactNode }[] = [
  { view: 'accounts', label: 'Contas', icon: <Wallet className="w-4 h-4" /> },
  { view: 'categories', label: 'Categorias', icon: <Tags className="w-4 h-4" /> },
  { view: 'clients-suppliers', label: 'Clientes/Fornecedores', icon: <Users className="w-4 h-4" /> },
];

export function FinanceSidebar({
  companies,
  selectedCompanyId,
  onSelectCompany,
  currentView,
  onChangeView,
  isSupervisor = false,
  isGerente = false,
  canCreateCompany = false,
  companyLimit,
  companiesCreated = 0,
  canInvite = false,
  invitationLimit,
  invitationsCreated = 0,
  onCreateCompany,
  onManageCompanies,
  onOpenUsers,
  onOpenInvitations,
  onOpenCompanySettings,
}: FinanceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-14" : "w-64"
      )}>
        {/* Logo */}
        <div className={cn("p-4 border-b border-border", collapsed && "px-2")}>
          <div className={cn(
            "flex",
            collapsed ? "flex-col items-center gap-2" : "items-center justify-between"
          )}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-bold text-sm">TAI</span>
              </div>
              {!collapsed && <span className="font-semibold text-foreground">Tai Finance</span>}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="w-6 h-6"
                  onClick={() => setCollapsed(!collapsed)}
                >
                  {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{collapsed ? 'Expandir menu' : 'Recolher menu'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Company Selector */}
        {!collapsed && companies.length > 0 && (
          <div className="p-2 border-b border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-2 rounded-md bg-accent/50 w-full hover:bg-accent transition-colors">
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0"
                    style={{ backgroundColor: selectedCompany ? `hsl(${selectedCompany.color})` : 'hsl(var(--muted))' }}
                  >
                    {selectedCompany?.name.charAt(0) || '?'}
                  </div>
                  <span className="text-sm font-medium text-foreground flex-1 truncate text-left">
                    {selectedCompany?.name || 'Selecione uma empresa'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {companies.map((company) => (
                  <DropdownMenuItem key={company.id} onClick={() => onSelectCompany(company.id)}>
                    <div 
                      className="w-4 h-4 rounded mr-2"
                      style={{ backgroundColor: `hsl(${company.color})` }}
                    />
                    {company.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {collapsed && selectedCompany && (
          <div className="p-2 border-b border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="w-full flex items-center justify-center p-2 rounded-md hover:bg-accent"
                >
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-primary-foreground"
                    style={{ backgroundColor: `hsl(${selectedCompany.color})` }}
                  >
                    {selectedCompany.name.charAt(0)}
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{selectedCompany.name}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {/* Main menu items */}
            {mainMenuItems.map((item) => (
              collapsed ? (
                <Tooltip key={item.view}>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("w-full", currentView === item.view && "bg-accent")}
                      onClick={() => onChangeView(item.view)}
                    >
                      {item.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <Button 
                  key={item.view}
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-2 text-foreground hover:bg-accent",
                    currentView === item.view && "bg-accent"
                  )}
                  onClick={() => onChangeView(item.view)}
                >
                  {item.icon}
                  {item.label}
                </Button>
              )
            ))}

            {/* Transações submenu */}
            {collapsed ? (
              // When collapsed, show transacoes items as regular icons
              transacoesMenuItems.map((item) => (
                <Tooltip key={item.view}>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("w-full", currentView === item.view && "bg-accent")}
                      onClick={() => onChangeView(item.view)}
                    >
                      {item.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ))
            ) : (
              <Collapsible defaultOpen={transacoesMenuItems.some(item => currentView === item.view)}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between text-foreground hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Transações
                    </span>
                    <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  {transacoesMenuItems.map((item) => (
                    <Button 
                      key={item.view}
                      variant="ghost" 
                      className={cn(
                        "w-full justify-start gap-2 text-foreground hover:bg-accent",
                        currentView === item.view && "bg-accent"
                      )}
                      onClick={() => onChangeView(item.view)}
                    >
                      {item.icon}
                      {item.label}
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Relatórios submenu */}
            {collapsed ? (
              // When collapsed, show relatorios items as regular icons
              allRelatoriosItems.map((item) => (
                <Tooltip key={item.view}>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("w-full", currentView === item.view && "bg-accent")}
                      onClick={() => onChangeView(item.view)}
                    >
                      {item.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ))
            ) : (
              <Collapsible defaultOpen={allRelatoriosItems.some(item => currentView === item.view)}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between text-foreground hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" />
                      Relatórios
                    </span>
                    <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  {/* Balancete - main item */}
                  {relatoriosMainItems.map((item) => (
                    <Button 
                      key={item.view}
                      variant="ghost" 
                      className={cn(
                        "w-full justify-start gap-2 text-foreground hover:bg-accent",
                        currentView === item.view && "bg-accent"
                      )}
                      onClick={() => onChangeView(item.view)}
                    >
                      {item.icon}
                      {item.label}
                    </Button>
                  ))}

                  {/* Movimentações sub-submenu */}
                  <Collapsible defaultOpen={movimentacoesMenuItems.some(item => currentView === item.view)}>
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-between text-foreground hover:bg-accent"
                      >
                        <span className="flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          Movimentações
                        </span>
                        <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 space-y-1 mt-1">
                      {movimentacoesMenuItems.map((item) => (
                        <Button 
                          key={item.view}
                          variant="ghost" 
                          className={cn(
                            "w-full justify-start gap-2 text-foreground hover:bg-accent",
                            currentView === item.view && "bg-accent"
                          )}
                          onClick={() => onChangeView(item.view)}
                        >
                          {item.icon}
                          {item.label}
                        </Button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Pagar/Receber sub-submenu */}
                  <Collapsible defaultOpen={pagarReceberMenuItems.some(item => currentView === item.view)}>
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-between text-foreground hover:bg-accent"
                      >
                        <span className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Pagar/Receber
                        </span>
                        <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 space-y-1 mt-1">
                      {pagarReceberMenuItems.map((item) => (
                        <Button 
                          key={item.view}
                          variant="ghost" 
                          className={cn(
                            "w-full justify-start gap-2 text-foreground hover:bg-accent",
                            currentView === item.view && "bg-accent"
                          )}
                          onClick={() => onChangeView(item.view)}
                        >
                          {item.icon}
                          {item.label}
                        </Button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Cadastros submenu */}
            {collapsed ? (
              // When collapsed, show cadastros items as regular icons
              cadastrosMenuItems.map((item) => (
                <Tooltip key={item.view}>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("w-full", currentView === item.view && "bg-accent")}
                      onClick={() => onChangeView(item.view)}
                    >
                      {item.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ))
            ) : (
              <Collapsible defaultOpen={cadastrosMenuItems.some(item => currentView === item.view)}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between text-foreground hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <FolderCog className="w-4 h-4" />
                      Cadastros
                    </span>
                    <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  {cadastrosMenuItems.map((item) => (
                    <Button 
                      key={item.view}
                      variant="ghost" 
                      className={cn(
                        "w-full justify-start gap-2 text-foreground hover:bg-accent",
                        currentView === item.view && "bg-accent"
                      )}
                      onClick={() => onChangeView(item.view)}
                    >
                      {item.icon}
                      {item.label}
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </nav>

        {/* Configurações submenu */}
        {(isSupervisor || isGerente) && (
          <div className="p-2 border-t border-border">
            {collapsed ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-full"
                      onClick={onOpenUsers}
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Usuários</TooltipContent>
                </Tooltip>
                {canInvite && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-full"
                        onClick={onOpenInvitations}
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Convites {isGerente && invitationLimit !== null && `(${invitationsCreated}/${invitationLimit})`}
                    </TooltipContent>
                  </Tooltip>
                )}
                {canCreateCompany && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-full"
                        onClick={onCreateCompany}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Nova Empresa {isGerente && companyLimit !== null && `(${companiesCreated}/${companyLimit})`}
                    </TooltipContent>
                  </Tooltip>
                )}
                {isSupervisor && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-full"
                        onClick={onManageCompanies}
                      >
                        <Building2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Gerenciar Empresas</TooltipContent>
                  </Tooltip>
                )}
                {isSupervisor && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn("w-full", currentView === 'audit-logs' && "bg-accent")}
                        onClick={() => onChangeView('audit-logs')}
                      >
                        <FileSearch className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Logs de Auditoria</TooltipContent>
                  </Tooltip>
                )}
              </>
            ) : (
              <Collapsible defaultOpen={currentView === 'audit-logs'}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between text-foreground hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Configurações
                    </span>
                    <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-2 text-foreground hover:bg-accent"
                    onClick={onOpenUsers}
                  >
                    <Users className="w-4 h-4" />
                    Usuários
                  </Button>
                  {canInvite && (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-2 text-foreground hover:bg-accent"
                      onClick={onOpenInvitations}
                    >
                      <UserPlus className="w-4 h-4" />
                      Convites
                      {isGerente && invitationLimit !== null && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {invitationsCreated}/{invitationLimit}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {canCreateCompany && (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-2 text-foreground hover:bg-accent"
                      onClick={onCreateCompany}
                    >
                      <Plus className="w-4 h-4" />
                      Nova Empresa
                      {isGerente && companyLimit !== null && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {companiesCreated}/{companyLimit}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {isSupervisor && (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-2 text-foreground hover:bg-accent"
                      onClick={onManageCompanies}
                    >
                      <Building2 className="w-4 h-4" />
                      Gerenciar Empresas
                    </Button>
                  )}
                  {selectedCompanyId && (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-2 text-foreground hover:bg-accent"
                      onClick={onOpenCompanySettings}
                    >
                      <FolderCog className="w-4 h-4" />
                      Config. da Empresa
                    </Button>
                  )}
                  {isSupervisor && (
                    <Button 
                      variant="ghost" 
                      className={cn(
                        "w-full justify-start gap-2 text-foreground hover:bg-accent",
                        currentView === 'audit-logs' && "bg-accent"
                      )}
                      onClick={() => onChangeView('audit-logs')}
                    >
                      <FileSearch className="w-4 h-4" />
                      Logs de Auditoria
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Create company button when no companies exist */}
        {companies.length === 0 && !collapsed && (
          <div className="p-2 border-t border-border">
            <Button 
              variant="default" 
              className="w-full justify-start gap-2"
              onClick={onCreateCompany}
            >
              <Plus className="w-4 h-4" />
              Criar Primeira Empresa
            </Button>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
