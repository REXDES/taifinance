// Liquidação da antecipação contra um banco em memória e uma Necta falsa.
// Nada sai da máquina: fetch é interceptado e nenhum dinheiro é movido.
// Roda o código REAL de supabase/functions/_shared/anticipation.ts.
import assert from 'node:assert/strict';
import {
  settleAssignment, onSalePaid, onDisbursementSalePaid, settlementAmounts, findActiveSplit,
} from '../supabase/functions/_shared/anticipation.ts';

const ENV: Record<string, string> = { NECTA_CLIENT_SECRET: 'MARKETPLACE', NECTA_SECRET_KEY: 'mkt-key' };
Object.assign(globalThis, { Deno: { env: { get: (k: string) => ENV[k] } } });

type Row = Record<string, any>;
let db: Record<string, Row[]> = {};

// ------------------------------------------------------------ Necta falsa
const necta = {
  splits: new Map<string, Row[]>(),
  calls: [] as Array<{ method: string; path: string; body: any; who: string }>,
  forbidMarketplaceWrites: false,
  timeoutAfterCreate: false,
  listFails: false,
};
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, opts: any) => {
  const u = new URL(String(url));
  const method = opts?.method ?? 'GET';
  const body = opts?.body ? JSON.parse(String(opts.body)) : undefined;
  if (u.pathname === '/auth') return Response.json({ token: `tok:${body.clientSecret}` });
  const who = String(opts?.headers?.Authorization ?? '').replace('Bearer tok:', '');
  necta.calls.push({ method, path: u.pathname, body, who });
  if (method === 'POST' && u.pathname === '/api-tokens') {
    return Response.json({ id: 'token-1', name: body.name, clientSecret: 'TAI-SELLER', secretKey: 'tai-key' }, { status: 201 });
  }
  let m = u.pathname.match(/^\/sales\/([^/]+)\/splits$/);
  if (m) {
    const list = necta.splits.get(m[1]) ?? [];
    if (method === 'GET') {
      if (necta.listFails) return new Response('indisponível', { status: 503 });
      return Response.json(list);
    }
    if (who === 'MARKETPLACE' && necta.forbidMarketplaceWrites) {
      return Response.json({ error: 'Token sem vínculo com estabelecimento' }, { status: 403 });
    }
    const split = {
      id: `split-${list.length + 1}`, recipientType: body.recipientType,
      recipient: { type: body.recipientType, id: body.recipientId ?? null },
      amount: body.amount, splitType: body.splitType, status: 'PENDING', author: who,
    };
    list.push(split);
    necta.splits.set(m[1], list);
    if (necta.timeoutAfterCreate) throw new TypeError('network timeout (a Necta criou, a resposta se perdeu)');
    return Response.json(split, { status: 201 });
  }
  m = u.pathname.match(/^\/sales\/([^/]+)\/void$/);
  if (m) return Response.json({ ok: true });
  return new Response('not found', { status: 404 });
}) as typeof fetch;

// ------------------------------------------------------- banco em memória
function admin() {
  return {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let op: 'select' | 'update' | 'insert' = 'select';
      let value: any;
      let limitN: number | null = null;
      let returning = false;
      const rows = () => (db[table] ??= []);
      const run = () => {
        if (op === 'insert') {
          const items = (Array.isArray(value) ? value : [value]).map((i) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...i }));
          rows().push(...items);
          return { data: returning ? items : null, error: null };
        }
        const matched = rows().filter((r) => filters.every((f) => f(r)));
        if (op === 'update') {
          matched.forEach((r) => Object.assign(r, value));
          return { data: returning ? matched.map((r) => ({ ...r })) : null, error: null };
        }
        return { data: (limitN ? matched.slice(0, limitN) : matched).map((r) => ({ ...r })), error: null };
      };
      const q: any = {
        select() { if (op !== 'select') returning = true; return q; },
        eq(k: string, v: any) { filters.push((r) => r[k] === v); return q; },
        in(k: string, v: any[]) { filters.push((r) => v.includes(r[k])); return q; },
        is(k: string, v: any) { filters.push((r) => (r[k] ?? null) === v); return q; },
        not(k: string, o: string, v: any) { filters.push((r) => !(o === 'is' ? (r[k] ?? null) === v : r[k] === v)); return q; },
        order() { return q; },
        limit(n: number) { limitN = n; return q; },
        update(v: any) { op = 'update'; value = v; return q; },
        insert(v: any) { op = 'insert'; value = v; return q; },
        upsert(v: any) { op = 'insert'; value = v; return q; },
        async maybeSingle() { const r = run(); const d = Array.isArray(r.data) ? r.data : (r.data ? [r.data] : []); return { data: d[0] ?? null, error: null }; },
        async single() { const r = run(); const d = Array.isArray(r.data) ? r.data : [r.data]; return { data: d[0] ?? null, error: null }; },
        then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); },
      };
      return q;
    },
    // Mesma regra de public.ra_claim_settlement (migração 0020).
    async rpc(fn: string, args: any) {
      if (fn !== 'ra_claim_settlement') return { data: null, error: { message: `rpc ${fn} não simulada` } };
      const a = (db.receivable_assignments ?? []).find((r) => r.id === args._assignment_id);
      const free = a && ['assigned', 'paid_by_debtor', 'split_pending', 'settlement_failed'].includes(a.status)
        && (!a.settle_claimed_at || Date.parse(a.settle_claimed_at) < Date.now() - args._ttl_seconds * 1000);
      if (!free) return { data: [], error: null };
      a.settle_claim_id = args._claim_id;
      a.settle_claimed_at = new Date().toISOString();
      return { data: [{ ...a }], error: null };
    },
  };
}

