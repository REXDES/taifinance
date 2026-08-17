import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Recebe eventos da Necta Multi-Pay: grava log e atualiza a cobrança correspondente.
// Público (verify_jwt = false); opcionalmente valida NECTA_WEBHOOK_SECRET.

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
  if (/(paid|pago|liquidad|settled|approved|captured|confirm)/.test(s)) return 'paid';
  if (/(refund|revert|estorn|chargeback)/.test(s)) return 'refunded';
  if (/(cancel|void|declined|denied|recus|fail)/.test(s)) return 'canceled';
  if (/(expired|vencid|overdue)/.test(s)) return 'overdue';
  if (/(pending|aguard|created|issued|open)/.test(s)) return 'issued';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let payload: any = null;

  try {
    const secret = Deno.env.get('NECTA_WEBHOOK_SECRET');
    if (secret) {
      const url = new URL(req.url);
      const provided = req.headers.get('x-webhook-secret') ?? req.headers.get('x-necta-signature') ?? url.searchParams.get('secret');
      if (provided !== secret) return json({ error: 'Unauthorized' }, 401);
    }

    payload = await req.json().catch(() => ({}));
    const eventType = (deepFind(payload, ['eventType', 'event', 'type']) ?? 'unknown').toString();
    const referenceId = (deepFind(payload, ['saleId', 'id', 'paymentLinkId']) ?? null)?.toString() ?? null;

    const { data: logged } = await admin.from('necta_webhook_events').insert({
      event_type: eventType, necta_reference_id: referenceId, payload,
    }).select('id').maybeSingle();

    if (referenceId) {
      const { data: sale } = await admin.from('necta_sales').select('*')
        .or(`necta_sale_id.eq.${referenceId},necta_payment_link_id.eq.${referenceId}`).maybeSingle();
      if (sale) {
        const providerStatus = (deepFind(payload, ['status', 'statusName', 'name']) ?? eventType)?.toString();
        const mapped = mapStatus(providerStatus) ?? mapStatus(eventType);
        const update: Record<string, unknown> = {
          provider_status: providerStatus, last_sync_at: new Date().toISOString(), raw: payload,
        };
        if (mapped) update.status = mapped;

        if (mapped === 'paid') {
          const paidAt = (deepFind(payload, ['paidAt', 'paymentDate']) ?? new Date().toISOString()).toString();
          update.paid_at = paidAt;
          const description = `Cobrança ${sale.method}${sale.payer_name ? ` - ${sale.payer_name}` : ''}`;
          if (sale.payable_receivable_id) {
            await admin.from('payables_receivables')
              .update({ status: 'paid', paid_date: paidAt.slice(0, 10), paid_account_id: sale.account_id ?? null })
              .eq('id', sale.payable_receivable_id);
          }
          if (sale.account_id && !sale.transaction_id) {
            const { data: tx } = await admin.from('transactions').insert({
              company_id: sale.company_id, account_id: sale.account_id, type: 'income',
              amount: sale.amount, description, date: paidAt.slice(0, 10),
              category_id: sale.category_id ?? null, subcategory_id: sale.subcategory_id ?? null,
              created_by: sale.created_by ?? null,
            }).select('id').maybeSingle();
            if (tx) update.transaction_id = tx.id;
          }
        }
        await admin.from('necta_sales').update(update).eq('id', sale.id);
        if (logged) await admin.from('necta_webhook_events').update({ processed: true, company_id: sale.company_id }).eq('id', logged.id);
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error('necta-webhook error:', e);
    try {
      await admin.from('necta_webhook_events').insert({ event_type: 'error', payload: payload ?? {}, process_error: (e as Error).message });
    } catch { /* ignore */ }
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
