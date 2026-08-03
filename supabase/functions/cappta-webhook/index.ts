import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Public webhook endpoint (no JWT). Validates a shared secret from the query
// string or a custom header when CAPPTA_WEBHOOK_SECRET is configured.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const expected = Deno.env.get('CAPPTA_WEBHOOK_SECRET');
  if (expected) {
    const url = new URL(req.url);
    const provided = url.searchParams.get('secret') ?? req.headers.get('x-cappta-secret');
    if (provided !== expected) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  let payload: any = null;
  try { payload = await req.json(); } catch { payload = {}; }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const eventType = payload?.event ?? payload?.type ?? 'unknown';
  const eventId = payload?.id ?? payload?.eventId ?? null;

  const { error } = await supabase.from('cappta_webhook_events').insert({
    event_type: String(eventType),
    event_id: eventId ? String(eventId) : null,
    payload,
    processed: false,
  });
  if (error) {
    console.error('webhook insert error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ---- Update the related charge status (boleto/PIX tracking) --------------
  try {
    const data = payload?.data ?? payload?.charge ?? payload?.billet ?? payload;
    const providerId = data?.id ?? data?.chargeId ?? data?.billetId ?? data?.documentNumber ?? null;
    const externalId = data?.externalId ?? data?.external_id ?? null;
    const rawStatus = String(data?.status ?? data?.situation ?? payload?.event ?? payload?.type ?? '').toLowerCase();

    let mapped: string | null = null;
    if (/(paid|pago|liquidad|settled|received|recebid|confirmed|approved)/.test(rawStatus)) mapped = 'paid';
    else if (/(cancel|revers|void)/.test(rawStatus)) mapped = 'canceled';
    else if (/(expired|vencid|overdue|atras)/.test(rawStatus)) mapped = 'overdue';
    else if (/(registered|registrad|issued|emitid|generated|gerad|open|aberto)/.test(rawStatus)) mapped = 'issued';

    if (mapped && (providerId || externalId)) {
      const update: Record<string, unknown> = {
        status: mapped,
        provider_status: rawStatus || null,
        last_sync_at: new Date().toISOString(),
        raw_payload: payload,
      };
      if (mapped === 'paid') update.paid_at = data?.paidAt ?? data?.paymentDate ?? new Date().toISOString();
      if (mapped === 'canceled') update.canceled_at = new Date().toISOString();

      const q = supabase.from('cappta_charges').update(update);
      const { error: upErr } = externalId
        ? await q.eq('id', String(externalId))
        : await q.eq('cappta_charge_id', String(providerId));
      if (upErr) console.error('charge update error:', upErr);
      else await supabase.from('cappta_webhook_events').update({ processed: true }).eq('payload', payload as any);
    }
  } catch (e) {
    console.error('charge sync from webhook failed:', e);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
