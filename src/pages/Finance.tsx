import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessMode } from '@/contexts/AccessModeContext';
import { useCompanies } from '@/hooks/useCompanies';
import { FinanceSidebar } from '@/components/finance/FinanceSidebar';
import { FinanceHeader } from '@/components/finance/FinanceHeader';
import { MobileBottomNav } from '@/components/finance/MobileBottomNav';
import { MobileMenuSheet } from '@/components/finance/MobileMenuSheet';
import { AccountsPage } from '@/components/finance/AccountsPage';
import { TransactionsPage } from '@/components/finance/TransactionsPage';
import { TransfersPage } from '@/components/finance/TransfersPage';
import { BalanceSheetPage } from '@/components/finance/BalanceSheetPage';
import { StatementPage } from '@/components/finance/StatementPage';
import { StatementImportPage } from '@/components/finance/StatementImportPage';
import { CategoriesPage } from '@/components/finance/CategoriesPage';
import { FinanceDashboard } from '@/components/finance/FinanceDashboard';
import { AdminDashboard } from '@/components/finance/AdminDashboard';
import { AdminUsersPage } from '@/components/admin/AdminUsersPage';
import { AdminRolesPage } from '@/components/admin/AdminRolesPage';
import { CategoryReportPage } from '@/components/finance/CategoryReportPage';
import { TagReportPage } from '@/components/finance/TagReportPage';
import { CashFlowReportPage } from '@/components/finance/CashFlowReportPage';
import { AuditLogsPage } from '@/components/finance/AuditLogsPage';
import { PayablesReceivablesPage } from '@/components/finance/PayablesReceivablesPage';
import { PayablesReceivablesReportPage } from '@/components/finance/PayablesReceivablesReportPage';
import { PayablesReceivablesCalendarPage } from '@/components/finance/PayablesReceivablesCalendarPage';
import { PayablesReceivablesFlowPage } from '@/components/finance/PayablesReceivablesFlowPage';
import { QuickEntryPage } from '@/components/finance/QuickEntryPage';
import { ClientsSuppliersPage } from '@/components/finance/ClientsSuppliersPage';
import { TagsPage } from '@/components/finance/TagsPage';
import { SplitPixPage } from '@/components/finance/SplitPixPage';
import { BankDigitalPage } from '@/components/finance/BankDigitalPage';
import { BoletosPage } from '@/components/finance/BoletosPage';
import { CompanySettingsDialog } from '@/components/finance/CompanySettingsDialog';
import { CreateCompanyDialog } from '@/components/dialogs/CreateCompanyDialog';
import { FinanceUsersDialog } from '@/components/dialogs/FinanceUsersDialog';
import { FinanceInvitationsDialog } from '@/components/dialogs/FinanceInvitationsDialog';
import { AccessModeDialog } from '@/components/AccessModeDialog';
import { MachinesPage } from '@/components/machines/MachinesPage';
import { MachinesDashboardPage } from '@/components/machines/MachinesDashboardPage';
import { MachineCatalogPage } from '@/components/machines/MachineCatalogPage';
import { MachineMovementsReportPage } from '@/components/machines/MachineMovementsReportPage';
import { RentalPricingPage } from '@/components/machines/RentalPricingPage';
import { MaintenancePage } from '@/components/machines/MaintenancePage';
import { RentalsPage } from '@/components/machines/RentalsPage';
import { RentalsReportPage } from '@/components/machines/RentalsReportPage';
import { PeoplePage } from '@/components/machines/PeoplePage';
import { useCompanyMachinesFlag } from '@/hooks/useMachinesModule';
import { useCompanyCreditFlag } from '@/hooks/useCreditModule';
import { useCompanyBankDigitalFlag } from '@/hooks/useBankConnections';
import { useCompanyPaymentsFlag } from '@/hooks/usePaymentsModule';
import { CreditAdminPage } from '@/components/credit/CreditAdminPage';
import { CreditApplicationsPage } from '@/components/credit/CreditApplicationsPage';
import { CreditIgnoredOccurrencesPage } from '@/components/credit/CreditIgnoredOccurrencesPage';
import { NectaDashboardPage } from '@/components/payments/NectaDashboardPage';
import { NectaRegistrationPage } from '@/components/payments/NectaRegistrationPage';
import { NectaChargesPage } from '@/components/payments/NectaChargesPage';
import { NectaEstablishmentsPage } from '@/components/payments/NectaEstablishmentsPage';
import { NectaAdminDashboardPage } from '@/components/payments/NectaAdminDashboardPage';
import { NectaAdminRegistrationPage } from '@/components/payments/NectaAdminRegistrationPage';
import { NectaAdminSettlementsPage } from '@/components/payments/NectaAdminSettlementsPage';
import { NectaAdminSettingsPage } from '@/components/payments/NectaAdminSettingsPage';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { usePermissions } from '@/hooks/usePermissions';
import { FINANCE_VIEW_PERMISSION_KEY } from '@/lib/permissions';

