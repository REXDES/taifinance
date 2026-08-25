import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Cobranças (vendas) na Necta Multi-Pay.
// actions: issue | sync | sync_open | void | settlements_sync

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(force = false): Promise<string> {
  if (!force && tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const baseUrl = (Deno.env.get('NECTA_API_BASE_URL') ?? 'https://api-gateway.nectaco.com.br').replace(/\/$/, '');
  const r = await fetch(`${baseUrl}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      clientSecret: Deno.env.get('NECTA_CLIENT_SECRET'),
      secretKey: Deno.env.get('NECTA_SECRET_KEY'),
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Necta auth [${r.status}]: ${text}`);
  const token = JSON.parse(text).token;
  if (!token) throw new Error('Necta auth: token ausente');
  tokenCache = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

async function api(path: string, method = 'GET', payload?: unknown, query?: Record<string, unknown>): Promise<any> {
  const baseUrl = (Deno.env.get('NECTA_API_BASE_URL') ?? 'https://api-gateway.nectaco.com.br').replace(/\/$/, '');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
  const url = `${baseUrl}${path}${qs.toString() ? `?${qs}` : ''}`;
  const run = async (token: string) => fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: payload !== undefined && method !== 'GET' ? JSON.stringify(payload) : undefined,
  });
  let r = await run(await getToken());
  if (r.status === 401) r = await run(await getToken(true));
  const text = await r.text();
  let parsed: any = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* text */ }
  if (!r.ok) throw new Error(`Necta ${method} ${path} [${r.status}]: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
  return parsed;
}

const digits = (v?: string | null) => (v ?? '').replace(/\D/g, '');
const toCents = (v: number) => Math.round(Number(v) * 100);
const fromCents = (v: unknown) => (v === null || v === undefined ? null : Number(v) / 100);

function deepFind(obj: any, keys: string[], depth = 0): any {
  if (!obj || typeof obj !== 'object' || depth > 5) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      const found = deepFind(v, keys, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function mapStatus(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (/(paid|pago|liquidad|settled|approved|aprovad|captured|confirm)/.test(s)) return 'paid';
  if (/(refund|revert|estorn|chargeback)/.test(s)) return 'refunded';
  if (/(cancel|void|denied|declined|recus|fail|erro)/.test(s)) return 'canceled';
  if (/(expired|vencid|overdue|atras)/.test(s)) return 'overdue';
  if (/(pending|aguard|waiting|created|open|aberto|issued|emitid|authorized)/.test(s)) return 'issued';
  return null;
}

/**
 * Monta o buyer a partir do endereço REAL do pagador (nunca do estabelecimento —
 * enviar o endereço do lojista como se fosse do comprador quebraria a emissão do
 * boleto e falsearia o cadastro do pagador na Necta). Boleto exige endereço
 * completo: se faltar algo, lança erro em vez de inventar dado.
 */
function buyerPayload(sale: any, paymentMethod: string) {
  const hasAddress = sale.payer_address_street && sale.payer_address_number
    && sale.payer_address_neighborhood && sale.payer_address_city
    && sale.payer_address_state && sale.payer_address_postal_code;

  if (paymentMethod === 'bank_slip' && !hasAddress) {
    throw new Error('Endereço completo do pagador é obrigatório para emitir boleto (rua, número, bairro, cidade, UF e CEP).');
  }

  const buyer: Record<string, unknown> = {
    name: sale.payer_name || 'Consumidor',
    document: digits(sale.payer_document),
    email: sale.payer_email || 'nao-informado@exemplo.com.br',
    phoneNumber: digits(sale.payer_phone) || '11999999999',
  };
  if (hasAddress) {
    buyer.address = {
      street: sale.payer_address_street,
      number: sale.payer_address_number,
      neighborhood: sale.payer_address_neighborhood,
      city: sale.payer_address_city,
      state: sale.payer_address_state,
      country: 'BR',
      postalCode: digits(sale.payer_address_postal_code),
    };
  }
  return buyer;
}

function extractFields(resp: any) {
  const providerStatus = deepFind(resp, ['name', 'status', 'situation']);
  return {
    necta_sale_id: deepFind(resp, ['id', 'saleId'])?.toString() ?? null,
    provider_status: typeof providerStatus === 'string' ? providerStatus : (deepFind(resp?.status ?? {}, ['name']) ?? null),
    pix_copy_paste: deepFind(resp, ['emv', 'qrCodeText', 'copyPaste', 'pixCopyPaste', 'payload'])?.toString() ?? null,
    pix_qr_code: deepFind(resp, ['qrCodeImage', 'qrCodeBase64', 'qrCode'])?.toString() ?? null,
    boleto_digitable_line: deepFind(resp, ['digitableLine', 'typeableLine', 'linhaDigitavel'])?.toString() ?? null,
    boleto_barcode: deepFind(resp, ['barcode', 'barCode'])?.toString() ?? null,
    boleto_url: deepFind(resp, ['pdfUrl', 'billetUrl', 'pdf'])?.toString() ?? null,
    payment_url: deepFind(resp, ['paymentUrl', 'checkoutUrl', 'url', 'link'])?.toString() ?? null,
    paid_at: deepFind(resp, ['paidAt', 'paymentDate', 'settledAt']) ?? null,
  };
}

/** Espelha a cobrança na gestão financeira (contas a receber + transação). */
async function mirrorFinance(admin: any, sale: any, status: string, paidAt?: string | null) {
  const isPaid = status === 'paid';
  const methodLabel: Record<string, string> = {
    pix: 'PIX', bank_slip: 'Boleto', pix_cappta: 'Bolepix', credit_card: 'Cartão', link: 'Link de pagamento',
  };
  const description = `Cobrança ${methodLabel[sale.method] ?? sale.method}${sale.payer_name ? ` - ${sale.payer_name}` : ''}${sale.description ? ` (${sale.description})` : ''}`;
  const update: Record<string, unknown> = {};

  // Contas a receber
  if (!sale.payable_receivable_id) {
    const { data: pr } = await admin.from('payables_receivables').insert({
      company_id: sale.company_id,
      type: 'receivable',
      description,
      amount: sale.amount,
      due_date: sale.due_date ?? new Date().toISOString().slice(0, 10),
      status: isPaid ? 'paid' : 'pending',
      paid_account_id: isPaid ? (sale.account_id ?? null) : null,
      category_id: sale.category_id ?? null,
      subcategory_id: sale.subcategory_id ?? null,
      paid_date: isPaid ? (paidAt ?? new Date().toISOString()).slice(0, 10) : null,
      created_by: sale.created_by ?? null,
    }).select('id').maybeSingle();
    if (pr) update.payable_receivable_id = pr.id;
  } else if (isPaid) {
    await admin.from('payables_receivables')
      .update({ status: 'paid', paid_date: (paidAt ?? new Date().toISOString()).slice(0, 10), paid_account_id: sale.account_id ?? null })
      .eq('id', sale.payable_receivable_id);
  }

  // Transação efetiva na conta (somente quando liquidada e com conta definida)
  if (isPaid && sale.account_id && !sale.transaction_id) {
    const { data: tx } = await admin.from('transactions').insert({
      company_id: sale.company_id,
      account_id: sale.account_id,
      type: 'income',
      amount: sale.amount,
      description,
      date: (paidAt ?? new Date().toISOString()).slice(0, 10),
      category_id: sale.category_id ?? null,
      subcategory_id: sale.subcategory_id ?? null,
      created_by: sale.created_by ?? null,
    }).select('id').maybeSingle();
    if (tx) update.transaction_id = tx.id;
  }
  return update;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const url = new URL(req.url);
    const cronSecret = Deno.env.get('NECTA_CRON_SECRET');
    const isCron = !!cronSecret && (req.headers.get('x-cron-secret') === cronSecret || url.searchParams.get('secret') === cronSecret);

    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
      if (error || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const input = await req.json().catch(() => ({}));
    const action = input?.action ?? 'sync_open';

    // ------------------------------------------------------------------ issue
    if (action === 'issue') {
      const saleId = input?.sale_id;
      if (!saleId) return json({ error: 'sale_id é obrigatório' }, 400);
      const { data: sale } = await admin.from('necta_sales').select('*').eq('id', saleId).maybeSingle();
      if (!sale) return json({ error: 'Cobrança não encontrada' }, 404);
      if (sale.necta_sale_id || sale.necta_payment_link_id) return json({ error: 'Cobrança já emitida' }, 400);

      // As rotas /sales/pix, /sales/bank-slip, /sales/credit-card e /sales/pix-cappta foram
      // descontinuadas pela Necta (respondem 404). O endpoint único e atual é POST /sales
      // com `paymentMethod` no corpo — pix-cappta (bolepix) virou bank_slip nos gateways
      // que o suportam, que já devolve o QR PIX embutido junto do boleto.
      let resp: any;
      let saleDetail: any = null;
      let billet: any = null;
      try {
        if (sale.method === 'link') {
          const expiration = sale.due_date
            ? new Date(`${sale.due_date}T23:59:59`).toISOString()
            : new Date(Date.now() + 7 * 864e5).toISOString();
          resp = await api('/payment-links', 'POST', {
            title: sale.description || 'Cobrança',
            expirationDate: expiration,
            paymentMethod: 'pix',
            amount: toCents(sale.amount),
            expireAfterPay: true,
            description: sale.description ?? undefined,
            email: sale.payer_email ?? undefined,
            installments: sale.installments ?? 1,
          });
        } else {
          const paymentMethod = sale.method === 'pix_cappta' ? 'bank_slip' : sale.method;
          const body: Record<string, unknown> = {
            paymentMethod,
            totalAmount: toCents(sale.amount),
            description: sale.description ?? undefined,
            buyer: buyerPayload(sale, paymentMethod),
          };
          if (paymentMethod === 'bank_slip') body.dueDate = sale.due_date ?? undefined;
          if (paymentMethod === 'credit_card') {
            const card = input?.credit_card;
            if (!card?.number || !card?.holderName) return json({ error: 'Dados do cartão são obrigatórios' }, 400);
            body.installments = sale.installments ?? 1;
            body.creditCard = {
              holderName: card.holderName,
              number: digits(card.number),
              expirationMonth: String(card.expirationMonth),
              expirationYear: String(card.expirationYear),
              cvv: String(card.cvv ?? ''),
            };
          }
          // POST /sales só devolve { id, externalId, status } — QR/linha digitável/boleto
          // só vêm em seguida, via GET /sales/{id} (+ GET /sales/{id}/billet para boleto).
          resp = await api('/sales', 'POST', body);
          const saleUuid = resp?.id;
          if (saleUuid) {
            saleDetail = await api(`/sales/${saleUuid}`).catch(() => null);
            if (paymentMethod === 'bank_slip') {
              billet = await api(`/sales/${saleUuid}/billet`).catch(() => null);
            }
          }
        }
      } catch (e) {
        const msg = (e as Error).message;
        await admin.from('necta_sales').update({ sync_error: msg, last_sync_at: new Date().toISOString() }).eq('id', saleId);
        return json({ error: msg }, 502);
      }

      const merged = sale.method === 'link' ? resp : { ...resp, ...saleDetail, ...billet };
      const f = extractFields(merged);
      const status = mapStatus(f.provider_status) ?? 'issued';
      const update: Record<string, unknown> = {
        raw: merged, sync_error: null, status, last_sync_at: new Date().toISOString(),
        provider_status: f.provider_status,
      };
      if (sale.method === 'link') update.necta_payment_link_id = f.necta_sale_id;
      else update.necta_sale_id = f.necta_sale_id;
      for (const k of ['pix_copy_paste', 'pix_qr_code', 'boleto_digitable_line', 'boleto_barcode', 'boleto_url', 'payment_url'] as const) {
        if ((f as any)[k]) update[k] = (f as any)[k];
      }
      if (status === 'paid') update.paid_at = f.paid_at ?? new Date().toISOString();

      Object.assign(update, await mirrorFinance(admin, sale, status, update.paid_at as string | undefined));
      const { data: updated, error } = await admin.from('necta_sales').update(update).eq('id', saleId).select('*').maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, sale: updated });
    }

    // ------------------------------------------------------------------- void
    if (action === 'void') {
      const saleId = input?.sale_id;
      const { data: sale } = await admin.from('necta_sales').select('*').eq('id', saleId).maybeSingle();
      if (!sale) return json({ error: 'Cobrança não encontrada' }, 404);
      try {
        if (sale.necta_sale_id) {
          await api(`/sales/${sale.necta_sale_id}/void`, 'POST', input?.amount ? { amount: toCents(input.amount) } : {});
        } else if (sale.necta_payment_link_id) {
          await api(`/payment-links/${sale.necta_payment_link_id}`, 'DELETE');
        }
      } catch (e) {
        return json({ error: (e as Error).message }, 502);
      }
      const isRefund = !!sale.necta_sale_id && sale.status === 'paid';
      const { data: updated } = await admin.from('necta_sales').update({
        status: isRefund ? 'refunded' : 'canceled',
        refunded_at: isRefund ? new Date().toISOString() : null,
        last_sync_at: new Date().toISOString(),
      }).eq('id', saleId).select('*').maybeSingle();
      if (sale.payable_receivable_id && !isRefund) {
        await admin.from('payables_receivables').update({ status: 'cancelled' }).eq('id', sale.payable_receivable_id);
      }
      return json({ ok: true, sale: updated });
    }

    // -------------------------------------------------------- settlements_sync
    if (action === 'settlements_sync') {
      const companyId = input?.company_id ?? null;
      const list = await api('/settlements', 'GET', undefined, {
        limit: input?.limit ?? 100,
        page: input?.page ?? 1,
        paymentDate__goe: input?.start_date ?? undefined,
        paymentDate__loe: input?.end_date ?? undefined,
        status: input?.status ?? undefined,
      });
      const rows: any[] = Array.isArray(list) ? list : (list?.data ?? []);
      let saved = 0;
      for (const r of rows) {
        const nectaId = deepFind(r, ['id', 'settlementId'])?.toString();
        if (!nectaId) continue;
        const payload = {
          company_id: companyId,
          necta_settlement_id: nectaId,
          settlement_date: (deepFind(r, ['paymentDate', 'settlementDate', 'date']) ?? '')?.toString().slice(0, 10) || null,
          status: (deepFind(r, ['status', 'statusName']) ?? null)?.toString() ?? null,
          gross_amount: fromCents(deepFind(r, ['grossAmount', 'totalAmount', 'amount'])) ?? 0,
          fee_amount: fromCents(deepFind(r, ['feeAmount', 'fees', 'totalFee'])) ?? 0,
          net_amount: fromCents(deepFind(r, ['netAmount', 'liquidAmount'])) ?? 0,
          orders_count: Number(deepFind(r, ['ordersCount', 'totalOrders']) ?? 0),
          merchant_name: (deepFind(r, ['merchantName', 'sellerName', 'name']) ?? null)?.toString() ?? null,
          merchant_document: (deepFind(r, ['merchantDocument', 'document']) ?? null)?.toString() ?? null,
          raw: r,
        };
        const { data: existing } = await admin.from('necta_settlements').select('id')
          .eq('necta_settlement_id', nectaId).maybeSingle();
        if (existing) await admin.from('necta_settlements').update(payload).eq('id', existing.id);
        else await admin.from('necta_settlements').insert(payload);
        saved++;
      }
      return json({ ok: true, saved });
    }

    // ------------------------------------------------------------- sync/_open
    const targets: any[] = [];
    if (action === 'sync') {
      if (!input?.sale_id) return json({ error: 'sale_id é obrigatório' }, 400);
      const { data } = await admin.from('necta_sales').select('*').eq('id', input.sale_id).maybeSingle();
      if (!data) return json({ error: 'Cobrança não encontrada' }, 404);
      targets.push(data);
    } else {
      let q = admin.from('necta_sales').select('*')
        .in('status', ['pending', 'issued', 'overdue'])
        .order('last_sync_at', { ascending: true, nullsFirst: true })
        .limit(input?.limit ?? 50);
      if (input?.company_id) q = q.eq('company_id', input.company_id);
      const { data } = await q;
      targets.push(...(data ?? []));
    }

    const results: any[] = [];
    for (const sale of targets) {
      if (!sale.necta_sale_id && !sale.necta_payment_link_id) { results.push({ id: sale.id, skipped: 'não emitida' }); continue; }
      try {
        let resp = sale.necta_sale_id
          ? await api(`/sales/${sale.necta_sale_id}`)
          : await api(`/payment-links/${sale.necta_payment_link_id}`);
        if (sale.necta_sale_id && (sale.method === 'bank_slip' || sale.method === 'pix_cappta')) {
          const billet = await api(`/sales/${sale.necta_sale_id}/billet`).catch(() => null);
          if (billet) resp = { ...resp, ...billet };
        }
        const f = extractFields(resp);
        const mapped = mapStatus(f.provider_status ?? deepFind(resp, ['statusName']));
        const update: Record<string, unknown> = {
          raw: resp, provider_status: f.provider_status, last_sync_at: new Date().toISOString(), sync_error: null,
        };
        for (const k of ['pix_copy_paste', 'boleto_digitable_line', 'boleto_url', 'payment_url'] as const) {
          if ((f as any)[k]) update[k] = (f as any)[k];
        }
        if (mapped) update.status = mapped;
        if (mapped === 'paid') {
          update.paid_at = f.paid_at ?? new Date().toISOString();
          Object.assign(update, await mirrorFinance(admin, sale, 'paid', update.paid_at as string));
        }
        // Estorno ou cancelamento de uma cobrança já paga não deve dar baixa/reverter
        // sozinho — só sinalizar para revisão humana (pode ser fraude ou erro de input).
        if (mapped === 'refunded' || (mapped === 'canceled' && sale.status === 'paid')) {
          update.needs_review = true;
          update.review_reason = `Sincronização detectou status "${mapped}" (era "${sale.status}")`;
        }
        await admin.from('necta_sales').update(update).eq('id', sale.id);
        results.push({ id: sale.id, status: mapped ?? sale.status });
      } catch (e) {
        const msg = (e as Error).message;
        await admin.from('necta_sales').update({ sync_error: msg, last_sync_at: new Date().toISOString() }).eq('id', sale.id);
        results.push({ id: sale.id, error: msg });
      }
    }
    return json({ ok: true, synced: results.length, results });
  } catch (e) {
    console.error('necta-sale error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
