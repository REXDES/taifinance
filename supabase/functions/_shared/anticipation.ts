// Liquidação de títulos cedidos (antecipação de recebíveis).
//
// Quando o sacado paga o boleto cedido, o valor vai ao financiador por um split
// pós-pagamento na própria venda (POST /sales/{uuid}/splits). Regras:
// - Credencial: primeiro a do marketplace (o estabelecimento não cancela split
//   criado pelo marketplace); se a Necta recusar, o token do estabelecimento
//   criado pelo TAI (segredo só no servidor); por último a credencial da própria
//   empresa cedente. A usada fica registrada na cessão (split_credential).
// - Uma liquidação por vez (ra_claim_settlement) e nunca dois splits: antes de
//   criar, consulta o rateio da venda na Necta e reaproveita o que já existe.
// - "Liquidado" só quando a Necta informa o split como SETTLED; até lá a cessão
//   fica em split_pending ("Repasse agendado").
// - Valor: boleto pago (bruto, com juros/multa — ou líquido, conforme a
//   configuração) menos a taxa da plataforma, que vai num segundo split.
// - Pago antes do desembolso ao cedente: não há repasse; a cessão é encerrada.
import {
  type NectaCreds, nectaRequest, marketplaceCreds, companyCredentials, sellerCredentials, resolveCompanySellerId,
} from './nectaSeller.ts';

const FINAL_FAILURE = ['CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'];
const upper = (s: unknown) => String(s ?? '').toUpperCase();
const isActiveSplit = (s: any) => !FINAL_FAILURE.includes(upper(s?.status));
const str = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v));
const nowIso = () => new Date().toISOString();
const httpStatus = (e: unknown) => Number(/\[(\d{3})\]/.exec(String((e as Error)?.message ?? ''))?.[1] ?? 0);
const isClientError = (e: unknown) => { const s = httpStatus(e); return s >= 400 && s < 500; };

export interface AnticipationSettings {
  platform_fee_percent: number;
  platform_fee_fixed: number;
  platform_fee_payer: 'cedent' | 'financier';
  platform_fee_recipient_type: 'SELLER' | 'MARKETPLACE';
  platform_fee_recipient_id: string | null;
  split_base: 'gross' | 'net';
  internal_transfer_enabled: boolean;
}

export const DEFAULT_SETTINGS: AnticipationSettings = {
  platform_fee_percent: 0, platform_fee_fixed: 0, platform_fee_payer: 'cedent',
  platform_fee_recipient_type: 'SELLER', platform_fee_recipient_id: null,
  split_base: 'gross', internal_transfer_enabled: false,
};

