import { useQuery } from '@tanstack/react-query';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { formatLocalISO, parseLocalDate, todayISO } from '@/lib/dateUtils';
import type { FinanceView } from '@/pages/Finance';

export type PendingSeverity = 'urgent' | 'attention' | 'info';

export type PendingKind =
  | 'payables-overdue'
  | 'receivables-overdue'
  | 'payables-due-soon'
  | 'charges-review'
  | 'homologation-ready'
  | 'homologation-rejected'
  | 'homologation-expired';

export interface PendingItem {
  kind: PendingKind;
  severity: PendingSeverity;
  /** Quantas ocorrências esse item agrupa. */
  count: number;
  title: string;
  detail?: string;
  /** Tela para onde o clique leva. */
  view: FinanceView;
}

export interface PendingAccess {
  isSupervisor: boolean;
  can: (permissionKey: string) => boolean;
  paymentsEnabled: boolean;
}

const DUE_SOON_DAYS = 7;
const ROW_LIMIT = 1000;

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Bucket {
  count: number;
  total: number;
  oldestDays: number;
}

const emptyBucket = (): Bucket => ({ count: 0, total: 0, oldestDays: 0 });

function addToBucket(bucket: Bucket, amount: number | null, daysLate: number) {
  bucket.count += 1;
  bucket.total += Number(amount ?? 0);
  bucket.oldestDays = Math.max(bucket.oldestDays, daysLate);
}

const lateText = (b: Bucket) =>
  [b.total > 0 ? brl(b.total) : null, b.oldestDays > 0 ? `a mais antiga venceu há ${plural(b.oldestDays, 'dia', 'dias')}` : null]
    .filter(Boolean)
    .join(' · ');

/**
 * Pendências da empresa selecionada, já em linguagem simples.
 * Consulta só o que a pessoa pode ver (permissão + módulo ativo) e agrupa por
 * tipo — assim a lista fica curta, mesmo com muitas ocorrências.
 */
interface PendingScope {
  canPayables: boolean;
  canCharges: boolean;
  canHomologation: boolean;
}

