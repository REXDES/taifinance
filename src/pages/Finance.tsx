import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessMode } from '@/contexts/AccessModeContext';
import { useCompanies } from '@/hooks/useCompanies';
import { FinanceSidebar } from '@/components/finance/FinanceSidebar';
import { FinanceHeader } from '@/components/finance/FinanceHeader';
import { AccountsPage } from '@/components/finance/AccountsPage';
import { TransactionsPage } from '@/components/finance/TransactionsPage';
import { TransfersPage } from '@/components/finance/TransfersPage';
import { BalanceSheetPage } from '@/components/finance/BalanceSheetPage';
import { StatementPage } from '@/components/finance/StatementPage';
import { CategoriesPage } from '@/components/finance/CategoriesPage';
import { FinanceDashboard } from '@/components/finance/FinanceDashboard';
import { AdminDashboard } from '@/components/finance/AdminDashboard';
import { CategoryReportPage } from '@/components/finance/CategoryReportPage';
import { CashFlowReportPage } from '@/components/finance/CashFlowReportPage';
import { AuditLogsPage } from '@/components/finance/AuditLogsPage';
import { PayablesReceivablesPage } from '@/components/finance/PayablesReceivablesPage';
import { PayablesReceivablesReportPage } from '@/components/finance/PayablesReceivablesReportPage';
import { PayablesReceivablesCalendarPage } from '@/components/finance/PayablesReceivablesCalendarPage';
import { PayablesReceivablesFlowPage } from '@/components/finance/PayablesReceivablesFlowPage';
import { QuickEntryPage } from '@/components/finance/QuickEntryPage';
import { ClientsSuppliersPage } from '@/components/finance/ClientsSuppliersPage';
import { BankDigitalPage } from '@/components/finance/BankDigitalPage';
import { CompanySettingsDialog } from '@/components/finance/CompanySettingsDialog';
import { CreateCompanyDialog } from '@/components/dialogs/CreateCompanyDialog';
import { FinanceUsersDialog } from '@/components/dialogs/FinanceUsersDialog';
import { FinanceInvitationsDialog } from '@/components/dialogs/FinanceInvitationsDialog';
import { AccessModeDialog } from '@/components/AccessModeDialog';
import { MachinesPage } from '@/components/machines/MachinesPage';
import { MaintenancePage } from '@/components/machines/MaintenancePage';
import { RentalsPage } from '@/components/machines/RentalsPage';
import { PeoplePage } from '@/components/machines/PeoplePage';
import { useCompanyMachinesFlag } from '@/hooks/useMachinesModule';
import { useCompanyCreditFlag } from '@/hooks/useCreditModule';
import { CreditAdminPage } from '@/components/credit/CreditAdminPage';
import { CreditApplicationsPage } from '@/components/credit/CreditApplicationsPage';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export type FinanceView =
  | 'dashboard'
  | 'admin-dashboard'
  | 'quick-entry'
  | 'accounts'
  | 'transactions'
  | 'transfers'
  | 'payables-receivables'
  | 'balance'
  | 'statement'
  | 'categories'
  | 'category-report'
  | 'cash-flow'
  | 'payables-receivables-report'
  | 'payables-receivables-calendar'
  | 'payables-receivables-flow'
  | 'audit-logs'
  | 'clients-suppliers'
  | 'bank-digital'
  | 'machines-inventory'
  | 'machines-maintenance'
  | 'machines-rentals'
  | 'machines-operators'
  | 'machines-mechanics'
  | 'credit-admin'
  | 'credit-applications';

