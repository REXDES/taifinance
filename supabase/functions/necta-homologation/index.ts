import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const hashToken = async (token: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, '0')).join('');
};

const allowedFields = [
  'legal_name', 'trade_name', 'document', 'email', 'phone', 'whatsapp', 'person_type',
  'birth_date', 'opening_date', 'legal_nature', 'revenue', 'mcc_id', 'address_zip',
  'address_street', 'address_number', 'address_complement', 'address_district',
  'address_city', 'address_state', 'bank_code', 'bank_name', 'bank_agency', 'bank_account',
  'bank_account_type', 'bank_account_holder', 'bank_account_document', 'pix_key_type', 'pix_key',
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const contentType = req.headers.get('content-type') ?? '';
    let token = '';
    let action = '';
    let body: Record<string, any> = {};
    let upload: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      token = String(form.get('token') ?? '');
      action = String(form.get('action') ?? 'upload');
      const candidate = form.get('file');
      upload = candidate instanceof File ? candidate : null;
      body = { document_type: String(form.get('document_type') ?? '') };
    } else {
      body = await req.json();
      token = String(body.token ?? '');
      action = String(body.action ?? 'get');
    }
    if (!token || token.length < 32) return json({ error: 'Link inválido.' }, 400);

    const tokenHash = await hashToken(token);
    const { data: request } = await admin.from('necta_homologation_requests')
      .select('*, necta_establishments(*)').eq('public_token_hash', tokenHash).maybeSingle();
    if (!request) return json({ error: 'Solicitação não encontrada.' }, 404);
    if (new Date(request.expires_at).getTime() < Date.now()) {
      await admin.from('necta_homologation_requests').update({ status: 'expired' }).eq('id', request.id);
      return json({ error: 'Este link expirou. Solicite um novo link à empresa.' }, 410);
    }

    await admin.from('necta_homologation_requests').update({ last_opened_at: new Date().toISOString() }).eq('id', request.id);

    if (action === 'get') {
      const { data: documents } = await admin.from('necta_homologation_documents')
        .select('id, document_type, file_name, mime_type, file_size, status, rejection_reason, uploaded_at')
        .eq('request_id', request.id).order('uploaded_at');
      return json({
        request: { id: request.id, status: request.status, expires_at: request.expires_at, rejection_reason: request.rejection_reason },
        establishment: request.necta_establishments,
        documents: documents ?? [],
      });
    }

    if (action === 'save') {
      const values: Record<string, unknown> = {};
      for (const field of allowedFields) if (Object.hasOwn(body.fields ?? {}, field)) values[field] = body.fields[field] || null;
      if (!Object.keys(values).length) return json({ error: 'Nenhum dado válido para salvar.' }, 400);
      const { error } = await admin.from('necta_establishments').update(values).eq('id', request.establishment_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'upload') {
      if (!upload) return json({ error: 'Selecione um arquivo.' }, 400);
      const type = String(body.document_type);
      if (!['SELFIE', 'IDENTIFICATION_DOCUMENT'].includes(type)) return json({ error: 'Tipo de documento inválido.' }, 400);
      if (!['image/jpeg', 'application/pdf'].includes(upload.type)) return json({ error: 'Envie um arquivo JPG, JPEG ou PDF.' }, 400);
      if (upload.size > 10 * 1024 * 1024) return json({ error: 'O arquivo deve ter no máximo 10 MB.' }, 400);
      const extension = upload.type === 'application/pdf' ? 'pdf' : 'jpg';
      const path = `${request.company_id}/${request.id}/${type.toLowerCase()}-${crypto.randomUUID()}.${extension}`;
      const { error: storageError } = await admin.storage.from('necta-homologation-documents')
        .upload(path, await upload.arrayBuffer(), { contentType: upload.type });
      if (storageError) throw storageError;
      const { error } = await admin.from('necta_homologation_documents').insert({
        request_id: request.id, company_id: request.company_id, establishment_id: request.establishment_id,
        document_type: type, file_name: upload.name.slice(0, 255), storage_path: path,
        mime_type: upload.type, file_size: upload.size,
      });
      if (error) {
        await admin.storage.from('necta-homologation-documents').remove([path]);
        throw error;
      }
      return json({ ok: true });
    }

    if (action === 'delete_document') {
      const { data: document } = await admin.from('necta_homologation_documents')
        .select('id, storage_path').eq('id', String(body.document_id ?? '')).eq('request_id', request.id).maybeSingle();
      if (!document) return json({ error: 'Documento não encontrado.' }, 404);
      await admin.storage.from('necta-homologation-documents').remove([document.storage_path]);
      await admin.from('necta_homologation_documents').delete().eq('id', document.id);
      return json({ ok: true });
    }

    if (action === 'submit') {
      const establishment = request.necta_establishments ?? {};
      const required = ['legal_name', 'document', 'email', 'phone', 'mcc_id', 'address_zip', 'address_street', 'address_number', 'address_district', 'address_city', 'address_state', 'bank_code', 'bank_agency', 'bank_account'];
      required.push(establishment.person_type === 'PF' ? 'birth_date' : 'opening_date', ...(establishment.person_type === 'PF' ? [] : ['legal_nature']));
      const missing = required.filter((field) => !String(establishment[field] ?? '').trim());
      const { data: documents } = await admin.from('necta_homologation_documents').select('document_type').eq('request_id', request.id);
      const types = new Set((documents ?? []).map((document) => document.document_type));
      if (missing.length) return json({ error: 'Complete todos os dados obrigatórios antes de enviar.' }, 400);
      if (!types.has('SELFIE') || !types.has('IDENTIFICATION_DOCUMENT')) return json({ error: 'Envie a selfie e o documento de identificação.' }, 400);
      if (!body.accept_terms) return json({ error: 'É necessário aceitar os termos para continuar.' }, 400);
      const now = new Date().toISOString();
      await admin.from('necta_homologation_terms').upsert({
        request_id: request.id, company_id: request.company_id, establishment_id: request.establishment_id,
        term_slug: 'tai-homologation-consent-v1', term_version: '1', accepted_at: now,
      }, { onConflict: 'request_id,term_slug' });
      await admin.from('necta_establishments').update({ term_accepted_at: now, term_slug: 'tai-homologation-consent-v1' }).eq('id', request.establishment_id);
      await admin.from('necta_homologation_requests').update({ status: 'ready', client_completed_at: now }).eq('id', request.id);
      return json({ ok: true, status: 'ready' });
    }

    return json({ error: 'Ação inválida.' }, 400);
  } catch (error) {
    console.error('necta-homologation error', error);
    return json({ error: error instanceof Error ? error.message : 'Falha inesperada.' }, 500);
  }
});