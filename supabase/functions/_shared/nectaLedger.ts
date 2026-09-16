// Conta espelho da Necta: o extrato do TAI Finance apenas reflete o que a Necta
// informa. Nada é duplicado em transactions/payables_receivables — as linhas
// vivem em public.necta_ledger_entries e o saldo da conta espelho é recalculado
// a partir delas.

const METHOD_LABEL: Record<string, string> = {
  pix: 'PIX', bank_slip: 'Boleto', pix_cappta: 'Bolepix', credit_card: 'Cartão', link: 'Link de pagamento',
};

export const saleDescription = (sale: any) =>
  `Cobrança ${METHOD_LABEL[sale.method] ?? sale.method}${sale.payer_name ? ` - ${sale.payer_name}` : ''}${sale.description ? ` (${sale.description})` : ''}`;

/** Texto normalizado usado como chave da memória de categorização. */
export function normalizePattern(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\d{2,}/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ').slice(0, 6).join(' ');
}

export async function ensureMirrorAccount(admin: any, companyId: string): Promise<string | null> {
  const { data, error } = await admin.rpc('ensure_necta_mirror_account', { _company_id: companyId });
  if (error) {
    console.error('ensure_necta_mirror_account', error.message);
    return null;
  }
  return (data as string) ?? null;
}

async function memoryMatch(admin: any, companyId: string, scope: string, pattern: string) {
  if (!pattern) return null;
  const { data } = await admin.from('finance_categorization_memory')
    .select('id, category_id, subcategory_id, hits')
    .eq('company_id', companyId).eq('scope', scope).eq('pattern', pattern).maybeSingle();
  if (!data?.category_id) return null;
  await admin.from('finance_categorization_memory')
    .update({ hits: (data.hits ?? 1) + 1 }).eq('id', data.id);
  return { category_id: data.category_id, subcategory_id: data.subcategory_id as string | null };
}

/** Sugere categoria pela IA quando não há memória para o padrão. */
async function aiCategorize(admin: any, companyId: string, description: string) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return null;
  const { data: categories } = await admin.from('transaction_categories')
    .select('id, name, type, transaction_subcategories(id, name)')
    .eq('company_id', companyId).in('type', ['income', 'both']);
  if (!categories?.length) return null;

  const list = categories.map((c: any) =>
    `${c.name} (id: ${c.id})${(c.transaction_subcategories ?? []).map((s: any) => `\n   - ${s.name} (id: ${s.id})`).join('')}`,
  ).join('\n');

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'google/gemini-3.8-flash',
        messages: [
          {
            role: 'system',
            content: `Você classifica recebimentos de uma conta de meios de pagamento.\nCategorias disponíveis:\n${list}\n\nResponda APENAS com JSON: {"category_id":"...","subcategory_id":"..."} usando ids existentes. Use null quando não houver correspondência clara.`,
          },
          { role: 'user', content: description },
        ],
      }),
    });
    if (!response.ok) {
      console.error('ai categorize', response.status, await response.text());
      return null;
    }
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const validCategory = categories.find((c: any) => c.id === parsed?.category_id);
    if (!validCategory) return null;
    const validSub = (validCategory.transaction_subcategories ?? [])
      .find((s: any) => s.id === parsed?.subcategory_id);
    return { category_id: validCategory.id, subcategory_id: validSub?.id ?? null };
  } catch (error) {
    console.error('ai categorize', (error as Error).message);
    return null;
  }
}

interface LedgerEntryInput {
  companyId: string;
  accountId: string | null;
  nectaEntryId: string;
  entryType: 'settlement' | 'fee' | 'refund' | 'transfer';
  date: string;
  description: string;
  counterparty?: string | null;
  amount: number;
  direction: 'in' | 'out';
  nectaSaleId?: string | null;
  raw?: unknown;
}

