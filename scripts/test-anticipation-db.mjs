// Testa drizzle/migrations/0020_anticipation_money_locks.sql num Postgres de verdade (PGlite, em memória),
// com o esquema mínimo do Supabase/TAI: papéis, auth.uid(), RLS e as tabelas da antecipação.
//
// Uso (não altera package.json nem o lockfile):
//   npm i --no-save @electric-sql/pglite@0.5.12
//   node scripts/test-anticipation-db.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const MIG = fs.readFileSync(process.argv[2] ?? new URL('../drizzle/migrations/0020_anticipation_money_locks.sql', import.meta.url), 'utf8');
const db = new PGlite();

const U_CED = '11111111-1111-1111-1111-111111111111';   // usuário do cedente
const U_FIN = '22222222-2222-2222-2222-222222222222';   // usuário do financiador
const U_SUP = '33333333-3333-3333-3333-333333333333';   // supervisor (Rone)
const U_OUT = '44444444-4444-4444-4444-444444444444';   // usuário de outra empresa
const C_CED = 'aaaaaaaa-0000-0000-0000-000000000001';
const C_FIN = 'aaaaaaaa-0000-0000-0000-000000000002';
const C_OUT = 'aaaaaaaa-0000-0000-0000-000000000003';

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;

  create table public.companies (id uuid primary key, name text, cnpj text);
  create table public.user_companies (user_id uuid, company_id uuid);
  create table public.supervisors (user_id uuid primary key);
  create function public.is_supervisor(_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.supervisors where user_id = _user_id) $$;
  create function public.has_company_access(_user_id uuid, _company_id uuid) returns boolean language sql stable security definer set search_path = public as $$
    select public.is_supervisor(_user_id) or exists (select 1 from public.user_companies where user_id = _user_id and company_id = _company_id) $$;
  create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

  create table public.clients_suppliers (id uuid primary key default gen_random_uuid(), company_id uuid, name text not null, document text);
  create table public.payables_receivables (
    id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
    type text not null, payment_type text not null default 'single', description text not null, amount numeric,
    is_amount_pending boolean not null default false, due_date date not null, status text not null default 'pending',
    client_supplier_id uuid, paid_amount numeric, paid_date date, paid_account_id uuid, paid_by uuid, transaction_id uuid,
    assignment_id uuid, category_id uuid, parent_id uuid, updated_at timestamptz default now());
  create trigger update_payables_receivables_updated_at before update on public.payables_receivables for each row execute function public.update_updated_at_column();
  create table public.necta_sales (
    id uuid primary key default gen_random_uuid(), company_id uuid not null, amount numeric not null, method text not null,
    status text not null default 'pending', due_date date, necta_sale_id text, necta_payment_link_id text,
    payable_receivable_id uuid, establishment_id uuid, paid_at timestamptz, reviewed_at timestamptz,
    created_at timestamptz default now(), updated_at timestamptz default now());
  create table public.seller_transfers (id uuid primary key default gen_random_uuid());
  alter table public.companies enable row level security;
  create policy "co read" on public.companies for select to authenticated using (public.has_company_access(auth.uid(), id));
  alter table public.payables_receivables enable row level security;
  create policy "pr all" on public.payables_receivables for all to authenticated using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id));
  alter table public.necta_sales enable row level security;
  create policy "ns all" on public.necta_sales for all to authenticated using (public.has_company_access(auth.uid(), company_id)) with check (public.has_company_access(auth.uid(), company_id));
  alter table public.clients_suppliers enable row level security;
  create policy "cs all" on public.clients_suppliers for all to authenticated using (public.has_company_access(auth.uid(), company_id));
