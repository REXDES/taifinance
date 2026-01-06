import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { CategoryReportPage } from '@/components/finance/CategoryReportPage';
import { CashFlowReportPage } from '@/components/finance/CashFlowReportPage';
import { AuditLogsPage } from '@/components/finance/AuditLogsPage';
import { CreateCompanyDialog } from '@/components/dialogs/CreateCompanyDialog';
import { FinanceUsersDialog } from '@/components/dialogs/FinanceUsersDialog';
import { FinanceInvitationsDialog } from '@/components/dialogs/FinanceInvitationsDialog';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export type FinanceView = 'dashboard' | 'accounts' | 'transactions' | 'transfers' | 'balance' | 'statement' | 'categories' | 'category-report' | 'cash-flow' | 'audit-logs';

interface UserRoleInfo {
  role: AppRole;
  companyLimit: number | null;
  companiesCreated: number;
  invitationLimit: number | null;
  invitationsCreated: number;
}

const Finance = () => {
  const { user, signOut } = useAuth();
  const { companies, createCompany, refetch: refetchCompanies } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<FinanceView>('dashboard');
  const [userRole, setUserRole] = useState<UserRoleInfo | null>(null);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);

  const isSupervisor = userRole?.role === 'supervisor';
  const isGerente = userRole?.role === 'gerente';
  const canAccessUserManagement = isSupervisor || isGerente;
  const canCreateCompany = isSupervisor || (isGerente && userRole.companyLimit !== null && userRole.companiesCreated < userRole.companyLimit);

  // Check user role and limits
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) return;
      
      // Get role, company_limit and invitation_limit
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, company_limit, invitation_limit')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Count companies created by this user
      const { count: companiesCount } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id);
      
      // Count invitations created by this user
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
  }, [user?.id]);

  // Auto-select company
  useEffect(() => {
    if (!selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const handleCreateCompany = async (name: string, color: string) => {
    const result = await createCompany(name, color);
    if (result) {
      // Also add user to this company
      if (user?.id) {
        await supabase.from('user_companies').insert({
          user_id: user.id,
          company_id: result.id
        });
      }
      await refetchCompanies();
      setSelectedCompanyId(result.id);
      return true;
    }
    return false;
  };

  const renderContent = () => {
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
      case 'accounts':
        return <AccountsPage companyId={selectedCompanyId} />;
      case 'transactions':
        return <TransactionsPage companyId={selectedCompanyId} />;
      case 'transfers':
        return <TransfersPage companyId={selectedCompanyId} />;
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
      case 'audit-logs':
        return <AuditLogsPage />;
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
        canCreateCompany={canCreateCompany}
        companyLimit={userRole?.companyLimit ?? null}
        companiesCreated={userRole?.companiesCreated ?? 0}
        canInvite={isSupervisor || (isGerente && userRole?.invitationLimit !== null && userRole.invitationLimit > 0)}
        invitationLimit={userRole?.invitationLimit ?? null}
        invitationsCreated={userRole?.invitationsCreated ?? 0}
        onCreateCompany={() => setIsCreateCompanyOpen(true)}
        onManageCompanies={() => setIsCreateCompanyOpen(true)}
        onOpenUsers={() => setShowUsers(true)}
        onOpenInvitations={() => setShowInvitations(true)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <FinanceHeader
          user={user}
          onSignOut={signOut}
          companyName={selectedCompany?.name}
          onOpenUsers={() => setShowUsers(true)}
          showUsersButton={!!selectedCompanyId && canAccessUserManagement}
        />
        <main className="flex-1 overflow-auto p-6">
          {renderContent()}
        </main>
      </div>

      <CreateCompanyDialog
        open={isCreateCompanyOpen}
        onOpenChange={setIsCreateCompanyOpen}
        onSubmit={handleCreateCompany}
      />

      <FinanceUsersDialog
        open={showUsers}
        onOpenChange={setShowUsers}
        companyId={selectedCompanyId}
        isSupervisor={isSupervisor}
        currentUserRole={userRole?.role || 'operador'}
      />

      <FinanceInvitationsDialog
        open={showInvitations}
        onOpenChange={setShowInvitations}
        companyId={selectedCompanyId}
        currentUserRole={userRole?.role || 'operador'}
        invitationLimit={userRole?.invitationLimit ?? null}
        invitationsCreated={userRole?.invitationsCreated ?? 0}
      />
    </div>
  );
};

export default Finance;
