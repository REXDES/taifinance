import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyMovement {
  company_id: string;
  company_name: string;
  income: number;
  expense: number;
  total: number;
}

export interface PatrimonialPoint {
  month: string;
  total: number;
}

export interface AdminGlobalStats {
  loading: boolean;
  totalCompanies: number;
  totalUsers: number;
  pendingInvitations: number;
  ativoBalance: number;
  passivoBalance: number;
  monthIncome: number;
  monthExpense: number;
  payablesPending: number;
  receivablesPending: number;
  payablesOverdue: number;
  receivablesOverdue: number;
  topCompanies: CompanyMovement[];
  patrimonialEvolution: PatrimonialPoint[];
  recentLogs: Array<{
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
    user_email?: string;
  }>;
}

const initial: AdminGlobalStats = {
  loading: true,
  totalCompanies: 0,
  totalUsers: 0,
  pendingInvitations: 0,
  ativoBalance: 0,
  passivoBalance: 0,
  monthIncome: 0,
  monthExpense: 0,
  payablesPending: 0,
  receivablesPending: 0,
  payablesOverdue: 0,
  receivablesOverdue: 0,
  topCompanies: [],
  patrimonialEvolution: [],
  recentLogs: [],
};

export function useAdminGlobalStats(enabled: boolean) {
  const [stats, setStats] = useState<AdminGlobalStats>(initial);

  const fetchAll = useCallback(async () => {
    setStats((s) => ({ ...s, loading: true }));

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    try {
      const [
        companiesRes,
        usersRes,
        invitesRes,
        accountsRes,
        groupsRes,
        txRes,
        prRes,
        logsRes,
      ] = await Promise.all([
        supabase.from('companies').select('id, name'),
        supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
        supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('is_used', false).gt('expires_at', new Date().toISOString()),
        supabase.from('accounts').select('id, company_id, current_balance, group_id'),
        supabase.from('account_groups').select('id, type'),
        supabase.from('transactions').select('company_id, type, amount, date').gte('date', monthStart),
        supabase.from('payables_receivables').select('type, status, amount, due_date, is_amount_pending'),
        supabase
          .from('audit_logs')
          .select('id, action, entity_type, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const companies = companiesRes.data || [];
      const accounts = accountsRes.data || [];
      const groups = groupsRes.data || [];
      const transactions = txRes.data || [];
      const pr = prRes.data || [];
      const logs = logsRes.data || [];

      const groupTypeMap = new Map(groups.map((g) => [g.id, g.type]));

      let ativoBalance = 0;
      let passivoBalance = 0;
      for (const acc of accounts) {
        const t = acc.group_id ? groupTypeMap.get(acc.group_id) : 'ativo';
        if (t === 'passivo') passivoBalance += Number(acc.current_balance || 0);
        else ativoBalance += Number(acc.current_balance || 0);
      }

      let monthIncome = 0;
      let monthExpense = 0;
      const movByCompany = new Map<string, { income: number; expense: number }>();
      for (const tx of transactions) {
        const amt = Number(tx.amount || 0);
        const cur = movByCompany.get(tx.company_id) || { income: 0, expense: 0 };
        if (tx.type === 'income') {
          monthIncome += amt;
          cur.income += amt;
        } else {
          monthExpense += amt;
          cur.expense += amt;
        }
        movByCompany.set(tx.company_id, cur);
      }

      const companyNameMap = new Map(companies.map((c) => [c.id, c.name]));
      const topCompanies: CompanyMovement[] = Array.from(movByCompany.entries())
        .map(([id, v]) => ({
          company_id: id,
          company_name: companyNameMap.get(id) || 'Desconhecida',
          income: v.income,
          expense: v.expense,
          total: v.income + v.expense,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      let payablesPending = 0;
      let receivablesPending = 0;
      let payablesOverdue = 0;
      let receivablesOverdue = 0;
      for (const r of pr) {
        if (r.status === 'paid' || r.is_amount_pending) continue;
        const amt = Number(r.amount || 0);
        const overdue = r.due_date < todayStr;
        if (r.type === 'payable') {
          payablesPending += amt;
          if (overdue) payablesOverdue += amt;
        } else {
          receivablesPending += amt;
          if (overdue) receivablesOverdue += amt;
        }
      }

      // Patrimonial evolution: last 6 months total income - expense per month, cumulative on top of current ativo
      const months: PatrimonialPoint[] = [];
      const monthLabels: string[] = [];
      const monthKeys: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        monthLabels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
      }
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10);
      const evolRes = await supabase
        .from('transactions')
        .select('type, amount, date')
        .gte('date', sixMonthsAgo);
      const evolTx = evolRes.data || [];
      const monthDelta = new Map<string, number>(monthKeys.map((k) => [k, 0]));
      for (const t of evolTx) {
        const k = (t.date as string).slice(0, 7);
        if (!monthDelta.has(k)) continue;
        const amt = Number(t.amount || 0);
        monthDelta.set(k, (monthDelta.get(k) || 0) + (t.type === 'income' ? amt : -amt));
      }
      // Approximate: ativoBalance is "current"; reverse-build past months
      let running = ativoBalance + passivoBalance;
      const reverseDeltas = monthKeys.map((k) => monthDelta.get(k) || 0);
      const totals: number[] = new Array(monthKeys.length);
      totals[monthKeys.length - 1] = running;
      for (let i = monthKeys.length - 1; i > 0; i--) {
        running = running - reverseDeltas[i];
        totals[i - 1] = running;
      }
      monthKeys.forEach((_, i) => months.push({ month: monthLabels[i], total: totals[i] }));

      // Resolve user emails for recent logs
      const userIds = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean)));
      let emailMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds);
        emailMap = new Map((profs || []).map((p) => [p.user_id, p.email]));
      }

      setStats({
        loading: false,
        totalCompanies: companies.length,
        totalUsers: usersRes.count || 0,
        pendingInvitations: invitesRes.count || 0,
        ativoBalance,
        passivoBalance,
        monthIncome,
        monthExpense,
        payablesPending,
        receivablesPending,
        payablesOverdue,
        receivablesOverdue,
        topCompanies,
        patrimonialEvolution: months,
        recentLogs: logs.map((l) => ({
          id: l.id,
          action: l.action,
          entity_type: l.entity_type,
          created_at: l.created_at,
          user_email: emailMap.get(l.user_id) || '—',
        })),
      });
    } catch (err) {
      console.error('Erro ao carregar estatísticas globais:', err);
      setStats((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchAll();
  }, [enabled, fetchAll]);

  return { ...stats, refetch: fetchAll };
}
