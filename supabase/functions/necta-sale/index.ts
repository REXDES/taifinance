import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  boletoMinCents, buildBuyer, normalizeDate,
  sameDocument, todayISO, translateGatewayError, validatePayer,
} from './nectaFormat.ts';

// @supabase/supabase-js não expõe um subpath /cors (só a exportação "."), então
// `npm:@supabase/supabase-js@2/cors` não resolve — corsHeaders definido aqui,
// no mesmo padrão já usado em bank-api-proxy/send-pix-whatsapp.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Cobranças (vendas) na Necta Multi-Pay.
// actions: issue | sync | sync_open | void | settlements_sync

// Marketplace: escrita (emitir/estornar) exige token vinculado ao seller.
// `creds` = credencial do estabelecimento recebedor; ausente → marketplace.
const api = (
  path: string,
  method = 'GET',
  payload?: unknown,
  query?: Record<string, unknown>,
  creds?: NectaCreds | null,
) => nectaRequest(path, method, payload, query, creds);


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
  // pending | processing | scheduled | pre_authorized são estados abertos na Necta.
  if (/(pending|processing|scheduled|pre_authorized|aguard|waiting|created|open|aberto|issued|emitid|authorized)/.test(s)) return 'issued';
  return null;
}

/**
 * Monta o buyer a partir do endereço REAL do pagador (nunca do estabelecimento).
 * Contrato Necta (`BuyerCreate`): name, document, email, phoneNumber e address são
 * TODOS obrigatórios — inclusive em PIX e cartão, não só no boleto. Address exige
 * street, number, neighborhood, city, state, country e postalCode.
 */
function buyerPayload(sale: any, receiverDocument?: string | null) {
  const errors = validatePayer(sale);
  if (sameDocument(sale.payer_document, receiverDocument)) {
    errors.push('O pagador não pode ter o mesmo CPF/CNPJ do recebedor (estabelecimento). Selecione outro pagador ou emita por outro estabelecimento.');
  }
  if (errors.length) throw new Error(errors.join(' '));
  return buildBuyer(sale);
}


/**
 * Extrai os campos exatamente como o contrato da Necta os devolve:
 * - SaleCreated (POST /sales): { id, externalId, status: { name } }
 * - SaleDetail  (GET /sales/{uuid}): qrCode (EMV do PIX), numberCode (linha
 *   digitável), barCode, dueDate, billetStatus, status: { name, reference }
 * - Billet      (GET /sales/{uuid}/billet): { url, status, numberCode, barCode, dueDate }
 * - PaymentLink (POST /payment-links): { id, url/shortUrl, status }
 *
 * `billet` é recebido em separado justamente porque seu `status` é string e
 * sobrescreveria o objeto `status` da venda num spread ingênuo.
 */
