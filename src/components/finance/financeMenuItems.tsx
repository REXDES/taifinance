import {
  Home,
  Wallet,
  ArrowUpDown,
  ArrowRightLeft,
  BarChart3,
  FileText,
  Tags,
  Users,
  Building2,
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
  Barcode,
  Split,
  Truck,
  Hammer,
  Wrench,
  HardHat,
  ClipboardCheck,
  ArrowLeftRight,
  Settings,
} from 'lucide-react';
import { FinanceView } from '@/pages/Finance';

export type MenuItem = { view: FinanceView; label: string; icon: React.ReactNode };

export const mainMenuItems: MenuItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
  { view: 'quick-entry', label: 'Lance Rápido (Finanças)', icon: <Zap className="w-4 h-4" /> },
];

export const bankDigitalMenuItem: MenuItem = { view: 'bank-digital', label: 'Banco Digital', icon: <Landmark className="w-4 h-4" /> };

export const transacoesMenuItems: MenuItem[] = [
  { view: 'transactions', label: 'Lançamentos', icon: <ArrowUpDown className="w-4 h-4" /> },
  { view: 'transfers', label: 'Transferências', icon: <ArrowRightLeft className="w-4 h-4" /> },
  { view: 'payables-receivables', label: 'Contas a Pagar/Receber', icon: <CreditCard className="w-4 h-4" /> },
  { view: 'statement-import', label: 'Importar Extrato', icon: <FileSearch className="w-4 h-4" /> },
  { view: 'boletos', label: 'Boletos', icon: <Barcode className="w-4 h-4" /> },
];

export const relatoriosMainItems: MenuItem[] = [
  { view: 'balance', label: 'Balancete', icon: <BarChart3 className="w-4 h-4" /> },
];

export const movimentacoesMenuItems: MenuItem[] = [
  { view: 'statement', label: 'Extrato', icon: <FileText className="w-4 h-4" /> },
  { view: 'category-report', label: 'Por Categoria', icon: <PieChart className="w-4 h-4" /> },
  { view: 'tag-report', label: 'Por Tag', icon: <Tags className="w-4 h-4" /> },
  { view: 'cash-flow', label: 'Fluxo Financeiro', icon: <Activity className="w-4 h-4" /> },
];

export const pagarReceberMenuItems: MenuItem[] = [
  { view: 'payables-receivables-report', label: 'Contas a Pagar/Receber', icon: <FileSearch className="w-4 h-4" /> },
  { view: 'payables-receivables-calendar', label: 'Calendário Financeiro', icon: <Calendar className="w-4 h-4" /> },
  { view: 'payables-receivables-flow', label: 'Fluxo de Contas', icon: <TrendingUp className="w-4 h-4" /> },
];

export const allRelatoriosItems = [...relatoriosMainItems, ...movimentacoesMenuItems, ...pagarReceberMenuItems];

export const cadastrosMenuItems: MenuItem[] = [
  { view: 'accounts', label: 'Contas', icon: <Wallet className="w-4 h-4" /> },
  { view: 'categories', label: 'Categorias', icon: <Tags className="w-4 h-4" /> },
  { view: 'tags', label: 'Tags', icon: <Tags className="w-4 h-4" /> },
  { view: 'clients-suppliers', label: 'Clientes/Fornecedores', icon: <Users className="w-4 h-4" /> },
  { view: 'split-pix', label: 'Split de PIX', icon: <Split className="w-4 h-4" /> },
];

export const machinesTopMenuItems: MenuItem[] = [
  { view: 'machines-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { view: 'machines-inventory', label: 'Inventário', icon: <Truck className="w-4 h-4" /> },
  { view: 'machines-maintenance', label: 'Manutenções', icon: <Hammer className="w-4 h-4" /> },
];

export const machinesGestaoMenuItems: MenuItem[] = [
  { view: 'machines-rentals', label: 'Locações', icon: <ClipboardCheck className="w-4 h-4" /> },
  { view: 'machines-pricing', label: 'Tabela de Preços', icon: <Tags className="w-4 h-4" /> },
  { view: 'machines-movements', label: 'Vendidos e Baixados', icon: <ArrowLeftRight className="w-4 h-4" /> },
];

export const machinesCadastrosMenuItems: MenuItem[] = [
  { view: 'machines-operators', label: 'Operadores', icon: <HardHat className="w-4 h-4" /> },
  { view: 'machines-mechanics', label: 'Mecânicos', icon: <Wrench className="w-4 h-4" /> },
  { view: 'machines-catalog', label: 'Categorias e Tipos', icon: <Tags className="w-4 h-4" /> },
  { view: 'clients-suppliers', label: 'Clientes/Fornecedores', icon: <Users className="w-4 h-4" /> },
];

export const machinesMenuItems: MenuItem[] = [
  ...machinesTopMenuItems,
  ...machinesGestaoMenuItems,
  ...machinesCadastrosMenuItems,
];

export const creditMenuItems: MenuItem[] = [
  { view: 'credit-applications', label: 'Propostas', icon: <ClipboardList className="w-4 h-4" /> },
];

export const creditAdminMenuItems: MenuItem[] = [
  { view: 'credit-ignored', label: 'Ocorrências Ignoradas', icon: <Shield className="w-4 h-4" /> },
];

export const paymentsMenuItems: MenuItem[] = [
  { view: 'payments-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { view: 'payments-registration', label: 'Cadastro', icon: <Building2 className="w-4 h-4" /> },
  { view: 'payments-charges', label: 'Cobranças', icon: <Receipt className="w-4 h-4" /> },
];

export const paymentsAdminMenuItems: MenuItem[] = [
  { view: 'payments-admin-dashboard', label: 'Pagamentos — Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { view: 'payments-admin-registration', label: 'Pagamentos — Cadastros', icon: <Building2 className="w-4 h-4" /> },
  { view: 'payments-admin-settlements', label: 'Pagamentos — Liquidações', icon: <TrendingUp className="w-4 h-4" /> },
  { view: 'payments-admin-settings', label: 'Pagamentos — Configurações', icon: <Settings className="w-4 h-4" /> },
];