function seed(over: Partial<Row> = {}, opts: { fee?: number; saleOver?: Partial<Row>; settings?: Partial<Row> } = {}) {
  necta.splits = new Map(); necta.calls = []; necta.forbidMarketplaceWrites = false; necta.timeoutAfterCreate = false; necta.listFails = false;
  db = {
    companies: [
      { id: 'cedente', name: 'Originatto', necta_seller_id: 'seller-cedente', cnpj: '1' },
      { id: 'financiador', name: 'Nexus ESC', necta_seller_id: 'seller-nexus', cnpj: '2' },
    ],
    necta_establishments: [{ id: 'est-cedente', company_id: 'cedente', is_own_profile: true, necta_establishment_id: 'seller-cedente', legal_name: 'Originatto' }],
    necta_company_credentials: [{ company_id: 'cedente', client_secret: 'CEDENTE', secret_key: 'k' }],
    necta_seller_credentials: [],
    anticipation_settings: [{ id: true, split_base: 'gross', internal_transfer_enabled: false, ...(opts.settings ?? {}) }],
    necta_sales: [
      { id: 'sale-row', necta_sale_id: 'sale-uuid', payable_receivable_id: 'titulo', amount: 1000, status: 'paid', net_amount: 997.5, fee_amount: 2.5, method: 'bank_slip', company_id: 'cedente', ...(opts.saleOver ?? {}) },
      { id: 'disb-sale', necta_sale_id: 'disb-uuid', payable_receivable_id: null, amount: 962.5, status: 'issued', method: 'pix', company_id: 'cedente' },
    ],
    payables_receivables: [{ id: 'titulo', company_id: 'cedente', status: 'paid', assignment_id: 'cessao' }],
    receivable_assignments: [{
      id: 'cessao', payable_receivable_id: 'titulo', necta_sale_id: 'sale-row', cedent_company_id: 'cedente',
      financier_company_id: 'financiador', face_amount: 1000, discount_amount: 30, net_amount: 970 - (opts.fee ?? 0),
      platform_fee_amount: opts.fee ?? 0, platform_fee_payer: opts.fee ? 'cedent' : null,
      platform_fee_recipient_type: opts.fee ? 'SELLER' : null, platform_fee_recipient_id: opts.fee ? 'seller-pagando' : null,
      status: 'assigned', disbursed_at: '2026-11-10T12:00:00Z', disbursement_sale_id: null, ...over,
    }],
    receivable_assignment_events: [],
  };
}
const a = () => db.receivable_assignments[0];
const splits = () => necta.splits.get('sale-uuid') ?? [];
const paid = { id: 'sale-row', payable_receivable_id: 'titulo' };
const ok = (msg: string) => console.log(`✓ ${msg}`);

