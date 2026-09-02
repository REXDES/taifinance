import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  marketplaceCreds, nectaRequest, provisionSellerCredentials, sellerCredentials,
} from '../_shared/nectaSeller.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Proxy autenticado da API Necta Multi-Pay.
// body genérico: { path: '/sales', method?: 'GET', query?, body?, establishment_id? }
//   `establishment_id` autentica em nome daquele seller (necessário para escrita
//   quando a credencial do projeto é de marketplace).
// ações: { action: 'provision_seller_token', establishment_id }
//        { action: 'import_sellers', company_id }

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

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const input = await req.json();

    // ------------------------------------------- credencial de cobrança do seller
    if (input?.action === 'provision_seller_token') {
      const { data: est } = await admin.from('necta_establishments')
        .select('id, company_id, necta_establishment_id, legal_name, trade_name')
        .eq('id', input?.establishment_id).maybeSingle();
      if (!est) return json({ error: 'Estabelecimento não encontrado' }, 404);
      const creds = await provisionSellerCredentials(admin, est as any);
      return json({ ok: true, client_secret_preview: `${creds.clientSecret.slice(0, 12)}…` });
    }

    // ---------------------------------- importa sellers já cadastrados na Necta
    if (input?.action === 'import_sellers') {
      const companyId = input?.company_id;
      if (!companyId) return json({ error: 'company_id é obrigatório' }, 400);
      const list = await nectaRequest('/establishments', 'GET', undefined, { limit: 200 }, marketplaceCreds());
      const items: any[] = Array.isArray(list) ? list : (list?.items ?? list?.data ?? []);
      let imported = 0, updated = 0;
      for (const it of items) {
        const sellerId = it?.id;
        if (!sellerId) continue;
        const doc = String(it?.document ?? '').replace(/\D/g, '');
        const row = {
          company_id: companyId,
          necta_establishment_id: String(sellerId),
          legal_name: it?.name ?? null,
          trade_name: it?.name ?? null,
          document: doc || null,
          email: it?.email ?? null,
          phone: it?.phone ?? null,
          person_type: it?.legalPerson === 'PHYSICAL' ? 'PF' : 'PJ',
          status: it?.status?.name ?? null,
          address_street: it?.address?.street ?? null,
          address_number: it?.address?.number ?? null,
          address_district: it?.address?.neighborhood ?? null,
          address_city: it?.address?.city ?? null,
          address_state: it?.address?.state ?? null,
          address_zip: it?.address?.postalCode ?? null,
          imported_from_necta: true,
          is_own_profile: false,
          raw: it,
        };
        const { data: existing } = await admin.from('necta_establishments')
          .select('id').eq('company_id', companyId).eq('necta_establishment_id', String(sellerId)).maybeSingle();
        if (existing?.id) {
          await admin.from('necta_establishments').update(row).eq('id', existing.id);
          updated++;
        } else {
          const { error } = await admin.from('necta_establishments').insert(row);
          if (!error) imported++;
        }
      }
      return json({ ok: true, imported, updated, total: items.length });
    }

    // ------------------------------------------------------------ proxy genérico
    const { path, method = 'GET', body, query, establishment_id } = input ?? {};
    if (typeof path !== 'string' || !path.startsWith('/')) return json({ error: 'path deve iniciar com /' }, 400);
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return json({ error: 'método inválido' }, 400);

    const creds = establishment_id ? await sellerCredentials(admin, establishment_id) : null;
    const data = await nectaRequest(path, method, body, query, creds);
    return json({ ok: true, data });
  } catch (e) {
    console.error('necta-api error:', e);
    return json({ error: (e as Error).message }, 502);
  }
});
