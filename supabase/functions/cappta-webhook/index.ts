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

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