async function fetchPendingItems(companyId: string, scope: PendingScope): Promise<PendingItem[]> {
  const today = todayISO();
  const todayDate = parseLocalDate(today);
  const soonLimit = formatLocalISO(addDays(todayDate, DUE_SOON_DAYS));
  const items: PendingItem[] = [];
  const { canPayables, canCharges, canHomologation } = scope;

  const tasks: Promise<void>[] = [];

  if (canPayables) {
    tasks.push((async () => {
      const receivablesOverdue = emptyBucket();
      const payablesOverdue = emptyBucket();
      const payablesSoon = emptyBucket();

      const { data, error } = await supabase
        .from('payables_receivables')
        .select('type, amount, due_date')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .lte('due_date', soonLimit)
        .limit(ROW_LIMIT);
      if (error) throw error;

      for (const row of data ?? []) {
        const daysLate = differenceInCalendarDays(todayDate, parseLocalDate(row.due_date));
        if (daysLate > 0) addToBucket(row.type === 'receivable' ? receivablesOverdue : payablesOverdue, row.amount, daysLate);
        else if (row.type === 'payable') addToBucket(payablesSoon, row.amount, 0);
      }

      // Cobranças da Necta aparecem junto das contas a receber (mesma regra do espelho
      // em usePayablesReceivables), então entram aqui para o número bater com a lista.
      const { data: company } = await supabase
        .from('companies')
        .select('necta_mirror_enabled')
        .eq('id', companyId)
        .maybeSingle();
      if ((company as { necta_mirror_enabled?: boolean } | null)?.necta_mirror_enabled) {
        const { data: sales } = await supabase
          .from('necta_sales')
          .select('amount, due_date')
          .eq('company_id', companyId)
          .in('status', ['pending', 'issued', 'overdue'])
          .lt('due_date', today)
          .limit(ROW_LIMIT);
        for (const sale of sales ?? []) {
          addToBucket(receivablesOverdue, sale.amount, differenceInCalendarDays(todayDate, parseLocalDate(sale.due_date)));
        }
      }

      if (payablesOverdue.count) {
        items.push({
          kind: 'payables-overdue', severity: 'urgent', count: payablesOverdue.count, view: 'payables-receivables',
          title: `${plural(payablesOverdue.count, 'conta a pagar atrasada', 'contas a pagar atrasadas')}`,
          detail: lateText(payablesOverdue),
        });
      }
      if (receivablesOverdue.count) {
        items.push({
          kind: 'receivables-overdue', severity: 'attention', count: receivablesOverdue.count, view: 'payables-receivables',
          title: `${plural(receivablesOverdue.count, 'conta a receber atrasada', 'contas a receber atrasadas')}`,
          detail: lateText(receivablesOverdue),
        });
      }
      if (payablesSoon.count) {
        items.push({
          kind: 'payables-due-soon', severity: 'info', count: payablesSoon.count, view: 'payables-receivables',
          title: `${plural(payablesSoon.count, 'conta a pagar vence', 'contas a pagar vencem')} nos próximos ${DUE_SOON_DAYS} dias`,
          detail: payablesSoon.total > 0 ? brl(payablesSoon.total) : undefined,
        });
      }
    })());
  }

  if (canCharges) {
    tasks.push((async () => {
      const { count, error } = await supabase
        .from('necta_sales')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('needs_review', true)
        .is('reviewed_at', null);
      if (error) throw error;
      if (count) {
        items.push({
          kind: 'charges-review', severity: 'attention', count, view: 'payments-charges',
          title: `${plural(count, 'cobrança precisa', 'cobranças precisam')} de revisão`,
          detail: 'Estorno ou falha detectados — confira antes de agir',
        });
      }
    })());
  }

  if (canHomologation) {
    tasks.push((async () => {
      const { data, error } = await supabase
        .from('necta_homologation_requests')
        .select('establishment_id, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      // Só vale a solicitação mais recente de cada estabelecimento: uma recusa antiga
      // já substituída por uma aprovada não é mais pendência.
      const latest = new Map<string, string>();
      for (const row of (data ?? []) as { establishment_id: string; status: string }[]) {
        if (!latest.has(row.establishment_id)) latest.set(row.establishment_id, row.status);
      }
      const countStatus = (status: string) => [...latest.values()].filter((s) => s === status).length;

      const rejected = countStatus('rejected');
      const ready = countStatus('ready');
      const expired = countStatus('expired');
      if (rejected) {
        items.push({
          kind: 'homologation-rejected', severity: 'urgent', count: rejected, view: 'payments-establishments',
          title: `${plural(rejected, 'cadastro recusado', 'cadastros recusados')} na homologação`,
          detail: 'Corrija os dados e envie de novo',
        });
      }
      if (ready) {
        items.push({
          kind: 'homologation-ready', severity: 'attention', count: ready, view: 'payments-establishments',
          title: `${plural(ready, 'cadastro pronto', 'cadastros prontos')} para enviar`,
          detail: 'O cliente já concluiu — falta você enviar para análise',
        });
      }
      if (expired) {
        items.push({
          kind: 'homologation-expired', severity: 'attention', count: expired, view: 'payments-establishments',
          title: `${plural(expired, 'link de cadastro expirou', 'links de cadastro expiraram')}`,
          detail: 'Gere um novo link para o cliente concluir',
        });
      }
    })());
  }

  await Promise.all(tasks);

  const order: Record<PendingSeverity, number> = { urgent: 0, attention: 1, info: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function usePendingItems(companyId: string | null, access: PendingAccess) {
  const scope: PendingScope = {
    canPayables: access.isSupervisor || access.can('finance.payables_receivables'),
    canCharges: access.paymentsEnabled && (access.isSupervisor || access.can('payments.charges')),
    canHomologation:
      access.paymentsEnabled &&
      (access.isSupervisor || access.can('payments.establishments') || access.can('payments.registration')),
  };
  const enabled = !!companyId && (scope.canPayables || scope.canCharges || scope.canHomologation);
  const query = useQuery({
    // O escopo entra na chave: se as permissões terminarem de carregar depois, refaz a busca.
    queryKey: ['pending-items', companyId, scope.canPayables, scope.canCharges, scope.canHomologation],
    queryFn: () => fetchPendingItems(companyId as string, scope),
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  const items = query.data ?? [];
  // O número do sino conta só o que pede ação (urgente/atenção). "Vence nos próximos
  // dias" é informativo: aparece na lista, mas não acende o contador — senão o sino
  // nunca ficaria apagado e as pessoas aprenderiam a ignorá-lo.
  const actionableCount = items
    .filter((i) => i.severity !== 'info')
    .reduce((sum, i) => sum + i.count, 0);
  const topSeverity: PendingSeverity | null = items.some((i) => i.severity === 'urgent')
    ? 'urgent'
    : items.some((i) => i.severity === 'attention')
      ? 'attention'
      : null;

  return {
    items,
    actionableCount,
    topSeverity,
    loading: enabled && query.isLoading,
    error: query.isError,
    refetch: query.refetch,
  };
}
