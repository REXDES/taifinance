import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Generic authenticated proxy for the Necta Multi-Pay API.
// body: { path: '/sales', method?: 'GET', query?: Record<string, unknown>, body?: unknown }

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getNectaToken(force = false): Promise<string> {
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
  const j = JSON.parse(text);
  const token = j.token ?? j.accessToken ?? j.access_token;
  if (!token) throw new Error('Necta auth: token ausente na resposta');
  tokenCache = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

export async function nectaFetch(
  path: string,
  method = 'GET',
  payload?: unknown,
  query?: Record<string, unknown>,
): Promise<any> {
  const baseUrl = (Deno.env.get('NECTA_API_BASE_URL') ?? 'https://api-gateway.nectaco.com.br').replace(/\/$/, '');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
  }
  const url = `${baseUrl}${path}${qs.toString() ? `?${qs}` : ''}`;

  const run = async (token: string) =>
    fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: payload !== undefined && method !== 'GET' ? JSON.stringify(payload) : undefined,
    });

  let r = await run(await getNectaToken());
  if (r.status === 401) r = await run(await getNectaToken(true));

  const text = await r.text();
  let parsed: any = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* text */ }
  if (!r.ok) {
    const msg = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    throw new Error(`Necta ${method} ${path} [${r.status}]: ${msg}`);
  }
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (cErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);

    const { path, method = 'GET', body, query } = await req.json();
    if (typeof path !== 'string' || !path.startsWith('/')) return json({ error: 'path deve iniciar com /' }, 400);
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return json({ error: 'método inválido' }, 400);

    const data = await nectaFetch(path, method, body, query);
    return json({ ok: true, data });
  } catch (e) {
    console.error('necta-api error:', e);
    return json({ error: (e as Error).message }, 502);
  }
});