function extractFields(resp: any, billet?: any) {
  const str = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v));
  const statusName = typeof resp?.status === 'string' ? resp.status : resp?.status?.name;
  const providerStatus = str(resp?.billetStatus ?? billet?.status ?? statusName);
  return {
    necta_sale_id: str(resp?.id ?? resp?.saleId),
    provider_status: providerStatus,
    status_reference: str(resp?.status?.reference),
    // PIX: `qrCode` é o EMV (copia e cola). A imagem do QR é gerada no app.
    pix_copy_paste: str(resp?.qrCode ?? resp?.emv ?? resp?.qrCodeText ?? resp?.copyPaste),
    pix_qr_code: str(resp?.qrCodeImage ?? resp?.qrCodeBase64),
    boleto_digitable_line: str(billet?.numberCode ?? resp?.numberCode ?? resp?.digitableLine),
    boleto_barcode: str(billet?.barCode ?? resp?.barCode),
    boleto_url: str(billet?.url ?? resp?.billetUrl ?? resp?.pdfUrl),
    boleto_due_date: str(billet?.dueDate ?? resp?.dueDate),
    payment_url: str(resp?.url ?? resp?.shortUrl ?? resp?.paymentUrl ?? resp?.checkoutUrl ?? resp?.link),
    paid_at: str(resp?.paidAt ?? resp?.paymentDate ?? resp?.saleDate),
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

      // Documento do recebedor (perfil do estabelecimento da empresa) — o adquirente
      // recusa autocobrança (pagador == recebedor), principalmente em bolepix.
      const { data: ownProfile } = await admin.from('necta_establishments')
        .select('document')
        .eq('company_id', sale.company_id).eq('is_own_profile', true).maybeSingle();
      const receiverDocument = (ownProfile as any)?.document ?? null;
      const gatewayName = Deno.env.get('NECTA_GATEWAY') ?? 'rinne';

      if (!(Number(sale.amount) > 0)) return json({ error: 'Valor da cobrança deve ser maior que zero.' }, 400);
      if (sale.due_date) {
        const due = normalizeDate(sale.due_date);
        if (!due) return json({ error: 'Data de vencimento inválida.' }, 400);
        if (['bank_slip', 'pix_cappta'].includes(sale.method) && due < todayISO()) {
          return json({ error: 'A data de vencimento do boleto não pode ser no passado.' }, 400);
        }
      }


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
          // Enum do link é `bankslip` (sem underscore), diferente de /sales (`bank_slip`).
          const allowed = ['pix', 'credit_card', 'bankslip'];
          const linkMethod = allowed.includes(input?.link_payment_method) ? input.link_payment_method : 'pix';
          const linkBody: Record<string, unknown> = {
            title: (sale.description || 'Cobrança').slice(0, 120),
            expirationDate: expiration,
            paymentMethod: linkMethod,
            amount: toCents(sale.amount),
            expireAfterPay: true,
            description: sale.description ?? undefined,
            email: sale.payer_email ?? undefined,
          };
          // `installments` só é aceito em credit_card (máx. 21) — enviar nos demais dá 400.
          if (linkMethod === 'credit_card') {
            linkBody.installments = Math.min(21, Math.max(1, Number(sale.installments || 1)));
          }
          resp = await api('/payment-links', 'POST', linkBody);
        } else {
          const paymentMethod = sale.method === 'pix_cappta' ? 'bank_slip' : sale.method;
          const totalAmount = toCents(sale.amount);
          const minCents = boletoMinCents(gatewayName);
          if (paymentMethod === 'bank_slip' && totalAmount < minCents) {
            return json({ error: `Boleto exige valor mínimo de R$ ${(minCents / 100).toFixed(2).replace('.', ',')} neste adquirente.` }, 400);
          }
          const body: Record<string, unknown> = {
            paymentMethod,
            totalAmount,
            description: sale.description ? String(sale.description).trim().slice(0, 255) : undefined,
          };
          // O comprador é deduplicado por documento na Necta: reaproveitamos o buyerId
          // já conhecido e só enviamos o objeto inline na primeira cobrança do pagador.
          // A checagem pagador ≠ recebedor vale nos dois casos.
          if (sameDocument(sale.payer_document, receiverDocument)) {
            return json({ error: 'O pagador não pode ter o mesmo CPF/CNPJ do recebedor (estabelecimento). Selecione outro pagador ou emita por outro estabelecimento.' }, 400);
          }
          if (sale.necta_buyer_id) body.buyerId = sale.necta_buyer_id;
          else body.buyer = buyerPayload(sale, receiverDocument);
          if (paymentMethod === 'bank_slip') {
            const due = normalizeDate(sale.due_date);
            if (!due) return json({ error: 'Boleto exige data de vencimento válida.' }, 400);
            body.dueDate = due;
          }
          if (paymentMethod === 'credit_card') {
            const card = input?.credit_card;
            if (!card?.number || !card?.holderName) return json({ error: 'Dados do cartão são obrigatórios' }, 400);
            body.installments = Math.max(1, Number(sale.installments || 1));
            body.creditCard = {
              holderName: card.holderName,
              number: digits(card.number),
              expirationMonth: String(card.expirationMonth).padStart(2, '0'),
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
        const raw = (e as Error).message;
        const msg = translateGatewayError(raw);
        await admin.from('necta_sales')
          .update({ sync_error: msg, last_sync_at: new Date().toISOString(), raw: { error: raw } })
          .eq('id', saleId);
        return json({ error: msg }, 502);
      }

      // O id da venda vem do POST /sales; os dados de pagamento, do GET /sales/{id}.
      const detail = sale.method === 'link' ? resp : { ...resp, ...saleDetail, id: resp?.id ?? saleDetail?.id };
      const f = extractFields(detail, billet);
      const status = mapStatus(f.provider_status) ?? 'issued';
      const update: Record<string, unknown> = {
        raw: { created: resp, detail: saleDetail, billet }, sync_error: null, status,
        last_sync_at: new Date().toISOString(), provider_status: f.provider_status,
      };
      if (f.status_reference) update.status_reference = f.status_reference;
      // buyer deduplicado: guardamos o id para as próximas cobranças do mesmo pagador
      const buyerId = deepFind({ ...resp, detail: saleDetail }, ['buyerId'])
        ?? (saleDetail?.buyer?.id ?? resp?.buyer?.id);
      if (buyerId && !sale.necta_buyer_id) update.necta_buyer_id = String(buyerId);
      if (sale.method === 'link') update.necta_payment_link_id = f.necta_sale_id;
      else update.necta_sale_id = f.necta_sale_id;
      for (const k of ['pix_copy_paste', 'pix_qr_code', 'boleto_digitable_line', 'boleto_barcode', 'boleto_url', 'payment_url'] as const) {
        if ((f as any)[k]) update[k] = (f as any)[k];
      }
      if (f.boleto_due_date && !sale.due_date) update.due_date = f.boleto_due_date.slice(0, 10);
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
        const resp = sale.necta_sale_id
          ? await api(`/sales/${sale.necta_sale_id}`)
          : await api(`/payment-links/${sale.necta_payment_link_id}`);
        let billet: any = null;
        if (sale.necta_sale_id && (sale.method === 'bank_slip' || sale.method === 'pix_cappta')) {
          billet = await api(`/sales/${sale.necta_sale_id}/billet`).catch(() => null);
        }
        const f = extractFields(resp, billet);
        const mapped = mapStatus(f.provider_status);
        const update: Record<string, unknown> = {
          raw: billet ? { detail: resp, billet } : resp,
          provider_status: f.provider_status, last_sync_at: new Date().toISOString(), sync_error: null,
        };
        for (const k of ['pix_copy_paste', 'boleto_digitable_line', 'boleto_barcode', 'boleto_url', 'payment_url'] as const) {
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
