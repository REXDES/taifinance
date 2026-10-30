import assert from 'node:assert/strict';
import { settleAssignment, onSalePaid } from '../supabase/functions/_shared/anticipation.ts';

// Simulate provider and storage only: never send money during tests.
Object.assign(globalThis, { Deno: { env: { get: () => undefined } } });
const originalFetch = globalThis.fetch;
const splits: Array<{ url: string; payload: any }> = [];
globalThis.fetch = async (url, options) => {
  if (String(url).endsWith('/auth')) return Response.json({ token: 'test-token' });
  splits.push({ url: String(url), payload: JSON.parse(String(options?.body)) });
  return Response.json({ id: 'test-split' });
};

let assignment: any;
let succeeded = false;
let completedFinancier = '';
function adminMock() {
  return { from(table: string) {
    let operation = 'select';
    let value: any;
    const filters: Record<string, unknown> = {};
    const query: any = {
      select() { return query; },
      eq(key: string, item: unknown) { filters[key] = item; return query; },
      in() { return query; },
      limit() { return query; },
      update(item: unknown) { operation = 'update'; value = item; return query; },
      insert(item: unknown) { operation = 'insert'; value = item; return query; },
      maybeSingle() { return Promise.resolve(result()); },
      then(resolve: any, reject: any) { return Promise.resolve(result()).then(resolve, reject); },
    };
    function result() {
      if (operation === 'update' && table === 'receivable_assignments') Object.assign(assignment, value);
      if (operation === 'insert' && table === 'receivable_assignment_events' && value.success) succeeded = true;
      if (operation !== 'select') return { data: null, error: null };
      if (table === 'receivable_assignments') return { data: assignment };
      if (table === 'receivable_assignment_events') return { data: succeeded ? [{ id: 'event' }] : [] };
      if (table === 'companies') {
        completedFinancier = String(filters.id);
        return { data: { name: 'Configured financier', necta_seller_id: `seller-${filters.id}` } };
      }
      if (table === 'necta_sales') return { data: { necta_sale_id: 'sale-uuid' } };
      return { data: null };
    }
    return query;
  } };
}

try {
  assignment = {
    id: 'assignment-1', status: 'assigned', financier_company_id: 'admin-selected-company',
    cedent_company_id: 'cedent', payable_receivable_id: 'receivable', necta_sale_id: 'sale-row',
    face_amount: '100.00', net_amount: '90.00',
  };
  const admin = adminMock();
  await onSalePaid(admin, { id: 'sale-row', payable_receivable_id: 'receivable' });
  assert.equal(splits[0]?.payload.amount, 10000, 'Split must send 100% face, not the R$90 disbursement');
  assert.equal(completedFinancier, 'admin-selected-company');
  assert.equal(splits[0]?.payload.recipientId, 'seller-admin-selected-company');
  assert.equal(splits[0]?.url.endsWith('/sales/sale-uuid/splits'), true);
  assert.equal(assignment.status, 'settled');
  await settleAssignment(admin, assignment.id);
  assert.equal(splits.length, 1, 'A settled assignment cannot send money twice');
  assignment.status = 'paid_by_debtor';
  await settleAssignment(admin, assignment.id);
  assert.equal(splits.length, 1, 'A successful request event prevents duplicate splits');

  succeeded = false;
  assignment = { ...assignment, id: 'assignment-2', status: 'paid_by_debtor', face_amount: '51.75' };
  await settleAssignment(admin, assignment.id);
  assert.equal(splits[1]?.payload.amount, 5175, 'Face cents must be preserved exactly');

  for (const face of [null, 'invalid', 0, -10]) {
    succeeded = false;
    assignment = { ...assignment, status: 'paid_by_debtor', face_amount: face };
    const outcome = await settleAssignment(admin, assignment.id);
    assert.equal(outcome.ok, false);
    assert.equal(assignment.status, 'settlement_failed');
    assert.equal(splits.length, 2, 'Invalid face must never invoke the provider');
  }
  console.log('Anticipation settlement: full face, configured financier, cents, idempotency and validation passed.');
} finally {
  globalThis.fetch = originalFetch;
}