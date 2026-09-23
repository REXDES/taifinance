import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  companyCredentials, marketplaceCreds, nectaBaseUrl, nectaRequest, nectaToken, provisionSellerCredentials,
  saveCompanyCredentials, sellerCredentials,
} from '../_shared/nectaSeller.ts';
import { syncCompanyLedger } from '../_shared/nectaLedger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const hashPublicToken = async (token: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, '0')).join('');
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
    const userId = (claims.claims as any)?.sub as string | undefined;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const input = await req.json();

    if (input?.action === 'create_homologation_link') {
      const establishmentId = String(input?.establishment_id ?? '');
      const { data: establishment } = await admin.from('necta_establishments')
        .select('id, company_id').eq('id', establishmentId).maybeSingle();
      if (!establishment?.company_id) return json({ error: 'Estabelecimento não encontrado.' }, 404);
      const { data: hasAccess } = await supabase.rpc('has_company_access', {
        _user_id: userId,
        _company_id: establishment.company_id,
      });
      if (!hasAccess) return json({ error: 'Sem acesso a esta empresa.' }, 403);
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: request, error } = await admin.from('necta_homologation_requests').insert({
        company_id: establishment.company_id,
        establishment_id: establishment.id,
        public_token_hash: await hashPublicToken(token),
        expires_at: expiresAt,
        status: 'waiting_client',
        created_by: userId ?? null,
      }).select('id').single();
      if (error) throw error;
      return json({ ok: true, request_id: request.id, token, expires_at: expiresAt });
    }

    if (input?.action === 'submit_homologation') {
      const requestId = String(input?.request_id ?? '');
      const { data: request } = await admin.from('necta_homologation_requests')
        .select('*, necta_establishments(*)').eq('id', requestId).maybeSingle();
      if (!request?.company_id || !request?.necta_establishments) return json({ error: 'Solicitação não encontrada.' }, 404);
      const { data: hasAccess } = await supabase.rpc('has_company_access', { _user_id: userId, _company_id: request.company_id });
      if (!hasAccess) return json({ error: 'Sem acesso a esta empresa.' }, 403);
      if (request.status !== 'ready') return json({ error: 'O cliente ainda não concluiu o cadastro.' }, 400);

      const row = request.necta_establishments as any;
      const legalPerson = row.person_type === 'PF' ? 'PHYSICAL' : 'JURIDICAL';
      const establishmentPayload: Record<string, unknown> = {
        name: String(row.legal_name ?? '').trim(), document: String(row.document ?? '').replace(/\D/g, ''),
        email: String(row.email ?? '').trim().toLowerCase(), phone: String(row.phone ?? '').replace(/\D/g, ''),
        legalPerson, birthDate: legalPerson === 'PHYSICAL' ? row.birth_date : row.opening_date,
        mccId: row.mcc_id,
        address: {
          street: row.address_street, number: row.address_number || 'S/N', neighborhood: row.address_district,
          city: row.address_city, state: String(row.address_state ?? '').toUpperCase(), country: 'BR',
          postalCode: String(row.address_zip ?? '').replace(/\D/g, ''), complement: row.address_complement || undefined,
        },
        bankAccount: {
          document: String(row.bank_account_document || row.document || '').replace(/\D/g, ''),
          corporateName: row.bank_account_holder || row.legal_name, legalPerson,
          bankCode: row.bank_code, compeCode: row.bank_code, bankName: row.bank_name || undefined,
          agencyNumber: String(row.bank_agency ?? '').replace(/\D/g, ''),
          accountNumber: String(row.bank_account ?? '').replace(/\s/g, ''),
          accountType: row.bank_account_type || 'CHECKING', type: row.bank_account_type || 'CHECKING', active: true,
        },
      };
      if (row.legal_nature) establishmentPayload.legalNature = String(row.legal_nature).replace(/\D/g, '');
      if (row.opening_date) establishmentPayload.openingDate = row.opening_date;
      if (row.revenue !== null) establishmentPayload.revenue = String(row.revenue);

      let nectaId = row.necta_establishment_id;
      if (!nectaId) {
        const created = await nectaRequest('/establishments', 'POST', establishmentPayload, undefined, marketplaceCreds());
        nectaId = created?.id;
        if (!nectaId) return json({ error: 'A Necta não devolveu o identificador do estabelecimento.' }, 502);
        await admin.from('necta_establishments').update({
          necta_establishment_id: String(nectaId), homologation_status: 'pending', necta_status: created?.status?.name ?? null,
          homologation_sent_at: new Date().toISOString(), raw: created,
        }).eq('id', row.id);
      }

      const { data: documents } = await admin.from('necta_homologation_documents').select('*').eq('request_id', request.id);
      if (!documents?.length) return json({ error: 'Nenhum documento foi anexado.' }, 400);
      const uploadFiles: Array<{ blob: Blob; name: string }> = [];
      for (let index = 0; index < documents.length; index++) {
        const document = documents[index];
        const { data: blob, error: downloadError } = await admin.storage.from('necta-homologation-documents').download(document.storage_path);
        if (downloadError || !blob) throw downloadError ?? new Error('Arquivo não encontrado.');
        uploadFiles.push({ blob, name: document.file_name });
      }
      const createMultipart = () => {
        const multipart = new FormData();
        uploadFiles.forEach((file, index) => multipart.append(`merchantDocumentList[${index}]`, file.blob, file.name));
        return multipart;
      };
      let token = await nectaToken(marketplaceCreds());
      let uploadResponse = await fetch(`${nectaBaseUrl()}/establishments/${encodeURIComponent(String(nectaId))}/documents`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, body: createMultipart(),
      });
      if (uploadResponse.status === 401) {
        token = await nectaToken(marketplaceCreds(), true);
        uploadResponse = await fetch(`${nectaBaseUrl()}/establishments/${encodeURIComponent(String(nectaId))}/documents`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, body: createMultipart(),
        });
      }
      const uploadText = await uploadResponse.text();
      if (!uploadResponse.ok) return json({ error: `Necta documentos [${uploadResponse.status}]: ${uploadText}` }, 400);
      const now = new Date().toISOString();
      await admin.from('necta_homologation_documents').update({ status: 'sent', sent_at: now }).eq('request_id', request.id);
      await admin.from('necta_homologation_requests').update({ status: 'submitted', submitted_at: now }).eq('id', request.id);
      return json({ ok: true, establishment_id: nectaId });
    }

    // ------------------------------------------- credencial de cobrança do seller
    if (input?.action === 'provision_seller_token') {
      const { data: est } = await admin.from('necta_establishments')
        .select('id, company_id, necta_establishment_id, legal_name, trade_name')
        .eq('id', input?.establishment_id).maybeSingle();
      if (!est) return json({ error: 'Estabelecimento não encontrado' }, 404);
      const creds = await provisionSellerCredentials(admin, est as any);
      return json({ ok: true, client_secret_preview: `${creds.clientSecret.slice(0, 12)}…` });
    }

    // Credencial do usuário de API do Portal Necta (aba "Tokens de API") da
    // EMPRESA — é o que a Necta exige para emitir (POST /sales).
    if (input?.action === 'set_company_credentials') {
      const companyId = String(input?.company_id ?? '');
      const { data: company } = await admin.from('companies').select('id').eq('id', companyId).maybeSingle();
      if (!company) return json({ error: 'Empresa não encontrada' }, 404);
      const clientSecret = String(input?.client_secret ?? '').trim();
      const secretKey = String(input?.secret_key ?? '').trim();
      if (!clientSecret || !secretKey) return json({ error: 'Informe clientSecret e secretKey.' }, 400);
      try {
        await saveCompanyCredentials(admin, companyId, { clientSecret, secretKey }, {
          tokenName: input?.token_name ?? null, createdBy: userId ?? null,
        });
      } catch (e) {
        return json({ error: `Credencial recusada pela Necta: ${(e as Error).message}` }, 400);
      }
      return json({ ok: true });
    }

    // ------------------- lista os sellers da Necta (tolerante à falha da rota)
    const listSellers = async (): Promise<any[]> => {
      try {
        const list = await nectaRequest(
          '/establishments', 'GET', undefined, { page: 1, limit: 200 }, marketplaceCreds(), false,
        );
        return Array.isArray(list) ? list : (list?.items ?? list?.data ?? []);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/column[^\n]*nan[^\n]*does not exist/i.test(message)) throw error;

        // A versão atual da Necta tem um defeito interno em GET /establishments:
        // ela gera `LIMIT NaN` mesmo quando page/limit são inteiros válidos.
        // /users não sofre do problema e contém os IDs dos sellers acessíveis;
        // detalhamos cada ID pela rota estável GET /establishments/{id}.
        const usersResponse = await nectaRequest(
          '/users', 'GET', undefined, { page: 1, limit: 200 }, marketplaceCreds(), false,
        );
        const users = Array.isArray(usersResponse)
          ? usersResponse
          : (usersResponse?.items ?? usersResponse?.data ?? []);
        const ids = [...new Set(
          users.map((user: any) => user?.establishment?.id).filter((id: unknown) => typeof id === 'string' && id),
        )] as string[];
        const sellers: any[] = [];
        for (let index = 0; index < ids.length; index += 10) {
          const batch = await Promise.all(ids.slice(index, index + 10).map(async (id) => {
            try {
              return await nectaRequest(`/establishments/${encodeURIComponent(id)}`, 'GET', undefined, undefined, marketplaceCreds(), false);
            } catch {
              return null;
            }
          }));
          sellers.push(...batch.filter(Boolean));
        }
        return sellers;
      }
    };

    const mapSeller = (it: any, companyId: string, own = false) => ({
      company_id: companyId,
      necta_establishment_id: String(it?.id),
      legal_name: it?.name ?? null,
      trade_name: it?.tradeName ?? it?.name ?? null,
      document: String(it?.document ?? '').replace(/\D/g, '') || null,
      email: it?.email ?? null,
      phone: it?.phone ?? null,
      person_type: it?.legalPerson === 'PHYSICAL' ? 'PF' : 'PJ',
      necta_status: (typeof it?.status === 'string' ? it.status : it?.status?.name) ?? null,
      address_street: it?.address?.street ?? null,
      address_number: it?.address?.number ?? null,
      address_district: it?.address?.neighborhood ?? null,
      address_city: it?.address?.city ?? null,
      address_state: it?.address?.state ?? null,
      address_zip: it?.address?.postalCode ?? null,
      imported_from_necta: true,
      // Sellers do marketplace ficam visíveis só no modo administrativo.
      // Vincular um seller a uma empresa define o perfil próprio dela (recebedor).
      is_own_profile: own,
      origin: own ? 'local' : 'marketplace',
      raw: it,
    });

    const upsertSeller = async (it: any, companyId: string, own = false) => {
      const row = mapSeller(it, companyId, own);
      const { data: existing } = await admin.from('necta_establishments')
        .select('id').eq('necta_establishment_id', row.necta_establishment_id)
        .eq('company_id', companyId).maybeSingle();
      if (own) {
        // Um único perfil próprio por empresa.
        const clear = admin.from('necta_establishments')
          .update({ is_own_profile: false })
          .eq('company_id', companyId).eq('is_own_profile', true);
        await (existing?.id ? clear.neq('id', existing.id) : clear);
      }
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
        .select('id, company_id, necta_establishment_id, companies(name)')
        .in('necta_establishment_id', ids.length ? ids : ['-']);
      const linksOut = (links ?? []).map((l: any) => ({
        id: l.id, company_id: l.company_id, necta_establishment_id: l.necta_establishment_id,
        company_name: l.companies?.name ?? null,
      }));
      return json({ ok: true, sellers: items, links: linksOut });
    }

    // vincula sellers escolhidos às empresas escolhidas
    if (input?.action === 'link_sellers') {
      const selections: { necta_establishment_id: string; company_id: string; seller?: any }[] = input?.items ?? [];
      if (!selections.length) return json({ error: 'Nenhum seller selecionado' }, 400);
      // Usa o snapshot enviado pela tela; só consulta a Necta se faltar algum.
      const needsFetch = selections.some((s) => !s?.seller?.id);
      const byId = new Map<string, any>();
      if (needsFetch) {
        for (const i of await listSellers()) byId.set(String(i?.id), i);
      }
      let imported = 0, updated = 0;
      const errors: string[] = [];
      for (const sel of selections) {
        const seller = sel.seller?.id ? sel.seller : byId.get(String(sel.necta_establishment_id));
        if (!seller || !sel.company_id) continue;
        try {
          const r = await upsertSeller(seller, sel.company_id, true);
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

    // ------------------------------------------- conta gráfica (espelho) da Necta
    // Atualiza o espelho da Conta Necta a partir das cobranças liquidadas.
    if (input?.action === 'sync_ledger') {
      const companyId = String(input?.company_id ?? '');
      if (!companyId) return json({ error: 'company_id é obrigatório' }, 400);
      const { data: hasAccess } = await supabase.rpc('has_company_access', { _user_id: userId, _company_id: companyId });
      if (!hasAccess) return json({ error: 'Sem acesso a esta empresa.' }, 403);
      const result = await syncCompanyLedger(admin, companyId, input?.use_ai !== false);
      return json({ ok: true, ...result });
    }

    // ------------------------------------------------------------ proxy genérico
    const { path, method = 'GET', body, query, establishment_id, company_id } = input ?? {};
    if (typeof path !== 'string' || !path.startsWith('/')) return json({ error: 'path deve iniciar com /' }, 400);
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return json({ error: 'método inválido' }, 400);

    // Escopo por empresa: quando company_id vem na chamada, a consulta é feita
    // com a credencial de cobrança daquela empresa — nunca com a do marketplace,
    // para não expor a operação de outras empresas.
    let creds = establishment_id ? await sellerCredentials(admin, establishment_id) : null;
    if (!creds && company_id) {
      const { data: hasAccess } = await supabase.rpc('has_company_access', {
        _user_id: userId,
        _company_id: company_id,
      });
      if (!hasAccess) return json({ error: 'Sem acesso a esta empresa.' }, 403);
      creds = await companyCredentials(admin, company_id);
      if (!creds) {
        const message = 'Esta empresa ainda não tem credencial de cobrança cadastrada.';
        // Em leitura, não é erro: devolvemos vazio para a tela seguir exibindo
        // os dados locais (sem estourar exceção no navegador).
        if (method === 'GET') {
          return json({ ok: true, data: null, warning: message, code: 'missing_company_credentials' });
        }
        return json({ error: message, code: 'missing_company_credentials' }, 400);
      }

    }
    const data = path === '/establishments' && method === 'GET'
      ? await listSellers()
      : await nectaRequest(path, method, body, query, creds);
    return json({ ok: true, data });
  } catch (e) {
    console.error('necta-api error:', e);
    return json({ error: (e as Error).message }, 502);
  }
});
