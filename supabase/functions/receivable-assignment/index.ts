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

const Body = z.object({
  action: z.enum(['approve', 'reject', 'cancel', 'retry']),
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
    const isFin = await access(a.financier_company_id);
    const isCed = await access(a.cedent_company_id);
    const now = new Date().toISOString();
    const log = (event_type: string, payload: unknown = {}) =>
      admin.from('receivable_assignment_events').insert({ assignment_id, event_type, success: true, payload, created_by: u.user.id });

    if (action === 'approve') {
      if (!isFin) return json({ error: 'Apenas o financiador aprova.' }, 403);
      if (a.status !== 'requested') return json({ error: 'Solicitação não está pendente.' }, 400);
      const { data: pr } = await admin.from('payables_receivables').select('status').eq('id', a.payable_receivable_id).maybeSingle();
      if (pr?.status === 'paid') return json({ error: 'Título já foi pago.' }, 400);
      await admin.from('receivable_assignments').update({ status: 'assigned', decided_by: u.user.id, decided_at: now }).eq('id', assignment_id);
      await admin.from('payables_receivables').update({ assignment_id }).eq('id', a.payable_receivable_id);
      await log('approved');
      return json({ ok: true });
    }
    if (action === 'reject') {
      if (!isFin) return json({ error: 'Apenas o financiador recusa.' }, 403);
      if (a.status !== 'requested') return json({ error: 'Solicitação não está pendente.' }, 400);
      await admin.from('receivable_assignments').update({ status: 'rejected', rejection_reason: reason ?? null, decided_by: u.user.id, decided_at: now }).eq('id', assignment_id);
      await log('rejected', { reason });
      return json({ ok: true });
    }
    if (action === 'cancel') {
      if (!isCed && !isFin) return json({ error: 'Sem acesso.' }, 403);
      if (a.status !== 'requested') return json({ error: 'Só é possível cancelar solicitações pendentes.' }, 400);
      await admin.from('receivable_assignments').update({ status: 'cancelled' }).eq('id', assignment_id);
      await log('cancelled');
      return json({ ok: true });
    }
    // retry
    if (!isFin && !isCed) return json({ error: 'Sem acesso.' }, 403);
    if (!['settlement_failed', 'paid_by_debtor'].includes(a.status)) return json({ error: 'Nada a reprocessar.' }, 400);
    return json(await settleAssignment(admin, assignment_id, u.user.id));
  } catch (e) {
    console.error('receivable-assignment', e);
    return json({ error: (e as Error).message }, 500);
  }
});