const ADMIN_VIEWS: FinanceView[] = ['admin-dashboard', 'audit-logs', 'bank-digital', 'credit-admin'];
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
  'categories',
  'category-report',
  'cash-flow',
  'payables-receivables-report',
  'payables-receivables-calendar',
  'payables-receivables-flow',
  'clients-suppliers',
  'machines-inventory',
  'machines-maintenance',
  'machines-rentals',
  'machines-operators',
  'machines-mechanics',
  'credit-applications',
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
  const [currentView, setCurrentView] = useState<FinanceView>('dashboard');
  const [userRole, setUserRole] = useState<UserRoleInfo | null>(null);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showCompanySettings, setShowCompanySettings] = useState(false);

  const isSupervisor = userRole?.role === 'supervisor';
  const isGerente = userRole?.role === 'gerente';
  const canAccessUserManagement = isSupervisor || isGerente;
  const canCreateCompany = isSupervisor || (isGerente && userRole?.companyLimit !== null && (userRole?.companiesCreated ?? 0) < (userRole?.companyLimit ?? 0));

  // Force non-supervisors to "normal" mode automatically
  useEffect(() => {
    if (!userRole) return;
    if (!isSupervisor && accessMode !== 'normal') {
      setAccessMode('normal');
    }
  }, [userRole, isSupervisor, accessMode, setAccessMode]);

  const showAccessModeDialog = !!userRole && isSupervisor && accessMode === null;
  const effectiveMode: 'admin' | 'normal' = accessMode === 'admin' && isSupervisor ? 'admin' : 'normal';

  // Sync default view to mode
  useEffect(() => {
    if (showAccessModeDialog) return;
    if (effectiveMode === 'admin') {
      if (!ADMIN_VIEWS.includes(currentView)) {
        setCurrentView('admin-dashboard');
      }
    } else {
      if (!NORMAL_ONLY_VIEWS.includes(currentView) && currentView !== 'bank-digital') {
        setCurrentView('dashboard');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMode, showAccessModeDialog]);

  useEffect(() => {
    const checkUserRole = async () => {
      if (authLoading || !user?.id) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, company_limit, invitation_limit')
        .eq('user_id', user.id)
        .maybeSingle();

      const { count: companiesCount } = await supabase
        .from('user_companies')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

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

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const { enabled: machinesEnabled, refetch: refetchMachinesFlag } = useCompanyMachinesFlag(selectedCompanyId);
  const { enabled: creditEnabled, refetch: refetchCreditFlag } = useCompanyCreditFlag(selectedCompanyId);

  const handleCreateCompany = async (name: string, color: string) => {
    const result = await createCompany(name, color);
    if (result) {
      await refetchCompanies();
      setSelectedCompanyId(result.id);
      return true;
    }
    return false;
  };

  const renderContent = () => {
    if (effectiveMode === 'admin' && currentView === 'admin-dashboard') {
      return <AdminDashboard />;
    }

    if (!selectedCompanyId) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Selecione uma empresa para começar</p>
        </div>
      );
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
      case 'categories':
        return <CategoriesPage companyId={selectedCompanyId} />;
      case 'category-report':
        return <CategoryReportPage companyId={selectedCompanyId} />;
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
        return <BankDigitalPage companyId={selectedCompanyId} />;
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
      case 'credit-admin':
        return creditEnabled ? <CreditAdminPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      case 'credit-applications':
        return creditEnabled ? <CreditApplicationsPage companyId={selectedCompanyId} /> : <FinanceDashboard companyId={selectedCompanyId} />;
      default:
        return <FinanceDashboard companyId={selectedCompanyId} />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <FinanceSidebar
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
        currentView={currentView}
        onChangeView={setCurrentView}
        isSupervisor={isSupervisor}
        isGerente={isGerente}
        accessMode={effectiveMode}
        canCreateCompany={canCreateCompany}
        companyLimit={userRole?.companyLimit ?? null}
        companiesCreated={userRole?.companiesCreated ?? 0}
        canInvite={isSupervisor || (isGerente && userRole?.invitationLimit !== null && (userRole?.invitationsCreated ?? 0) < (userRole?.invitationLimit ?? 0))}
        invitationLimit={userRole?.invitationLimit ?? null}
        invitationsCreated={userRole?.invitationsCreated ?? 0}
        onCreateCompany={() => setIsCreateCompanyOpen(true)}
        onManageCompanies={() => setShowCompanySettings(true)}
        onOpenUsers={() => setShowUsers(true)}
        onOpenInvitations={() => setShowInvitations(true)}
        onOpenCompanySettings={() => setShowCompanySettings(true)}
        machinesEnabled={machinesEnabled}
        creditEnabled={creditEnabled}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <FinanceHeader
          user={user}
          onSignOut={signOut}
          companyName={selectedCompany?.name}
          onOpenUsers={() => setShowUsers(true)}
          showUsersButton={!!selectedCompanyId && canAccessUserManagement && effectiveMode === 'normal'}
          isAdminMode={effectiveMode === 'admin'}
          canSwitchMode={isSupervisor}
          onSwitchMode={resetMode}
        />
        <main className="flex-1 overflow-auto p-6">
          {renderContent()}
        </main>
      </div>

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
        onSaved={() => { refetchMachinesFlag(); refetchCreditFlag(); }}
      />
    </div>
  );
};

export default Finance;