type AppRole = Database['public']['Enums']['app_role'];

export type FinanceView =
  | 'dashboard'
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-roles'
  | 'quick-entry'
  | 'accounts'
  | 'transactions'
  | 'transfers'
  | 'payables-receivables'
  | 'balance'
  | 'statement'
  | 'statement-import'
  | 'categories'
  | 'tags'
  | 'split-pix'
  | 'category-report'
  | 'tag-report'
  | 'cash-flow'
  | 'payables-receivables-report'
  | 'payables-receivables-calendar'
  | 'payables-receivables-flow'
  | 'audit-logs'
  | 'clients-suppliers'
  | 'bank-digital'
  | 'machines-dashboard'
  | 'machines-inventory'
  | 'machines-maintenance'
  | 'machines-rentals'
  | 'machines-operators'
  | 'machines-mechanics'
  | 'machines-catalog'
  | 'machines-pricing'
  | 'machines-movements'
  | 'credit-admin'
  | 'credit-applications'
  | 'credit-ignored'
  | 'payments-dashboard'
  | 'payments-registration'
  | 'payments-establishments'
  | 'payments-charges'
  | 'payments-admin-dashboard'
  | 'payments-admin-registration'
  | 'payments-admin-settlements'
  | 'payments-admin-settings'
  | 'boletos';

const ADMIN_VIEWS: FinanceView[] = ['admin-dashboard', 'admin-users', 'admin-roles', 'audit-logs', 'bank-digital', 'credit-admin', 'payments-admin-dashboard', 'payments-admin-registration', 'payments-admin-settlements', 'payments-admin-settings'];

// Views available only in normal mode for supervisors
const NORMAL_ONLY_VIEWS: FinanceView[] = [
  'dashboard',
  'quick-entry',
  'accounts',
  'transactions',
  'transfers',
  'payables-receivables',
  'balance',
  'statement',
  'statement-import',
  'categories',
  'tags',
  'split-pix',
  'category-report',
  'tag-report',
  'cash-flow',
  'payables-receivables-report',
  'payables-receivables-calendar',
  'payables-receivables-flow',
  'clients-suppliers',
  'machines-dashboard',
  'machines-inventory',
  'machines-maintenance',
  'machines-rentals',
  'machines-operators',
  'machines-mechanics',
  'machines-catalog',
  'machines-pricing',
  'machines-movements',
  'credit-applications',
  'credit-ignored',
  'payments-dashboard',
  'payments-registration',
  'payments-establishments',
  'payments-charges',
  'boletos',
];

interface UserRoleInfo {
  role: AppRole;
  companyLimit: number | null;
  companiesCreated: number;
  invitationLimit: number | null;
  invitationsCreated: number;
}

