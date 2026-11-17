import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { settleAssignment } from '../_shared/anticipation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// approve/reject: financiador. cancel: cedente (ou financiador) enquanto em análise.
// retry: financiador reprocessa um repasse com falha. check: qualquer parte confere o repasse na Necta.
const Body = z.object({
  action: z.enum(['approve', 'reject', 'cancel', 'retry', 'check']),
  assignment_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'Não autenticado' }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { action, assignment_id, reason } = parsed.data;

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: a } = await admin.from('receivable_assignments').select('*').eq('id', assignment_id).maybeSingle();
    if (!a) return json({ error: 'Cessão não encontrada' }, 404);
    const access = async (cid: string) => {
      const { data } = await admin.rpc('has_company_access', { _user_id: u.user.id, _company_id: cid });
      return !!data;
    };
    const can = async (key: string) => {
      const { data } = await admin.rpc('has_permission', { _user_id: u.user.id, _permission_key: key });
      return !!data;
    };
    // Lado do financiador exige a permissão "Financiador"; lado do cedente, "Antecipação".
    const isFin = (await access(a.financier_company_id)) && (await can('credit.financier'));
    const isCed = (await access(a.cedent_company_id)) && (await can('credit.anticipation'));
    const now = new Date().toISOString();
    const log = (event_type: string, payload: unknown = {}) =>
      admin.from('receivable_assignment_events').insert({ assignment_id, event_type, success: true, payload, created_by: u.user.id });

    if (action === 'approve') {
      if (!isFin) return json({ error: 'Apenas o financiador (com a permissão Financiador) aprova.' }, 403);
      if (a.status !== 'requested') return json({ error: 'Solicitação não está pendente.' }, 400);
      // Recalcula a partir do título e do boleto reais e revalida as regras (prazo, valores, limites, nota).
      const { data: terms, error: termsError } = await admin.rpc('ra_refresh_terms', { _assignment_id: assignment_id });
      if (termsError) return json({ error: termsError.message }, 400);
      const { data: approved } = await admin.from('receivable_assignments')
        .update({ status: 'assigned', decided_by: u.user.id, decided_at: now })
        .eq('id', assignment_id).eq('status', 'requested').select('id');
      if (!approved?.length) return json({ error: 'A solicitação mudou enquanto era aprovada. Atualize a tela.' }, 409);
      await admin.from('payables_receivables').update({ assignment_id }).eq('id', a.payable_receivable_id);
      const t = Array.isArray(terms) ? terms[0] : terms;
      await log('approved', {
        face_amount: t?.face_amount, discount_amount: t?.discount_amount, platform_fee_amount: t?.platform_fee_amount,
        net_amount: t?.net_amount, due_date: t?.due_date,
      });
      return json({ ok: true, net_amount: t?.net_amount });
    }
    if (action === 'reject') {
      if (!isFin) return json({ error: 'Apenas o financiador (com a permissão Financiador) recusa.' }, 403);
      if (a.status !== 'requested') return json({ error: 'Solicitação não está pendente.' }, 400);
      await admin.from('receivable_assignments')
        .update({ status: 'rejected', rejection_reason: reason ?? null, decided_by: u.user.id, decided_at: now })
        .eq('id', assignment_id).eq('status', 'requested');
      await log('rejected', { reason });
      return json({ ok: true });
    }
    if (action === 'cancel') {
      if (!isCed && !isFin) return json({ error: 'Sem permissão para cancelar esta solicitação.' }, 403);
      if (!['requested', 'approved'].includes(a.status)) return json({ error: 'Só é possível cancelar solicitações ainda não aprovadas.' }, 400);
      await admin.from('receivable_assignments')
        .update({ status: 'cancelled', cancel_reason: isCed ? 'Cancelada pelo cedente.' : 'Cancelada pelo financiador.' })
        .eq('id', assignment_id).in('status', ['requested', 'approved']);
      await log('cancelled');
      return json({ ok: true });
    }
    if (action === 'retry') {
      if (!isFin) return json({ error: 'Apenas o financiador reprocessa o repasse.' }, 403);
      if (!['settlement_failed', 'paid_by_debtor', 'split_pending'].includes(a.status)) return json({ error: 'Nada a reprocessar.' }, 400);
      return json(await settleAssignment(admin, assignment_id, u.user.id));
    }
    // check
    if (!isFin && !isCed) return json({ error: 'Sem acesso.' }, 403);
    if (!['paid_by_debtor', 'split_pending', 'settlement_failed'].includes(a.status)) {
      return json({ ok: true, status: a.status });
    }
    return json(await settleAssignment(admin, assignment_id, u.user.id));
  } catch (e) {
    console.error('receivable-assignment', e);
    return json({ error: (e as Error).message }, 500);
  }
});