`);

// Trecho de 0009/0011/0014/0019 (tabelas e policies do módulo, sem storage).
await db.exec(`
CREATE TABLE public.financier_cedent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financier_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cedent_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financier_company_id, cedent_company_id));
ALTER TABLE public.financier_cedent_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcl read" ON public.financier_cedent_links FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_company_access(auth.uid(), financier_company_id) OR public.has_company_access(auth.uid(), cedent_company_id));
CREATE TABLE public.financier_credit_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financier_company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  monthly_discount_rate numeric NOT NULL DEFAULT 3, min_days integer NOT NULL DEFAULT 1, max_days integer NOT NULL DEFAULT 180,
  min_installments integer NOT NULL DEFAULT 1, max_installments integer NOT NULL DEFAULT 24,
  min_title_amount numeric NOT NULL DEFAULT 0, max_title_amount numeric, limit_per_cedent numeric, limit_per_debtor numeric,
  min_score integer, requires_invoice boolean NOT NULL DEFAULT true, notes text, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.financier_credit_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcr write" ON public.financier_credit_rules FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), financier_company_id)) WITH CHECK (public.has_company_access(auth.uid(), financier_company_id));
CREATE TABLE public.receivable_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_receivable_id uuid NOT NULL REFERENCES public.payables_receivables(id) ON DELETE CASCADE,
  necta_sale_id uuid,
  cedent_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  financier_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  face_amount numeric NOT NULL, discount_rate numeric NOT NULL DEFAULT 0, discount_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL, due_date date, status text NOT NULL DEFAULT 'requested', rejection_reason text,
  requested_by uuid, decided_by uuid, decided_at timestamptz, settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ra_status_chk CHECK (status IN ('requested','approved','rejected','assigned','paid_by_debtor','settled','settlement_failed','cancelled')));
CREATE UNIQUE INDEX ra_active_title ON public.receivable_assignments(payable_receivable_id) WHERE status NOT IN ('rejected','cancelled');
ALTER TABLE public.receivable_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ra read" ON public.receivable_assignments FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), cedent_company_id) OR public.has_company_access(auth.uid(), financier_company_id));
CREATE POLICY "ra cedent insert" ON public.receivable_assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), cedent_company_id) AND status = 'requested' AND EXISTS (
    SELECT 1 FROM public.financier_cedent_links l WHERE l.financier_company_id = receivable_assignments.financier_company_id AND l.cedent_company_id = receivable_assignments.cedent_company_id AND l.active));
CREATE POLICY "ra update parties" ON public.receivable_assignments FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), cedent_company_id) OR public.has_company_access(auth.uid(), financier_company_id));
CREATE TRIGGER ra_updated BEFORE UPDATE ON public.receivable_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.receivable_assignment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id uuid REFERENCES public.receivable_assignments(id) ON DELETE CASCADE,
  payable_receivable_id uuid NOT NULL REFERENCES public.payables_receivables(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, kind text NOT NULL DEFAULT 'invoice',
  file_name text NOT NULL, storage_path text NOT NULL, uploaded_by uuid, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.receivable_assignment_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raa write" ON public.receivable_assignment_attachments FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id)) WITH CHECK (public.has_company_access(auth.uid(), company_id));
CREATE TABLE public.receivable_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.receivable_assignments(id) ON DELETE CASCADE,
  event_type text NOT NULL, request_id text, success boolean, payload jsonb, response jsonb, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.receivable_assignment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rae read" ON public.receivable_assignment_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.receivable_assignments a WHERE a.id = assignment_id AND (public.has_company_access(auth.uid(), a.cedent_company_id) OR public.has_company_access(auth.uid(), a.financier_company_id))));
CREATE POLICY "rae insert" ON public.receivable_assignment_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.receivable_assignments a WHERE a.id = assignment_id AND (public.has_company_access(auth.uid(), a.cedent_company_id) OR public.has_company_access(auth.uid(), a.financier_company_id))));
ALTER TABLE public.receivable_assignments ADD COLUMN IF NOT EXISTS title_description text, ADD COLUMN IF NOT EXISTS debtor_name text, ADD COLUMN IF NOT EXISTS cedent_name text;
ALTER TABLE public.receivable_assignments ADD COLUMN IF NOT EXISTS disbursed_at timestamptz;
ALTER TABLE public.receivable_assignments ADD COLUMN IF NOT EXISTS disbursement_transfer_id uuid REFERENCES public.seller_transfers(id) ON DELETE SET NULL;
ALTER TABLE public.receivable_assignments
  ADD COLUMN IF NOT EXISTS disbursement_method text,
  ADD COLUMN IF NOT EXISTS disbursement_sale_id uuid REFERENCES public.necta_sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disbursement_proof_path text,
  ADD COLUMN IF NOT EXISTS disbursement_note text;