const Finance = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { mode: accessMode, setMode: setAccessMode, resetMode } = useAccessMode();
  const { companies, loading: companiesLoading, createCompany, refetch: refetchCompanies } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    return localStorage.getItem('tai-finance-last-company') || null;
  });
  const [currentView, setCurrentView] = useState<FinanceView>(() => {
    const savedView = localStorage.getItem('tai-finance-current-view') as FinanceView | null;
    return savedView && NORMAL_ONLY_VIEWS.includes(savedView) ? savedView : 'dashboard';
  });
  const changeView = (view: FinanceView) => {
    localStorage.setItem('tai-finance-current-view', view);
    setCurrentView(view);
  };
  const [userRole, setUserRole] = useState<UserRoleInfo | null>(null);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showCompanySettings, setShowCompanySettings] = useState(false);
  const { can, loading: permissionsLoading } = usePermissions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSupervisor = userRole?.role === 'supervisor';
  const isGerente = userRole?.role === 'gerente';
  const canAccessUserManagement = isSupervisor || (isGerente && can('admin.users'));
  const canCreateCompany = isSupervisor || (isGerente && can('admin.companies') && userRole?.companyLimit !== null && (userRole?.companiesCreated ?? 0) < (userRole?.companyLimit ?? 0));
  const canInviteUsers = isSupervisor || (isGerente && can('admin.invitations') && userRole?.invitationLimit !== null && (userRole?.invitationsCreated ?? 0) < (userRole?.invitationLimit ?? 0));

  useEffect(() => {
    if (!userRole) return;
    if (!isSupervisor && accessMode !== 'normal') {
      setAccessMode('normal');
    }
  }, [userRole, isSupervisor, accessMode, setAccessMode]);

  const showAccessModeDialog = !!userRole && isSupervisor && accessMode === null;
  const effectiveMode: 'admin' | 'normal' = accessMode === 'admin' && isSupervisor ? 'admin' : 'normal';

  useEffect(() => {
    if (showAccessModeDialog) return;
    if (effectiveMode === 'admin') {
      if (!ADMIN_VIEWS.includes(currentView)) {
        changeView('admin-dashboard');
      }
    } else {
      if (!NORMAL_ONLY_VIEWS.includes(currentView) && currentView !== 'bank-digital') {
        changeView('dashboard');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMode, showAccessModeDialog]);

  // Impede que uma tela sem permissão permaneça aberta por estado anterior,
  // atualização de cargo ou manipulação direta da navegação.
  useEffect(() => {
    if (permissionsLoading || isSupervisor || effectiveMode === 'admin') return;
    const currentKey = FINANCE_VIEW_PERMISSION_KEY[currentView];
    if (currentKey && can(currentKey)) return;

    const firstAllowedView = NORMAL_ONLY_VIEWS.find(view => {
      const key = FINANCE_VIEW_PERMISSION_KEY[view];
      return !!key && can(key);
    });
    if (firstAllowedView && firstAllowedView !== currentView) changeView(firstAllowedView);
  }, [permissionsLoading, isSupervisor, effectiveMode, currentView, can]);

  useEffect(() => {
    const checkUserRole = async () => {
      if (authLoading || !user?.id) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, company_limit, invitation_limit')
        .eq('user_id', user.id)
        .maybeSingle();

      // A cota de empresas deve considerar apenas as empresas CRIADAS pelo usuário,
      // não as empresas às quais ele apenas recebeu acesso.
      const { data: companiesCount } = await supabase
        .rpc('count_companies_created_by', { _user_id: user.id });

      const { count: invitationsCount } = await supabase
        .from('invitations')
        .select('*', { count: 'exact', head: true })
        .eq('invited_by', user.id);

      setUserRole({
        role: roleData?.role || 'operador',
        companyLimit: roleData?.company_limit ?? null,
        companiesCreated: companiesCount || 0,
        invitationLimit: roleData?.invitation_limit ?? null,
        invitationsCreated: invitationsCount || 0,
      });
    };

    checkUserRole();
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (companiesLoading || companies.length === 0) return;

    const lastCompanyId = localStorage.getItem('tai-finance-last-company');
    const lastCompanyExists = lastCompanyId && companies.some(c => c.id === lastCompanyId);

    if (!selectedCompanyId || !companies.some(c => c.id === selectedCompanyId)) {
      if (lastCompanyExists) {
        setSelectedCompanyId(lastCompanyId);
      } else {
        setSelectedCompanyId(companies[0].id);
      }
    }
  }, [companies, companiesLoading, selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      localStorage.setItem('tai-finance-last-company', selectedCompanyId);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    localStorage.setItem('tai-finance-current-view', currentView);
  }, [currentView]);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const { enabled: machinesEnabled, refetch: refetchMachinesFlag } = useCompanyMachinesFlag(selectedCompanyId);
  const { enabled: creditEnabled, refetch: refetchCreditFlag } = useCompanyCreditFlag(selectedCompanyId);
  const { enabled: bankDigitalEnabled, refetch: refetchBankDigitalFlag } = useCompanyBankDigitalFlag(selectedCompanyId);
  const { enabled: paymentsEnabled, refetch: refetchPaymentsFlag } = useCompanyPaymentsFlag(selectedCompanyId);

  const handleCreateCompany = async (name: string, color: string) => {
    const result = await createCompany(name, color);
    if (result) {
      await refetchCompanies();
      setSelectedCompanyId(result.id);
      return true;
    }
    return false;
  };

  const sharedSidebarProps = {
    companies,
    selectedCompanyId,
    onSelectCompany: setSelectedCompanyId,
    currentView,
    onChangeView: setCurrentView,
    isSupervisor,
    isGerente,
    accessMode: effectiveMode,
    canCreateCompany,
    companyLimit: userRole?.companyLimit ?? null,
    companiesCreated: userRole?.companiesCreated ?? 0,
    canInvite: isSupervisor || (isGerente && userRole?.invitationLimit !== null && (userRole?.invitationsCreated ?? 0) < (userRole?.invitationLimit ?? 0)),
    invitationLimit: userRole?.invitationLimit ?? null,
    invitationsCreated: userRole?.invitationsCreated ?? 0,
    onCreateCompany: () => setIsCreateCompanyOpen(true),
    onManageCompanies: () => setShowCompanySettings(true),
    onOpenUsers: () => setShowUsers(true),
    onOpenInvitations: () => setShowInvitations(true),
    onOpenCompanySettings: () => setShowCompanySettings(true),
    machinesEnabled,
    creditEnabled,
    bankDigitalEnabled,
    paymentsEnabled,
  };

  const renderContent = () => {
    if (effectiveMode === 'admin' && currentView === 'admin-dashboard') {
      return <AdminDashboard />;
    }
    if (effectiveMode === 'admin' && currentView === 'admin-users') {
      return <AdminUsersPage />;
    }
    if (effectiveMode === 'admin' && currentView === 'admin-roles') {
      return <AdminRolesPage />;
    }


    if (!selectedCompanyId) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Selecione uma empresa para começar</p>
        </div>
      );
    }

    if (permissionsLoading) {
      return <div className="flex-1 flex items-center justify-center text-muted-foreground">Carregando permissões...</div>;
    }

    if (!isSupervisor) {
      const permissionKey = FINANCE_VIEW_PERMISSION_KEY[currentView];
      if (!permissionKey || !can(permissionKey)) {
        return <div className="flex-1 flex items-center justify-center text-muted-foreground">Acesso não autorizado para esta função.</div>;
      }
    }

    switch (currentView) {
      case 'dashboard':
        return <FinanceDashboard companyId={selectedCompanyId} />;
      case 'quick-entry':
        return <QuickEntryPage companyId={selectedCompanyId} />;
      case 'accounts':
        return <AccountsPage companyId={selectedCompanyId} />;
      case 'transactions':
        return <TransactionsPage companyId={selectedCompanyId} />;
      case 'transfers':
        return <TransfersPage companyId={selectedCompanyId} />;
      case 'payables-receivables':
        return <PayablesReceivablesPage companyId={selectedCompanyId} />;
      case 'balance':
        return <BalanceSheetPage companyId={selectedCompanyId} />;
      case 'statement':
        return <StatementPage companyId={selectedCompanyId} />;
      case 'statement-import':
        return <StatementImportPage companyId={selectedCompanyId} />;
      case 'categories':
        return <CategoriesPage companyId={selectedCompanyId} />;
      case 'tags':
        return <TagsPage companyId={selectedCompanyId} />;
      case 'split-pix':
        return <SplitPixPage companyId={selectedCompanyId} />;
      case 'category-report':
        return <CategoryReportPage companyId={selectedCompanyId} />;
      case 'tag-report':
        return <TagReportPage companyId={selectedCompanyId} />;
      case 'cash-flow':
        return <CashFlowReportPage companyId={selectedCompanyId} />;
      case 'payables-receivables-report':
        return <PayablesReceivablesReportPage companyId={selectedCompanyId} />;
      case 'payables-receivables-calendar':
        return <PayablesReceivablesCalendarPage companyId={selectedCompanyId} />;
      case 'payables-receivables-flow':
        return <PayablesReceivablesFlowPage companyId={selectedCompanyId} />;
      case 'audit-logs':
        return <AuditLogsPage />;
      case 'clients-suppliers':
        return <ClientsSuppliersPage companyId={selectedCompanyId} />;
      case 'bank-digital':
        return bankDigitalEnabled ? <BankDigitalPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'machines-dashboard':
        return machinesEnabled ? <MachinesDashboardPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'machines-inventory':
        return machinesEnabled ? <MachinesPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'machines-maintenance':
        return machinesEnabled ? <MaintenancePage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'machines-rentals':
        return machinesEnabled ? <RentalsPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'machines-operators':
        return machinesEnabled ? <PeoplePage companyId={selectedCompanyId} kind="operator" /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'machines-mechanics':
        return machinesEnabled ? <PeoplePage companyId={selectedCompanyId} kind="mechanic" /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'machines-catalog':
        return machinesEnabled ? <MachineCatalogPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'machines-pricing':
        return machinesEnabled ? <RentalPricingPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'machines-movements':
        return machinesEnabled ? <MachineMovementsReportPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'credit-admin':
        return creditEnabled ? <CreditAdminPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'credit-applications':
        return creditEnabled ? <CreditApplicationsPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'credit-ignored':
        return creditEnabled ? <CreditIgnoredOccurrencesPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'payments-dashboard':
        return paymentsEnabled ? <NectaDashboardPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'payments-registration':
        return paymentsEnabled ? <NectaRegistrationPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'payments-establishments':
        return paymentsEnabled ? <NectaEstablishmentsPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'payments-charges':
        return paymentsEnabled ? <NectaChargesPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'payments-admin-dashboard':
        return <NectaAdminDashboardPage />;
      case 'payments-admin-registration':
        return <NectaAdminRegistrationPage companyId={selectedCompanyId} />;
      case 'payments-admin-settlements':
        return <NectaAdminSettlementsPage companyId={selectedCompanyId} />;
      case 'payments-admin-settings':
        return <NectaAdminSettingsPage companyId={selectedCompanyId} />;
      case 'boletos':
        return <BoletosPage companyId={selectedCompanyId} />;
      default:
        return <FinanceDashboard companyId={selectedCompanyId} />;
    }
  };

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block shrink-0">
        <FinanceSidebar {...sharedSidebarProps} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <FinanceHeader
          user={user}
          onSignOut={signOut}
          companyName={selectedCompany?.name}
          onOpenUsers={() => setShowUsers(true)}
          showUsersButton={!!selectedCompanyId && canAccessUserManagement && effectiveMode === 'normal'}
          isAdminMode={effectiveMode === 'admin'}
          canSwitchMode={isSupervisor}
          onSwitchMode={resetMode}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        {/* pb-16 on mobile to clear the bottom nav bar */}
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-20 md:pb-6">
          {renderContent()}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav
        currentView={currentView}
        onChangeView={setCurrentView}
        onOpenMenu={() => setMobileMenuOpen(true)}
        isAdminMode={effectiveMode === 'admin'}
      />

      {/* Mobile full menu drawer */}
      <MobileMenuSheet
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        {...sharedSidebarProps}
      />

      <AccessModeDialog open={showAccessModeDialog} />

      <CreateCompanyDialog
        open={isCreateCompanyOpen}
        onOpenChange={setIsCreateCompanyOpen}
        onSubmit={handleCreateCompany}
      />

      {showUsers && (
        <FinanceUsersDialog
          open={showUsers}
          onOpenChange={setShowUsers}
          companyId={selectedCompanyId}
          isSupervisor={isSupervisor}
          currentUserRole={userRole?.role || 'operador'}
        />
      )}

      {showInvitations && (
        <FinanceInvitationsDialog
          open={showInvitations}
          onOpenChange={setShowInvitations}
          companyId={selectedCompanyId}
          currentUserRole={userRole?.role || 'operador'}
          invitationLimit={userRole?.invitationLimit ?? null}
          invitationsCreated={userRole?.invitationsCreated ?? 0}
        />
      )}

      <CompanySettingsDialog
        open={showCompanySettings}
        onOpenChange={setShowCompanySettings}
        companyId={effectiveMode === 'admin' ? null : selectedCompanyId}
        showPicker={effectiveMode === 'admin'}
        showModulesTab={effectiveMode === 'admin'}
        onSaved={() => { refetchMachinesFlag(); refetchCreditFlag(); refetchBankDigitalFlag(); refetchPaymentsFlag(); }}
      />
    </div>
  );
};

export default Finance;