export async function loadAnticipationSettings(admin: any): Promise<AnticipationSettings> {
  try {
    const { data } = await admin.from('anticipation_settings').select('*').limit(1).maybeSingle();
    return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Valores do repasse em centavos. `fee` é a taxa gravada na aprovação; só entra
 * quando há conta de destino. Puro — testado em scripts/test-anticipation-settlement.mts.
 */
export function settlementAmounts(input: {
  face: unknown; saleAmount?: unknown; saleNet?: unknown; saleFee?: unknown;
  base: 'gross' | 'net'; fee?: unknown; feeEnabled: boolean;
}): { baseCents: number; feeCents: number; financierCents: number; grossCents: number } | { error: string } {
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const net = num(input.saleNet);
  const providerFee = num(input.saleFee);
  const issued = num(input.saleAmount);
  const face = num(input.face);
  // Bruto pago = líquido + taxa informados pela Necta (inclui juros/multa); sem eles, o valor emitido.
  const gross = Number.isFinite(net) && Number.isFinite(providerFee) ? net + providerFee
    : Number.isFinite(issued) ? issued : face;
  let base = gross;
  if (input.base === 'net') {
    if (!Number.isFinite(net) || net <= 0) return { error: 'A Necta ainda não informou o valor líquido do boleto; tente de novo em instantes.' };
    base = net;
  }
  const baseCents = Math.round(base * 100);
  const feeCents = input.feeEnabled ? Math.round(num(input.fee ?? 0) * 100) : 0;
  if (!Number.isSafeInteger(baseCents) || baseCents <= 0) return { error: 'Valor do boleto pago inválido para liquidação.' };
  if (!Number.isSafeInteger(feeCents) || feeCents < 0) return { error: 'Taxa da plataforma inválida.' };
  const financierCents = baseCents - feeCents;
  if (financierCents <= 0) return { error: 'A taxa da plataforma consome todo o valor do boleto.' };
  return { baseCents, feeCents, financierCents, grossCents: Math.round(gross * 100) };
}

// ------------------------------------------------------------- credenciais

interface CredentialOption { label: 'marketplace' | 'tai_seller_token' | 'cedent_token'; get: () => Promise<NectaCreds | null> }

async function splitCredentials(admin: any, cedentCompanyId: string): Promise<CredentialOption[]> {
  const list: CredentialOption[] = [{ label: 'marketplace', get: async () => marketplaceCreds() }];
  const { data: est } = await admin.from('necta_establishments').select('id')
    .eq('company_id', cedentCompanyId).eq('is_own_profile', true).maybeSingle();
  if (est?.id) list.push({ label: 'tai_seller_token', get: () => sellerCredentials(admin, est.id) });
  list.push({ label: 'cedent_token', get: () => companyCredentials(admin, cedentCompanyId) });
  return list;
}

/** Tenta as credenciais em ordem; 401/403/404 = credencial sem escopo para a venda → próxima. */
async function withCredentials<T>(
  chain: CredentialOption[], fn: (creds: NectaCreds) => Promise<T>, preferred?: string | null,
): Promise<{ value: T; label: CredentialOption['label'] }> {
  const ordered = preferred
    ? [...chain.filter((c) => c.label === preferred), ...chain.filter((c) => c.label !== preferred)]
    : chain;
  let lastError: unknown = null;
  for (const option of ordered) {
    let creds: NectaCreds | null = null;
    try { creds = await option.get(); } catch (e) { lastError = e; continue; }
    if (!creds?.clientSecret || !creds?.secretKey) continue;
    try {
      return { value: await fn(creds), label: option.label };
    } catch (e) {
      lastError = e;
      if (![401, 403, 404].includes(httpStatus(e))) throw e;
    }
  }
  throw lastError ?? new Error('Nenhuma credencial da Necta disponível para esta venda.');
}

async function listSaleSplits(chain: CredentialOption[], saleUuid: string, preferred?: string | null) {
  const { value, label } = await withCredentials(
    chain, (creds) => nectaRequest(`/sales/${saleUuid}/splits`, 'GET', undefined, undefined, creds, false, false), preferred,
  );
  const rows = Array.isArray(value) ? value : ((value as any)?.data ?? (value as any)?.items ?? []);
  return { rows: rows as any[], label };
}

/** Split ativo (não cancelado/falho) para o recebedor; prefere o id já conhecido. */
export function findActiveSplit(rows: any[] | null, recipient: { type: string; id: string | null }, knownId?: string | null) {
  if (!rows) return null;
  const active = rows.filter(isActiveSplit);
  if (knownId) {
    const byId = active.find((s) => String(s?.id) === String(knownId));
    if (byId) return byId;
  }
  return active.find((s) => {
    const type = upper(s?.recipientType ?? s?.recipient?.type);
    const id = s?.recipient?.id ?? s?.recipientId ?? null;
    if (recipient.type === 'MARKETPLACE') return type === 'MARKETPLACE' && (!recipient.id || String(id) === String(recipient.id));
    return !!id && String(id) === String(recipient.id) && (!type || type === recipient.type);
  }) ?? null;
}

// --------------------------------------------------------------- eventos

function eventLogger(admin: any, assignmentId: string, actor?: string | null) {
  return (event_type: string, success: boolean, payload: unknown = {}, response: unknown = {}, requestId?: string) =>
    admin.from('receivable_assignment_events').insert({
      assignment_id: assignmentId, event_type, request_id: requestId ?? `${event_type}-${assignmentId}`,
      success, payload, response, created_by: actor ?? null,
    });
}

// ------------------------------------------------------------- liquidação

export type SettleResult = { ok: boolean; status?: string; error?: string; already?: boolean; busy?: boolean; warning?: string | null };

/** Liquida (ou confere) uma cessão paga. Seguro para chamar várias vezes e em paralelo. */
export async function settleAssignment(admin: any, assignmentId: string, actor?: string | null): Promise<SettleResult> {
  const claimId = crypto.randomUUID();
  const { data: claimed, error: claimError } = await admin.rpc('ra_claim_settlement', {
    _assignment_id: assignmentId, _claim_id: claimId, _ttl_seconds: 120,
  });
  if (claimError) throw new Error(`Não foi possível reservar a liquidação: ${claimError.message}`);
  const a = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!a) {
    const { data: current } = await admin.from('receivable_assignments').select('id, status').eq('id', assignmentId).maybeSingle();
    if (!current) throw new Error('Cessão não encontrada');
    if (current.status === 'settled') return { ok: true, already: true, status: 'settled' };
    return { ok: true, busy: true, status: current.status };
  }
  try {
    return await runSettlement(admin, a, actor);
  } finally {
    await admin.from('receivable_assignments').update({ settle_claim_id: null, settle_claimed_at: null })
      .eq('id', a.id).eq('settle_claim_id', claimId);
  }
}

async function runSettlement(admin: any, a: any, actor?: string | null): Promise<SettleResult> {
  const log = eventLogger(admin, a.id, actor);
  const save = (patch: Record<string, unknown>) => admin.from('receivable_assignments').update(patch).eq('id', a.id);
  const fail = async (message: string, detail?: unknown): Promise<SettleResult> => {
    await log('split', false, { stage: 'settle' }, { error: message, detail: detail ?? null });
    await save({ status: 'settlement_failed', last_error: message, split_checked_at: nowIso() });
    return { ok: false, error: message, status: 'settlement_failed' };
  };

  if (a.status === 'settled') return { ok: true, already: true, status: 'settled' };
  if (!['paid_by_debtor', 'split_pending', 'settlement_failed'].includes(a.status)) {
    return { ok: false, error: 'O título ainda não foi pago pelo sacado.', status: a.status };
  }

  const saleFields = 'id, necta_sale_id, amount, net_amount, fee_amount, status, payable_receivable_id';
  let sale: any = null;
  if (a.necta_sale_id) {
    sale = (await admin.from('necta_sales').select(saleFields).eq('id', a.necta_sale_id).maybeSingle()).data;
  }
  if (!sale || sale.status !== 'paid') {
    const { data } = await admin.from('necta_sales').select(saleFields)
      .eq('payable_receivable_id', a.payable_receivable_id).eq('status', 'paid').limit(1);
    if (data?.[0]) {
      sale = data[0];
      await save({ necta_sale_id: sale.id });
    }
  }
  if (!sale?.necta_sale_id) return await fail('Título sem venda Pagando.net vinculada.');
  if (sale.status !== 'paid') return await fail('O pagamento do boleto ainda não foi confirmado pela Necta.');

  const settings = await loadAnticipationSettings(admin);
  const feeTarget = Number(a.platform_fee_amount) > 0 && (a.platform_fee_recipient_type === 'MARKETPLACE' || a.platform_fee_recipient_id)
    ? { type: String(a.platform_fee_recipient_type ?? 'SELLER'), id: str(a.platform_fee_recipient_id) }
    : null;
  const amounts = settlementAmounts({
    face: a.face_amount, saleAmount: sale.amount, saleNet: sale.net_amount, saleFee: sale.fee_amount,
    base: settings.split_base, fee: a.platform_fee_amount, feeEnabled: !!feeTarget,
  });
  if ('error' in amounts) return await fail(amounts.error);

  const financierSeller = await resolveCompanySellerId(admin, a.financier_company_id);
  if (!financierSeller) return await fail('Financiador sem ID de seller Pagando configurado.');

  const chain = await splitCredentials(admin, a.cedent_company_id);

  // 1. O que já existe no rateio da venda (evita split duplicado após timeout ou clique duplo).
  let existing: any[] | null = null;
  let listError: string | null = null;
  try {
    existing = (await listSaleSplits(chain, sale.necta_sale_id, a.split_credential)).rows;
  } catch (e) {
    listError = (e as Error).message;
  }

  let financierSplit = findActiveSplit(existing, { type: 'SELLER', id: financierSeller }, a.split_id);
  let feeSplit = feeTarget ? findActiveSplit(existing, feeTarget, a.platform_split_id) : null;
  let credentialUsed: string | null = a.split_credential ?? null;

  // 2. Repasse do financiador (primeiro: é o dinheiro que precisa ser protegido).
  if (!financierSplit) {
    if (existing === null && (a.split_id || a.split_status === 'REQUESTED')) {
      if (a.status === 'split_pending' && a.split_id) {
        // Conferência de rotina sem resposta da Necta: o repasse continua agendado.
        const warning = `Não foi possível consultar a Necta agora: ${listError}`;
        await save({ split_checked_at: nowIso(), last_error: warning });
        return { ok: true, status: 'split_pending', warning };
      }
      return await fail('Não foi possível conferir na Necta se o repasse já foi criado. Confira o rateio da venda antes de reprocessar.', listError);
    }
    await save({
      split_status: 'REQUESTED', last_error: null,
      settlement_base_amount: amounts.baseCents / 100,
      financier_split_amount: amounts.financierCents / 100,
      platform_split_amount: amounts.feeCents / 100,
    });
    const body = {
      recipientType: 'SELLER', recipientId: financierSeller, amount: amounts.financierCents, splitType: 'ABSOLUTE',
      metadata: { request_id: `assign-split-${a.id}`, assignment_id: a.id, source: 'tai-finance-anticipation' },
    };
    try {
      const { value, label } = await withCredentials(
        chain, (creds) => nectaRequest(`/sales/${sale.necta_sale_id}/splits`, 'POST', body, undefined, creds, false, false),
      );
      financierSplit = value ?? {};
      credentialUsed = label;
      await log('split', true, { ...body, credential: label }, value ?? {}, `assign-split-${a.id}`);
      await save({ split_id: str(financierSplit.id), split_status: upper(financierSplit.status) || 'PENDING', split_credential: label });
    } catch (e) {
      const message = (e as Error).message;
      // 4xx: a Necta recusou e nada foi criado — pode reprocessar à vontade.
      if (isClientError(e)) {
        await save({ split_status: null });
        return await fail(`A Necta recusou o repasse ao financiador: ${message}`);
      }
      // Sem resposta: o split pode ter sido criado; a próxima tentativa confere o rateio antes.
      return await fail(`Sem confirmação da Necta ao criar o repasse (${message}). Ele pode ter sido criado: a próxima tentativa confere o rateio da venda antes de criar outro.`);
    }
  }

  // 3. Taxa da plataforma (segundo split). Falha aqui não bloqueia o repasse do financiador.
  let warning: string | null = null;
  if (feeTarget && !feeSplit) {
    if (existing === null && (a.platform_split_id || a.platform_split_status === 'REQUESTED')) {
      warning = 'Não foi possível conferir na Necta a taxa da plataforma.';
    } else {
      await save({ platform_split_status: 'REQUESTED' });
      const body = {
        recipientType: feeTarget.type, ...(feeTarget.id ? { recipientId: feeTarget.id } : {}),
        amount: amounts.feeCents, splitType: 'ABSOLUTE',
        metadata: { request_id: `assign-fee-${a.id}`, assignment_id: a.id, source: 'tai-finance-platform-fee' },
      };
      try {
        const { value, label } = await withCredentials(
          chain, (creds) => nectaRequest(`/sales/${sale.necta_sale_id}/splits`, 'POST', body, undefined, creds, false, false), credentialUsed,
        );
        feeSplit = value ?? {};
        await log('platform_fee_split', true, { ...body, credential: label }, value ?? {}, `assign-fee-${a.id}`);
        await save({ platform_split_id: str(feeSplit.id), platform_split_status: upper(feeSplit.status) || 'PENDING' });
      } catch (e) {
        warning = `Taxa da plataforma não repassada: ${(e as Error).message}`;
        await log('platform_fee_split', false, body, { error: warning }, `assign-fee-${a.id}`);
        if (isClientError(e)) await save({ platform_split_status: null });
      }
    }
  }

  // 4. Situação conforme a Necta.
  const financierStatus = upper(financierSplit.status) || 'PENDING';
  const patch: Record<string, unknown> = {
    split_id: str(financierSplit.id) ?? a.split_id ?? null,
    split_status: financierStatus,
    split_credential: credentialUsed,
    split_checked_at: nowIso(),
    last_error: warning,
  };
  if (feeSplit) {
    patch.platform_split_id = str(feeSplit.id) ?? a.platform_split_id ?? null;
    patch.platform_split_status = upper(feeSplit.status) || 'PENDING';
  }
  let status = 'split_pending';
  if (FINAL_FAILURE.includes(financierStatus)) {
    status = 'settlement_failed';
    patch.last_error = `A Necta informou o repasse ao financiador como ${financierStatus}.`;
  } else if (financierStatus === 'SETTLED') {
    status = 'settled';
    patch.settled_at = nowIso();
  }
  patch.status = status;
  await save(patch);
  if (status === 'settled' && a.status !== 'settled') await log('settled', true, { split_id: patch.split_id });
  return { ok: status !== 'settlement_failed', status, warning, error: status === 'settlement_failed' ? String(patch.last_error) : undefined };
}

// ---------------------------------------------------------------- desembolso

/** Marca o desembolso ao cedente (uma vez). Devolve true se marcou agora. */
export async function markDisbursed(
  admin: any, assignment: any, method: string, actor?: string | null, extra: Record<string, unknown> = {},
): Promise<boolean> {
  const { data } = await admin.from('receivable_assignments')
    .update({ disbursed_at: nowIso(), disbursement_method: method, ...extra })
    .eq('id', assignment.id).eq('status', 'assigned').is('disbursed_at', null)
    .select('id');
  if (!data?.length) return false;
  await eventLogger(admin, assignment.id, actor)('disbursement', true, { method, ...extra }, {}, `assign-disburse-${method}-${assignment.id}`);
  return true;
}

async function voidDisbursementCharge(admin: any, a: any) {
  if (!a.disbursement_sale_id) return;
  const { data: s } = await admin.from('necta_sales').select('id, necta_sale_id, status, company_id')
    .eq('id', a.disbursement_sale_id).maybeSingle();
  if (!s?.necta_sale_id || !['pending', 'issued', 'overdue'].includes(s.status)) return;
  try {
    const creds = await companyCredentials(admin, s.company_id);
    await nectaRequest(`/sales/${s.necta_sale_id}/void`, 'POST', {}, undefined, creds);
    await admin.from('necta_sales').update({ status: 'canceled', last_sync_at: nowIso() }).eq('id', s.id);
    await eventLogger(admin, a.id)('disbursement_charge_voided', true, { sale_id: s.id });
  } catch (e) {
    await eventLogger(admin, a.id)('disbursement_charge_voided', false, { sale_id: s.id }, { error: (e as Error).message });
  }
}

/** Chamado quando uma venda é paga (webhook ou sincronização). */
export async function onSalePaid(admin: any, sale: { id: string; payable_receivable_id?: string | null }) {
  if (!sale?.payable_receivable_id) return null;
  const { data: rows } = await admin.from('receivable_assignments').select('*')
    .eq('payable_receivable_id', sale.payable_receivable_id)
    .in('status', ['requested', 'approved', 'assigned', 'paid_by_debtor', 'split_pending', 'settlement_failed'])
    .limit(1);
  const a = rows?.[0];
  if (!a) return null;
  const log = eventLogger(admin, a.id);

  if (a.status === 'requested' || a.status === 'approved') {
    const { data: closed } = await admin.from('receivable_assignments')
      .update({ status: 'cancelled', cancel_reason: 'O título foi pago antes da aprovação do financiador.' })
      .eq('id', a.id).in('status', ['requested', 'approved']).select('id');
    if (closed?.length) await log('closed_paid_before_approval', true, { sale_id: sale.id });
    return { ok: true, status: 'cancelled' };
  }

  if (a.status === 'assigned') {
    let disbursed = !!a.disbursed_at;
    // Desembolso por cobrança PIX/boleto já pago, mas ainda não registrado na cessão.
    if (!disbursed && a.disbursement_sale_id) {
      const { data: ds } = await admin.from('necta_sales').select('id, status, method').eq('id', a.disbursement_sale_id).maybeSingle();
      if (ds?.status === 'paid') {
        await markDisbursed(admin, a, ds.method === 'pix' ? 'pix_charge' : 'boleto_charge');
        disbursed = true;
      }
    }
    if (!disbursed) {
      // Decisão da Fase 1: o financiador não pagou nada ao cedente → não há repasse.
      const { data: closed } = await admin.from('receivable_assignments')
        .update({
          status: 'cancelled', necta_sale_id: sale.id,
          cancel_reason: 'O sacado pagou o boleto antes do desembolso ao cedente; não há repasse ao financiador.',
        })
        .eq('id', a.id).eq('status', 'assigned').is('disbursed_at', null).select('id');
      if (closed?.length) {
        await admin.from('payables_receivables').update({ assignment_id: null }).eq('id', a.payable_receivable_id).eq('assignment_id', a.id);
        await log('closed_paid_before_disbursement', true, { sale_id: sale.id });
        await voidDisbursementCharge(admin, a);
        return { ok: true, status: 'cancelled' };
      }
    }
    await admin.from('receivable_assignments').update({ status: 'paid_by_debtor', necta_sale_id: sale.id })
      .eq('id', a.id).eq('status', 'assigned');
    await log('paid_by_debtor', true, { sale_id: sale.id });
  } else if (sale.id !== a.necta_sale_id) {
    await admin.from('receivable_assignments').update({ necta_sale_id: sale.id }).eq('id', a.id);
  }
  return await settleAssignment(admin, a.id, null);
}

/** Cobrança de desembolso (PIX/boleto emitida pelo cedente contra o financiador) paga. */
export async function onDisbursementSalePaid(admin: any, sale: { id: string; method?: string | null }) {
  if (!sale?.id) return null;
  const { data: rows } = await admin.from('receivable_assignments').select('*').eq('disbursement_sale_id', sale.id).limit(1);
  const a = rows?.[0];
  if (!a) return null;
  if (a.status === 'assigned' && !a.disbursed_at) {
    await markDisbursed(admin, a, sale.method === 'pix' ? 'pix_charge' : 'boleto_charge');
    return { ok: true, disbursed: true };
  }
  if (a.status === 'cancelled' && !a.disbursed_at) {
    const message = 'O financiador pagou a cobrança de desembolso depois que a cessão foi encerrada: o cedente precisa devolver o valor.';
    await admin.from('receivable_assignments').update({ last_error: message }).eq('id', a.id);
    await eventLogger(admin, a.id)('disbursement_after_close', false, { sale_id: sale.id }, { error: message });
    return { ok: false, error: message };
  }
  return null;
}