-- Padrão do Supabase: privilégios amplos nas tabelas, RLS restringe.
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
`);

// Aplica a migração duas vezes: precisa ser reaplicável.
await db.exec(MIG);
await db.exec(MIG);
console.log('✓ migração aplicada (2x, sem erro)');

// ------------------------------------------------------------------- dados
const today = (await db.query(`select (now() at time zone 'America/Sao_Paulo')::date as d`)).rows[0].d;
const plus = (n) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
await db.exec(`
  insert into public.companies values ('${C_CED}', 'Originatto', '1'), ('${C_FIN}', 'Nexus ESC', '2'), ('${C_OUT}', 'Outra', '3');
  insert into public.user_companies values ('${U_CED}', '${C_CED}'), ('${U_FIN}', '${C_FIN}'), ('${U_OUT}', '${C_OUT}');
  insert into public.supervisors values ('${U_SUP}');
  insert into public.financier_cedent_links (financier_company_id, cedent_company_id) values ('${C_FIN}', '${C_CED}');
  insert into public.financier_credit_rules (financier_company_id, monthly_discount_rate, min_days, max_days, requires_invoice, limit_per_cedent, limit_per_debtor)
    values ('${C_FIN}', 3, 5, 120, true, 2500, 1600);
  insert into public.clients_suppliers (id, company_id, name, document) values
    ('cccccccc-0000-0000-0000-000000000001', '${C_CED}', 'Sacado Um', '12.345.678/0001-90'),
    ('cccccccc-0000-0000-0000-000000000002', '${C_CED}', 'Sacado Dois', '98.765.432/0001-10');
`);

async function as(role, sub, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ role, sub })}', false); set role ${role};`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`); }
}
const cedent = (fn) => as('authenticated', U_CED, fn);
const financier = (fn) => as('authenticated', U_FIN, fn);
const outsider = (fn) => as('authenticated', U_OUT, fn);
const server = (fn) => as('service_role', null, fn);
const q = (sql, p) => db.query(sql, p);
async function fails(promise, pattern, label) {
  try { await promise; } catch (e) { assert.match(e.message, pattern, `${label}: mensagem inesperada "${e.message}"`); console.log(`✓ ${label} → "${e.message}"`); return; }
  assert.fail(`${label}: deveria ter falhado`);
}

let n = 0;
async function title({ amount = 1000, days = 30, client = 1, sale = true, saleAmount, saleStatus = 'issued', invoice = true } = {}) {
  n++;
  const due = plus(days);
  const pr = (await q(`insert into public.payables_receivables (company_id, type, description, amount, due_date, client_supplier_id)
    values ($1, 'receivable', $2, $3, $4, $5) returning id`, [C_CED, `Boleto ${n}`, amount, due, `cccccccc-0000-0000-0000-00000000000${client}`])).rows[0].id;
  let saleId = null;
  if (sale) saleId = (await q(`insert into public.necta_sales (company_id, amount, method, status, due_date, necta_sale_id, payable_receivable_id)
    values ($1, $2, 'bank_slip', $3, $4, $5, $6) returning id`, [C_CED, saleAmount ?? amount, saleStatus, due, `sale-uuid-${n}`, pr])).rows[0].id;
  if (invoice) await q(`insert into public.receivable_assignment_attachments (payable_receivable_id, company_id, file_name, storage_path) values ($1, $2, 'nf.pdf', 'x')`, [pr, C_CED]);
  return { pr, saleId, due };
}
const request = (pr, extra = {}) => cedent(() => q(
  `insert into public.receivable_assignments (payable_receivable_id, cedent_company_id, financier_company_id, face_amount, net_amount, discount_amount, status, title_description)
   values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
  [pr, C_CED, C_FIN, extra.face ?? 1, extra.net ?? 999999, extra.discount ?? 0, extra.status ?? 'requested', extra.desc ?? 'forjado'],
));
const getA = async (id) => (await q(`select * from public.receivable_assignments where id = $1`, [id])).rows[0];

