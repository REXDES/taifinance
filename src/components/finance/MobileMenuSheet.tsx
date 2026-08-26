import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home,
  Wallet,
  ArrowUpDown,
  ArrowRightLeft,
  BarChart3,
  FileText,
  Tags,
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
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Barcode,
} from 'lucide-react';
import { FinanceView } from '@/pages/Finance';

interface Company {
  id: string;
  name: string;
  color: string;
}

interface MobileMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}

type MenuItem = { view: FinanceView; label: string; icon: React.ReactNode };

const mainMenuItems: MenuItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
  { view: 'quick-entry', label: 'Lance Rápido', icon: <Zap className="w-4 h-4" /> },
  { view: 'bank-digital', label: 'Banco Digital', icon: <Landmark className="w-4 h-4" /> },
];

const transacoesMenuItems: MenuItem[] = [
  { view: 'transactions', label: 'Lançamentos', icon: <ArrowUpDown className="w-4 h-4" /> },
  { view: 'transfers', label: 'Transferências', icon: <ArrowRightLeft className="w-4 h-4" /> },
  { view: 'payables-receivables', label: 'Contas a Pagar/Receber', icon: <CreditCard className="w-4 h-4" /> },
  { view: 'boletos', label: 'Boletos', icon: <Barcode className="w-4 h-4" /> },
];

const relatoriosMainItems: MenuItem[] = [
  { view: 'balance', label: 'Balancete', icon: <BarChart3 className="w-4 h-4" /> },
];

const movimentacoesMenuItems: MenuItem[] = [
  { view: 'statement', label: 'Extrato', icon: <FileText className="w-4 h-4" /> },
  { view: 'category-report', label: 'Por Categoria', icon: <PieChart className="w-4 h-4" /> },
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
  { view: 'clients-suppliers', label: 'Clientes/Fornecedores', icon: <Users className="w-4 h-4" /> },
];

