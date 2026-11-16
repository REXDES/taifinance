import assert from 'node:assert/strict';
import { findStatementBalanceMatch } from '../src/lib/statementBalanceMatch.ts';

const lines = [
  { id: 'old', line_index: 0, date: '2026-11-01', amount: 100, type: 'income' as const, running_balance: 1100, status: 'pending', duplicate_of_transaction_id: null, suggested_account_id: 'account' },
  { id: 'debit', line_index: 1, date: '2026-11-02', amount: 50, type: 'expense' as const, running_balance: 1050, status: 'pending', duplicate_of_transaction_id: null, suggested_account_id: 'account' },
  { id: 'credit', line_index: 2, date: '2026-11-03', amount: 200, type: 'income' as const, running_balance: 1250, status: 'pending', duplicate_of_transaction_id: null, suggested_account_id: 'account' },
];
const params = { lines, openingBalance: 1000, closingBalance: 1250, accountBalance: 1100, accountId: 'account' };
assert.deepEqual(findStatementBalanceMatch(params)?.lineIds, ['debit', 'credit']);
assert.equal(findStatementBalanceMatch(params)?.projectedBalance, 1250);
assert.deepEqual(findStatementBalanceMatch({ ...params, accountBalance: 1000 })?.lineIds, ['old', 'debit', 'credit']);
assert.equal(findStatementBalanceMatch({ ...params, accountBalance: 999 }), null);
assert.equal(findStatementBalanceMatch({ ...params, closingBalance: 1251 }), null);
const flagged = findStatementBalanceMatch({ ...params, lines: lines.map(l => l.id === 'credit' ? { ...l, duplicate_of_transaction_id: 'existing' } : l) });
assert.deepEqual(flagged?.lineIds, ['debit', 'credit']);
assert.deepEqual(flagged?.flaggedDuplicateIds, ['credit']);
assert.deepEqual(findStatementBalanceMatch(params)?.flaggedDuplicateIds, []);
assert.equal(findStatementBalanceMatch({ ...params, lines: lines.map(l => ({ ...l, suggested_account_id: 'other' })) }), null);
assert.deepEqual(findStatementBalanceMatch({ ...params, openingBalance: null })?.lineIds, ['debit', 'credit']);
assert.equal(findStatementBalanceMatch({ ...params, openingBalance: null, lines: lines.map(l => ({ ...l, running_balance: null })) }), null);
assert.deepEqual(findStatementBalanceMatch({ ...params, accountBalance: 1250 })?.lineIds, []);
assert.equal(findStatementBalanceMatch({ ...params, lines: lines.map(l => l.id === 'debit' ? { ...l, running_balance: 1040 } : l) }), null);
console.log('11 verificações de saldo e seleção passaram');
// Possible duplicate already in app: balance 1000 + credit 200 = 1200; only old+debit are missing.
const inApp = findStatementBalanceMatch({ ...params, accountBalance: 1200, lines: lines.map(l => l.id === 'credit' ? { ...l, duplicate_of_transaction_id: 'existing' } : l) });
assert.deepEqual(inApp?.lineIds, ['old', 'debit']);
assert.deepEqual(inApp?.alreadyInAppIds, ['credit']);
assert.equal(inApp?.mode, 'already_in_app');