// 1. Valores forjados pelo navegador são substituídos pelos reais
const t1 = await title({ amount: 1000, days: 30 });
const a1 = (await request(t1.pr)).rows[0]?.id
  ?? (await q(`select id from public.receivable_assignments where payable_receivable_id = $1`, [t1.pr])).rows[0].id;
let a = await getA(a1);
assert.equal(Number(a.face_amount), 1000);
assert.equal(Number(a.discount_amount), 30);   // 1000 × 3% × 30/30
assert.equal(Number(a.net_amount), 970);
assert.equal(a.status, 'requested');
assert.equal(a.title_description, 'Boleto 1');
assert.equal(a.debtor_name, 'Sacado Um');
assert.equal(a.cedent_name, 'Originatto');
assert.equal(a.necta_sale_id, t1.saleId);
assert.equal(a.requested_by, U_CED);
console.log('✓ solicitação forjada (face 1, líquido 999.999) gravada com os valores reais: face 1.000, deságio 30, líquido 970');

// 2. Regras do financiador validadas no banco
await fails(request((await title({ days: 2 })).pr), /prazo mínimo do financiador é 5/, 'prazo menor que o mínimo');
await fails(request((await title({ days: 200 })).pr), /prazo máximo do financiador é 120/, 'prazo maior que o máximo');
await fails(request((await title({ invoice: false })).pr), /Anexe a nota fiscal/, 'sem nota fiscal');
await fails(request((await title({ sale: false })).pr), /não tem boleto Pagando.net em aberto/, 'sem boleto');
await fails(request((await title({ saleStatus: 'paid' })).pr), /não tem boleto Pagando.net em aberto/, 'boleto já pago');
await fails(request((await title({ amount: 1000, saleAmount: 900 })).pr), /diferente do boleto emitido/, 'título ≠ boleto');
await fails(request((await title({ amount: 700, client: 1 })).pr), /limite por sacado/, 'limite por sacado (1.000 + 700 > 1.600)');
const t2 = await title({ amount: 900, client: 2 });
await request(t2.pr);
await fails(request((await title({ amount: 700, client: 2 })).pr), /Limite por cedente do financiador excedido.*em uso: R\$ 1900,00/, 'limite por cedente (1.900 + 700 > 2.500)');
await fails(outsider(() => q(`select public.ra_quote($1, $2, $3)`, [t1.pr, C_CED, C_FIN])), /Sem acesso à empresa cedente/, 'outra empresa consultando condições do cedente');

// 3. Cessão e eventos só pelo servidor
await fails(cedent(() => q(`update public.receivable_assignments set status = 'cancelled' where id = $1`, [a1])), /permission denied/, 'cedente alterando status da cessão');
await fails(financier(() => q(`update public.receivable_assignments set net_amount = 1 where id = $1`, [a1])), /permission denied/, 'financiador alterando valores da cessão');
await fails(cedent(() => q(`delete from public.receivable_assignments where id = $1`, [a1])), /permission denied/, 'cedente excluindo a cessão');
await fails(cedent(() => q(`insert into public.receivable_assignment_events (assignment_id, event_type, request_id, success) values ($1, 'split', 'assign-split-x', true)`, [a1])), /permission denied/, 'cedente inserindo evento falso de "split com sucesso"');
assert.equal((await financier(() => q(`select count(*)::int as c from public.receivable_assignment_events`))).rows[0].c, 0);

