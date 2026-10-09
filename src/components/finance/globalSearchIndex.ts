import type { ReactNode } from 'react';
import type { FinanceView } from '@/pages/Finance';
import {
  mainMenuItems,
  transacoesMenuItems,
  allRelatoriosItems,
  cadastrosMenuItems,
  machinesMenuItems,
  creditMenuItems,
  creditAdminMenuItems,
  paymentsMenuItems,
  paymentsAdminMenuItems,
  type MenuItem,
} from './financeMenuItems';
import { FINANCE_VIEW_PERMISSION_KEY } from '@/lib/permissions';

export interface SearchableScreen {
  view: FinanceView;
  label: string;
  /** Onde a tela mora no menu — desambigua rótulos repetidos (ex.: vários "Dashboard"). */
  section: string;
  icon: ReactNode | null;
  keywords: string[];
}

export interface SearchAccessContext {
  isAdminMode: boolean;
  isSupervisor: boolean;
  isGerente: boolean;
  can: (permissionKey: string) => boolean;
  machinesEnabled: boolean;
  creditEnabled: boolean;
  isFinancier: boolean;
  anticipationEnabled?: boolean;
  bankDigitalEnabled: boolean;
  paymentsEnabled: boolean;
}

// Palavras que a pessoa realmente digita (sem acento — a comparação é normalizada).
const KEYWORDS: Partial<Record<FinanceView, string[]>> = {
  dashboard: ['inicio', 'resumo', 'visao geral', 'painel'],
  'quick-entry': ['lancar', 'rapido', 'nova receita', 'nova despesa', 'entrada', 'saida', 'novo lancamento'],
  transactions: ['receita', 'despesa', 'movimentacao', 'gastos', 'ganhos', 'historico'],
  transfers: ['transferir', 'entre contas', 'mover dinheiro'],
  'payables-receivables': ['contas a pagar', 'contas a receber', 'vencimentos', 'boleto', 'parcelas', 'pagar', 'receber', 'baixa'],
  'statement-import': ['importar', 'ofx', 'csv', 'extrato do banco', 'conciliar', 'conciliacao'],
  balance: ['balanco', 'patrimonio', 'ativo', 'passivo'],
  statement: ['saldo', 'extrato da conta', 'movimentos'],
  'category-report': ['categoria', 'gastos por categoria', 'para onde foi o dinheiro'],
  'tag-report': ['tag', 'etiqueta'],
  'cash-flow': ['fluxo de caixa', 'caixa', 'entradas e saidas'],
  'payables-receivables-report': ['relatorio de contas', 'pagar e receber'],
  'payables-receivables-calendar': ['calendario', 'agenda', 'vencimentos do mes'],
  'payables-receivables-flow': ['projecao', 'fluxo de contas', 'proximos meses'],
  accounts: ['bancos', 'carteira', 'saldo das contas', 'conta bancaria'],
  categories: ['classificar', 'subcategoria'],
  tags: ['etiquetas', 'marcadores'],
  'clients-suppliers': ['clientes', 'fornecedores', 'pessoas', 'cadastro', 'cpf', 'cnpj', 'contato', 'pix', 'split'],
  'machines-dashboard': ['maquinas', 'equipamentos', 'frota'],
  'machines-inventory': ['maquinas', 'equipamentos', 'estoque', 'frota', 'cadastro de maquina'],
  'machines-maintenance': ['manutencao', 'conserto', 'oficina', 'revisao'],
  'machines-rentals': ['locacao', 'aluguel', 'alugar', 'contrato'],
  'machines-pricing': ['preco', 'tabela de precos', 'valor da locacao'],
  'machines-movements': ['vendidos', 'baixados', 'baixa de maquina', 'venda de maquina'],
  'machines-operators': ['operador', 'motorista'],
  'machines-mechanics': ['mecanico'],
  'machines-catalog': ['tipos', 'categorias de maquina'],
  'credit-applications': ['credito', 'proposta', 'analise', 'biometria', 'financiamento'],
  'credit-ignored': ['ocorrencias', 'ignoradas', 'restricoes'],
  'credit-admin': ['credito', 'configuracao de credito', 'regras'],
  'payments-dashboard': ['pagamentos', 'vendas', 'recebimentos', 'resumo de vendas'],
  'payments-establishments': ['pagadores', 'lojista', 'homologacao', 'estabelecimento', 'cadastro', 'documentos'],
  'payments-charges': ['cobranca', 'cobrar', 'boleto', 'pix', 'link de pagamento', 'cartao', 'vendas', 'receber', 'emitir'],
  'payments-pos': ['maquininha', 'pos', 'terminal'],
  'payments-fees': ['taxas', 'tarifas', 'custo', 'mdr'],
  'payments-seller-transfer': ['transferência entre sellers', 'transferir entre contas', 'desembolso'],
  'payments-transfer': ['saque', 'repasse', 'transferir saldo', 'retirar'],
  'payments-admin-dashboard': ['pagamentos', 'visao geral', 'marketplace'],
  'payments-admin-registration': ['estabelecimentos', 'sellers', 'credenciais', 'cadastros', 'homologacao'],
  'payments-admin-settlements': ['liquidacoes', 'repasses', 'conciliacao'],
  'payments-admin-settings': ['configuracoes', 'webhook', 'gateway'],
  'company-settings': ['empresa', 'configuracoes', 'configuracao', 'logo', 'perfil', 'dados da empresa', 'whatsapp', 'modulos'],
  'admin-dashboard': ['admin', 'visao geral', 'painel'],
  'admin-users': ['usuarios', 'pessoas', 'convites', 'acessos'],
  'admin-roles': ['cargos', 'permissoes', 'acessos', 'papeis'],
  'admin-modules': ['modulos', 'marca', 'logo', 'nome', 'cor', 'personalizar', 'branding'],
  'audit-logs': ['auditoria', 'historico', 'quem mudou', 'logs'],
  'bank-digital': ['banco digital', 'unida', 'extrato', 'conexao'],
};

