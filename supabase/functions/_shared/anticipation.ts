// Liquidação de títulos cedidos (antecipação de recebíveis).
// Após o pagamento do boleto (sale.paid), cria um split pós-venda na Multi-Pay
// direcionando o valor líquido da cessão ao seller do financiador.
// Idempotente: request_id fixo por cessão; não repete se já houve sucesso.
import { nectaRequest, companyCredentials } from './nectaSeller.ts';

export async function settleAssignment(admin: any, assignmentId: string, actor?: string | null) {
  const { data: a } = await admin.from('receivable_assignments').select('*').eq('id', assignmentId).maybeSingle();
  if (!a) throw new Error('Cessão não encontrada');
  if (a.status === 'settled') return { ok: true, already: true };

  const requestId = `assign-split-${a.id}`;
  const { data: done } = await admin.from('receivable_assignment_events')
    .select('id').eq('request_id', requestId).eq('success', true).limit(1);
  if (done?.length) {
    await admin.from('receivable_assignments').update({ status: 'settled', settled_at: new Date().toISOString() }).eq('id', a.id);
    return { ok: true, already: true };
  }

  const { data: fin } = await admin.from('companies').select('necta_seller_id, name').eq('id', a.financier_company_id).maybeSingle();
  let saleUuid: string | null = null;
  if (a.necta_sale_id) {
    const { data: s } = await admin.from('necta_sales').select('necta_sale_id').eq('id', a.necta_sale_id).maybeSingle();
    saleUuid = s?.necta_sale_id ?? null;
  } else {
    const { data: s } = await admin.from('necta_sales').select('id, necta_sale_id')
      .eq('payable_receivable_id', a.payable_receivable_id).maybeSingle();
    saleUuid = s?.necta_sale_id ?? null;
    if (s?.id) await admin.from('receivable_assignments').update({ necta_sale_id: s.id }).eq('id', a.id);
  }

  const payload = {
    recipientType: 'SELLER',
    recipientId: fin?.necta_seller_id,
    amount: Math.round(Number(a.net_amount) * 100),
    metadata: { request_id: requestId, assignment_id: a.id, source: 'tai-finance-anticipation' },
  };

  const fail = async (msg: string, response?: unknown) => {
    await admin.from('receivable_assignment_events').insert({
      assignment_id: a.id, event_type: 'split', request_id: requestId, success: false,
      payload, response: { error: msg, detail: response ?? null }, created_by: actor ?? null,
    });
    await admin.from('receivable_assignments').update({ status: 'settlement_failed' }).eq('id', a.id);
    return { ok: false, error: msg };
  };

  if (!fin?.necta_seller_id) return await fail('Financiador sem ID de seller Pagando configurado.');
  if (!saleUuid) return await fail('Título sem venda Pagando.net vinculada.');

  try {
    const creds = await companyCredentials(admin, a.cedent_company_id);
    const res = await nectaRequest(`/sales/${saleUuid}/splits`, 'POST', payload, undefined, creds);
    await admin.from('receivable_assignment_events').insert({
      assignment_id: a.id, event_type: 'split', request_id: requestId, success: true,
      payload, response: res ?? {}, created_by: actor ?? null,
    });
    await admin.from('receivable_assignments').update({ status: 'settled', settled_at: new Date().toISOString() }).eq('id', a.id);
    return { ok: true };
  } catch (e) {
    return await fail((e as Error).message);
  }
}

/** Chamado pelo webhook quando uma venda é paga. */
export async function onSalePaid(admin: any, sale: { id: string; payable_receivable_id?: string | null }) {
  if (!sale.payable_receivable_id) return;
  const { data: a } = await admin.from('receivable_assignments').select('id, status')
    .eq('payable_receivable_id', sale.payable_receivable_id)
    .in('status', ['assigned', 'settlement_failed']).maybeSingle();
  if (!a) return;
  await admin.from('receivable_assignments').update({ status: 'paid_by_debtor', necta_sale_id: sale.id }).eq('id', a.id);
  await settleAssignment(admin, a.id);
}
