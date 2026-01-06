import { useMemo } from 'react';
import { Account, AccountGroup } from './useAccounts';
import { Transaction } from './useTransactions';
import { Transfer } from './useTransfers';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthlyBalance {
  month: string;
  monthLabel: string;
  ativo: number;
  passivo: number;
  total: number;
}

interface UsePatrimonialEvolutionProps {
  accounts: Account[];
  groups: AccountGroup[];
  transactions: Transaction[];
  transfers: Transfer[];
  monthsBack?: number;
}

export function usePatrimonialEvolution({
  accounts,
  groups,
  transactions,
  transfers,
  monthsBack = 6,
}: UsePatrimonialEvolutionProps): MonthlyBalance[] {
  return useMemo(() => {
    const now = new Date();
    const months: MonthlyBalance[] = [];

    // Helper to determine if an account belongs to ativo or passivo
    const getAccountType = (account: Account): 'ativo' | 'passivo' => {
      const group = groups.find(g => g.id === account.group_id);
      return group?.type || 'ativo';
    };

    // Calculate balance for each month
    for (let i = monthsBack - 1; i >= 0; i--) {
      const targetDate = subMonths(now, i);
      const monthEnd = endOfMonth(targetDate);
      const monthKey = format(targetDate, 'yyyy-MM');
      const monthLabel = format(targetDate, 'MMM/yy', { locale: ptBR });

      let ativoBalance = 0;
      let passivoBalance = 0;

      // For each account, calculate its balance at the end of this month
      accounts.forEach(account => {
        const accountType = getAccountType(account);
        let balance = Number(account.initial_balance);

        // Add transactions up to this month end
        transactions.forEach(tx => {
          if (tx.account_id === account.id) {
            const txDate = parseISO(tx.date);
            if (!isAfter(txDate, monthEnd)) {
              if (tx.type === 'income') {
                balance += tx.amount;
              } else {
                balance -= tx.amount;
              }
            }
          }
        });

        // Add transfers up to this month end
        transfers.forEach(tr => {
          const trDate = parseISO(tr.date);
          if (!isAfter(trDate, monthEnd)) {
            if (tr.from_account_id === account.id) {
              balance -= tr.amount;
            }
            if (tr.to_account_id === account.id) {
              balance += tr.amount;
            }
          }
        });

        if (accountType === 'passivo') {
          passivoBalance += balance;
        } else {
          ativoBalance += balance;
        }
      });

      months.push({
        month: monthKey,
        monthLabel,
        ativo: ativoBalance,
        passivo: passivoBalance,
        total: ativoBalance - passivoBalance,
      });
    }

    return months;
  }, [accounts, groups, transactions, transfers, monthsBack]);
}