/** Insere/atualiza uma linha do espelho; categoriza por memória e, se preciso, IA. */
export async function upsertLedgerEntry(
  admin: any,
  entry: LedgerEntryInput,
  options: { allowAi?: boolean } = {},
): Promise<'inserted' | 'updated'> {
  const { data: existing } = await admin.from('necta_ledger_entries')
    .select('id, category_id, category_source')
    .eq('company_id', entry.companyId).eq('necta_entry_id', entry.nectaEntryId).maybeSingle();

  const row: Record<string, unknown> = {
    company_id: entry.companyId,
    account_id: entry.accountId,
    necta_entry_id: entry.nectaEntryId,
    entry_type: entry.entryType,
    date: entry.date,
    description: entry.description,
    counterparty: entry.counterparty ?? null,
    amount: entry.amount,
    direction: entry.direction,
    necta_sale_id: entry.nectaSaleId ?? null,
    raw: entry.raw ?? null,
  };

  if (!existing?.category_id) {
    const pattern = normalizePattern(entry.counterparty, entry.description);
    const remembered = await memoryMatch(admin, entry.companyId, 'ledger', pattern);
    if (remembered) {
      row.category_id = remembered.category_id;
      row.subcategory_id = remembered.subcategory_id;
      row.category_source = 'memory';
    } else if (options.allowAi && !existing) {
      const suggested = await aiCategorize(admin, entry.companyId, `${entry.counterparty ?? ''} ${entry.description}`.trim());
      if (suggested) {
        row.category_id = suggested.category_id;
        row.subcategory_id = suggested.subcategory_id;
        row.category_source = 'auto';
      }
    }
  }

  if (existing?.id) {
    // Nunca sobrescreve categorização feita à mão.
    if (existing.category_source === 'manual') {
      delete row.category_id;
      delete row.subcategory_id;
      delete row.category_source;
    }
    await admin.from('necta_ledger_entries').update(row).eq('id', existing.id);
    return 'updated';
  }
  const { error } = await admin.from('necta_ledger_entries').insert(row);
  if (error) throw new Error(error.message);
  return 'inserted';
}

/** Recalcula o saldo da conta espelho a partir das linhas do espelho. */
export async function recomputeMirrorBalance(admin: any, companyId: string, accountId: string) {
  const { data } = await admin.from('necta_ledger_entries')
    .select('amount, direction').eq('company_id', companyId).eq('account_id', accountId);
  const balance = (data ?? []).reduce(
    (sum: number, row: any) => sum + (row.direction === 'out' ? -Number(row.amount) : Number(row.amount)),
    0,
  );
  await admin.from('accounts')
    .update({ current_balance: Number(balance.toFixed(2)) }).eq('id', accountId);
  return balance;
}

/** Gera as linhas do espelho de uma cobrança liquidada (líquido + taxa). */
export async function mirrorSaleToLedger(
  admin: any,
  sale: any,
  paidAt?: string | null,
  options: { accountId?: string | null; allowAi?: boolean } = {},
) {
  const accountId = options.accountId ?? await ensureMirrorAccount(admin, sale.company_id);
  if (!accountId) return null;
  const date = (paidAt ?? sale.paid_at ?? new Date().toISOString()).slice(0, 10);
  const gross = Number(sale.amount ?? 0);
  const fee = Number(sale.fee_amount ?? 0);
  const net = sale.net_amount !== null && sale.net_amount !== undefined ? Number(sale.net_amount) : gross;
  const description = saleDescription(sale);

  await upsertLedgerEntry(admin, {
    companyId: sale.company_id,
    accountId,
    nectaEntryId: `sale:${sale.id}`,
    entryType: 'settlement',
    date,
    description,
    counterparty: sale.payer_name ?? null,
    amount: net,
    direction: 'in',
    nectaSaleId: sale.id,
    raw: { sale_id: sale.id, necta_sale_id: sale.necta_sale_id, gross, fee, net },
  }, { allowAi: options.allowAi });

  if (fee > 0) {
    await upsertLedgerEntry(admin, {
      companyId: sale.company_id,
      accountId,
      nectaEntryId: `fee:${sale.id}`,
      entryType: 'fee',
      date,
      description: `Taxa Necta - ${description}`,
      counterparty: 'Necta',
      amount: fee,
      direction: 'out',
      nectaSaleId: sale.id,
      raw: { sale_id: sale.id, fee },
    });
  }

  await recomputeMirrorBalance(admin, sale.company_id, accountId);
  return accountId;
}

/** Reconstrói o espelho da empresa a partir das cobranças liquidadas. */
export async function syncCompanyLedger(admin: any, companyId: string, allowAi = true) {
  const accountId = await ensureMirrorAccount(admin, companyId);
  if (!accountId) return { account_id: null, entries: 0 };
  const { data: sales } = await admin.from('necta_sales')
    .select('*').eq('company_id', companyId).eq('status', 'paid')
    .order('paid_at', { ascending: false }).limit(500);

  let aiBudget = allowAi ? 5 : 0;
  for (const sale of sales ?? []) {
    const useAi = aiBudget > 0;
    await mirrorSaleToLedger(admin, sale, sale.paid_at, { accountId, allowAi: useAi });
    if (useAi) aiBudget -= 1;
  }
  const balance = await recomputeMirrorBalance(admin, companyId, accountId);
  return { account_id: accountId, entries: (sales ?? []).length, balance };
}
