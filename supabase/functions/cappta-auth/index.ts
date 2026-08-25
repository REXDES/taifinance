const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory token cache (per isolate)
let cache: { token: string; expiresAt: number } | null = null;

async function fetchToken(): Promise<string> {
  const baseUrl = Deno.env.get('CAPPTA_API_BASE_URL');
  const clientId = Deno.env.get('CAPPTA_CLIENT_ID');
  const clientSecret = Deno.env.get('CAPPTA_CLIENT_SECRET');
  if (!baseUrl || !clientId || !clientSecret) throw new Error('Cappta credentials not configured');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cappta auth failed [${res.status}]: ${text}`);
  }
  const json = await res.json();
  const token = json.access_token as string;
  const ttl = Number(json.expires_in || 3600);
  cache = { token, expiresAt: Date.now() + (ttl - 60) * 1000 };
  return token;
}

export async function getCapptaToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now()) return cache.token;
  return await fetchToken();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const token = await getCapptaToken();
    return new Response(JSON.stringify({ ok: true, expires_at: cache?.expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
