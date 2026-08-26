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
  Shield,
  ShieldCheck,
  LayoutDashboard,
  Wrench,
  Truck,
  HardHat,
  ClipboardCheck,
  Hammer,
  Briefcase,
  Split,
  Barcode,
  ArrowLeftRight,
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
import { usePermissions } from '@/hooks/usePermissions';
import { FINANCE_VIEW_PERMISSION_KEY } from '@/lib/permissions';

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
  accessMode?: 'admin' | 'normal';
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
  machinesEnabled?: boolean;
  creditEnabled?: boolean;
  bankDigitalEnabled?: boolean;
  paymentsEnabled?: boolean;
}

type MenuItem = { view: FinanceView; label: string; icon: React.ReactNode };

const mainMenuItems: MenuItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
  { view: 'quick-entry', label: 'Lance Rápido (Finanças)', icon: <Zap className="w-4 h-4" /> },
];

const bankDigitalMenuItem: MenuItem = { view: 'bank-digital', label: 'Banco Digital', icon: <Landmark className="w-4 h-4" /> };

const transacoesMenuItems: MenuItem[] = [
  { view: 'transactions', label: 'Lançamentos', icon: <ArrowUpDown className="w-4 h-4" /> },
  { view: 'transfers', label: 'Transferências', icon: <ArrowRightLeft className="w-4 h-4" /> },
  { view: 'payables-receivables', label: 'Contas a Pagar/Receber', icon: <CreditCard className="w-4 h-4" /> },
  { view: 'statement-import', label: 'Importar Extrato', icon: <FileSearch className="w-4 h-4" /> },
  { view: 'boletos', label: 'Boletos', icon: <Barcode className="w-4 h-4" /> },
];

const relatoriosMainItems: MenuItem[] = [
  { view: 'balance', label: 'Balancete', icon: <BarChart3 className="w-4 h-4" /> },
];

const movimentacoesMenuItems: MenuItem[] = [
  { view: 'statement', label: 'Extrato', icon: <FileText className="w-4 h-4" /> },
  { view: 'category-report', label: 'Por Categoria', icon: <PieChart className="w-4 h-4" /> },
  { view: 'tag-report', label: 'Por Tag', icon: <Tags className="w-4 h-4" /> },
  { view: 'cash-flow', label: 'Fluxo Financeiro', icon: <Activity className="w-4 h-4" /> },
];

const pagarReceberMenuItems: MenuItem[] = [
  { view: 'payables-receivables-report', label: 'Contas a Pagar/Receber', icon: <FileSearch className="w-4 h-4" /> },
  { view: 'payables-receivables-calendar', label: 'Calendário Financeiro', icon: <Calendar className="w-4 h-4" /> },
  { view: 'payables-receivables-flow', label: 'Fluxo de Contas', icon: <TrendingUp className="w-4 h-4" /> },
];

const allRelatoriosItems = [...relatoriosMainItems, ...movimentacoesMenuItems, ...pagarReceberMenuItems];

const cadastrosMenuItems: MenuItem[] = [
  { view: 'accounts', label: 'Contas', icon: <Wallet className="w-4 h-4" /> },
  { view: 'categories', label: 'Categorias', icon: <Tags className="w-4 h-4" /> },
  { view: 'tags', label: 'Tags', icon: <Tags className="w-4 h-4" /> },
  { view: 'clients-suppliers', label: 'Clientes/Fornecedores', icon: <Users className="w-4 h-4" /> },
  { view: 'split-pix', label: 'Split de PIX', icon: <Split className="w-4 h-4" /> },
];

