import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { setEntityTags } from '@/hooks/useFinanceTags';
import { toast } from 'sonner';

const RECEIPT_BUCKET = 'statement-receipts';

export type StatementImportStatus = 'pending' | 'partial' | 'done';

export interface StatementImport {
  id: string;
  company_id: string;
  account_id: string | null;
  file_name: string;
  file_format: string;
  bank_name: string | null;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  computed_closing_balance: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface StatementLine {
  id: string;
  import_id: string;
  company_id: string;
  line_index: number;
  date: string;
  raw_description: string;
  amount: number;
  type: 'income' | 'expense';
  running_balance: number | null;
  external_id: string | null;
  fingerprint: string | null;
  suggested_account_id: string | null;
  suggested_category_id: string | null;
  suggested_subcategory_id: string | null;
  suggested_description: string | null;
  suggestion_source: string | null;
  suggestion_confidence: number | null;
  duplicate_of_transaction_id: string | null;
  duplicate_reason: string | null;
  status: 'pending' | 'reconciled' | 'ignored';
  transaction_id: string | null;
  payable_receivable_id: string | null;
  receipt_path?: string | null;
  receipt_name?: string | null;
  receipt_details?: string | null;
  tag_ids?: string[] | null;
}

export interface ParsedLine {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  running_balance: number | null;
  external_id: string | null;
}

export interface ParsedStatement {
  bank_name: string | null;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  lines: ParsedLine[];
}

export function normalizeDescription(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildFingerprint(line: { date: string; amount: number; type: string; description?: string; raw_description?: string }) {
  const desc = normalizeDescription(line.description ?? line.raw_description ?? '').slice(0, 40);
  return `${line.date}|${line.type}|${Number(line.amount).toFixed(2)}|${desc}`;
}

export function detectFormat(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'ofx' || ext === 'ofc') return 'ofx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return 'csv';
}

function toIsoDate(raw: string): string | null {
  const value = (raw || '').trim();
  const ofx = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = value.match(/^(\d{2})[/.-](\d{2})[/.-](\d{2,4})/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2]}-${br[1]}`;
  }
  return null;
}

/** Parser local de OFX/OFC — determinístico, sem IA. */
export function parseOfx(content: string): ParsedStatement {
  const lines: ParsedLine[] = [];
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const get = (tag: string) => {
      const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
      return match ? match[1].trim() : '';
    };
    const date = toIsoDate(get('DTPOSTED'));
    const rawAmount = Number(get('TRNAMT').replace(/\./g, (m, i, s) => (s.length - i - 1 > 2 ? '' : m)).replace(',', '.'));
    if (!date || !Number.isFinite(rawAmount) || rawAmount === 0) continue;
    const memo = [get('MEMO'), get('NAME')].filter(Boolean).join(' - ');
    lines.push({
      date,
      description: memo || 'Lançamento sem histórico',
      amount: Math.abs(rawAmount),
      type: rawAmount < 0 ? 'expense' : 'income',
      running_balance: null,
      external_id: get('FITID') || null,
    });
  }
  const ledger = content.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]*)/i);
  const dtStart = toIsoDate((content.match(/<DTSTART>([^<\r\n]*)/i) || [])[1] || '');
  const dtEnd = toIsoDate((content.match(/<DTEND>([^<\r\n]*)/i) || [])[1] || '');
  const bank = (content.match(/<ORG>([^<\r\n]*)/i) || [])[1]?.trim() || null;
  lines.sort((a, b) => a.date.localeCompare(b.date));
  const closing = ledger ? Number(ledger[1].replace(',', '.')) : null;
  const total = lines.reduce((sum, l) => sum + (l.type === 'income' ? l.amount : -l.amount), 0);
  return {
    bank_name: bank,
    period_start: dtStart || lines[0]?.date || null,
    period_end: dtEnd || lines[lines.length - 1]?.date || null,
    opening_balance: closing !== null && Number.isFinite(closing) ? Number((closing - total).toFixed(2)) : null,
    closing_balance: closing !== null && Number.isFinite(closing) ? closing : null,
    lines,
  };
}

export function sheetToCsvText(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return workbook.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { dateNF: 'yyyy-mm-dd' });
    return `--- Planilha: ${name} ---\n${csv}`;
  }).join('\n\n');
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function callParser(payload: Record<string, unknown>) {
  const res = await supabase.functions.invoke('statement-import-parse', { body: payload });
  if (res.error) {
    const detail = (res.data as any)?.error;
    throw new Error(detail || res.error.message);
  }
  if ((res.data as any)?.error) throw new Error((res.data as any).error);
  return res.data as any;
}

/** Lê o arquivo e devolve o extrato normalizado (IA para CSV/XLSX/PDF, parser local para OFX). */
export async function parseStatementFile(file: File): Promise<{ format: string; parsed: ParsedStatement }> {
  const format = detectFormat(file.name);

  if (format === 'ofx') {
    const parsed = parseOfx(await file.text());
    if (parsed.lines.length > 0) return { format, parsed };
  }

  if (format === 'pdf') {
    const parsed = await callParser({
      action: 'extract',
      format,
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      fileBase64: await fileToBase64(file),
    });
    return { format, parsed: normalizeParsed(parsed) };
  }

  const text = format === 'xlsx' ? sheetToCsvText(await file.arrayBuffer()) : await file.text();
  const parsed = await callParser({ action: 'extract', format, fileName: file.name, text });
  return { format, parsed: normalizeParsed(parsed) };
}

function normalizeParsed(raw: any): ParsedStatement {
  const lines: ParsedLine[] = (raw?.lines || [])
    .map((l: any) => ({
      date: toIsoDate(String(l.date || '')) || String(l.date || ''),
      description: String(l.description || 'Lançamento sem histórico'),
      amount: Math.abs(Number(l.amount) || 0),
      type: l.type === 'income' ? 'income' : 'expense',
      running_balance: l.running_balance === null || l.running_balance === undefined ? null : Number(l.running_balance),
      external_id: l.external_id ? String(l.external_id) : null,
    }))
    .filter((l: ParsedLine) => /^\d{4}-\d{2}-\d{2}$/.test(l.date) && l.amount > 0)
    .sort((a: ParsedLine, b: ParsedLine) => a.date.localeCompare(b.date));

  return {
    bank_name: raw?.bank_name ?? null,
    period_start: raw?.period_start ? toIsoDate(String(raw.period_start)) : lines[0]?.date ?? null,
    period_end: raw?.period_end ? toIsoDate(String(raw.period_end)) : lines[lines.length - 1]?.date ?? null,
    opening_balance: raw?.opening_balance === null || raw?.opening_balance === undefined ? null : Number(raw.opening_balance),
    closing_balance: raw?.closing_balance === null || raw?.closing_balance === undefined ? null : Number(raw.closing_balance),
    lines,
  };
}

export function useStatementImports(companyId: string | null) {
  const [imports, setImports] = useState<StatementImport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImports = useCallback(async () => {
    if (!companyId) {
      setImports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('statement_imports')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar importações: ' + error.message);
    setImports((data || []) as StatementImport[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchImports(); }, [fetchImports]);

  const deleteImport = async (id: string) => {
    const { error } = await (supabase as any).from('statement_imports').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir importação: ' + error.message);
      return;
    }
    toast.success('Importação excluída');
    fetchImports();
  };

  return { imports, loading, refetch: fetchImports, deleteImport };
}

export function useStatementLines(importId: string | null) {
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLines = useCallback(async () => {
    if (!importId) {
      setLines([]);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('statement_lines')
      .select('*')
      .eq('import_id', importId)
      .order('line_index');
    if (error) toast.error('Erro ao carregar linhas: ' + error.message);
    setLines((data || []) as StatementLine[]);
    setLoading(false);
  }, [importId]);

  useEffect(() => { fetchLines(); }, [fetchLines]);

  return { lines, loading, refetch: fetchLines, setLines };
}

interface CreateImportParams {
  companyId: string;
  accountId: string | null;
  fileName: string;
  format: string;
  parsed: ParsedStatement;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: string; subcategories?: { id: string; name: string }[] }[];
}

/** Cria a importação, grava as linhas, detecta duplicidades e pede sugestões da IA. */
export async function createStatementImport(params: CreateImportParams) {
  const { companyId, accountId, fileName, format, parsed } = params;
  const { data: { user } } = await supabase.auth.getUser();

  const total = parsed.lines.reduce((sum, l) => sum + (l.type === 'income' ? l.amount : -l.amount), 0);
  const computedClosing = parsed.opening_balance !== null ? Number((parsed.opening_balance + total).toFixed(2)) : null;

  const { data: importRow, error: importError } = await (supabase as any)
    .from('statement_imports')
    .insert({
      company_id: companyId,
      account_id: accountId,
      file_name: fileName,
      file_format: format,
      bank_name: parsed.bank_name,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
      opening_balance: parsed.opening_balance,
      closing_balance: parsed.closing_balance,
      computed_closing_balance: computedClosing,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (importError) throw importError;

  // --- Duplicidade: transações já existentes no período ---
  const start = parsed.period_start || parsed.lines[0]?.date;
  const end = parsed.period_end || parsed.lines[parsed.lines.length - 1]?.date;
  let existing: any[] = [];
  if (start && end) {
    const { data } = await supabase
      .from('transactions')
      .select('id, date, amount, type, description')
      .eq('company_id', companyId)
      .gte('date', start)
      .lte('date', end);
    existing = data || [];
  }

  const findDuplicate = (line: ParsedLine) => {
    const sameValue = existing.filter(
      (t) => t.date === line.date && Math.abs(Number(t.amount) - line.amount) < 0.01 && t.type === line.type
    );
    if (sameValue.length === 0) return null;
    const normalized = normalizeDescription(line.description);
    const exact = sameValue.find((t) => {
      const other = normalizeDescription(t.description);
      return other.includes(normalized.slice(0, 12)) || normalized.includes(other.slice(0, 12));
    });
    const match = exact || sameValue[0];
    return {
      id: match.id,
      reason: exact
        ? 'Mesma data, valor e histórico semelhante a um lançamento já existente'
        : 'Mesma data e valor de um lançamento já existente',
    };
  };

  const rows = parsed.lines.map((line, index) => {
    const duplicate = findDuplicate(line);
    return {
      import_id: importRow.id,
      company_id: companyId,
      line_index: index,
      date: line.date,
      raw_description: line.description,
      amount: line.amount,
      type: line.type,
      running_balance: line.running_balance,
      external_id: line.external_id,
      fingerprint: buildFingerprint({ ...line, raw_description: line.description }),
      suggested_account_id: accountId,
      suggested_description: line.description,
      duplicate_of_transaction_id: duplicate?.id ?? null,
      duplicate_reason: duplicate?.reason ?? null,
    };
  });

  if (rows.length > 0) {
    const { error: linesError } = await (supabase as any).from('statement_lines').insert(rows);
    if (linesError) throw linesError;
  }

  return importRow as StatementImport;
}

/** Chama a IA para sugerir conta/categoria/subcategoria/descrição e grava nas linhas. */
export async function suggestForLines(params: {
  companyId: string;
  lines: StatementLine[];
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: string; subcategories?: { id: string; name: string }[] }[];
  defaultAccountId: string | null;
}) {
  const { companyId, lines, accounts, categories, defaultAccountId } = params;
  if (lines.length === 0) return;

  const { data: history } = await supabase
    .from('transactions')
    .select('description, category_id, subcategory_id, account_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200);

  const validAccounts = new Set(accounts.map((a) => a.id));
  const validCategories = new Set(categories.map((c) => c.id));
  const validSubcategories = new Set(categories.flatMap((c) => (c.subcategories || []).map((s) => s.id)));
  const subToCategory = new Map<string, string>();
  categories.forEach((c) => (c.subcategories || []).forEach((s) => subToCategory.set(s.id, c.id)));

  const chunkSize = 40;
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    const result = await callParser({
      action: 'suggest',
      defaultAccountId,
      accounts,
      categories,
      history: history || [],
      lines: chunk.map((l) => ({
        line_index: l.line_index,
        date: l.date,
        amount: l.amount,
        type: l.type,
        raw_description: l.raw_description,
      })),
    });

    const suggestions: any[] = result?.suggestions || [];
    await Promise.all(
      chunk.map(async (line) => {
        const suggestion = suggestions.find((s) => Number(s.line_index) === line.line_index);
        if (!suggestion) return;
        let categoryId = suggestion.category_id && validCategories.has(suggestion.category_id) ? suggestion.category_id : null;
        const subcategoryId = suggestion.subcategory_id && validSubcategories.has(suggestion.subcategory_id) ? suggestion.subcategory_id : null;
        if (subcategoryId && !categoryId) categoryId = subToCategory.get(subcategoryId) ?? null;
        const accountId = suggestion.account_id && validAccounts.has(suggestion.account_id) ? suggestion.account_id : defaultAccountId;

        await (supabase as any)
          .from('statement_lines')
          .update({
            suggested_account_id: accountId,
            suggested_category_id: categoryId,
            suggested_subcategory_id: subcategoryId,
            suggested_description: suggestion.description || line.raw_description,
            suggestion_source: 'ai',
            suggestion_confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : null,
          })
          .eq('id', line.id);
      })
    );
  }
}

/** Efetiva uma linha criando uma transação. */
export async function reconcileLineAsTransaction(line: StatementLine, override?: Partial<StatementLine>) {
  const merged = { ...line, ...override };
  if (!merged.suggested_account_id) throw new Error('Selecione a conta antes de efetivar');

  const { data: { user } } = await supabase.auth.getUser();
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      company_id: merged.company_id,
      account_id: merged.suggested_account_id,
      type: merged.type,
      amount: merged.amount,
      description: merged.suggested_description || merged.raw_description,
      date: merged.date,
      category_id: merged.suggested_category_id,
      subcategory_id: merged.suggested_subcategory_id,
      notes: 'Importado do extrato bancário',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  if ((merged.tag_ids || []).length > 0) {
    try { await setEntityTags('transaction', transaction.id, merged.tag_ids as string[]); } catch { /* tags são acessórias */ }
  }


  const { error: updateError } = await (supabase as any)
    .from('statement_lines')
    .update({
      status: 'reconciled',
      transaction_id: transaction.id,
      reconciled_at: new Date().toISOString(),
      reconciled_by: user?.id ?? null,
    })
    .eq('id', merged.id);
  if (updateError) throw updateError;
  return transaction.id;
}

/** Efetiva uma linha dando baixa em um título de Contas a Pagar/Receber. */
export async function reconcileLineAsSettlement(line: StatementLine, payableId: string, accountId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: record, error: fetchError } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('id', payableId)
    .single();
  if (fetchError) throw fetchError;

  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .insert({
      company_id: record.company_id,
      account_id: accountId,
      type: record.type === 'receivable' ? 'income' : 'expense',
      amount: line.amount,
      description: record.description,
      date: line.date,
      category_id: record.category_id,
      subcategory_id: record.subcategory_id,
      notes: 'Baixa por conciliação de extrato',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();
  if (transactionError) throw transactionError;

  if ((line.tag_ids || []).length > 0) {
    try { await setEntityTags('transaction', transaction.id, line.tag_ids as string[]); } catch { /* tags são acessórias */ }
    try { await setEntityTags('payable_receivable', payableId, line.tag_ids as string[]); } catch { /* tags são acessórias */ }
  }


  const { error: prError } = await supabase
    .from('payables_receivables')
    .update({
      status: 'paid',
      paid_amount: line.amount,
      paid_date: line.date,
      paid_account_id: accountId,
      transaction_id: transaction.id,
      paid_by: user?.id ?? null,
      is_amount_pending: false,
      ...(record.is_amount_pending ? { amount: line.amount } : {}),
    })
    .eq('id', payableId);
  if (prError) throw prError;

  const { error: updateError } = await (supabase as any)
    .from('statement_lines')
    .update({
      status: 'reconciled',
      transaction_id: transaction.id,
      payable_receivable_id: payableId,
      reconciled_at: new Date().toISOString(),
      reconciled_by: user?.id ?? null,
    })
    .eq('id', line.id);
  if (updateError) throw updateError;
}

export async function updateStatementLine(id: string, patch: Partial<StatementLine>) {
  const { error } = await (supabase as any).from('statement_lines').update(patch).eq('id', id);
  if (error) throw error;
}

export async function setImportStatus(importId: string, status: StatementImportStatus) {
  await (supabase as any).from('statement_imports').update({ status }).eq('id', importId);
}

/** Encerra a conciliação marcando a importação como done e, opcionalmente, ignorando linhas pendentes restantes. */
export async function finishReconciliation(importId: string, lineIdsToIgnore?: string[]) {
  if (lineIdsToIgnore && lineIdsToIgnore.length > 0) {
    const { error } = await (supabase as any)
      .from('statement_lines')
      .update({ status: 'ignored' })
      .in('id', lineIdsToIgnore);
    if (error) throw error;
  }

  const { error } = await (supabase as any)
    .from('statement_imports')
    .update({ status: 'done' })
    .eq('id', importId);
  if (error) throw error;
}

/** Cria uma transação de ajuste de arredondamento para equalizar pequenas diferenças de saldo na conciliação. */
export async function createReconciliationAdjustment(params: {
  companyId: string;
  accountId: string;
  amount: number;
  date: string;
  importId: string;
  description?: string;
}) {
  const { companyId, accountId, amount, date, importId, description } = params;
  const { data: { user } } = await supabase.auth.getUser();

  const type = amount >= 0 ? 'income' : 'expense';
  const absAmount = Number(Math.abs(amount).toFixed(2));

  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      company_id: companyId,
      account_id: accountId,
      type,
      amount: absAmount,
      description: description || 'Ajuste de arredondamento - conciliação',
      date,
      notes: `Ajuste gerado pela conciliação ${importId}`,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  return transaction.id as string;
}

/* ============================ Comprovantes ============================ */

export interface ReceiptAnalysis {
  details: string;
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  tag_ids: string[];
  amount: number | null;
  date: string | null;
  type: 'income' | 'expense' | null;
  confidence: number | null;
}

interface ReceiptContext {
  categories: { id: string; name: string; type: string; subcategories?: { id: string; name: string }[] }[];
  tags: { id: string; name: string }[];
}

async function readReceipt(file: File) {
  const format = detectFormat(file.name);
  const isImage = (file.type || '').startsWith('image/');
  if (!isImage && format !== 'pdf') {
    return { text: await file.text(), fileBase64: null as string | null, mimeType: file.type || 'text/plain' };
  }
  return {
    text: null as string | null,
    fileBase64: await fileToBase64(file),
    mimeType: file.type || (isImage ? 'image/jpeg' : 'application/pdf'),
  };
}

function sanitizeAnalysis(raw: any, ctx: ReceiptContext, fallbackDescription: string): ReceiptAnalysis {
  const validCategories = new Set(ctx.categories.map((c) => c.id));
  const validSubcategories = new Set(ctx.categories.flatMap((c) => (c.subcategories || []).map((s) => s.id)));
  const subToCategory = new Map<string, string>();
  ctx.categories.forEach((c) => (c.subcategories || []).forEach((s) => subToCategory.set(s.id, c.id)));
  const validTags = new Set(ctx.tags.map((t) => t.id));

  let categoryId = raw?.category_id && validCategories.has(raw.category_id) ? raw.category_id : null;
  const subcategoryId = raw?.subcategory_id && validSubcategories.has(raw.subcategory_id) ? raw.subcategory_id : null;
  if (subcategoryId && !categoryId) categoryId = subToCategory.get(subcategoryId) ?? null;

  const amount = raw?.amount === null || raw?.amount === undefined ? null : Math.abs(Number(raw.amount)) || null;
  const date = raw?.date ? toIsoDate(String(raw.date)) : null;

  return {
    details: String(raw?.details || '').trim(),
    description: String(raw?.description || fallbackDescription).trim(),
    category_id: categoryId,
    subcategory_id: subcategoryId,
    tag_ids: (raw?.tag_ids || []).filter((id: string) => validTags.has(id)),
    amount,
    date,
    type: raw?.type === 'income' ? 'income' : raw?.type === 'expense' ? 'expense' : null,
    confidence: typeof raw?.confidence === 'number' ? raw.confidence : null,
  };
}

/** Envia o comprovante ao cofre e devolve o caminho salvo. */
export async function uploadReceiptFile(companyId: string, file: File, prefix: string) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${companyId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function getReceiptUrl(path: string) {
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Anexa um comprovante a uma linha do extrato, lê os detalhes com IA e atualiza as sugestões. */
export async function attachReceiptToLine(line: StatementLine, file: File, ctx: ReceiptContext) {
  const path = await uploadReceiptFile(line.company_id, file, `line-${line.id}`);
  const read = await readReceipt(file);

  const raw = await callParser({
    action: 'receipt',
    fileName: file.name,
    mimeType: read.mimeType,
    fileBase64: read.fileBase64,
    text: read.text,
    line: { date: line.date, amount: line.amount, type: line.type, raw_description: line.raw_description },
    categories: ctx.categories,
    tags: ctx.tags,
  });

  const analysis = sanitizeAnalysis(raw, ctx, line.suggested_description || line.raw_description);

  await updateStatementLine(line.id, {
    receipt_path: path,
    receipt_name: file.name,
    receipt_details: analysis.details || null,
    suggested_description: analysis.description || line.suggested_description,
    suggested_category_id: analysis.category_id ?? line.suggested_category_id,
    suggested_subcategory_id: analysis.subcategory_id ?? line.suggested_subcategory_id,
    tag_ids: analysis.tag_ids.length > 0 ? analysis.tag_ids : (line.tag_ids || []),
    suggestion_source: 'receipt',
    suggestion_confidence: analysis.confidence,
  } as Partial<StatementLine>);

  return analysis;
}

/** Cria uma conciliação a partir de comprovantes soltos (sem extrato). */
export async function createReceiptsImport(params: {
  companyId: string;
  accountId: string | null;
  files: File[];
  ctx: ReceiptContext;
}) {
  const { companyId, accountId, files, ctx } = params;
  const { data: { user } } = await supabase.auth.getUser();

  const analyses: { file: File; path: string; analysis: ReceiptAnalysis }[] = [];
  for (const file of files) {
    const path = await uploadReceiptFile(companyId, file, 'receipt');
    const read = await readReceipt(file);
    const raw = await callParser({
      action: 'receipt',
      fileName: file.name,
      mimeType: read.mimeType,
      fileBase64: read.fileBase64,
      text: read.text,
      categories: ctx.categories,
      tags: ctx.tags,
    });
    analyses.push({ file, path, analysis: sanitizeAnalysis(raw, ctx, file.name) });
  }

  const usable = analyses.filter((a) => a.analysis.amount && a.analysis.date);
  if (usable.length === 0) throw new Error('Não foi possível identificar valor e data nos comprovantes enviados');

  const dates = usable.map((a) => a.analysis.date!).sort();

  const { data: importRow, error: importError } = await (supabase as any)
    .from('statement_imports')
    .insert({
      company_id: companyId,
      account_id: accountId,
      file_name: usable.length === 1 ? usable[0].file.name : `${usable.length} comprovantes`,
      file_format: 'receipt',
      period_start: dates[0],
      period_end: dates[dates.length - 1],
      notes: 'Importação por comprovantes',
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();
  if (importError) throw importError;

  const rows = usable.map((item, index) => {
    const a = item.analysis;
    const type = a.type || 'expense';
    return {
      import_id: importRow.id,
      company_id: companyId,
      line_index: index,
      date: a.date,
      raw_description: a.details || a.description || item.file.name,
      amount: a.amount,
      type,
      fingerprint: buildFingerprint({ date: a.date!, amount: a.amount!, type, description: a.description }),
      suggested_account_id: accountId,
      suggested_category_id: a.category_id,
      suggested_subcategory_id: a.subcategory_id,
      suggested_description: a.description,
      suggestion_source: 'receipt',
      suggestion_confidence: a.confidence,
      receipt_path: item.path,
      receipt_name: item.file.name,
      receipt_details: a.details || null,
      tag_ids: a.tag_ids,
    };
  });

  const { error: linesError } = await (supabase as any).from('statement_lines').insert(rows);
  if (linesError) throw linesError;

  return { importRow: importRow as StatementImport, skipped: analyses.length - usable.length };
}