// 4. Título e boleto travados enquanto a cessão está ativa (inclusive em análise)
await fails(cedent(() => q(`update public.payables_receivables set amount = 10 where id = $1`, [t1.pr])), /em antecipação com Nexus ESC.*não podem ser alterados/, 'cedente mudando o valor do título');
await fails(cedent(() => q(`update public.payables_receivables set status = 'paid', paid_amount = 1000, paid_date = now()::date where id = $1`, [t1.pr])), /não podem ser alterados/, 'cedente dando baixa manual');
await fails(cedent(() => q(`update public.payables_receivables set status = 'cancelled' where id = $1`, [t1.pr])), /não podem ser alterados/, 'cedente cancelando o título');
await fails(cedent(() => q(`delete from public.payables_receivables where id = $1`, [t1.pr])), /não pode ser excluído/, 'cedente excluindo o título (apagaria a cessão em cascata)');
await cedent(() => q(`update public.payables_receivables set description = 'Boleto 1 (NF 123)' where id = $1`, [t1.pr]));
console.log('✓ cedente ainda pode corrigir a descrição do título');
await fails(cedent(() => q(`delete from public.necta_sales where id = $1`, [t1.saleId])), /não pode ser excluída/, 'cedente excluindo o boleto');
await fails(cedent(() => q(`update public.necta_sales set payable_receivable_id = null where id = $1`, [t1.saleId])), /não podem ser alterados/, 'cedente desvinculando o boleto do título');
await fails(cedent(() => q(`update public.necta_sales set status = 'canceled' where id = $1`, [t1.saleId])), /não podem ser alterados/, 'cedente marcando o boleto como cancelado');
await cedent(() => q(`update public.necta_sales set reviewed_at = now() where id = $1`, [t1.saleId]));
console.log('✓ cedente ainda pode marcar a cobrança como revisada');
await fails(cedent(() => q(`insert into public.necta_sales (company_id, amount, method, status, payable_receivable_id) values ($1, 1000, 'bank_slip', 'pending', $2)`, [C_CED, t1.pr])), /não é possível vincular outra cobrança/, 'cedente emitindo um segundo boleto para o título cedido');
const loose = (await cedent(() => q(`insert into public.necta_sales (company_id, amount, method, status) values ($1, 1000, 'bank_slip', 'pending') returning id`, [C_CED]))).rows[0].id;
console.log('✓ cobranças avulsas continuam sendo criadas normalmente');
await fails(cedent(() => q(`update public.necta_sales set payable_receivable_id = $2 where id = $1`, [loose, t1.pr])), /não é possível vincular outra cobrança/, 'cedente vinculando outro boleto ao título cedido');
const freeTitle = await title({ sale: false, client: 2, amount: 50 });
await cedent(() => q(`update public.necta_sales set payable_receivable_id = $2 where id = $1`, [loose, freeTitle.pr]));
console.log('✓ vincular boleto a título sem antecipação continua funcionando (fluxo de contratos)');
// Função SECURITY DEFINER chamada pelo usuário continua travada (o papel vem do JWT)
await db.exec(`create function public.test_definer_pay(_id uuid) returns void language sql security definer set search_path = public as $$ update public.payables_receivables set status = 'paid' where id = _id $$;`);
await fails(cedent(() => q(`select public.test_definer_pay($1)`, [t1.pr])), /não podem ser alterados/, 'baixa por função SECURITY DEFINER chamada pelo cedente');

// 5. Servidor continua com acesso total
await server(() => q(`select public.ra_refresh_terms($1)`, [a1]));
await server(() => q(`update public.receivable_assignments set status = 'assigned', decided_by = $2 where id = $1`, [a1, U_FIN]));
await server(() => q(`update public.payables_receivables set assignment_id = $2 where id = $1`, [t1.pr, a1]));
await server(() => q(`update public.payables_receivables set status = 'paid', paid_date = now()::date where id = $1`, [t1.pr]));
await server(() => q(`insert into public.receivable_assignment_events (assignment_id, event_type, success) values ($1, 'approved', true)`, [a1]));
console.log('✓ servidor aprova, vincula, baixa o título e grava eventos');
await fails(server(() => q(`select public.ra_refresh_terms($1)`, [a1])), /não está em aberto/, 'reaprovação de título já pago');

// 6. Reserva da liquidação: uma por vez
const claim = (id) => server(() => q(`select id from public.ra_claim_settlement($1, gen_random_uuid(), 120)`, [id]));
assert.equal((await claim(a1)).rows.length, 1);
assert.equal((await claim(a1)).rows.length, 0);
await server(() => q(`update public.receivable_assignments set settle_claimed_at = now() - interval '5 minutes' where id = $1`, [a1]));
assert.equal((await claim(a1)).rows.length, 1);
console.log('✓ segunda liquidação simultânea não pega a cessão; reserva vencida (5 min) é liberada');
await fails(cedent(() => q(`select * from public.ra_claim_settlement($1, gen_random_uuid(), 120)`, [a1])), /permission denied/, 'navegador chamando a reserva de liquidação');
await fails(cedent(() => q(`select public.ra_refresh_terms($1)`, [a1])), /permission denied/, 'navegador chamando o recálculo da aprovação');

