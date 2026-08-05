// Catálogo de permissões do sistema.
// Cada `key` representa um módulo/menu/submenu que pode ser liberado ou bloqueado por cargo.
// Supervisor SEMPRE tem acesso total (ignora esta lista).
//
// IMPORTANTE (convenção de desenvolvimento):
// Sempre que um novo módulo, menu ou tela for criado e ele precise aparecer na matriz de
// "Cargos & Permissões" (src/components/admin/AdminRolesPage.tsx), adicione uma entrada
// aqui no formato "modulo.submenu". Após incluir a key, ela será exibida automaticamente
// como coluna na matriz e poderá ser consultada via usePermissions().can(key).

export interface PermissionDef {
  key: string;
  label: string;
}

export interface PermissionGroup {
  label: string;
  items: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Gestão Financeira',
    items: [
      { key: 'finance.dashboard', label: 'Dashboard' },
      { key: 'finance.quick_entry', label: 'Lançamento Rápido' },
      { key: 'finance.accounts', label: 'Contas' },
      { key: 'finance.transactions', label: 'Transações' },
      { key: 'finance.transfers', label: 'Transferências' },
      { key: 'finance.payables_receivables', label: 'Pagar / Receber' },
      { key: 'finance.split_pix', label: 'Split de PIX' },
      { key: 'finance.statement_import', label: 'Importar Extrato (Conciliação)' },
    ],
  },
  {
    label: 'Banco Digital',
    items: [
      { key: 'finance.bank_digital', label: 'Banco Digital' },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      { key: 'reports.balance_sheet', label: 'Balancete' },
      { key: 'reports.statement', label: 'Movimentações' },
      { key: 'reports.cash_flow', label: 'Fluxo de Caixa' },
      { key: 'reports.category', label: 'Categorias' },
      { key: 'reports.tag', label: 'Tags' },
      { key: 'reports.payables_receivables', label: 'Pagar / Receber' },
      { key: 'reports.payables_receivables_calendar', label: 'Calendário' },
      { key: 'reports.payables_receivables_flow', label: 'Fluxo Pagar/Receber' },
      { key: 'reports.audit_logs', label: 'Auditoria' },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { key: 'registry.categories', label: 'Categorias' },
      { key: 'registry.tags', label: 'Tags' },
      { key: 'registry.clients_suppliers', label: 'Clientes / Fornecedores' },
    ],
  },
  {
    label: 'Máquinas & Locação',
    items: [
      { key: 'machines.dashboard', label: 'Dashboard' },
      { key: 'machines.inventory', label: 'Inventário' },
      { key: 'machines.rentals', label: 'Locações' },
      { key: 'machines.pricing', label: 'Tabela de preços' },
      { key: 'machines.maintenance', label: 'Manutenção' },
      { key: 'machines.operators', label: 'Operadores' },
      { key: 'machines.mechanics', label: 'Mecânicos' },
      { key: 'machines.catalog', label: 'Categorias e tipos' },
    ],
  },
  {
    label: 'Pagamentos',
    items: [
      { key: 'payments.dashboard', label: 'Dashboard' },
      { key: 'payments.charges', label: 'Cobranças' },
      { key: 'payments.transactions', label: 'Transações' },
      { key: 'payments.settlements', label: 'Liquidações' },
      { key: 'payments.terminals', label: 'Terminais' },
      { key: 'payments.merchants', label: 'Estabelecimentos' },
      { key: 'payments.plans', label: 'Planos' },
      { key: 'payments.webhooks', label: 'Webhooks' },
    ],
  },
  {
    label: 'Crédito',
    items: [
      { key: 'credit.applications', label: 'Propostas' },
      { key: 'credit.ignored', label: 'Ocorrências ignoradas' },
      { key: 'credit.admin', label: 'Configuração' },
    ],
  },
  {
    label: 'Administração',
    items: [
      { key: 'admin.companies', label: 'Empresas' },
      { key: 'admin.users', label: 'Usuários' },
      { key: 'admin.invitations', label: 'Convites' },
    ],
  },
];

export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_GROUPS.flatMap(g => g.items);

// Fonte única para relacionar telas do Finance às permissões da matriz.
// Toda tela funcional deve estar mapeada para que a navegação e o conteúdo
// usem exatamente a mesma regra de autorização.
export const FINANCE_VIEW_PERMISSION_KEY: Record<string, string> = {
  dashboard: 'finance.dashboard',
  'quick-entry': 'finance.quick_entry',
  accounts: 'finance.accounts',
  transactions: 'finance.transactions',
  transfers: 'finance.transfers',
  'payables-receivables': 'finance.payables_receivables',
  'split-pix': 'finance.split_pix',
  'statement-import': 'finance.statement_import',
  'bank-digital': 'finance.bank_digital',
  balance: 'reports.balance_sheet',
  statement: 'reports.statement',
  'cash-flow': 'reports.cash_flow',
  'category-report': 'reports.category',
  'tag-report': 'reports.tag',
  'payables-receivables-report': 'reports.payables_receivables',
  'payables-receivables-calendar': 'reports.payables_receivables_calendar',
  'payables-receivables-flow': 'reports.payables_receivables_flow',
  'audit-logs': 'reports.audit_logs',
  categories: 'registry.categories',
  tags: 'registry.tags',
  'clients-suppliers': 'registry.clients_suppliers',
  'machines-dashboard': 'machines.dashboard',
  'machines-inventory': 'machines.inventory',
  'machines-rentals': 'machines.rentals',
  'machines-pricing': 'machines.pricing',
  'machines-maintenance': 'machines.maintenance',
  'machines-operators': 'machines.operators',
  'machines-mechanics': 'machines.mechanics',
  'machines-catalog': 'machines.catalog',
  'payments-dashboard': 'payments.dashboard',
  'payments-charges': 'payments.charges',
  'payments-transactions': 'payments.transactions',
  'payments-settlements': 'payments.settlements',
  'payments-terminals': 'payments.terminals',
  'payments-merchants': 'payments.merchants',
  'payments-plans': 'payments.plans',
  'payments-webhooks': 'payments.webhooks',
  'credit-applications': 'credit.applications',
  'credit-ignored': 'credit.ignored',
  'credit-admin': 'credit.admin',
};

/**
 * Retorna o rótulo legível de uma permissão a partir da sua key.
 * Útil para exibir nomes de módulos em mensagens, logs ou telas dinâmicas.
 */
export function getPermissionLabel(key: string): string {
  const found = ALL_PERMISSIONS.find(p => p.key === key);
  return found?.label || key;
}
