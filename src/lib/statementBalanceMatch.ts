interface BalanceLine {
  id: string;
  line_index: number;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  running_balance: number | null;
  status: string;
  duplicate_of_transaction_id: string | null;
  suggested_account_id: string | null;
}

const cents = (value: number) => Math.round(value * 100);
const signed = (line: BalanceLine) => cents(line.amount) * (line.type === 'income' ? 1 : -1);

/** Suggest only a chronological remainder with a verified opening and closing balance. */
export function findStatementBalanceMatch(params: {
  lines: BalanceLine[];
  openingBalance: number | null;
  closingBalance: number | null;
  accountBalance: number | null;
  accountId: string | null;
}) {
  const { openingBalance, closingBalance, accountBalance, accountId } = params;
  if (!accountId || accountBalance === null || closingBalance === null ||
      !Number.isFinite(accountBalance) || !Number.isFinite(closingBalance)) return null;
  const lines = [...params.lines].sort((a, b) => a.line_index - b.line_index);
  if (!lines.length) return null;
  // An explicit running balance can establish the opening even when it is absent in the header.
  let opening = openingBalance === null ? null : cents(openingBalance);
  if (opening === null) {
    let movement = 0;
    for (const line of lines) {
      movement += signed(line);
      if (line.running_balance !== null && Number.isFinite(line.running_balance)) {
        opening = cents(line.running_balance) - movement;
        break;
      }
    }
  }
  if (opening === null || !Number.isFinite(opening)) return null;
  const balances = [opening];
  for (const line of lines) {
    const balance = balances[balances.length - 1] + signed(line);
    if (line.running_balance !== null && (!Number.isFinite(line.running_balance) || cents(line.running_balance) !== balance)) return null;
    balances.push(balance);
  }
  if (balances[balances.length - 1] !== cents(closingBalance)) return null;
  // Prefer the most recent checkpoint to avoid suggesting historical movements again.
  // A verified balance chain proves the remainder is not yet in the account, so lines
  // flagged only as *possible* duplicates may be included — but are reported separately.
  const base = { openingBalance: opening / 100, movement: (cents(closingBalance) - cents(accountBalance)) / 100, projectedBalance: closingBalance };
  // Possible duplicates already exist in the app, so they are already inside the account balance:
  // only the missing (unflagged) lines should be posted, and they must close the final balance exactly.
  const pending = lines.filter(line => line.status === 'pending' && line.suggested_account_id === accountId);
  const alreadyInApp = pending.filter(line => line.duplicate_of_transaction_id);
  const missing = pending.filter(line => !line.duplicate_of_transaction_id);
  if (alreadyInApp.length && missing.reduce((sum, line) => sum + signed(line), cents(accountBalance)) === cents(closingBalance)) {
    return { ...base, mode: 'already_in_app' as const, lineIds: missing.map(l => l.id), alreadyInAppIds: alreadyInApp.map(l => l.id),
      flaggedDuplicateIds: [] as string[], checkpointDate: null, startIndex: 0,
      firstDate: missing[0]?.date ?? null, lastDate: missing[missing.length - 1]?.date ?? null };
  }
  for (const allowFlagged of [false, true]) {
    for (let start = lines.length; start >= 0; start--) {
      if (balances[start] !== cents(accountBalance)) continue;
      const remainder = lines.slice(start);
      const eligible = remainder.filter(line => line.status === 'pending' &&
        (allowFlagged || !line.duplicate_of_transaction_id) && line.suggested_account_id === accountId);
      if (eligible.reduce((sum, line) => sum + signed(line), cents(accountBalance)) !== cents(closingBalance)) continue;
      return {
        mode: 'checkpoint' as const,
        alreadyInAppIds: [] as string[],
        lineIds: eligible.map(line => line.id),
        flaggedDuplicateIds: eligible.filter(line => line.duplicate_of_transaction_id).map(line => line.id),
        checkpointDate: start > 0 ? lines[start - 1].date : null,
        startIndex: start,
        firstDate: eligible[0]?.date ?? null,
        lastDate: eligible[eligible.length - 1]?.date ?? null,
        openingBalance: opening / 100,
        movement: (cents(closingBalance) - cents(accountBalance)) / 100,
        projectedBalance: closingBalance,
      };
    }
  }
  return null;
}