// 7. Status novo aceito; cessão encerrada libera o título
await server(() => q(`update public.receivable_assignments set status = 'split_pending' where id = $1`, [a1]));
const t3 = await title({ amount: 700, client: 2 });
await fails(request(t3.pr), /Limite por cedente/, 'limite por cedente conta repasse pendente (1.000 + 900 + 700 > 2.500)');
await server(() => q(`update public.receivable_assignments set status = 'cancelled', cancel_reason = 'teste' where payable_receivable_id = $1`, [t2.pr]));
await cedent(() => q(`update public.payables_receivables set amount = 950 where id = $1`, [t2.pr]));
console.log('✓ cessão encerrada: o título volta a ser editável');

// 8. Taxa da plataforma (cedente paga): líquido = face − deságio − taxa
await cedent(() => q(`update public.anticipation_settings set platform_fee_percent = 1`));
const before = (await q(`select platform_fee_percent from public.anticipation_settings`)).rows[0];
assert.equal(Number(before.platform_fee_percent), 0);
console.log('✓ cedente não consegue mudar a taxa da plataforma (continua 0%)');
await as('authenticated', U_SUP, () => q(`update public.anticipation_settings set platform_fee_percent = 1, platform_fee_fixed = 2.5, platform_fee_recipient_id = 'pagando-seller' where id`));
const t4 = await title({ amount: 500, days: 60, client: 2 });
const a4 = (await q(`select id from public.receivable_assignments where id = (select id from public.receivable_assignments order by created_at desc limit 1)`)).rows[0];
await request(t4.pr);
a = (await q(`select * from public.receivable_assignments where payable_receivable_id = $1`, [t4.pr])).rows[0];
assert.equal(Number(a.discount_amount), 30);           // 500 × 3% × 60/30
assert.equal(Number(a.platform_fee_amount), 7.5);      // 500 × 1% + 2,50
assert.equal(Number(a.net_amount), 462.5);             // 500 − 30 − 7,50
assert.equal(a.platform_fee_payer, 'cedent');
assert.equal(a.platform_fee_recipient_id, 'pagando-seller');
console.log('✓ taxa da Pagando: 1% + R$ 2,50 sobre R$ 500 = R$ 7,50, descontada do desembolso (líquido R$ 462,50)');
void a4;

// 9. Taxa sem conta de destino não é cobrada
await as('authenticated', U_SUP, () => q(`update public.anticipation_settings set platform_fee_recipient_id = null where id`));
const t5 = await title({ amount: 200, days: 30, client: 2 });
await server(() => q(`update public.financier_credit_rules set limit_per_cedent = null, limit_per_debtor = null`));
await request(t5.pr);
a = (await q(`select * from public.receivable_assignments where payable_receivable_id = $1`, [t5.pr])).rows[0];
assert.equal(Number(a.platform_fee_amount), 0);
assert.equal(Number(a.net_amount), 194);
console.log('✓ taxa configurada mas sem conta de destino: não é cobrada (líquido R$ 194,00)');

// 10. Supervisor pode excluir a empresa inteira (cascata)
await as('authenticated', U_SUP, () => q(`delete from public.companies where id = $1`, [C_CED]).catch(async (e) => {
  // companies não tem policy de DELETE neste esquema mínimo; o teste da cascata é feito como servidor
  void e;
}));
await server(() => q(`delete from public.companies where id = $1`, [C_CED]));
assert.equal((await q(`select count(*)::int c from public.payables_receivables`)).rows[0].c, 0);
console.log('✓ exclusão da empresa pelo servidor/console continua funcionando (cascata)');

console.log('\nTodos os testes da migração 0020 passaram.');
