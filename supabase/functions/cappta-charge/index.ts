import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Cappta charge issuing + status tracking
//   action: 'issue'      -> emits boleto/PIX at Cappta for a local charge
//   action: 'sync'       -> refreshes a single charge status
//   action: 'sync_open'  -> refreshes every open charge (used by cron)
//   action: 'cancel'     -> cancels the charge at Cappta
// ---------------------------------------------------------------------------

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const baseUrl = Deno.env.get('CAPPTA_API_BASE_URL')!.replace(/\/$/, '');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: Deno.env.get('CAPPTA_CLIENT_ID')!,
    client_secret: Deno.env.get('CAPPTA_CLIENT_SECRET')!,
  });
  const r = await fetch(`${baseUrl}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`Cappta auth [${r.status}]: ${await r.text()}`);
  const j = await r.json();
  tokenCache = { token: j.access_token, expiresAt: Date.now() + (Number(j.expires_in || 3600) - 60) * 1000 };
  return tokenCache.token;
}

async function capptaFetch(path: string, method = 'GET', payload?: unknown) {
  const baseUrl = Deno.env.get('CAPPTA_API_BASE_URL')!.replace(/\/$/, '');
  const token = await getToken();
  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await r.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* text */ }
  if (!r.ok) {
    const msg = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    throw new Error(`Cappta ${method} ${path} [${r.status}]: ${msg}`);
  }
  return parsed;
}

const digits = (v?: string | null) => (v ?? '').replace(/\D/g, '');

function pick(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  // one nested level
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = pick(v, keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Maps any provider status string to our internal lifecycle status. */
function mapStatus(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (/(paid|pago|liquidad|settled|received|recebid|confirmed|approved)/.test(s)) return 'paid';
  if (/(cancel|revers|void)/.test(s)) return 'canceled';
  if (/(expired|vencid|overdue|atras)/.test(s)) return 'overdue';
  if (/(registered|registrad|open|aberto|issued|emitid|generated|gerad|pending|aguardando|waiting)/.test(s)) return 'issued';
  return null;
}

function extractChargeFields(resp: any) {
  const providerStatus = pick(resp, ['status', 'situation', 'situacao', 'state']);
  return {
    cappta_charge_id: pick(resp, ['id', 'chargeId', 'billetId', 'documentNumber', 'transactionId'])?.toString() ?? null,
    boleto_digitable_line: pick(resp, ['digitableLine', 'digitable_line', 'linhaDigitavel', 'typeableLine'])?.toString() ?? null,
    boleto_barcode: pick(resp, ['barcode', 'barCode', 'codigoBarras'])?.toString() ?? null,
    boleto_url: pick(resp, ['pdfUrl', 'pdf', 'url', 'billetUrl', 'link'])?.toString() ?? null,
    boleto_our_number: pick(resp, ['ourNumber', 'our_number', 'nossoNumero'])?.toString() ?? null,
    pix_copy_paste: pick(resp, ['pixCopyPaste', 'emv', 'qrCodeText', 'copyPaste', 'pixEmv'])?.toString() ?? null,
    pix_qrcode: pick(resp, ['qrCode', 'qrcode', 'qrCodeImage', 'qrCodeBase64'])?.toString() ?? null,
    payment_url: pick(resp, ['paymentUrl', 'payment_url', 'checkoutUrl'])?.toString() ?? null,
    provider_status: providerStatus ? String(providerStatus) : null,
    paid_at: pick(resp, ['paidAt', 'paymentDate', 'settledAt', 'dataPagamento']) ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const cronSecret = Deno.env.get('CAPPTA_CRON_SECRET') ?? Deno.env.get('CAPPTA_WEBHOOK_SECRET');
    const url = new URL(req.url);
    const providedSecret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret');
    const isCron = !!cronSecret && providedSecret === cronSecret;

    const authHeader = req.headers.get('Authorization');
    if (!isCron) {
      if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: cErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
      if (cErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const bodyIn = await req.json().catch(() => ({}));
    const action = bodyIn?.action ?? 'sync_open';

    // ---------------------------------------------------------------- issue
    if (action === 'issue') {
      const chargeId = bodyIn?.charge_id;
      if (!chargeId) return json({ error: 'charge_id é obrigatório' }, 400);

      const { data: charge, error } = await admin.from('cappta_charges').select('*').eq('id', chargeId).maybeSingle();
      if (error || !charge) return json({ error: 'Cobrança não encontrada' }, 404);
      if (charge.cappta_charge_id) return json({ error: 'Cobrança já emitida na Cappta' }, 400);
      if (!charge.due_date) return json({ error: 'Informe o vencimento antes de emitir o boleto' }, 400);
      if (!charge.payer_name || !digits(charge.payer_document)) {
        return json({ error: 'Nome e documento do pagador são obrigatórios para emitir boleto' }, 400);
      }

      let merchant: any = null;
      if (charge.merchant_id) {
        const { data } = await admin.from('cappta_merchants').select('*').eq('id', charge.merchant_id).maybeSingle();
        merchant = data;
      }
      if (!merchant) {
        const { data } = await admin
          .from('cappta_merchants')
          .select('*')
          .eq('company_id', charge.company_id)
          .order('created_at', { ascending: true })
          .limit(1);
        merchant = data?.[0] ?? null;
      }
      if (!merchant) return json({ error: 'Cadastre um lojista (merchant) antes de emitir boletos' }, 400);

      const payload = {
        merchantDocument: digits(merchant.document),
        merchantId: merchant.cappta_merchant_id ?? undefined,
        amount: Number(charge.amount),
        dueDate: charge.due_date,
        description: charge.description ?? undefined,
        externalId: charge.id,
        payer: {
          name: charge.payer_name,
          document: digits(charge.payer_document),
          email: charge.payer_email ?? undefined,
          phone: digits(charge.payer_phone) || undefined,
        },
      };

      let resp: any;
      try {
        resp = await capptaFetch('/financial_module/billet', 'POST', payload);
      } catch (e) {
        const msg = (e as Error).message;
        await admin.from('cappta_charges').update({ sync_error: msg, last_sync_at: new Date().toISOString() }).eq('id', chargeId);
        return json({ error: msg }, 502);
      }

      const fields = extractChargeFields(resp);
      const update: Record<string, unknown> = {
        raw_payload: resp,
        sync_error: null,
        last_sync_at: new Date().toISOString(),
        status: mapStatus(fields.provider_status) ?? 'issued',
      };
      for (const [k, v] of Object.entries(fields)) if (v) (update as any)[k] = v;

      const { data: updated, error: uErr } = await admin
        .from('cappta_charges').update(update).eq('id', chargeId).select('*').maybeSingle();
      if (uErr) return json({ error: uErr.message }, 500);
      return json({ ok: true, charge: updated });
    }

    // ---------------------------------------------------------------- cancel
    if (action === 'cancel') {
      const chargeId = bodyIn?.charge_id;
      if (!chargeId) return json({ error: 'charge_id é obrigatório' }, 400);
      const { data: charge } = await admin.from('cappta_charges').select('*').eq('id', chargeId).maybeSingle();
      if (!charge) return json({ error: 'Cobrança não encontrada' }, 404);
      if (charge.cappta_charge_id) {
        try {
          await capptaFetch(`/financial_module/billet/${charge.cappta_charge_id}`, 'DELETE');
        } catch (e) {
          return json({ error: (e as Error).message }, 502);
        }
      }
      const { data: updated } = await admin
        .from('cappta_charges')
        .update({ status: 'canceled', canceled_at: new Date().toISOString(), last_sync_at: new Date().toISOString() })
        .eq('id', chargeId).select('*').maybeSingle();
      return json({ ok: true, charge: updated });
    }

    // ------------------------------------------------------------ sync(_open)
    const targets: any[] = [];
    if (action === 'sync') {
      if (!bodyIn?.charge_id) return json({ error: 'charge_id é obrigatório' }, 400);
      const { data } = await admin.from('cappta_charges').select('*').eq('id', bodyIn.charge_id).maybeSingle();
      if (!data) return json({ error: 'Cobrança não encontrada' }, 404);
      targets.push(data);
    } else {
      let q = admin
        .from('cappta_charges')
        .select('*')
        .not('cappta_charge_id', 'is', null)
        .in('status', ['pending', 'issued', 'registered', 'overdue'])
        .order('last_sync_at', { ascending: true, nullsFirst: true })
        .limit(bodyIn?.limit ?? 50);
      if (bodyIn?.company_id) q = q.eq('company_id', bodyIn.company_id);
      const { data } = await q;
      targets.push(...(data ?? []));
    }

    const results: any[] = [];
    for (const charge of targets) {
      if (!charge.cappta_charge_id) {
        results.push({ id: charge.id, skipped: 'não emitida' });
        continue;
      }
      try {
        const resp = await capptaFetch(`/financial_module/billet/${charge.cappta_charge_id}`);
        const fields = extractChargeFields(resp);
        const mapped = mapStatus(fields.provider_status);
        const update: Record<string, unknown> = {
          raw_payload: resp,
          provider_status: fields.provider_status,
          last_sync_at: new Date().toISOString(),
          sync_error: null,
        };
        if (fields.boleto_digitable_line) update.boleto_digitable_line = fields.boleto_digitable_line;
        if (fields.pix_copy_paste) update.pix_copy_paste = fields.pix_copy_paste;
        if (fields.boleto_url) update.boleto_url = fields.boleto_url;
        if (mapped) update.status = mapped;
        if (mapped === 'paid') update.paid_at = fields.paid_at ?? new Date().toISOString();
        await admin.from('cappta_charges').update(update).eq('id', charge.id);
        results.push({ id: charge.id, status: mapped ?? charge.status, provider_status: fields.provider_status });
      } catch (e) {
        const msg = (e as Error).message;
        await admin.from('cappta_charges')
          .update({ sync_error: msg, last_sync_at: new Date().toISOString() })
          .eq('id', charge.id);
        results.push({ id: charge.id, error: msg });
      }
    }

    return json({ ok: true, synced: results.length, results });
  } catch (e) {
    console.error('cappta-charge error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
