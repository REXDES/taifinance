import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { FinanceView } from '@/pages/Finance';
import {
  Zap,
  CreditCard,
  ArrowRightLeft,
  BarChart3,
  FileText,
  FileSearch,
  ArrowUpDown,
  Wallet,
  PieChart,
  Activity,
  Users,
  Calendar,
  TrendingUp,
  Landmark,
  Tags,
} from 'lucide-react';

export interface ShortcutDef {
  view: FinanceView;
  label: string;
  description: string;
  icon: ReactNode;
}

/** Catálogo de telas elegíveis a aparecer como atalho no dashboard. */
export const SHORTCUT_CATALOG: ShortcutDef[] = [
  { view: 'quick-entry', label: 'Lance Rápido', description: 'Registrar receita ou despesa em segundos', icon: <Zap className="w-5 h-5" /> },
  { view: 'payables-receivables', label: 'Contas a Pagar/Receber', description: 'Lançar e quitar contas', icon: <CreditCard className="w-5 h-5" /> },
  { view: 'transfers', label: 'Transferências', description: 'Mover valores entre contas', icon: <ArrowRightLeft className="w-5 h-5" /> },
  { view: 'balance', label: 'Balancete', description: 'Saldos por grupo e conta', icon: <BarChart3 className="w-5 h-5" /> },
  { view: 'statement', label: 'Extrato', description: 'Movimentações por conta', icon: <FileText className="w-5 h-5" /> },
  { view: 'payables-receivables-report', label: 'Relatório Pagar/Receber', description: 'Análise de contas por período', icon: <FileSearch className="w-5 h-5" /> },
  { view: 'transactions', label: 'Lançamentos', description: 'Todas as receitas e despesas', icon: <ArrowUpDown className="w-5 h-5" /> },
  { view: 'accounts', label: 'Contas', description: 'Gerenciar contas financeiras', icon: <Wallet className="w-5 h-5" /> },
  { view: 'category-report', label: 'Por Categoria', description: 'Despesas e receitas por categoria', icon: <PieChart className="w-5 h-5" /> },
  { view: 'cash-flow', label: 'Fluxo Financeiro', description: 'Auditoria cronológica do caixa', icon: <Activity className="w-5 h-5" /> },
  { view: 'clients-suppliers', label: 'Clientes/Fornecedores', description: 'Cadastros e regras de PIX', icon: <Users className="w-5 h-5" /> },
  { view: 'payables-receivables-calendar', label: 'Calendário Financeiro', description: 'Vencimentos dia a dia', icon: <Calendar className="w-5 h-5" /> },
  { view: 'payables-receivables-flow', label: 'Fluxo de Contas', description: 'Projeção de pagamentos e recebimentos', icon: <TrendingUp className="w-5 h-5" /> },
  { view: 'statement-import', label: 'Importar Extrato', description: 'Importar extrato bancário com IA', icon: <FileSearch className="w-5 h-5" /> },
  { view: 'bank-digital', label: 'Banco Digital', description: 'Conta digital integrada', icon: <Landmark className="w-5 h-5" /> },
  { view: 'tags', label: 'Tags', description: 'Organizar lançamentos por tag', icon: <Tags className="w-5 h-5" /> },
];

/** Atalhos exibidos enquanto não há histórico de uso do usuário. */
export const DEFAULT_SHORTCUT_VIEWS: FinanceView[] = [
  'quick-entry',
  'payables-receivables',
  'transfers',
  'balance',
  'statement',
  'payables-receivables-report',
];

const usageKey = (userId: string, companyId: string) =>
  `tai-finance-view-usage:${userId}:${companyId}`;

type UsageMap = Record<string, number>;

function readUsage(userId: string, companyId: string): UsageMap {
  try {
    const raw = localStorage.getItem(usageKey(userId, companyId));
    return raw ? (JSON.parse(raw) as UsageMap) : {};
  } catch {
    return {};
  }
}

/** Registra uma visita a uma tela (chamado a cada troca de view). */
export function recordViewUsage(view: FinanceView, userId: string | undefined, companyId: string | null) {
  if (!userId || !companyId) return;
  try {
    const usage = readUsage(userId, companyId);
    usage[view] = (usage[view] || 0) + 1;
    localStorage.setItem(usageKey(userId, companyId), JSON.stringify(usage));
  } catch {
    // armazenamento indisponível — ignora silenciosamente
  }
}

/**
 * Retorna os 6 atalhos do dashboard: os mais usados pelo usuário nesta
 * empresa; enquanto não houver histórico, usa os atalhos padrão.
 */
export function useShortcutCards(userId: string | undefined, companyId: string): ShortcutDef[] {
  return useMemo(() => {
    const defaults = DEFAULT_SHORTCUT_VIEWS
      .map(v => SHORTCUT_CATALOG.find(c => c.view === v))
      .filter((c): c is ShortcutDef => !!c);

    if (!userId) return defaults;

    const usage = readUsage(userId, companyId);
    const ranked = SHORTCUT_CATALOG
      .filter(c => (usage[c.view] || 0) > 0)
      .sort((a, b) => (usage[b.view] || 0) - (usage[a.view] || 0));

    if (ranked.length === 0) return defaults;

    // Completa com os padrões caso o histórico tenha menos de 6 telas distintas.
    const result = [...ranked];
    for (const d of defaults) {
      if (result.length >= 6) break;
      if (!result.some(r => r.view === d.view)) result.push(d);
    }
    return result.slice(0, 6);
  }, [userId, companyId]);
}
