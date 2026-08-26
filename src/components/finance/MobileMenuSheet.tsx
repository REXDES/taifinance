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
  Building2,
  Plus,
  Settings,
  Users,
  UserPlus,
  FolderCog,
  Receipt,
  ClipboardList,
  Activity,
  FileSearch,
  CreditCard,
  Landmark,
  Shield,
  ShieldCheck,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Truck,
} from 'lucide-react';
import { FinanceView } from '@/pages/Finance';
import { usePermissions } from '@/hooks/usePermissions';
import { FINANCE_VIEW_PERMISSION_KEY } from '@/lib/permissions';
import {
  type MenuItem,
  mainMenuItems,
  bankDigitalMenuItem,
  transacoesMenuItems,
  relatoriosMainItems,
  movimentacoesMenuItems,
  pagarReceberMenuItems,
  allRelatoriosItems,
  cadastrosMenuItems,
  machinesTopMenuItems,
  machinesGestaoMenuItems,
  machinesCadastrosMenuItems,
  machinesMenuItems,
  creditMenuItems,
  creditAdminMenuItems,
  paymentsMenuItems,
  paymentsAdminMenuItems,
} from '@/components/finance/financeMenuItems';

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
  machinesEnabled?: boolean;
  creditEnabled?: boolean;
  bankDigitalEnabled?: boolean;
  paymentsEnabled?: boolean;
}

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
  machinesEnabled = false,
  creditEnabled = false,
  bankDigitalEnabled = false,
  paymentsEnabled = false,
}: MobileMenuSheetProps) {
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const isAdminMode = accessMode === 'admin';
  const { can } = usePermissions();

  // Mesma regra do sidebar desktop: esconde itens sem permissão para o cargo.
  const filterAllowed = (items: MenuItem[]) =>
    isAdminMode || isSupervisor
      ? items
      : items.filter(i => {
          const key = FINANCE_VIEW_PERMISSION_KEY[i.view];
          return !!key && can(key);
        });

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

  const section = (
    key: string,
    label: string,
    icon: React.ReactNode,
    items: MenuItem[],
    children?: React.ReactNode,
    small?: boolean
  ) => {
    if (items.length === 0 && !children) return null;
    return (
      <Collapsible key={key} defaultOpen={items.some(i => currentView === i.view)}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn('w-full justify-between font-normal', small ? 'h-10 text-sm' : 'h-11 text-base')}
          >
            <span className="flex items-center gap-3">
              {icon}
              {label}
            </span>
            <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-5 space-y-0.5 mt-0.5">
          {items.map(renderMenuItem)}
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const transacoes = filterAllowed(transacoesMenuItems);
  const relatoriosMain = filterAllowed(relatoriosMainItems);
  const movimentacoes = filterAllowed(movimentacoesMenuItems);
  const pagarReceber = filterAllowed(pagarReceberMenuItems);
  const cadastros = filterAllowed(cadastrosMenuItems);
  const machinesTop = machinesEnabled ? filterAllowed(machinesTopMenuItems) : [];
  const machinesGestao = machinesEnabled ? filterAllowed(machinesGestaoMenuItems) : [];
  const machinesCadastros = machinesEnabled ? filterAllowed(machinesCadastrosMenuItems) : [];
  const credit = creditEnabled ? filterAllowed(creditMenuItems) : [];
  const creditAdmin = creditEnabled && (isSupervisor || isGerente) ? filterAllowed(creditAdminMenuItems) : [];
  const payments = paymentsEnabled ? filterAllowed(paymentsMenuItems) : [];

  const hasGestaoFinanceira =
    transacoes.length > 0 || relatoriosMain.length > 0 || movimentacoes.length > 0 ||
    pagarReceber.length > 0 || cadastros.length > 0;
  const hasMachines = machinesTop.length + machinesGestao.length + machinesCadastros.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85vw] max-w-xs p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className={cn('px-4 py-3 border-b border-border', isAdminMode && 'bg-primary/5')}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary">
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
        {companies.length > 0 && (
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
              {renderMenuItem({ view: 'admin-users', label: 'Usuários', icon: <Users className="w-4 h-4" /> })}
              {renderMenuItem({ view: 'admin-roles', label: 'Cargos & Permissões', icon: <ShieldCheck className="w-4 h-4" /> })}
              {bankDigitalEnabled && renderMenuItem({ view: 'bank-digital', label: 'Banco Digital (config)', icon: <Landmark className="w-4 h-4" /> })}
              {renderMenuItem({ view: 'credit-admin', label: 'Gestão de Crédito (config)', icon: <CreditCard className="w-4 h-4" /> })}

              {paymentsEnabled && section('payments-admin', 'Pagamentos', <CreditCard className="w-4 h-4" />, paymentsAdminMenuItems)}

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
              {filterAllowed(mainMenuItems).map(renderMenuItem)}
              {bankDigitalEnabled && can('finance.bank_digital') && renderMenuItem(bankDigitalMenuItem)}

              {/* Gestão Financeira */}
              {hasGestaoFinanceira && (
                <Collapsible defaultOpen={[...transacoes, ...allRelatoriosItems, ...cadastros].some(i => currentView === i.view)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-11 text-base font-normal">
                      <span className="flex items-center gap-3">
                        <Briefcase className="w-4 h-4" />
                        Gestão Financeira
                      </span>
                      <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-3 space-y-0.5 mt-0.5">
                    {section('transacoes', 'Transações', <Receipt className="w-4 h-4" />, transacoes, undefined, true)}

                    {(relatoriosMain.length > 0 || movimentacoes.length > 0 || pagarReceber.length > 0) && (
                      <Collapsible defaultOpen={allRelatoriosItems.some(i => currentView === i.view)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between h-10 text-sm font-normal">
                            <span className="flex items-center gap-3">
                              <ClipboardList className="w-4 h-4" />
                              Relatórios
                            </span>
                            <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-5 space-y-0.5 mt-0.5">
                          {relatoriosMain.map(renderMenuItem)}
                          {section('movimentacoes', 'Movimentações', <Activity className="w-4 h-4" />, movimentacoes, undefined, true)}
                          {section('pagar-receber', 'Pagar/Receber', <CreditCard className="w-4 h-4" />, pagarReceber, undefined, true)}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {section('cadastros', 'Cadastros', <FolderCog className="w-4 h-4" />, cadastros, undefined, true)}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Máquinas & Locação (módulo opcional por empresa) */}
              {hasMachines && (
                <Collapsible defaultOpen={machinesMenuItems.some(i => currentView === i.view)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-11 text-base font-normal">
                      <span className="flex items-center gap-3">
                        <Truck className="w-4 h-4" />
                        Máquinas & Locação
                      </span>
                      <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-3 space-y-0.5 mt-0.5">
                    {machinesTop.map(renderMenuItem)}
                    {section('machines-gestao', 'Gestão', <Briefcase className="w-4 h-4" />, machinesGestao, undefined, true)}
                    {section('machines-cadastros', 'Cadastros', <FolderCog className="w-4 h-4" />, machinesCadastros, undefined, true)}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Gestão de Crédito (módulo opcional por empresa) */}
              {credit.length + creditAdmin.length > 0 && (
                <Collapsible defaultOpen={[...credit, ...creditAdmin].some(i => currentView === i.view)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-11 text-base font-normal">
                      <span className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4" />
                        Gestão de Crédito
                      </span>
                      <ChevronRight className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-5 space-y-0.5 mt-0.5">
                    {credit.map(renderMenuItem)}
                    {creditAdmin.map(renderMenuItem)}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Pagamentos (módulo opcional por empresa) */}
              {section('payments', 'Pagamentos', <CreditCard className="w-4 h-4" />, payments)}

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
                  {onOpenCompanySettings && selectedCompanyId && (isSupervisor || (isGerente && can('admin.companies'))) && (
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