const machinesTopMenuItems: MenuItem[] = [
  { view: 'machines-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { view: 'machines-inventory', label: 'Inventário', icon: <Truck className="w-4 h-4" /> },
  { view: 'machines-maintenance', label: 'Manutenções', icon: <Hammer className="w-4 h-4" /> },
];
const machinesGestaoMenuItems: MenuItem[] = [
  { view: 'machines-rentals', label: 'Locações', icon: <ClipboardCheck className="w-4 h-4" /> },
  { view: 'machines-pricing', label: 'Tabela de Preços', icon: <Tags className="w-4 h-4" /> },
  { view: 'machines-movements', label: 'Vendidos e Baixados', icon: <ArrowLeftRight className="w-4 h-4" /> },
];

const machinesCadastrosMenuItems: MenuItem[] = [
  { view: 'machines-operators', label: 'Operadores', icon: <HardHat className="w-4 h-4" /> },
  { view: 'machines-mechanics', label: 'Mecânicos', icon: <Wrench className="w-4 h-4" /> },
  { view: 'machines-catalog', label: 'Categorias e Tipos', icon: <Tags className="w-4 h-4" /> },
  { view: 'clients-suppliers', label: 'Clientes/Fornecedores', icon: <Users className="w-4 h-4" /> },
];
const machinesMenuItems: MenuItem[] = [
  ...machinesTopMenuItems,
  ...machinesGestaoMenuItems,
  ...machinesCadastrosMenuItems,
];

const creditMenuItems: MenuItem[] = [
  { view: 'credit-applications', label: 'Propostas', icon: <ClipboardList className="w-4 h-4" /> },
];
const creditAdminMenuItems: MenuItem[] = [
  { view: 'credit-ignored', label: 'Ocorrências Ignoradas', icon: <Shield className="w-4 h-4" /> },
];

const paymentsMenuItems: MenuItem[] = [
  { view: 'payments-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { view: 'payments-registration', label: 'Cadastro', icon: <Building2 className="w-4 h-4" /> },
  { view: 'payments-charges', label: 'Cobranças', icon: <Receipt className="w-4 h-4" /> },
];

const paymentsAdminMenuItems: MenuItem[] = [
  { view: 'payments-admin-dashboard', label: 'Pagamentos — Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { view: 'payments-admin-registration', label: 'Pagamentos — Cadastros', icon: <Building2 className="w-4 h-4" /> },
  { view: 'payments-admin-settlements', label: 'Pagamentos — Liquidações', icon: <TrendingUp className="w-4 h-4" /> },
  { view: 'payments-admin-settings', label: 'Pagamentos — Configurações', icon: <Settings className="w-4 h-4" /> },
];


export function FinanceSidebar({
  companies,
  selectedCompanyId,
  onSelectCompany,
  currentView,
  onChangeView,
  isSupervisor = false,
  isGerente = false,
  accessMode = 'normal',
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
  machinesEnabled = false,
  creditEnabled = false,
  bankDigitalEnabled = false,
  paymentsEnabled = false,
}: FinanceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const isAdminMode = accessMode === 'admin';
  const { can } = usePermissions();

  // Filter helper: hide sidebar items whose permission key is denied for this role.
  // Supervisor and unknown views always pass (unmapped views default to allowed).
  const filterAllowed = (items: MenuItem[]) =>
    isAdminMode || isSupervisor
      ? items
      : items.filter(i => {
           const key = FINANCE_VIEW_PERMISSION_KEY[i.view];
           return !!key && can(key);
        });


  // Accordion state for top-level groups in normal mode (only one open at a time)
  type TopGroup = 'gestao' | 'machines' | 'credit' | 'payments';
  type SubGroup = 'transacoes' | 'relatorios' | 'cadastros';
  const isInGestao =
    transacoesMenuItems.some(i => currentView === i.view) ||
    allRelatoriosItems.some(i => currentView === i.view) ||
    cadastrosMenuItems.some(i => currentView === i.view);
  const initialOpenGroup: TopGroup | null =
    isInGestao ? 'gestao'
    : machinesMenuItems.some(i => currentView === i.view) ? 'machines'
    : creditMenuItems.some(i => currentView === i.view) ? 'credit'
    : paymentsMenuItems.some(i => currentView === i.view) ? 'payments'
    : null;
  const initialOpenSub: SubGroup | null =
    transacoesMenuItems.some(i => currentView === i.view) ? 'transacoes'
    : allRelatoriosItems.some(i => currentView === i.view) ? 'relatorios'
    : cadastrosMenuItems.some(i => currentView === i.view) ? 'cadastros'
    : null;
  const [openGroup, setOpenGroup] = useState<TopGroup | null>(initialOpenGroup);
  const [openSubGroup, setOpenSubGroup] = useState<SubGroup | null>(initialOpenSub);
  const setGroup = (g: TopGroup) => (open: boolean) => setOpenGroup(open ? g : null);
  const setSubGroup = (g: SubGroup) => (open: boolean) => setOpenSubGroup(open ? g : null);

  const renderMenuItem = (item: MenuItem) => (
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
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "h-full bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-14" : "w-64",
        isAdminMode && "border-r-primary/30"
      )}>
        {/* Logo */}
        <div className={cn("p-4 border-b border-border", collapsed && "px-2", isAdminMode && "bg-primary/5")}>
          <div className={cn(
            "flex",
            collapsed ? "flex-col items-center gap-2" : "items-center justify-between"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                isAdminMode ? "bg-primary" : "bg-primary"
              )}>
                {isAdminMode ? (
                  <Shield className="w-4 h-4 text-primary-foreground" />
                ) : (
                  <span className="text-primary-foreground font-bold text-sm">TAI</span>
                )}
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground leading-tight">Tai Finance</span>
                  {isAdminMode && (
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Admin</span>
                  )}
                </div>
              )}
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

        {/* Company Selector — escondido em admin mode (admin trabalha global; seleção via dialog) */}
        {!isAdminMode && !collapsed && companies.length > 0 && (
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

        {!isAdminMode && collapsed && selectedCompany && (
          <div className="p-2 border-b border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-full flex items-center justify-center p-2 rounded-md hover:bg-accent">
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
            {isAdminMode ? (
              /* ============== ADMIN MODE MENU ============== */
              <>
                {renderMenuItem({ view: 'admin-dashboard', label: 'Dashboard Admin', icon: <LayoutDashboard className="w-4 h-4" /> })}
                {renderMenuItem({ view: 'admin-users', label: 'Usuários', icon: <Users className="w-4 h-4" /> })}
                {renderMenuItem({ view: 'admin-roles', label: 'Cargos & Permissões', icon: <ShieldCheck className="w-4 h-4" /> })}
                {bankDigitalEnabled && renderMenuItem({ view: 'bank-digital', label: 'Banco Digital (config)', icon: <Landmark className="w-4 h-4" /> })}
                {renderMenuItem({ view: 'credit-admin', label: 'Gestão de Crédito (config)', icon: <CreditCard className="w-4 h-4" /> })}

                {paymentsAdminMenuItems.map(renderMenuItem)}

                {!collapsed && (

                  <div className="pt-2 pb-1 px-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Gestão da Plataforma
                    </span>
                  </div>
                )}

                {/* Configurações da Empresa */}
                {selectedCompanyId && onOpenCompanySettings && (
                  collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-full" onClick={onOpenCompanySettings}>
                          <Settings className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Configurações da Empresa</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-foreground hover:bg-accent"
                      onClick={onOpenCompanySettings}
                    >
                      <Settings className="w-4 h-4" />
                      Configurações da Empresa
                    </Button>
                  )
                )}

                {/* "Gerenciar Empresas" removido — era duplicata de "Configurações da Empresa".
                    Use o seletor de empresa no topo do sidebar para escolher qual empresa configurar. */}

                {/* Nova Empresa */}
                {canCreateCompany && onCreateCompany && (
                  collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-full" onClick={onCreateCompany}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Nova Empresa</TooltipContent>
                    </Tooltip>
                  ) : (
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
                  )
                )}

                {/* "Usuários" (dialog por empresa) removido — use o menu "Usuários" global acima. */}


                {/* Convites */}
                {canInvite && onOpenInvitations && (
                  collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-full" onClick={onOpenInvitations}>
                          <UserPlus className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Convites</TooltipContent>
                    </Tooltip>
                  ) : (
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
                  )
                )}

                {/* Logs de Auditoria */}
                {isSupervisor && renderMenuItem({ view: 'audit-logs', label: 'Logs de Auditoria', icon: <FileSearch className="w-4 h-4" /> })}
              </>
            ) : (
              /* ============== NORMAL MODE MENU ============== */
              <>
                {filterAllowed(mainMenuItems).map(renderMenuItem)}
                {bankDigitalEnabled && can('finance.bank_digital') && renderMenuItem(bankDigitalMenuItem)}

                {/* Gestão Financeira (engloba Transações, Relatórios, Cadastros) */}
                {collapsed ? (
                  <>
                    {filterAllowed(transacoesMenuItems).map(renderMenuItem)}
                    {filterAllowed(allRelatoriosItems).map(renderMenuItem)}
                    {filterAllowed(cadastrosMenuItems).map(renderMenuItem)}
                  </>
                ) : (
                  <Collapsible open={openGroup === 'gestao'} onOpenChange={setGroup('gestao')}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                        <span className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          Gestão Financeira
                        </span>
                        <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 space-y-1 mt-1">
                      {/* Transações */}
                      <Collapsible open={openSubGroup === 'transacoes'} onOpenChange={setSubGroup('transacoes')}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                            <span className="flex items-center gap-2">
                              <Receipt className="w-4 h-4" />
                              Transações
                            </span>
                            <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 space-y-1 mt-1">
                          {filterAllowed(transacoesMenuItems).map(renderMenuItem)}
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Relatórios */}
                      <Collapsible open={openSubGroup === 'relatorios'} onOpenChange={setSubGroup('relatorios')}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                            <span className="flex items-center gap-2">
                              <ClipboardList className="w-4 h-4" />
                              Relatórios
                            </span>
                            <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 space-y-1 mt-1">
                          {filterAllowed(relatoriosMainItems).map(renderMenuItem)}

                          <Collapsible defaultOpen={movimentacoesMenuItems.some(item => currentView === item.view)}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                                <span className="flex items-center gap-2">
                                  <Activity className="w-4 h-4" />
                                  Movimentações
                                </span>
                                <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-4 space-y-1 mt-1">
                              {filterAllowed(movimentacoesMenuItems).map(renderMenuItem)}
                            </CollapsibleContent>
                          </Collapsible>

                          <Collapsible defaultOpen={pagarReceberMenuItems.some(item => currentView === item.view)}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                                <span className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4" />
                                  Pagar/Receber
                                </span>
                                <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-4 space-y-1 mt-1">
                              {filterAllowed(pagarReceberMenuItems).map(renderMenuItem)}
                            </CollapsibleContent>
                          </Collapsible>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Cadastros */}
                      <Collapsible open={openSubGroup === 'cadastros'} onOpenChange={setSubGroup('cadastros')}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                            <span className="flex items-center gap-2">
                              <FolderCog className="w-4 h-4" />
                              Cadastros
                            </span>
                            <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 space-y-1 mt-1">
                          {filterAllowed(cadastrosMenuItems).map(renderMenuItem)}
                        </CollapsibleContent>
                      </Collapsible>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Máquinas & Locação (módulo opcional por empresa) */}
                {machinesEnabled && (
                  collapsed ? (
                    filterAllowed(machinesMenuItems).map(renderMenuItem)
                  ) : (
                    <Collapsible open={openGroup === 'machines'} onOpenChange={setGroup('machines')}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                          <span className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            Máquinas & Locação
                          </span>
                          <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 space-y-1 mt-1">
                        {filterAllowed(machinesTopMenuItems).map(renderMenuItem)}

                        <Collapsible defaultOpen={machinesGestaoMenuItems.some(i => currentView === i.view)}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                              <span className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4" />
                                Gestão
                              </span>
                              <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-4 space-y-1 mt-1">
                            {filterAllowed(machinesGestaoMenuItems).map(renderMenuItem)}
                          </CollapsibleContent>
                        </Collapsible>

                        <Collapsible defaultOpen={machinesCadastrosMenuItems.some(i => currentView === i.view)}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                              <span className="flex items-center gap-2">
                                <FolderCog className="w-4 h-4" />
                                Cadastros
                              </span>
                              <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-4 space-y-1 mt-1">
                            {filterAllowed(machinesCadastrosMenuItems).map(renderMenuItem)}
                          </CollapsibleContent>
                        </Collapsible>
                      </CollapsibleContent>
                    </Collapsible>
                  )
                )}

                {/* Gestão de Crédito (módulo opcional por empresa) */}
                {creditEnabled && (
                  collapsed ? (
                    <>
                      {filterAllowed(creditMenuItems).map(renderMenuItem)}
                      {(isSupervisor || isGerente) && filterAllowed(creditAdminMenuItems).map(renderMenuItem)}
                    </>
                  ) : (
                    <Collapsible open={openGroup === 'credit'} onOpenChange={setGroup('credit')}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                          <span className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Gestão de Crédito
                          </span>
                          <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 space-y-1 mt-1">
                        {filterAllowed(creditMenuItems).map(renderMenuItem)}
                        {(isSupervisor || isGerente) && filterAllowed(creditAdminMenuItems).map(renderMenuItem)}
                      </CollapsibleContent>
                    </Collapsible>
                  )
                )}

                {/* Pagamentos - Necta (módulo opcional por empresa) */}
                {paymentsEnabled && (
                  collapsed ? (
                    filterAllowed(paymentsMenuItems).map(renderMenuItem)
                  ) : (
                    <Collapsible open={openGroup === 'payments'} onOpenChange={setGroup('payments')}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-accent">
                          <span className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Pagamentos
                          </span>
                          <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 space-y-1 mt-1">
                        {filterAllowed(paymentsMenuItems).map(renderMenuItem)}
                      </CollapsibleContent>
                    </Collapsible>
                  )
                )}

                {/* Administração da empresa — disponível também no modo normal */}
                {!collapsed && (canCreateCompany || canInvite || (selectedCompanyId && onOpenCompanySettings && (isSupervisor || (isGerente && can('admin.companies'))))) && (
                  <div className="pt-2 pb-1 px-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Administração
                    </span>
                  </div>
                )}

                {canCreateCompany && onCreateCompany && (
                  collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-full" onClick={onCreateCompany}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Nova Empresa</TooltipContent>
                    </Tooltip>
                  ) : (
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
                  )
                )}

                {canInvite && onOpenInvitations && selectedCompanyId && (
                  collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-full" onClick={onOpenInvitations}>
                          <UserPlus className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Convidar Usuário</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-foreground hover:bg-accent"
                      onClick={onOpenInvitations}
                    >
                      <UserPlus className="w-4 h-4" />
                      Convidar Usuário
                      {isGerente && invitationLimit !== null && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {invitationsCreated}/{invitationLimit}
                        </Badge>
                      )}
                    </Button>
                  )
                )}

                {/* Configurações da Empresa (supervisor e gerente) */}
                {selectedCompanyId && onOpenCompanySettings && (isSupervisor || (isGerente && can('admin.companies'))) && (
                  collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-full" onClick={onOpenCompanySettings}>
                          <Settings className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Configurações da Empresa</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-foreground hover:bg-accent"
                      onClick={onOpenCompanySettings}
                    >
                      <Settings className="w-4 h-4" />
                      Configurações da Empresa
                    </Button>
                  )
                )}
              </>
            )}
          </div>
        </nav>

        {/* Create company button when no companies exist */}
        {companies.length === 0 && !collapsed && canCreateCompany && (
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
