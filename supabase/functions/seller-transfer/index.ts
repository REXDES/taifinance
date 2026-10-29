// Transferência interna entre sellers Pagando.net (Multi-Pay).
// - destinations: lista empresas com conta Pagando.net (apenas id/nome).
// - transfer: transferência livre da empresa de origem para outra.
// - disburse: financiador envia o valor líquido da cessão ao cedente.
// Idempotente por request_id; usa a credencial do marketplace.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { nectaRequest, marketplaceCreds, nectaToken, marketplaceIdFromToken, resolveCompanySellerId } from '../_shared/nectaSeller.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('lookup'), from_company_id: z.string().uuid(), seller_id: z.string().uuid() }),
  z.object({
    action: z.literal('transfer'), from_company_id: z.string().uuid(), to_seller_id: z.string().uuid(),
    amount: z.number().positive().max(10_000_000), description: z.string().trim().max(200).optional(),
    request_id: z.string().min(8).max(100),
  }),
  z.object({ action: z.literal('disburse'), assignment_id: z.string().uuid() }),
  // Financiador sem conta Pagando.net: o cedente emite uma cobrança (PIX/boleto) contra o financiador
  z.object({ action: z.literal('disburse_charge'), assignment_id: z.string().uuid(), method: z.enum(['pix', 'bank_slip']) }),
  z.object({ action: z.literal('disburse_status'), assignment_id: z.string().uuid() }),
  // Cobrança própria: pagamento por fora (TED/PIX de qualquer banco), com comprovante opcional
  z.object({
    action: z.literal('disburse_manual'), assignment_id: z.string().uuid(),
    proof_path: z.string().max(500).optional(), note: z.string().trim().max(300).optional(),
  }),
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'Não autenticado' }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const access = async (cid: string) => {
      const { data } = await admin.rpc('has_company_access', { _user_id: u.user.id, _company_id: cid });
      return !!data;
    };

    const lookupSeller = async (sellerId: string): Promise<string | null> => {
      try {
        const r = await nectaRequest(`/establishments/${sellerId}`, 'GET', undefined, undefined, marketplaceCreds());
        const e = r?.data ?? r;
        return e?.tradeName ?? e?.fantasyName ?? e?.legalName ?? e?.companyName ?? e?.name
          ?? ([e?.firstName, e?.lastName].filter(Boolean).join(' ') || null);
      } catch { return null; }
    };

    if (body.action === 'lookup') {
      if (!(await access(body.from_company_id))) return json({ error: 'Sem acesso.' }, 403);
      const name = await lookupSeller(body.seller_id);
      if (!name) return json({ ok: false, error: 'Conta Pagando.net não encontrada para este código.' });
      return json({ ok: true, name });
    }

    if (body.action === 'disburse_charge' || body.action === 'disburse_status' || body.action === 'disburse_manual') {
      const { data: a } = await admin.from('receivable_assignments').select('*').eq('id', body.assignment_id).maybeSingle();
      if (!a) return json({ error: 'Cessão não encontrada' }, 404);
      if (!(await access(a.financier_company_id))) return json({ error: 'Apenas o financiador desembolsa.' }, 403);
      if (!['assigned', 'paid_by_debtor', 'settled', 'settlement_failed'].includes(a.status)) {
        return json({ error: 'Aprove a antecipação antes de desembolsar.' }, 400);
      }
      const saleFields = 'id, method, amount, status, due_date, pix_copy_paste, boleto_digitable_line, boleto_url, payment_url, paid_at';
      const markDone = async (method: string, extra: Record<string, unknown> = {}) => {
        await admin.from('receivable_assignments').update({ disbursed_at: new Date().toISOString(), disbursement_method: method, ...extra }).eq('id', a.id);
        await admin.from('receivable_assignment_events').insert({
          assignment_id: a.id, event_type: 'disbursement', request_id: `assign-disburse-${method}-${a.id}`, success: true,
          payload: { method, ...extra }, response: {}, created_by: u.user.id,
        });
      };

      if (body.action === 'disburse_manual') {
        if (a.disbursed_at) return json({ ok: true, already: true });
        await markDone('manual', { disbursement_proof_path: body.proof_path ?? null, disbursement_note: body.note ?? null });
        return json({ ok: true });
      }

      const callSale = async (payload: Record<string, unknown>) => {
        const r = await fetch(`${url}/functions/v1/necta-sale`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') ?? '', apikey: Deno.env.get('SUPABASE_ANON_KEY')! },
          body: JSON.stringify(payload),
        });
        return await r.json().catch(() => ({}));
      };

      if (body.action === 'disburse_status') {
        if (!a.disbursement_sale_id) return json({ ok: true, sale: null, disbursed: !!a.disbursed_at });
        if (!a.disbursed_at) await callSale({ action: 'sync', sale_id: a.disbursement_sale_id });
        const { data: s } = await admin.from('necta_sales').select(saleFields).eq('id', a.disbursement_sale_id).maybeSingle();
        if (s?.status === 'paid' && !a.disbursed_at) await markDone(s.method === 'pix' ? 'pix_charge' : 'boleto_charge');
        return json({ ok: true, sale: s, disbursed: !!a.disbursed_at || s?.status === 'paid' });
      }

      // disburse_charge
      if (a.disbursed_at) return json({ ok: true, already: true });
      if (a.disbursement_sale_id) {
        const { data: s } = await admin.from('necta_sales').select(saleFields).eq('id', a.disbursement_sale_id).maybeSingle();
        if (s && !['canceled', 'failed', 'expired'].includes(s.status) && s.method === (body.method)) return json({ ok: true, sale: s });
      }
      const { data: est } = await admin.from('necta_establishments').select('id')
        .eq('company_id', a.cedent_company_id).eq('is_own_profile', true).maybeSingle();
      if (!est) return json({ ok: false, error: 'O cedente ainda não tem conta Pagando.net homologada para emitir a cobrança. Use "Cobrança própria".' });
      const { data: fc } = await admin.from('companies').select('name, cnpj, email, phone, address, city, state, zip_code').eq('id', a.financier_company_id).maybeSingle();
      if (!fc?.cnpj) return json({ ok: false, error: 'Cadastre o CNPJ da empresa financiadora para ser o pagador da cobrança.' });
      const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const { data: sale, error: insErr } = await admin.from('necta_sales').insert({
        company_id: a.cedent_company_id, created_by: u.user.id, establishment_id: est.id,
        method: body.method, amount: Number(a.net_amount), installments: 1,
        description: `Desembolso antecipação — ${a.title_description ?? a.id}`,
        payer_name: fc.name, payer_document: fc.cnpj, payer_email: fc.email, payer_phone: fc.phone,
        payer_address_street: fc.address, payer_address_city: fc.city, payer_address_state: fc.state, payer_address_postal_code: fc.zip_code,
        due_date: body.method === 'bank_slip' ? due : null, status: 'pending',
      }).select('id').single();
      if (insErr || !sale) return json({ ok: false, error: `Não foi possível criar a cobrança: ${insErr?.message ?? 'erro'}` });
      await admin.from('receivable_assignments').update({ disbursement_sale_id: sale.id, disbursement_method: body.method === 'pix' ? 'pix_charge' : 'boleto_charge' }).eq('id', a.id);
      const issued = await callSale({ action: 'issue', sale_id: sale.id });
      if (issued?.error) return json({ ok: false, error: `Falha na emissão: ${issued.error}` });
      const { data: s } = await admin.from('necta_sales').select(saleFields).eq('id', sale.id).maybeSingle();
      return json({ ok: true, sale: s });
    }

    let from: string, to: string | null, toSeller: string | null = null, toName: string | null = null, amount: number, description: string | null, requestId: string;
    let assignment: any = null;
    if (body.action === 'disburse') {
      const { data: a } = await admin.from('receivable_assignments').select('*').eq('id', body.assignment_id).maybeSingle();
      if (!a) return json({ error: 'Cessão não encontrada' }, 404);
      if (!(await access(a.financier_company_id))) return json({ error: 'Apenas o financiador desembolsa.' }, 403);
      if (a.disbursed_at) return json({ ok: true, already: true });
      if (!['assigned', 'paid_by_debtor', 'settled', 'settlement_failed'].includes(a.status)) {
        return json({ error: 'Aprove a antecipação antes de desembolsar.' }, 400);
      }
      assignment = a;
      from = a.financier_company_id; to = a.cedent_company_id; amount = Number(a.net_amount);
      description = `Desembolso antecipação — ${a.title_description ?? a.id}`;
      requestId = `assign-disburse-${a.id}`;
    } else {
      if (!(await access(body.from_company_id))) return json({ error: 'Sem acesso à empresa de origem.' }, 403);
      from = body.from_company_id;
      const { data: tc } = await admin.from('companies').select('id').eq('necta_seller_id', body.to_seller_id).maybeSingle();
      to = tc?.id ?? null; toSeller = body.to_seller_id; toName = await lookupSeller(body.to_seller_id);
      if (!toName) return json({ ok: false, error: 'Conta Pagando.net de destino não encontrada.' });
      amount = body.amount;
      description = body.description ?? null; requestId = `free-${body.request_id}`;
    }

    const { data: existing } = await admin.from('seller_transfers').select('*').eq('request_id', requestId).maybeSingle();
    if (existing?.status === 'done') return json({ ok: true, already: true, transfer: existing });

    const { data: comps } = await admin.from('companies').select('id, name, necta_seller_id').in('id', [from, to].filter(Boolean) as string[]);
    const srcRow = comps?.find((c: any) => c.id === from);
    const src = srcRow ? { ...srcRow, necta_seller_id: await resolveCompanySellerId(admin, from) } : null;
    const dst = toSeller ? { necta_seller_id: toSeller } : (to ? { necta_seller_id: await resolveCompanySellerId(admin, to) } : null);
    if (src?.necta_seller_id && src.necta_seller_id === dst?.necta_seller_id) return json({ error: 'Origem e destino iguais.' }, 400);

    let row = existing;
    if (!row) {
      const ins = await admin.from('seller_transfers').insert({
        from_company_id: from, to_company_id: to, to_seller_id: dst?.necta_seller_id ?? null, to_seller_name: toName, amount, description, request_id: requestId,
        kind: body.action === 'disburse' ? 'disbursement' : 'free',
        assignment_id: assignment?.id ?? null, created_by: u.user.id,
      }).select().single();
      if (ins.error || !ins.data) {
        console.error('seller-transfer insert', ins.error);
        return json({ ok: false, error: `Não foi possível registrar a transferência: ${ins.error?.message ?? 'erro desconhecido'}` });
      }
      row = ins.data;
    }

    const fail = async (msg: string, detail?: unknown) => {
      await admin.from('seller_transfers').update({ status: 'failed', error: msg, response: detail ?? null }).eq('id', row.id);
      return json({ ok: false, error: msg });
    };
    if (!src?.necta_seller_id) return await fail('Empresa de origem sem conta Pagando.net. Informe o ID da conta em Gerenciar Empresa → Módulos (adm) ou cadastre o CNPJ da empresa.');
    if (!dst?.necta_seller_id) return await fail('Empresa de destino sem conta Pagando.net (ID de seller).');

    try {
      const token = await nectaToken(marketplaceCreds());
      const mkt = Deno.env.get('NECTA_MARKETPLACE_ID') || marketplaceIdFromToken(token);
      if (!mkt) return await fail('Marketplace Pagando.net não identificado.');
      const payload = {
        sourceSellerId: src.necta_seller_id,
        targetSellerId: dst.necta_seller_id,
        amount: Math.round(amount * 100),
        description: description ?? undefined,
        metadata: { request_id: requestId, source: 'tai-finance' },
      };
      const res = await nectaRequest(`/banking/marketplaces/${mkt}/internal-transfers`, 'POST', payload, undefined, marketplaceCreds());
      await admin.from('seller_transfers').update({ status: 'done', error: null, response: res ?? {} }).eq('id', row.id);
      if (assignment) {
        await admin.from('receivable_assignments').update({ disbursed_at: new Date().toISOString(), disbursement_transfer_id: row.id, disbursement_method: 'pagando_transfer' }).eq('id', assignment.id);
        await admin.from('receivable_assignment_events').insert({
          assignment_id: assignment.id, event_type: 'disbursement', request_id: requestId, success: true,
          payload, response: res ?? {}, created_by: u.user.id,
        });
      }
      return json({ ok: true });
    } catch (e) {
      return await fail((e as Error).message);
    }
  } catch (e) {
    console.error('seller-transfer', e);
    return json({ error: (e as Error).message }, 500);
  }
});