export function MobileMenuSheet({
  open,
  onOpenChange,
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
}: MobileMenuSheetProps) {
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const isAdminMode = accessMode === 'admin';

  const navigate = (view: FinanceView) => {
    onChangeView(view);
    onOpenChange(false);
  };

  const renderMenuItem = (item: MenuItem) => (
    <Button
      key={item.view}
      variant="ghost"
      className={cn(
        'w-full justify-start gap-3 h-11 text-base font-normal',
        currentView === item.view && 'bg-accent text-accent-foreground font-medium'
      )}
      onClick={() => navigate(item.view)}
    >
      {item.icon}
      {item.label}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85vw] max-w-xs p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className={cn('px-4 py-3 border-b border-border', isAdminMode && 'bg-primary/5')}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              'bg-primary'
            )}>
              {isAdminMode
                ? <Shield className="w-4 h-4 text-primary-foreground" />
                : <span className="text-primary-foreground font-bold text-sm">TAI</span>
              }
            </div>
            <div className="flex flex-col">
              <SheetTitle className="text-base leading-tight">Tai Finance</SheetTitle>
              {isAdminMode && (
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Admin</span>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Company selector */}
        {!isAdminMode && companies.length > 0 && (
          <div className="px-3 py-2 border-b border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/50 w-full hover:bg-accent transition-colors">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0"
                    style={{ backgroundColor: selectedCompany ? `hsl(${selectedCompany.color})` : 'hsl(var(--muted))' }}
                  >
                    {selectedCompany?.name.charAt(0) || '?'}
                  </div>
                  <span className="text-sm font-medium text-foreground flex-1 truncate text-left">
                    {selectedCompany?.name || 'Selecione uma empresa'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {companies.map((company) => (
                  <DropdownMenuItem
                    key={company.id}
                    onClick={() => { onSelectCompany(company.id); onOpenChange(false); }}
                  >
                    <div className="w-4 h-4 rounded mr-2 flex-shrink-0" style={{ backgroundColor: `hsl(${company.color})` }} />
                    {company.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {isAdminMode ? (
            <>
              {renderMenuItem({ view: 'admin-dashboard', label: 'Dashboard Admin', icon: <LayoutDashboard className="w-4 h-4" /> })}
              {renderMenuItem({ view: 'bank-digital', label: 'Banco Digital', icon: <Landmark className="w-4 h-4" /> })}

              <div className="pt-3 pb-1 px-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Gestão da Plataforma
                </span>
              </div>

              {selectedCompanyId && onOpenCompanySettings && (
                <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-base font-normal"
                  onClick={() => { onOpenCompanySettings(); onOpenChange(false); }}>
                  <Settings className="w-4 h-4" />
                  Configurações da Empresa
                </Button>
              )}
              {isSupervisor && onManageCompanies && (
                <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-base font-normal"
                  onClick={() => { onManageCompanies(); onOpenChange(false); }}>
                  <Building2 className="w-4 h-4" />
                  Gerenciar Empresas
                </Button>
              )}
              {canCreateCompany && onCreateCompany && (
                <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-base font-normal"
                  onClick={() => { onCreateCompany(); onOpenChange(false); }}>
                  <Plus className="w-4 h-4" />
                  Nova Empresa
                  {isGerente && companyLimit !== null && (
                    <Badge variant="secondary" className="ml-auto text-xs">{companiesCreated}/{companyLimit}</Badge>
                  )}
                </Button>
              )}
              {(isSupervisor || isGerente) && onOpenUsers && (
                <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-base font-normal"
                  onClick={() => { onOpenUsers(); onOpenChange(false); }}>
                  <Users className="w-4 h-4" />
                  Usuários
                </Button>
              )}
              {canInvite && onOpenInvitations && (
                <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-base font-normal"
                  onClick={() => { onOpenInvitations(); onOpenChange(false); }}>
                  <UserPlus className="w-4 h-4" />
                  Convites
                  {isGerente && invitationLimit !== null && (
                    <Badge variant="secondary" className="ml-auto text-xs">{invitationsCreated}/{invitationLimit}</Badge>
                  )}
                </Button>
              )}
              {isSupervisor && renderMenuItem({ view: 'audit-logs', label: 'Logs de Auditoria', icon: <FileSearch className="w-4 h-4" /> })}
            </>
          ) : (
            <>
              {mainMenuItems.map(renderMenuItem)}

              {/* Transações */}
              <Collapsible defaultOpen={transacoesMenuItems.some(i => currentView === i.view)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between h-11 text-base font-normal">
                    <span className="flex items-center gap-3">
                      <Receipt className="w-4 h-4" />
                      Transações
                    </span>
                    <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-5 space-y-0.5 mt-0.5">
                  {transacoesMenuItems.map(renderMenuItem)}
                </CollapsibleContent>
              </Collapsible>

              {/* Relatórios */}
              <Collapsible defaultOpen={allRelatoriosItems.some(i => currentView === i.view)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between h-11 text-base font-normal">
                    <span className="flex items-center gap-3">
                      <ClipboardList className="w-4 h-4" />
                      Relatórios
                    </span>
                    <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-5 space-y-0.5 mt-0.5">
                  {relatoriosMainItems.map(renderMenuItem)}
                  <Collapsible defaultOpen={movimentacoesMenuItems.some(i => currentView === i.view)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between h-10 text-sm font-normal">
                        <span className="flex items-center gap-3">
                          <Activity className="w-4 h-4" />
                          Movimentações
                        </span>
                        <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-5 space-y-0.5 mt-0.5">
                      {movimentacoesMenuItems.map(renderMenuItem)}
                    </CollapsibleContent>
                  </Collapsible>
                  <Collapsible defaultOpen={pagarReceberMenuItems.some(i => currentView === i.view)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between h-10 text-sm font-normal">
                        <span className="flex items-center gap-3">
                          <CreditCard className="w-4 h-4" />
                          Pagar/Receber
                        </span>
                        <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-5 space-y-0.5 mt-0.5">
                      {pagarReceberMenuItems.map(renderMenuItem)}
                    </CollapsibleContent>
                  </Collapsible>
                </CollapsibleContent>
              </Collapsible>

              {/* Cadastros */}
              <Collapsible defaultOpen={cadastrosMenuItems.some(i => currentView === i.view)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between h-11 text-base font-normal">
                    <span className="flex items-center gap-3">
                      <FolderCog className="w-4 h-4" />
                      Cadastros
                    </span>
                    <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-5 space-y-0.5 mt-0.5">
                  {cadastrosMenuItems.map(renderMenuItem)}
                </CollapsibleContent>
              </Collapsible>

              {/* Ações de gestão */}
              {(isSupervisor || isGerente) && (
                <>
                  <div className="pt-3 pb-1 px-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Gestão
                    </span>
                  </div>
                  {onOpenUsers && (
                    <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-base font-normal"
                      onClick={() => { onOpenUsers(); onOpenChange(false); }}>
                      <Users className="w-4 h-4" />
                      Usuários
                    </Button>
                  )}
                  {canInvite && onOpenInvitations && (
                    <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-base font-normal"
                      onClick={() => { onOpenInvitations(); onOpenChange(false); }}>
                      <UserPlus className="w-4 h-4" />
                      Convites
                      {isGerente && invitationLimit !== null && (
                        <Badge variant="secondary" className="ml-auto text-xs">{invitationsCreated}/{invitationLimit}</Badge>
                      )}
                    </Button>
                  )}
                  {onOpenCompanySettings && selectedCompanyId && (
                    <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-base font-normal"
                      onClick={() => { onOpenCompanySettings(); onOpenChange(false); }}>
                      <Settings className="w-4 h-4" />
                      Configurações da Empresa
                    </Button>
                  )}
                  {canCreateCompany && onCreateCompany && (
                    <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-base font-normal"
                      onClick={() => { onCreateCompany(); onOpenChange(false); }}>
                      <Plus className="w-4 h-4" />
                      Nova Empresa
                      {isGerente && companyLimit !== null && (
                        <Badge variant="secondary" className="ml-auto text-xs">{companiesCreated}/{companyLimit}</Badge>
                      )}
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </nav>

        <div className="px-4 py-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground/70 select-none">
            Tai Finance v1.0.0
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
