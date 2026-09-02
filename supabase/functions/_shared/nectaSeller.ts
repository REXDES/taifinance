// Autenticação Necta Multi-Pay com escopo de seller (marketplace).
//
// Contrato oficial (POST /api-tokens): "operações de escrita da API exigem um
// token vinculado a um estabelecimento; um token sem vínculo autentica e lê,
// mas recebe 403/400 nessas operações".
// Como o TAI Finance opera como marketplace (chave Integration-TAI), a emissão
// de cobrança precisa autenticar com um par clientSecret/secretKey do SELLER.
// Esse par é criado uma única vez por estabelecimento via POST /api-tokens
// { sellerId } usando a credencial do marketplace, e guardado em
// public.necta_seller_credentials (apenas service_role lê).

export interface NectaCreds { clientSecret: string; secretKey: string }

const baseUrl = () =>
  (Deno.env.get('NECTA_API_BASE_URL') ?? 'https://api-gateway.nectaco.com.br').replace(/\/$/, '');

export const marketplaceCreds = (): NectaCreds => ({
  clientSecret: Deno.env.get('NECTA_CLIENT_SECRET') ?? '',
  secretKey: Deno.env.get('NECTA_SECRET_KEY') ?? '',
});

const tokens = new Map<string, { token: string; expiresAt: number }>();

export async function nectaToken(creds?: NectaCreds | null, force = false): Promise<string> {
  const c = creds?.clientSecret && creds?.secretKey ? creds : marketplaceCreds();
  const key = c.clientSecret;
  const cached = tokens.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.token;
  const r = await fetch(`${baseUrl()}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ clientSecret: c.clientSecret, secretKey: c.secretKey }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Necta auth [${r.status}]: ${text}`);
  const j = JSON.parse(text);
  const token = j.token ?? j.accessToken ?? j.access_token;
  if (!token) throw new Error('Necta auth: token ausente na resposta');
  tokens.set(key, { token, expiresAt: Date.now() + 50 * 60 * 1000 });
  return token;
}

/** Extrai o marketplaceId do JWT da Necta (claim do próprio token). */
export function marketplaceIdFromToken(token: string): string | null {
  try {
    const part = token.split('.')[1];
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    const id = json.marketplaceId ?? json.marketplace_id ?? json.marketplace?.id;
    return id ? String(id) : null;
  } catch { return null; }
}

export async function nectaRequest(
  path: string,
  method = 'GET',
  payload?: unknown,
  query?: Record<string, unknown>,
  creds?: NectaCreds | null,
  retryWithoutQuery = true,
  retryWithMarketplace = true,
): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
  }
  const url = `${baseUrl()}${path}${qs.toString() ? `?${qs}` : ''}`;
  const run = async (token: string) => fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: payload !== undefined && method !== 'GET' ? JSON.stringify(payload) : undefined,
  });
  let token = await nectaToken(creds);
  let r = await run(token);
  if (r.status === 401) { token = await nectaToken(creds, true); r = await run(token); }
  const text = await r.text();
  let parsed: any = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* texto puro */ }
  if (!r.ok) {
    const msg = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    // Algumas rotas (ex.: /pos/models) exigem marketplaceId explícito —
    // reenvia com o id do próprio token / do segredo do projeto.
    if (r.status === 400 && retryWithMarketplace && /marketplaceid is required/i.test(msg) && !qs.get('marketplaceId')) {
      const mkt = Deno.env.get('NECTA_MARKETPLACE_ID') || marketplaceIdFromToken(token);
      if (mkt) {
        return await nectaRequest(
          path, method, payload, { ...(query ?? {}), marketplaceId: mkt }, creds, retryWithoutQuery, false,
        );
      }
    }
    // A Necta devolve 500 ("column \"nan\" does not exist") quando a rota espera
    // paginação numérica e nada é enviado (ela converte undefined -> NaN).
    if (r.status >= 500 && retryWithoutQuery && /\bnan\b/i.test(msg) && !qs.get('limit')) {
      const mkt = Deno.env.get('NECTA_MARKETPLACE_ID') || marketplaceIdFromToken(token);
      return await nectaRequest(
        path, method, payload,
        { ...(query ?? {}), page: 1, limit: 100, ...(mkt && !qs.get('marketplaceId') ? { marketplaceId: mkt } : {}) },
        creds, false, retryWithMarketplace,
      );
    }
    // Outros 500 podem vir de parâmetros que ela não reconhece — refaz sem query.
    if (r.status >= 500 && retryWithoutQuery && qs.toString()) {
      return await nectaRequest(path, method, payload, undefined, creds, false, retryWithMarketplace);
    }
    throw new Error(`Necta ${method} ${path} [${r.status}]: ${msg}`);

  }
  return parsed;
}



/** Cria (via credencial do marketplace) e persiste o token de API do seller. */
export async function provisionSellerCredentials(
  admin: any,
  establishment: { id: string; company_id?: string | null; necta_establishment_id?: string | null; legal_name?: string | null; trade_name?: string | null },
): Promise<NectaCreds> {
  const sellerId = establishment.necta_establishment_id;
  if (!sellerId) {
    throw new Error('Estabelecimento sem vínculo na Necta — informe/importe o ID do estabelecimento antes de gerar a credencial de cobrança.');
  }
  const name = `TAI Finance — ${(establishment.trade_name || establishment.legal_name || 'Estabelecimento').slice(0, 60)}`;
  const created = await nectaRequest('/api-tokens', 'POST', { name, sellerId }, undefined, marketplaceCreds());
  const clientSecret = created?.clientSecret;
  const secretKey = created?.secretKey;
  if (!clientSecret || !secretKey) throw new Error('A Necta não devolveu o par clientSecret/secretKey do token do seller.');

  await admin.from('necta_seller_credentials').upsert({
    company_id: establishment.company_id ?? null,
    establishment_id: establishment.id,
    necta_seller_id: sellerId,
    token_id: created?.id ? String(created.id) : null,
    token_name: created?.name ?? name,
    client_secret: clientSecret,
    secret_key: secretKey,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'establishment_id' });

  await admin.from('necta_establishments')
    .update({ has_charge_credentials: true, charge_credentials_at: new Date().toISOString() })
    .eq('id', establishment.id);

  return { clientSecret, secretKey };
}

/**
 * Credenciais para operar EM NOME do estabelecimento; provisiona na primeira vez.
 * Retorna null quando o estabelecimento não tem seller vinculado na Necta
 * (nesse caso o chamador cai na credencial do marketplace).
 */
export async function sellerCredentials(
  admin: any,
  establishmentId?: string | null,
): Promise<NectaCreds | null> {
  if (!establishmentId) return null;
  const { data: existing } = await admin.from('necta_seller_credentials')
    .select('client_secret, secret_key').eq('establishment_id', establishmentId).maybeSingle();
  if (existing?.client_secret && existing?.secret_key) {
    return { clientSecret: existing.client_secret, secretKey: existing.secret_key };
  }
  const { data: est } = await admin.from('necta_establishments')
    .select('id, company_id, necta_establishment_id, legal_name, trade_name')
    .eq('id', establishmentId).maybeSingle();
  if (!est?.necta_establishment_id) return null;
  return await provisionSellerCredentials(admin, est);
}