const screen = (section: string, view: FinanceView, label: string, icon: ReactNode | null = null): SearchableScreen => ({
  view,
  label,
  section,
  icon,
  keywords: KEYWORDS[view] ?? [],
});

const fromMenu = (section: string) => (item: MenuItem) => screen(section, item.view, item.label, item.icon);

/**
 * Lista as telas que a pessoa PODE abrir agora — mesmas regras do menu lateral
 * (modo, módulos ativos e permissões), para a busca nunca sugerir um beco sem saída.
 */
export function listSearchableScreens(ctx: SearchAccessContext): SearchableScreen[] {
  const seen = new Set<FinanceView>();
  const out: SearchableScreen[] = [];
  const push = (screens: SearchableScreen[]) => {
    for (const s of screens) {
      if (seen.has(s.view)) continue;
      seen.add(s.view);
      out.push(s);
    }
  };

  if (ctx.isAdminMode) {
    push([
      screen('Administração', 'admin-dashboard', 'Dashboard Admin'),
      screen('Administração', 'admin-users', 'Usuários'),
      screen('Administração', 'admin-roles', 'Cargos & Permissões'),
      screen('Administração', 'admin-modules', 'Configuração de Módulos'),
      screen('Administração', 'audit-logs', 'Logs de Auditoria'),
      screen('Administração', 'credit-admin', 'Gestão de Crédito (config)'),
      screen('Administração', 'company-settings', 'Configurações da Empresa'),
      ...(ctx.bankDigitalEnabled ? [screen('Administração', 'bank-digital', 'Banco Digital (config)')] : []),
    ]);
    push(paymentsAdminMenuItems.map(fromMenu('Pagamentos (admin)')));
    return out;
  }

  const allowed = (items: MenuItem[]) =>
    ctx.isSupervisor
      ? items
      : items.filter((i) => {
          const key = FINANCE_VIEW_PERMISSION_KEY[i.view];
          return !!key && ctx.can(key);
        });

  push(allowed(mainMenuItems).map(fromMenu('Finanças')));
  push(allowed(transacoesMenuItems).map(fromMenu('Finanças')));
  push(allowed(allRelatoriosItems).map(fromMenu('Relatórios')));
  push(allowed(cadastrosMenuItems).map(fromMenu('Cadastros')));

  if (ctx.machinesEnabled) push(allowed(machinesMenuItems).map(fromMenu('Máquinas')));
  if (ctx.creditEnabled) {
    push(allowed(creditMenuItems.filter(i => i.view !== 'credit-anticipation' || ctx.anticipationEnabled)).map(fromMenu('Crédito')));
    if (ctx.isSupervisor || ctx.isGerente) {
      push(allowed(creditAdminMenuItems.filter(i => i.view !== 'credit-financier' || ctx.isFinancier)).map(fromMenu('Crédito')));
    }
  }
  if (ctx.paymentsEnabled) push(allowed(paymentsMenuItems).map(fromMenu('Pagamentos')));

  if (ctx.isSupervisor || (ctx.isGerente && ctx.can('admin.companies'))) {
    push([screen('Configurações', 'company-settings', 'Configurações da Empresa')]);
  }
  return out;
}

/** Minúsculas e sem acento: "lancamento" encontra "Lançamentos". */
export const normalizeText = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
