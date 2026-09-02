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

    // ------------------- lista os sellers da Necta (tolerante à paginação)
    const listSellers = async (): Promise<any[]> => {
      const attempts: (Record<string, unknown> | undefined)[] = [
        { page: 1, limit: 200 }, { limit: 200 }, undefined,
      ];
      let lastErr: unknown = null;
      for (const q of attempts) {
        try {
          const list = await nectaRequest('/establishments', 'GET', undefined, q, marketplaceCreds());
          return Array.isArray(list) ? list : (list?.items ?? list?.data ?? []);
        } catch (e) { lastErr = e; }
      }
      throw lastErr ?? new Error('Não foi possível listar os estabelecimentos na Necta');
    };

    const mapSeller = (it: any, companyId: string) => ({
      company_id: companyId,
      necta_establishment_id: String(it?.id),
      legal_name: it?.name ?? null,
      trade_name: it?.tradeName ?? it?.name ?? null,
      document: String(it?.document ?? '').replace(/\D/g, '') || null,
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
    });

    const upsertSeller = async (it: any, companyId: string) => {
      const row = mapSeller(it, companyId);
      const { data: existing } = await admin.from('necta_establishments')
        .select('id').eq('necta_establishment_id', row.necta_establishment_id)
        .eq('company_id', companyId).maybeSingle();
      if (existing?.id) {
        await admin.from('necta_establishments').update(row).eq('id', existing.id);
        return 'updated' as const;
      }
      const { error } = await admin.from('necta_establishments').insert(row);
      if (error) throw new Error(error.message);
      return 'imported' as const;
    };

    // sellers da Necta + em quais empresas do TAI Finance já estão vinculados
    if (input?.action === 'list_sellers') {
      const items = await listSellers();
      const ids = items.map((i: any) => String(i?.id)).filter(Boolean);
      const { data: links } = await admin.from('necta_establishments')
        .select('id, company_id, necta_establishment_id')
        .in('necta_establishment_id', ids.length ? ids : ['-']);
      return json({ ok: true, sellers: items, links: links ?? [] });
    }

    // vincula sellers escolhidos às empresas escolhidas
    if (input?.action === 'link_sellers') {
      const selections: { necta_establishment_id: string; company_id: string }[] = input?.items ?? [];
      if (!selections.length) return json({ error: 'Nenhum seller selecionado' }, 400);
      const items = await listSellers();
      const byId = new Map(items.map((i: any) => [String(i?.id), i]));
      let imported = 0, updated = 0;
      const errors: string[] = [];
      for (const sel of selections) {
        const seller = byId.get(String(sel.necta_establishment_id));
        if (!seller || !sel.company_id) continue;
        try {
          const r = await upsertSeller(seller, sel.company_id);
          r === 'imported' ? imported++ : updated++;
        } catch (e) { errors.push((e as Error).message); }
      }
      return json({ ok: true, imported, updated, errors });
    }

    // ---------------------------------- importa TODOS os sellers para uma empresa
    if (input?.action === 'import_sellers') {
      const companyId = input?.company_id;
      if (!companyId) return json({ error: 'company_id é obrigatório' }, 400);
      const items = await listSellers();
      let imported = 0, updated = 0;
      for (const it of items) {
        if (!it?.id) continue;
        try {
          const r = await upsertSeller(it, companyId);
          r === 'imported' ? imported++ : updated++;
        } catch { /* ignora item inválido */ }
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