try {
  // Valores puros
  assert.deepEqual(settlementAmounts({ face: 1000, saleAmount: 1000, saleNet: 997.5, saleFee: 2.5, base: 'gross', fee: 7.5, feeEnabled: true }),
    { baseCents: 100000, feeCents: 750, financierCents: 99250, grossCents: 100000 });
  assert.equal((settlementAmounts({ face: 1000, saleNet: 1050.9, saleFee: 2.5, base: 'gross', feeEnabled: false }) as any).baseCents, 105340);
  assert.equal((settlementAmounts({ face: 1000, saleNet: 997.5, saleFee: 2.5, base: 'net', feeEnabled: false }) as any).baseCents, 99750);
  assert.match((settlementAmounts({ face: 1000, base: 'net', feeEnabled: false }) as any).error, /ainda não informou o valor líquido/);
  for (const face of [null, 'x', 0, -10]) assert.ok('error' in settlementAmounts({ face, base: 'gross', feeEnabled: false }));
  assert.equal(findActiveSplit([{ id: 's1', status: 'FAILED', recipient: { id: 'x' } }], { type: 'SELLER', id: 'x' }), null);
  ok('cálculo do repasse: bruto, líquido, taxa e valores inválidos');

  // 1. Sacado paga antes do desembolso → sem repasse, cessão encerrada, cobrança de desembolso cancelada
  seed({ disbursed_at: null, disbursement_sale_id: 'disb-sale' });
  await onSalePaid(admin(), paid);
  assert.equal(splits().length, 0);
  assert.equal(a().status, 'cancelled');
  assert.match(a().cancel_reason, /antes do desembolso/);
  assert.equal(db.payables_receivables[0].assignment_id, null);
  assert.equal(db.necta_sales[1].status, 'canceled');
  ok('1. pago antes do desembolso: nenhum split, cessão encerrada, PIX de desembolso cancelado');

  // 1b. PIX de desembolso já pago, mas não registrado → conta como desembolsado e liquida
  seed({ disbursed_at: null, disbursement_sale_id: 'disb-sale' });
  db.necta_sales[1].status = 'paid';
  await onSalePaid(admin(), paid);
  assert.ok(a().disbursed_at);
  assert.equal(a().disbursement_method, 'pix_charge');
  assert.equal(splits().length, 1);
  ok('1b. desembolso pago e ainda não registrado: é reconhecido e o repasse acontece');

  // 2. Credencial do marketplace; status fica "agendado" até a Necta liquidar
  seed();
  await onSalePaid(admin(), paid);
  assert.equal(splits().length, 1);
  assert.equal(splits()[0].author, 'MARKETPLACE');
  assert.equal(splits()[0].recipient.id, 'seller-nexus');
  assert.equal(splits()[0].amount, 100000);
  assert.equal(a().status, 'split_pending');
  assert.equal(a().split_credential, 'marketplace');
  ok('2. split criado com a credencial do marketplace, R$ 1.000,00 ao financiador, status "repasse agendado"');

  // 2b. Marketplace sem permissão de escrita → token do estabelecimento criado pelo TAI (nunca o do cedente)
  seed();
  necta.forbidMarketplaceWrites = true;
  await onSalePaid(admin(), paid);
  assert.equal(splits().length, 1);
  assert.equal(splits()[0].author, 'TAI-SELLER');
  assert.equal(a().split_credential, 'tai_seller_token');
  assert.ok(necta.calls.some((c) => c.path === '/api-tokens' && c.who === 'MARKETPLACE'));
  ok('2b. Necta recusa o marketplace: usa o token do estabelecimento criado pelo TAI, não o do cedente');

  // 3. Evento falso de "split com sucesso" não impede o repasse (o banco já recusa o INSERT; aqui, o código nem o consulta)
  seed();
  db.receivable_assignment_events.push({ assignment_id: 'cessao', request_id: 'assign-split-cessao', success: true, event_type: 'split' });
  await onSalePaid(admin(), paid);
  assert.equal(splits().length, 1);
  ok('3. evento falso de sucesso é ignorado: o repasse é criado');

  // 5. Duas liquidações ao mesmo tempo (webhook + botão)
  seed({ status: 'paid_by_debtor' });
  await Promise.all([settleAssignment(admin(), 'cessao', 'a'), settleAssignment(admin(), 'cessao', 'b'), settleAssignment(admin(), 'cessao', 'c')]);
  assert.equal(splits().length, 1);
  ok('5. três liquidações simultâneas: um único split');

  // 6. A Necta cria, mas a resposta se perde → a nova tentativa reaproveita
  seed({ status: 'paid_by_debtor' });
  necta.timeoutAfterCreate = true;
  const lost = await settleAssignment(admin(), 'cessao');
  assert.equal(lost.ok, false);
  assert.equal(a().status, 'settlement_failed');
  necta.timeoutAfterCreate = false;
  await settleAssignment(admin(), 'cessao');
  assert.equal(splits().length, 1);
  assert.equal(a().status, 'split_pending');
  assert.equal(a().split_id, 'split-1');
  ok('6. timeout depois de criar: a nova tentativa encontra o split e não cria outro');

  // 6b. Sem conseguir ler o rateio e com pedido anterior sem resposta → não arrisca duplicar
  seed({ status: 'settlement_failed', split_status: 'REQUESTED' });
  necta.listFails = true;
  const blind = await settleAssignment(admin(), 'cessao');
  assert.equal(blind.ok, false);
  assert.match(String(blind.error), /Confira o rateio da venda/);
  assert.equal(splits().length, 0);
  ok('6b. sem leitura do rateio após pedido sem resposta: não cria outro split, pede conferência');

  // 7. Juros/multa vão ao financiador; taxa da Pagando num segundo split
  seed({}, { fee: 7.5, saleOver: { net_amount: 1050.9, fee_amount: 2.5 } });
  await onSalePaid(admin(), paid);
  const [fin, fee] = splits();
  assert.equal(fin.recipient.id, 'seller-nexus');
  assert.equal(fin.amount, 105340 - 750);
  assert.equal(fee.recipient.id, 'seller-pagando');
  assert.equal(fee.amount, 750);
  assert.equal(a().platform_split_id, 'split-2');
  ok('7. pago com juros (R$ 1.053,40): financiador R$ 1.045,90 e Pagando R$ 7,50, em dois splits');

  // 8. Necta liquida → "Liquidado"
  seed();
  await onSalePaid(admin(), paid);
  splits()[0].status = 'SETTLED';
  await settleAssignment(admin(), 'cessao');
  assert.equal(a().status, 'settled');
  assert.ok(a().settled_at);
  assert.equal(splits().length, 1);
  ok('8. só fica "Liquidado" quando a Necta informa SETTLED');

  // 9. Necta informa falha → "Falha no repasse"; reprocessar cria outro (o falho não moveu dinheiro)
  seed();
  await onSalePaid(admin(), paid);
  splits()[0].status = 'FAILED';
  const failed = await settleAssignment(admin(), 'cessao');
  assert.equal(failed.ok, true); // criou um novo para substituir o falho
  assert.equal(splits().length, 2);
  assert.equal(a().split_id, 'split-2');
  assert.equal(a().status, 'split_pending');
  ok('9. split falho na Necta é substituído por um novo na conferência seguinte');

  // 10. Consulta de rotina sem resposta da Necta não marca falha
  seed();
  await onSalePaid(admin(), paid);
  necta.listFails = true;
  const check = await settleAssignment(admin(), 'cessao');
  assert.equal(check.ok, true);
  assert.equal(a().status, 'split_pending');
  assert.match(String(a().last_error), /Não foi possível consultar a Necta agora/);
  ok('10. conferência sem resposta da Necta: continua "repasse agendado", com aviso');

  // 11. Base líquida configurada
  seed({}, { settings: { split_base: 'net' } });
  await onSalePaid(admin(), paid);
  assert.equal(splits()[0].amount, 99750);
  ok('11. base líquida: repasse de R$ 997,50 (bruto menos a taxa da Necta)');

  // 12. Título pago com a solicitação ainda em análise → solicitação encerrada
  seed({ status: 'requested', disbursed_at: null });
  await onSalePaid(admin(), paid);
  assert.equal(a().status, 'cancelled');
  assert.equal(splits().length, 0);
  ok('12. pago com a solicitação em análise: solicitação encerrada, sem split');

  // 13. Desembolso pago depois do encerramento → alerta de devolução
  seed({ status: 'cancelled', disbursed_at: null, disbursement_sale_id: 'disb-sale' });
  const late = await onDisbursementSalePaid(admin(), { id: 'disb-sale', method: 'pix' });
  assert.equal(late?.ok, false);
  assert.match(String(a().last_error), /precisa devolver/);
  ok('13. desembolso pago após o encerramento: alerta de devolução na cessão');

  // 14. Desembolso por cobrança pago (webhook) → registrado automaticamente
  seed({ disbursed_at: null, disbursement_sale_id: 'disb-sale' });
  await onDisbursementSalePaid(admin(), { id: 'disb-sale', method: 'pix' });
  assert.ok(a().disbursed_at);
  assert.equal(a().status, 'assigned');
  ok('14. PIX de desembolso pago: desembolso registrado sozinho');

  // 15. Financiador sem seller e venda sem pagamento confirmado → nunca chama a Necta
  seed({ status: 'paid_by_debtor' });
  db.companies[1].necta_seller_id = null;
  const noSeller = await settleAssignment(admin(), 'cessao');
  assert.equal(noSeller.ok, false);
  seed({ status: 'paid_by_debtor' }, { saleOver: { status: 'issued' } });
  const unpaid = await settleAssignment(admin(), 'cessao');
  assert.match(String(unpaid.error), /ainda não foi confirmado/);
  assert.equal(necta.calls.filter((c) => c.method === 'POST').length, 0);
  ok('15. sem seller do financiador ou sem pagamento confirmado: nenhum split');

  console.log('\nLiquidação da antecipação: todos os cenários passaram.');
} finally {
  globalThis.fetch = originalFetch;
}
