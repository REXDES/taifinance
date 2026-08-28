import { createClient } from 'npm:@supabase/supabase-js@2';
import { decode as base64Decode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { timingSafeEqual } from 'https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts';

// @supabase/supabase-js não expõe um subpath /cors (só a exportação "."), então
// `npm:@supabase/supabase-js@2/cors` não resolve — corsHeaders definido aqui,
// no mesmo padrão já usado em bank-api-proxy/send-pix-whatsapp.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Recebe eventos da Necta Multi-Pay: grava log e atualiza a cobrança correspondente.
// Público (verify_jwt = false); a autenticidade vem da assinatura, não de JWT de usuário.
//
// A Necta assina no formato Svix: headers svix-id / svix-timestamp / svix-signature
// ("v1,<base64> v1,<base64> ..." — pode ter mais de uma durante rotação de segredo).
// Conteúdo assinado = "{svix-id}.{svix-timestamp}.{corpo-cru}", HMAC-SHA256 com chave =
// base64-decode do segredo (formato whsec_<base64>) sem o prefixo whsec_.

async function verifyNectaSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string,
): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignature) return false;
  const secretBytes = base64Decode(secret.replace(/^whsec_/, ''));
  // Cast: TS aqui reclama de Uint8Array<ArrayBufferLike> vs BufferSource (questão de
  // versão de lib, não de tipo real em runtime — secretBytes é sempre um ArrayBuffer comum).
  const key = await crypto.subtle.importKey('raw', secretBytes as unknown as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent)));

  const candidates = svixSignature.split(' ').map((part) => part.split(',')[1]).filter(Boolean);
  for (const candidate of candidates) {
    try {
      const candidateBytes = base64Decode(candidate);
      if (candidateBytes.length === mac.length && timingSafeEqual(candidateBytes, mac)) return true;
    } catch { /* candidato malformado, tenta o próximo */ }
  }
  return false;
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
    if (!secret) {
      console.error('necta-webhook: NECTA_WEBHOOK_SECRET não configurado — recusando entrega (nunca aceitar sem verificar).');
      return json({ error: 'Webhook não configurado' }, 500);
    }

    const rawBody = await req.text();
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    const validSignature = await verifyNectaSignature(rawBody, svixId, svixTimestamp, svixSignature, secret);
    if (!validSignature) return json({ error: 'Invalid signature' }, 401);

    payload = JSON.parse(rawBody);
    // Contrato oficial (WebhookEventBase): { type, id, status, occurredAt, marketplaceId, data? }
    // `type` ∈ sale.paid | sale.refunded | sale.failed | seller.status_changed
    // `id` = UUID público do recurso que mudou (venda OU estabelecimento).
    const eventType = (payload?.type ?? payload?.eventType ?? payload?.event ?? 'unknown').toString();
    const referenceId = (payload?.id ?? payload?.data?.saleId ?? payload?.saleId ?? null)?.toString() ?? null;
    const eventStatus = (payload?.status ?? null)?.toString() ?? null;

    // seller.status_changed não trata de venda: atualiza a homologação do estabelecimento.
    if (eventType === 'seller.status_changed' && referenceId) {
      const mappedSeller = /(aprov|approv|active|ativo|homologad)/i.test(eventStatus ?? '')
        ? 'approved'
        : /(recus|reject|denied|inativ|blocked|bloquead)/i.test(eventStatus ?? '')
          ? 'rejected'
          : 'pending';
      await admin.from('necta_establishments').update({
        homologation_status: mappedSeller,
        necta_status: eventStatus,
        homologation_notes: eventStatus,
      }).eq('necta_establishment_id', referenceId);
    }

    // Dedupe atômico por (event_type, necta_reference_id) — a Necta avisa que dois canais
    // (marketplace e estabelecimento) podem entregar o mesmo fato com svix-id diferente,
    // então não dá pra confiar só no svix-id pra evitar reprocessar.
    const { data: logged } = await admin.from('necta_webhook_events')
      .upsert(
        { event_type: eventType, necta_reference_id: referenceId, svix_id: svixId, payload },
        { onConflict: 'event_type,necta_reference_id', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle();
    if (!logged) {
      // Conflito com a constraint única = evento já processado antes. Confirma recebimento sem reprocessar.
      return json({ ok: true, duplicate: true });
    }

    if (referenceId) {
      const { data: sale } = await admin.from('necta_sales').select('*')
        .or(`necta_sale_id.eq.${referenceId},necta_payment_link_id.eq.${referenceId}`).maybeSingle();
      if (sale) {
        const providerStatus = (eventStatus ?? eventType)?.toString();
        const mapped = mapStatus(providerStatus) ?? mapStatus(eventType);
        const update: Record<string, unknown> = {
          provider_status: providerStatus, last_sync_at: new Date().toISOString(), raw: payload,
        };
        if (mapped) update.status = mapped;
        // Valores do evento vêm em centavos (WebhookSaleData).
        const totalCents = Number(payload?.data?.totalAmount ?? NaN);
        const liquidCents = Number(payload?.data?.liquidAmount ?? NaN);
        if (Number.isFinite(liquidCents)) update.net_amount = liquidCents / 100;
        if (Number.isFinite(totalCents) && Number.isFinite(liquidCents)) {
          update.fee_amount = Math.max(0, (totalCents - liquidCents) / 100);
        }

        if (mapped === 'paid') {
          const paidAt = (payload?.occurredAt ?? payload?.data?.saleDate ?? new Date().toISOString()).toString();
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

        // Estorno ou falha depois de já paga não devem reverter Contas a Receber
        // sozinhos — pode ser fraude ou erro de input do usuário. Só sinaliza revisão.
        if (mapped === 'refunded' || (mapped === 'canceled' && sale.status === 'paid')) {
          update.needs_review = true;
          update.review_reason = `Webhook ${eventType}: status mudou de "${sale.status}" para "${mapped}"`;
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
