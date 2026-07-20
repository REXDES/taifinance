import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Simple in-memory JWT cache per isolate
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const baseUrl = Deno.env.get('CAPPTA_API_BASE_URL')!.replace(/\/$/, '');
  const clientId = Deno.env.get('CAPPTA_CLIENT_ID')!;
  const clientSecret = Deno.env.get('CAPPTA_CLIENT_SECRET')!;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const r = await fetch(`${baseUrl}/connect/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error(`Cappta auth [${r.status}]: ${await r.text()}`);
  const j = await r.json();
  tokenCache = { token: j.access_token, expiresAt: Date.now() + (Number(j.expires_in || 3600) - 60) * 1000 };
  return tokenCache.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Require authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { path, method = 'GET', body } = await req.json();
    if (!path || typeof path !== 'string' || !path.startsWith('/')) {
      return new Response(JSON.stringify({ error: 'path must start with /' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const baseUrl = Deno.env.get('CAPPTA_API_BASE_URL')!.replace(/\/$/, '');
    const token = await getToken();
    const upstream = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await upstream.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep as text */ }

    if (!upstream.ok) {
      console.error(`Cappta ${method} ${path} [${upstream.status}]:`, text);
      return new Response(JSON.stringify({ error: 'Cappta request failed', status: upstream.status, details: parsed }), {
        status: upstream.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('cappta-api error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
