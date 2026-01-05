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
import { CreateCompanyDialog } from '@/components/dialogs/CreateCompanyDialog';
import { UsersDialog } from '@/components/dialogs/UsersDialog';
import { FinanceInvitationsDialog } from '@/components/dialogs/FinanceInvitationsDialog';
import { supabase } from '@/integrations/supabase/client';

export type FinanceView = 'dashboard' | 'accounts' | 'transactions' | 'transfers' | 'balance' | 'statement' | 'categories' | 'category-report' | 'cash-flow';

const Finance = () => {
  const { user, signOut } = useAuth();
  const { companies, createCompany, refetch: refetchCompanies } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<FinanceView>('dashboard');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);

  // Check if user is supervisor
  useEffect(() => {
    const checkSupervisor = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'supervisor')
        .maybeSingle();
      setIsSupervisor(!!data);
    };
    checkSupervisor();
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

      <UsersDialog
        open={showUsers}
        onOpenChange={setShowUsers}
        companyId={selectedCompanyId}
        isSupervisor={isSupervisor}
      />

      <FinanceInvitationsDialog
        open={showInvitations}
        onOpenChange={setShowInvitations}
        companyId={selectedCompanyId}
      />
    </div>
  );
};

export default Finance;
