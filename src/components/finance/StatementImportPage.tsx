import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload, RefreshCw, Sparkles, CheckCircle2, Trash2, AlertTriangle, FileSpreadsheet,
  Copy, Ban, Link2, ChevronLeft, Paperclip, ExternalLink, Receipt, Plus, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { usePayablesReceivables } from '@/hooks/usePayablesReceivables';
import { useFinanceTags } from '@/hooks/useFinanceTags';
import { usePermissions } from '@/hooks/usePermissions';
import { TagPicker } from '@/components/finance/TagPicker';
import { parseLocalDate } from '@/lib/dateUtils';
import { findStatementBalanceMatch } from '@/lib/statementBalanceMatch';
import {
  useStatementImports, useStatementLines, parseStatementFile, createStatementImport,
  suggestForLines, reconcileLineAsTransaction,
  linkLineToExistingTransaction, getAccountBalanceAt, reconcileLineAsSettlement, updateStatementLine,
  setImportStatus, finishReconciliation, createReconciliationAdjustment, detectFormat, StatementLine,
  DuplicateLineError,
  attachReceiptToLine, createReceiptsImport, getReceiptUrl,
} from '@/hooks/useStatementImport';

interface Props {
  companyId: string;
}

const currency = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const fmtDate = (value?: string | null) => (value ? format(parseLocalDate(value), 'dd/MM/yyyy') : '—');

/** Grau de confiança da sugestão da IA para um campo específico da linha. */
function ConfBadge({
  confidence,
  filled,
  manual,
}: { confidence: number | null; filled: boolean; manual?: boolean }) {
  if (manual) return <span className="text-[10px] text-muted-foreground">ajuste manual</span>;
  if (!filled) return <span className="text-[10px] text-muted-foreground">sem sugestão</span>;
  if (confidence === null || confidence === undefined) return null;
  const pct = Math.round(confidence * 100);
  const tone = pct >= 85 ? 'text-primary' : pct >= 60 ? 'text-amber-600' : 'text-destructive';
  const label = pct >= 85 ? 'alta' : pct >= 60 ? 'média' : 'baixa';
  return <span className={`text-[10px] ${tone}`}>IA {pct}% · confiança {label}</span>;
}



export function StatementImportPage({ companyId }: Props) {
  const { accounts, refetch: refetchAccounts } = useAccounts(companyId);
  const { categories, createCategory, createSubcategory } = useTransactionCategories(companyId);
  const { can } = usePermissions();
  const { payablesReceivables } = usePayablesReceivables(companyId, { status: ['pending'] });
  const { tags } = useFinanceTags(companyId);
  const { imports, loading: importsLoading, refetch: refetchImports, deleteImport } = useStatementImports(companyId);

  const storageKey = `statement_import_selected_${companyId}`;
  const [selectedImportId, setSelectedImportId] = useState<string | null>(() => {
    try { return localStorage.getItem(`statement_import_selected_${companyId}`); } catch { return null; }
  });
  const { lines, loading: linesLoading, refetch: refetchLines, replaceLines } = useStatementLines(selectedImportId);

  const selectImport = (importId: string | null) => {
    try {
      if (importId) localStorage.setItem(storageKey, importId);
      else localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
    setSelectedImportId(importId);
  };

  useEffect(() => {
    try {
      if (selectedImportId) localStorage.setItem(storageKey, selectedImportId);
      else localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
  }, [selectedImportId, storageKey]);


  const [accountId, setAccountId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [settleLine, setSettleLine] = useState<StatementLine | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const receiptsRef = useRef<HTMLInputElement>(null);
  const lineReceiptRef = useRef<HTMLInputElement>(null);
  const [receiptTargetLine, setReceiptTargetLine] = useState<StatementLine | null>(null);
  const [detailsLine, setDetailsLine] = useState<StatementLine | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [ignoreRemaining, setIgnoreRemaining] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [confirmDup, setConfirmDup] = useState<{ line: StatementLine; reason: string } | null>(null);
  const [descriptionLine, setDescriptionLine] = useState<StatementLine | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [catalogTarget, setCatalogTarget] = useState<{ line: StatementLine; kind: 'category' | 'subcategory' } | null>(null);
  const [catalogName, setCatalogName] = useState('');
  const [catalogType, setCatalogType] = useState<'income' | 'expense' | 'both'>('expense');
  const [savingCatalog, setSavingCatalog] = useState(false);

  const currentImport = imports.find((i) => i.id === selectedImportId) || null;

  const categoriesPayload = useMemo(
    () => categories.map((c) => ({ id: c.id, name: c.name, type: c.type, subcategories: c.subcategories || [] })),
    [categories]
  );
  const accountsPayload = useMemo(() => accounts.map((a) => ({ id: a.id, name: a.name })), [accounts]);
  const tagsPayload = useMemo(() => tags.map((t) => ({ id: t.id, name: t.name })), [tags]);
  const receiptCtx = useMemo(() => ({ categories: categoriesPayload, tags: tagsPayload }), [categoriesPayload, tagsPayload]);

  const openReceiptPicker = (line: StatementLine) => {
    setReceiptTargetLine(line);
    setTimeout(() => lineReceiptRef.current?.click(), 0);
  };

  const handleLineReceipt = async (file: File) => {
    const line = receiptTargetLine;
    if (!line) return;
    setBusyLine(line.id);
    try {
      await attachReceiptToLine(line, file, receiptCtx);
      await refetchLines();
      toast.success('Comprovante anexado e sugestões atualizadas');
    } catch (error) {
      toast.error('Erro ao anexar comprovante: ' + ((error as Error).message || 'desconhecido'));
    } finally {
      setBusyLine(null);
      setReceiptTargetLine(null);
      if (lineReceiptRef.current) lineReceiptRef.current.value = '';
    }
  };

  const openReceipt = async (path: string) => {
    try {
      const url = await getReceiptUrl(path);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      toast.error('Erro ao abrir comprovante: ' + (error as Error).message);
    }
  };

  const handleReceiptsUpload = async (files: File[]) => {
    setUploading(true);
    try {
      const { importRow, skipped } = await createReceiptsImport({
        companyId,
        accountId: accountId || null,
        files,
        ctx: receiptCtx,
      });
      await refetchImports();
      selectImport(importRow.id);
      toast.success(
        `Comprovantes lidos com sucesso${skipped ? ` (${skipped} sem valor/data identificados foram ignorados)` : ''}`
      );
    } catch (error) {
      toast.error('Erro ao ler comprovantes: ' + ((error as Error).message || 'desconhecido'));
    } finally {
      setUploading(false);
      if (receiptsRef.current) receiptsRef.current.value = '';
    }
  };


  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { format: fileFormat, parsed } = await parseStatementFile(file);
      if (parsed.lines.length === 0) {
        toast.error('Nenhum lançamento foi identificado neste arquivo.');
        return;
      }
      const created = await createStatementImport({
        companyId,
        accountId: accountId || null,
        fileName: file.name,
        format: fileFormat,
        parsed,
        accounts: accountsPayload,
        categories: categoriesPayload,
      });
      toast.success(`${parsed.lines.length} lançamentos importados. Gerando sugestões...`);
      await refetchImports();
      selectImport(created.id);

      const { data } = await (await import('@/integrations/supabase/client')).supabase
        .from('statement_lines' as never)
        .select('*')
        .eq('import_id', created.id)
        .order('line_index');
      const freshLines = (data || []) as unknown as StatementLine[];
      await suggestForLines({
        companyId,
        lines: freshLines,
        accounts: accountsPayload,
        categories: categoriesPayload,
        defaultAccountId: accountId || null,
      });
      const { data: suggestedLines, error: suggestedError } = await (await import('@/integrations/supabase/client')).supabase
        .from('statement_lines').select('*').eq('company_id', companyId).eq('import_id', created.id).order('line_index');
      if (suggestedError) throw suggestedError;
      replaceLines(created.id, (suggestedLines || []) as StatementLine[]);
      const sourceAccount = accounts.find(a => a.id === created.account_id);
      const match = findStatementBalanceMatch({
        lines: (suggestedLines || []) as StatementLine[],
        openingBalance: created.opening_balance,
        closingBalance: created.closing_balance,
        accountBalance: sourceAccount ? await getAccountBalanceAt(sourceAccount.id, sourceAccount.current_balance, created.period_end ?? null) : null,
        accountId: created.account_id,
      });
      setSelected(Object.fromEntries((match?.lineIds || []).map(id => [id, true])));
      toast.success(match?.lineIds.length ? `${match.lineIds.length} lançamentos sugeridos para fechar o saldo final` : 'Sugestões geradas pela IA');
    } catch (error) {
      toast.error('Erro ao importar extrato: ' + ((error as Error).message || 'desconhecido'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleResuggest = async () => {
    if (!currentImport) return;
    setSuggesting(true);
    try {
      await suggestForLines({
        companyId,
        lines: lines.filter((l) => l.status === 'pending'),
        accounts: accountsPayload,
        categories: categoriesPayload,
        defaultAccountId: currentImport.account_id,
      });
      await refetchLines();
      toast.success('Sugestões atualizadas');
    } catch (error) {
      toast.error('Erro nas sugestões: ' + (error as Error).message);
    } finally {
      setSuggesting(false);
    }
  };

  const patchLine = async (line: StatementLine, patch: Partial<StatementLine>) => {
    try {
      await updateStatementLine(line.id, { ...patch, suggestion_source: 'manual' });
      await refetchLines();
      return true;
    } catch (error) {
      toast.error('Erro ao salvar linha: ' + (error as Error).message);
      return false;
    }
  };

  const openCatalog = (line: StatementLine, kind: 'category' | 'subcategory') => {
    setCatalogTarget({ line, kind });
    setCatalogName('');
    setCatalogType(line.type);
  };

  const saveCatalog = async () => {
    if (!catalogTarget || !catalogName.trim() || !can('registry.categories')) return;
    setSavingCatalog(true);
    try {
      const { line, kind } = catalogTarget;
      if (kind === 'category') {
        const created = await createCategory({ name: catalogName.trim(), type: catalogType });
        if (!created) return;
        await patchLine(line, { suggested_category_id: created.id, suggested_subcategory_id: null });
      } else {
        if (!line.suggested_category_id) return;
        const created = await createSubcategory(line.suggested_category_id, catalogName.trim());
        if (!created) return;
        await patchLine(line, { suggested_category_id: created.category_id, suggested_subcategory_id: created.id });
      }
      setCatalogTarget(null);
    } finally {
      setSavingCatalog(false);
    }
  };

  const saveDescription = async () => {
    if (!descriptionLine || !descriptionDraft.trim()) return;
    setSavingDescription(true);
    try {
      if (await patchLine(descriptionLine, { suggested_description: descriptionDraft.trim() })) {
        setDescriptionLine(null);
        toast.success('Descrição salva');
      }
    } finally {
      setSavingDescription(false);
    }
  };

  /** Após efetivar, reconfere o saldo real da conta contra o saldo final do extrato. */
  const recheckBalance = async () => {
    await refetchAccounts();
    if (!currentImport?.account_id || currentImport.closing_balance === null || currentImport.closing_balance === undefined) return;
    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase
      .from('accounts')
      .select('current_balance')
      .eq('id', currentImport.account_id)
      .maybeSingle();
    if (data?.current_balance === null || data?.current_balance === undefined) return;
    const balance = await getAccountBalanceAt(currentImport.account_id, Number(data.current_balance), currentImport.period_end ?? null);
    setAppBalance(balance);
    const diff = Number((Number(currentImport.closing_balance) - Number(balance)).toFixed(2));
    if (Math.abs(diff) < 0.01) {
      toast.success('Saldo do app já está igual ao do extrato. Você pode encerrar a conciliação.');
    } else {
      toast.warning(`Ainda há diferença de ${currency(diff)} entre o saldo do app e o extrato.`);
    }
  };

  const effectivate = async (line: StatementLine, confirmDuplicate = false) => {
    setBusyLine(line.id);
    try {
      await reconcileLineAsTransaction(line, undefined, { confirmDuplicate });
      await refetchLines();
      toast.success('Linha conciliada');
      await recheckBalance();
    } catch (error) {
      if (error instanceof DuplicateLineError) {
        await refetchLines();
        setConfirmDup({ line, reason: error.message });
      } else {
        toast.error('Erro ao efetivar: ' + (error as Error).message);
      }
    } finally {
      setBusyLine(null);
    }
  };

  const [linking, setLinking] = useState(false);
  const linkAlreadyInApp = async (ids: string[]) => {
    setLinking(true);
    try {
      for (const line of lines.filter(l => ids.includes(l.id))) await linkLineToExistingTransaction(line);
      await refetchLines();
      toast.success(`${ids.length} linha(s) vinculada(s) aos lançamentos que já existem no app`);
    } catch (error) {
      toast.error('Erro ao vincular: ' + (error as Error).message);
    } finally { setLinking(false); }
  };

  const ignoreLine = async (line: StatementLine) => {
    setBusyLine(line.id);
    try {
      await updateStatementLine(line.id, { status: 'ignored' });
      await refetchLines();
    } finally {
      setBusyLine(null);
    }
  };

  const effectivateSelected = async () => {
    const targets = lines.filter((l) => selected[l.id] && l.status === 'pending');
    if (targets.length === 0) {
      toast.error('Selecione ao menos uma linha pendente');
      return;
    }
    let ok = 0;
    let failed = 0;
    let blocked = 0;
    // Lines in the verified balance block are proven missing from the account.
    const verified = new Set(balanceMatch?.flaggedDuplicateIds || []);
    for (const line of targets) {
      try {
        await reconcileLineAsTransaction(line, undefined, { confirmDuplicate: verified.has(line.id) });
        ok += 1;
      } catch (error) {
        if (error instanceof DuplicateLineError) blocked += 1;
        else failed += 1;
      }
    }
    setSelected({});
    await refetchLines();
    const extra = [
      blocked ? `${blocked} bloqueada(s) por duplicidade` : '',
      failed ? `${failed} com erro` : '',
    ].filter(Boolean).join(', ');
    toast[blocked || failed ? 'warning' : 'success'](`${ok} linha(s) conciliada(s)${extra ? `, ${extra}` : ''}`);
    if (blocked) {
      toast.warning('Linhas marcadas como duplicidade não foram efetivadas: elas já existem no app e já contam no saldo. Use "Vincular já existentes".');
    }
    await recheckBalance();
  };


  const handleFinishReconciliation = async () => {
    if (!currentImport) return;
    const remainingPending = lines.filter((l) => l.status === 'pending').map((l) => l.id);
    if (!ignoreRemaining && remainingPending.length > 0) {
      toast.error('Existem linhas pendentes. Marque a opção para ignorá-las ou efetive-as antes de encerrar.');
      return;
    }
    setFinishing(true);
    try {
      await finishReconciliation(currentImport.id, ignoreRemaining ? remainingPending : undefined);
      await refetchLines();
      await refetchImports();
      setFinishOpen(false);
      selectImport(null);
      toast.success('Conciliação encerrada com sucesso');
    } catch (error) {
      toast.error('Erro ao encerrar conciliação: ' + (error as Error).message);
    } finally {
      setFinishing(false);
    }
  };

  const handleCreateAdjustment = async () => {
    if (!currentImport?.account_id || appBalanceDiff === null || !withinTolerance) return;
    setAdjusting(true);
    try {
      await createReconciliationAdjustment({
        companyId,
        accountId: currentImport.account_id,
        amount: appBalanceDiff,
        date: currentImport.period_end || currentImport.period_start || new Date().toISOString().slice(0, 10),
        importId: currentImport.id,
      });
      await refetchLines();
      await refetchImports();
      toast.success('Ajuste de arredondamento criado com sucesso');
    } catch (error) {
      toast.error('Erro ao criar ajuste: ' + (error as Error).message);
    } finally {
      setAdjusting(false);
    }
  };

  const pending = lines.filter((l) => l.status === 'pending').length;
  const reconciled = lines.filter((l) => l.status === 'reconciled').length;
  const duplicates = lines.filter((l) => l.duplicate_of_transaction_id && l.status === 'pending').length;

  // Situação real da importação: marcar "Conciliado" quando não há pendentes ou quando o usuário encerrou manualmente.
  const derivedStatus: 'pending' | 'partial' | 'done' | null =
    linesLoading || lines.length === 0
      ? null
      : currentImport?.status === 'done'
        ? 'done'
        : pending === 0
          ? 'done'
          : pending === lines.length
            ? 'pending'
            : 'partial';

  useEffect(() => {
    if (finishing) return;
    if (!currentImport || !derivedStatus) return;
    if (currentImport.status === derivedStatus) return;
    (async () => {
      await setImportStatus(currentImport.id, derivedStatus);
      await refetchImports();
    })();
  }, [currentImport?.id, currentImport?.status, derivedStatus, refetchImports, finishing]);


  const sumSigned = lines.reduce((s, l) => s + (l.type === 'income' ? l.amount : -l.amount), 0);
  const computed = currentImport?.opening_balance !== null && currentImport?.opening_balance !== undefined
    ? Number((currentImport.opening_balance + sumSigned).toFixed(2))
    : null;
  const informedClosing = currentImport?.closing_balance ?? null;
  const balanceDiff = computed !== null && informedClosing !== null ? Number((informedClosing - computed).toFixed(2)) : null;

  const appAccount = currentImport?.account_id ? accounts.find((a) => a.id === currentImport.account_id) : null;
  const [appBalance, setAppBalance] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    if (!appAccount) { setAppBalance(null); return; }
    // Compare with the account balance on the statement's last day, not today's balance.
    getAccountBalanceAt(appAccount.id, appAccount.current_balance, currentImport?.period_end ?? null)
      .then(v => { if (alive) setAppBalance(v); })
      .catch(() => { if (alive) setAppBalance(null); });
    return () => { alive = false; };
  }, [appAccount?.id, appAccount?.current_balance, currentImport?.period_end, lines.filter(l => l.status !== 'pending').length]);
  const appBalanceDiff = informedClosing !== null && appBalance !== null ? Number((informedClosing - appBalance).toFixed(2)) : null;
  const tolerance = appAccount?.reconciliation_tolerance ?? 0;
  const withinTolerance = appBalanceDiff !== null && Math.abs(appBalanceDiff) <= Math.max(tolerance, 0.01);

  const balanceMatch = useMemo(() => findStatementBalanceMatch({
    lines,
    openingBalance: currentImport?.opening_balance ?? null,
    closingBalance: informedClosing,
    accountBalance: appBalance,
    accountId: currentImport?.account_id ?? null,
  }), [lines, currentImport?.opening_balance, informedClosing, appBalance, currentImport?.account_id]);


  // Continuidade da linha do tempo: procura buracos entre importações da mesma conta
  const timelineGap = useMemo(() => {
    if (!currentImport?.account_id || !currentImport.period_start) return null;
    const previous = imports
      .filter((i) => i.id !== currentImport.id && i.account_id === currentImport.account_id && i.period_end)
      .sort((a, b) => (b.period_end || '').localeCompare(a.period_end || ''))
      .find((i) => (i.period_end || '') < currentImport.period_start!);
    if (!previous) return null;
    const prevEnd = parseLocalDate(previous.period_end);
    const thisStart = parseLocalDate(currentImport.period_start);
    const days = Math.round((thisStart.getTime() - prevEnd.getTime()) / 86400000);
    if (days <= 1) return null;
    return { from: previous.period_end!, to: currentImport.period_start!, days };
  }, [imports, currentImport]);

  const settleCandidates = useMemo(() => {
    if (!settleLine) return [];
    return payablesReceivables
      .filter((p) => (settleLine.type === 'income' ? p.type === 'receivable' : p.type === 'payable'))
      .map((p) => {
        const amountDiff = p.amount === null ? 999999 : Math.abs(p.amount - settleLine.amount);
        const dayDiff = Math.abs(
          (parseLocalDate(p.due_date).getTime() - parseLocalDate(settleLine.date).getTime()) / 86400000
        );
        return { record: p, score: amountDiff * 10 + dayDiff };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 25);
  }, [settleLine, payablesReceivables]);

  const subcategoriesOf = (categoryId: string | null) =>
    categories.find((c) => c.id === categoryId)?.subcategories || [];

  if (!selectedImportId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Importar Extrato Bancário</h1>
            <p className="text-sm text-muted-foreground">
              Leitura inteligente de CSV, Excel, OFX e PDF com sugestão automática de conta, categoria e descrição
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Novo extrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Conta do extrato</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(mirrorFree => !mirrorFree.is_mirror).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Arquivo do extrato</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,.xls,.xlsx,.ofx,.ofc,.pdf"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!accountId) {
                      toast.error('Selecione a conta antes de enviar o arquivo');
                      if (fileRef.current) fileRef.current.value = '';
                      return;
                    }
                    handleUpload(file);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: CSV, Excel (XLSX/XLS), OFX/OFC e PDF.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" /> Comprovantes (sem extrato)
                </Label>
                <Input
                  ref={receiptsRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt"
                  disabled={uploading}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    if (!accountId) {
                      toast.error('Selecione a conta antes de enviar os comprovantes');
                      if (receiptsRef.current) receiptsRef.current.value = '';
                      return;
                    }
                    handleReceiptsUpload(files);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Envie PIX, TED, boletos ou notas (imagem ou PDF). A IA lê os detalhes do comprovante e sugere
                  categoria, subcategoria, descrição e tags com muito mais precisão.
                </p>
              </div>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" /> Lendo o extrato e gerando sugestões...
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Importações</CardTitle>
            <Button variant="outline" size="sm" onClick={refetchImports}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Saldo final</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {importsLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : imports.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum extrato importado ainda</TableCell></TableRow>
                  ) : imports.map((imp) => (
                  <TableRow key={imp.id} className="cursor-pointer" onClick={() => selectImport(imp.id)}>
                    <TableCell className="font-medium">
                      {imp.file_name}
                      <span className="ml-2 text-xs text-muted-foreground uppercase">{imp.file_format}</span>
                    </TableCell>
                    <TableCell className="text-sm">{accounts.find((a) => a.id === imp.account_id)?.name || '—'}</TableCell>
                    <TableCell className="text-sm">{fmtDate(imp.period_start)} → {fmtDate(imp.period_end)}</TableCell>
                    <TableCell className="text-right text-sm">{currency(imp.closing_balance)}</TableCell>
                    <TableCell>
                      <Badge variant={imp.status === 'done' ? 'default' : 'outline'}>
                        {imp.status === 'done' ? 'Conciliado' : imp.status === 'partial' ? 'Parcial' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteImport(imp.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" disabled={uploading} onClick={() => { selectImport(null); setSelected({}); }}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{currentImport?.file_name}</h1>
            <p className="text-sm text-muted-foreground">
              {currentImport?.bank_name ? `${currentImport.bank_name} · ` : ''}
              {fmtDate(currentImport?.period_start)} → {fmtDate(currentImport?.period_end)} · {lines.length} lançamentos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResuggest} disabled={suggesting || uploading}>
            <Sparkles className={`w-4 h-4 mr-2 ${suggesting ? 'animate-pulse' : ''}`} /> Sugerir com IA
          </Button>
          <Button size="sm" onClick={effectivateSelected}>
            <CheckCircle2 className="w-4 h-4 mr-2" /> Efetivar selecionadas
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold">{pending}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Conciliadas</p>
          <p className="text-2xl font-bold text-primary">{reconciled}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Possíveis duplicidades</p>
          <p className="text-2xl font-bold text-destructive">{duplicates}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Saldo final do extrato</p>
          <p className="text-2xl font-bold">{currency(informedClosing)}</p>
        </CardContent></Card>
      </div>

      {currentImport?.account_id && !linesLoading && appBalance !== null && informedClosing !== null && (
        <Alert>
          {balanceMatch ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <AlertTitle>{balanceMatch ? 'Ponto de conciliação encontrado' : 'O saldo final ainda não bate'}</AlertTitle>
          <AlertDescription className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="space-y-2 flex-1">
              {balanceMatch ? <>
                <p>
                  Saldo da conta no app em {fmtDate(currentImport.period_end || '')}: {currency(appBalance)} · Saldo final do extrato: {currency(balanceMatch.projectedBalance)} · Falta: {currency(balanceMatch.movement)}.
                </p>
                {balanceMatch.mode === 'checkpoint' && (
                  <p className="text-muted-foreground">O saldo da conta é igual ao do extrato{balanceMatch.checkpointDate ? ` em ${fmtDate(balanceMatch.checkpointDate)}` : ' no início do extrato'}.</p>
                )}
                {balanceMatch.alreadyInAppIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>{balanceMatch.alreadyInAppIds.length} linha(s) "Duplicidade?" já estão no app e já contam no saldo — <strong>não efetive</strong>, apenas vincule.</span>
                    <Button size="sm" variant="ghost" className="h-7" disabled={linking} onClick={() => linkAlreadyInApp(balanceMatch.alreadyInAppIds)}>
                      <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular já existentes
                    </Button>
                  </div>
                )}
                {balanceMatch.lineIds.length > 0 ? (
                  <p className="font-medium">
                    Só faltam no app estes {balanceMatch.lineIds.length} lançamento(s). Efetivando
                    {balanceMatch.firstDate ? ` (de ${fmtDate(balanceMatch.firstDate)} a ${fmtDate(balanceMatch.lastDate!)})` : ''},
                    total líquido de {currency(balanceMatch.movement)}, o saldo fica {currency(balanceMatch.projectedBalance)}, igual ao extrato.
                  </p>
                ) : <p className="font-medium">O saldo já bate com o extrato. Nada a efetivar.</p>}
                {balanceMatch.flaggedDuplicateIds.length > 0 && (
                  <p className="text-muted-foreground">
                    {balanceMatch.flaggedDuplicateIds.length} desses lançamento(s) estão marcados como "Duplicidade?", mas o saldo da conta mostra que
                    eles ainda não entraram nela — sem efetivá-los o saldo final não fecha. Confira se o lançamento parecido é de outra data/conta.
                  </p>
                )}
                {balanceMatch.lineIds.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded border bg-background">
                    <table className="w-full text-xs">
                      <tbody>
                        {lines.filter(l => balanceMatch.lineIds.includes(l.id)).map(l => (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="px-2 py-1 whitespace-nowrap">{fmtDate(l.date)}</td>
                            <td className="px-2 py-1">
                              {l.raw_description}
                              {l.duplicate_of_transaction_id && <Badge variant="outline" className="ml-2 text-[10px]">marcado como duplicidade</Badge>}
                            </td>
                            <td className={`px-2 py-1 text-right whitespace-nowrap ${l.type === 'income' ? 'text-primary' : 'text-destructive'}`}>
                              {l.type === 'income' ? '+' : '-'}{currency(l.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </> : (() => {
                const pendingLines = lines.filter(l => l.status === 'pending');
                const allInApp = pendingLines.length > 0 && pendingLines.every(l => l.duplicate_of_transaction_id);
                const diff = Number(((informedClosing ?? 0) - (appBalance ?? 0)).toFixed(2));
                return <>
                  <p>Saldo da conta no app em {fmtDate(currentImport.period_end || '')}: {currency(appBalance)} · Saldo final do extrato: {currency(informedClosing)} · Diferença: {currency(diff)}.</p>
                  {allInApp ? (
                    <p className="font-medium">
                      Todos os lançamentos deste extrato já existem no app — não há nada a efetivar. Use "Vincular já existentes".
                      {Math.abs(diff) >= 0.01 && ` A diferença de ${currency(diff)} não vem destes lançamentos: ela já existia antes do período (confira o saldo inicial da conta ou gere um ajuste).`}
                    </p>
                  ) : <p>Nenhum grupo de lançamentos pendentes fecha essa diferença no centavo. Revise os lançamentos antes de conciliar.</p>}
                  {allInApp && (
                    <Button size="sm" variant="outline" disabled={linking} onClick={() => linkAlreadyInApp(pendingLines.map(l => l.id))}>
                      <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular já existentes ({pendingLines.length})
                    </Button>
                  )}
                </>;
              })()}
            </div>
            {!!balanceMatch?.lineIds.length && (
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => setSelected(Object.fromEntries(balanceMatch.lineIds.map(id => [id, true])))}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Selecionar estes lançamentos
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {appBalanceDiff !== null && Math.abs(appBalanceDiff) >= 0.01 && (
        <Alert variant={withinTolerance ? 'default' : 'destructive'}>
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>
            {withinTolerance ? 'Diferença dentro da tolerância' : 'Saldo do app diverge do extrato'}
          </AlertTitle>
          <AlertDescription className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <span>
              O saldo da conta <strong>{appAccount?.name}</strong> no app em {fmtDate(currentImport?.period_end || '')} é {currency(appBalance)}, mas o extrato
              importado informa saldo final de {currency(informedClosing)} (diferença de {currency(appBalanceDiff)}).{' '}
              {withinTolerance
                ? `A diferença está dentro da tolerância configurada (${currency(tolerance)}). Você pode gerar um ajuste de arredondamento ou encerrar a conciliação.`
                : balanceMatch?.lineIds.length ? 'Efetive o bloco de lançamentos indicado no aviso "Ponto de conciliação encontrado" para o saldo bater.' : 'É necessário efetivar os lançamentos pendentes para equalizar os saldos antes de encerrar a conciliação.'}
            </span>
            {withinTolerance && (
              <Button size="sm" variant="outline" onClick={handleCreateAdjustment} disabled={adjusting}>
                <RefreshCw className={`w-4 h-4 mr-2 ${adjusting ? 'animate-spin' : ''}`} />
                Gerar ajuste
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {balanceDiff !== null && Math.abs(balanceDiff) >= 0.01 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Saldo não fecha</AlertTitle>
          <AlertDescription>
            Saldo inicial {currency(currentImport?.opening_balance)} + movimentações {currency(sumSigned)} ={' '}
            {currency(computed)}, mas o extrato informa {currency(informedClosing)} (diferença de {currency(balanceDiff)}).
            Provavelmente faltam lançamentos — importe os demais extratos do período para completar a linha do tempo.
          </AlertDescription>
        </Alert>
      )}

      {balanceDiff !== null && Math.abs(balanceDiff) < 0.01 && (
        <Alert>
          <CheckCircle2 className="w-4 h-4" />
          <AlertTitle>Saldo consistente</AlertTitle>
          <AlertDescription className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <span>
              Saldo inicial {currency(currentImport?.opening_balance)} + movimentações {currency(sumSigned)} ={' '}
              {currency(computed)}, igual ao saldo final informado pelo extrato.
              {appBalanceDiff !== null && Math.abs(appBalanceDiff) >= 0.01 && !withinTolerance && (
                <> No entanto, o saldo da conta no app ainda diverge — efetive os lançamentos pendentes para encerrar.</>
              )}
            </span>
            {appBalanceDiff !== null && (Math.abs(appBalanceDiff) < 0.01 || withinTolerance) && (
              <Button size="sm" variant="default" onClick={() => setFinishOpen(true)}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Encerrar conciliação
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}


      {computed === null && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Saldo inicial não identificado</AlertTitle>
          <AlertDescription>
            O arquivo não trouxe o saldo anterior, então não é possível conferir o saldo final. Informe o saldo inicial
            no extrato ou importe um arquivo que contenha a linha de "saldo anterior".
          </AlertDescription>
        </Alert>
      )}

      {timelineGap && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Falta extrato no período</AlertTitle>
          <AlertDescription>
            Há um intervalo de {timelineGap.days} dias sem extrato importado nesta conta, entre {fmtDate(timelineGap.from)} e{' '}
            {fmtDate(timelineGap.to)}. Importe o extrato desse intervalo para manter a linha do tempo completa.
          </AlertDescription>
        </Alert>
      )}

      {uploading && (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" /> Extrato importado. Gerando sugestões…
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table wrapperClassName="max-h-[65vh] overflow-auto accessible-scrollbar">
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-8 bg-background">
                  <Checkbox
                    checked={lines.length > 0 && lines.filter((l) => l.status === 'pending').every((l) => selected[l.id])}
                    onCheckedChange={(checked) => {
                      const next: Record<string, boolean> = {};
                      if (checked) lines.filter((l) => l.status === 'pending').forEach((l) => (next[l.id] = true));
                      setSelected(next);
                    }}
                  />
                </TableHead>
                <TableHead className="w-24 bg-background">Data</TableHead>
                <TableHead className="min-w-[200px] bg-background">Histórico do banco</TableHead>
                <TableHead className="text-right w-28 bg-background">Valor</TableHead>
                <TableHead className="min-w-[180px] bg-background">Conta</TableHead>
                <TableHead className="min-w-[180px] bg-background">Categoria</TableHead>
                <TableHead className="min-w-[180px] bg-background">Subcategoria</TableHead>
                <TableHead className="min-w-[200px] bg-background">Descrição</TableHead>
                <TableHead className="min-w-[170px] bg-background">Tags</TableHead>
                <TableHead className="min-w-[130px] bg-background">Comprovante</TableHead>
                <TableHead className="w-32 bg-background">Situação</TableHead>
                <TableHead className="w-40 text-right bg-background">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhuma linha</TableCell></TableRow>
              ) : lines.map((line) => {
                const done = line.status !== 'pending';
                return (
                  <TableRow key={line.id} className={done ? 'opacity-60' : line.duplicate_of_transaction_id ? 'bg-destructive/5' : undefined}>
                    <TableCell>
                      <Checkbox
                        disabled={done}
                        checked={!!selected[line.id]}
                        onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, [line.id]: !!checked }))}
                      />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fmtDate(line.date)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {line.raw_description}
                      {line.duplicate_of_transaction_id && (
                        <span className="flex items-center gap-1 mt-1 text-destructive">
                          <Copy className="w-3 h-3" /> {line.duplicate_reason}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${line.type === 'income' ? 'text-primary' : 'text-destructive'}`}>
                      {line.type === 'income' ? '+' : '-'}{currency(line.amount)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={line.suggested_account_id || 'none'}
                        disabled={done}
                        onValueChange={(v) => patchLine(line, { suggested_account_id: v === 'none' ? null : v })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— selecionar —</SelectItem>
                          {accounts.filter(mirrorFree => !mirrorFree.is_mirror).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!done && (
                        <ConfBadge
                          confidence={line.suggestion_confidence}
                          filled={!!line.suggested_account_id}
                          manual={line.suggestion_source === 'manual'}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                      <Select
                        value={line.suggested_category_id || 'none'}
                        disabled={done}
                        onValueChange={(v) => patchLine(line, {
                          suggested_category_id: v === 'none' ? null : v,
                          suggested_subcategory_id: null,
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— selecionar —</SelectItem>
                          {categories
                            .filter((c) => c.type === 'both' || c.type === line.type)
                            .map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!done && can('registry.categories') && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="Criar categoria" onClick={() => openCatalog(line, 'category')}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Criar categoria</TooltipContent>
                        </Tooltip>
                      )}
                      </div>
                      {!done && (
                        <ConfBadge
                          confidence={line.suggestion_confidence}
                          filled={!!line.suggested_category_id}
                          manual={line.suggestion_source === 'manual'}
                        />
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                      <Select
                        value={line.suggested_subcategory_id || 'none'}
                        disabled={done || !line.suggested_category_id}
                        onValueChange={(v) => patchLine(line, { suggested_subcategory_id: v === 'none' ? null : v })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— selecionar —</SelectItem>
                          {subcategoriesOf(line.suggested_category_id).map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!done && can('registry.categories') && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={!line.suggested_category_id} aria-label="Criar subcategoria" onClick={() => openCatalog(line, 'subcategory')}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Criar subcategoria</TooltipContent>
                        </Tooltip>
                      )}
                      </div>
                      {!done && (
                        <ConfBadge
                          confidence={line.suggestion_confidence}
                          filled={!!line.suggested_subcategory_id}
                          manual={line.suggestion_source === 'manual'}
                        />
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                      <Input
                        key={line.suggested_description || line.raw_description}
                        className="h-8 text-xs"
                        disabled={done}
                        defaultValue={line.suggested_description || line.raw_description}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value && value !== (line.suggested_description || line.raw_description)) {
                            patchLine(line, { suggested_description: value });
                          }
                        }}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant={line.suggested_description && line.suggested_description !== line.raw_description ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 shrink-0" aria-label="Histórico e descrição do lançamento" onClick={() => {
                            setDescriptionLine(line);
                            setDescriptionDraft(line.suggested_description || line.raw_description);
                          }}>
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Histórico e descrição do lançamento</TooltipContent>
                      </Tooltip>
                      </div>
                      {!done && (
                        <ConfBadge
                          confidence={line.suggestion_confidence}
                          filled={!!line.suggested_description}
                          manual={line.suggestion_source === 'manual'}
                        />
                      )}

                    </TableCell>
                    <TableCell>
                      <TagPicker
                        companyId={companyId}
                        value={line.tag_ids || []}
                        onChange={(ids) => { if (!done) patchLine(line, { tag_ids: ids } as Partial<StatementLine>); }}
                        size="sm"
                        placeholder="Tags..."
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {line.receipt_path ? (
                          <>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs max-w-[110px] justify-start"
                                title={line.receipt_name || 'Ver comprovante'}
                                onClick={() => openReceipt(line.receipt_path!)}
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1 shrink-0" />
                                <span className="truncate">{line.receipt_name || 'Ver'}</span>
                              </Button>
                            </div>
                            {line.receipt_details && (
                              <button
                                type="button"
                                className="text-[10px] text-primary underline text-left"
                                onClick={() => setDetailsLine(line)}
                              >
                                Ver detalhes lidos
                              </button>
                            )}
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={done || busyLine === line.id}
                            onClick={() => openReceiptPicker(line)}
                          >
                            <Paperclip className="w-3.5 h-3.5 mr-1" />
                            Anexar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {line.status === 'reconciled' ? (
                        <Badge variant="default" className="text-xs">Conciliado</Badge>
                      ) : line.status === 'ignored' ? (
                        <Badge variant="secondary" className="text-xs">Ignorado</Badge>
                      ) : line.duplicate_of_transaction_id ? (
                        <Badge variant="destructive" className="text-xs">Duplicidade?</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!done && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-8 px-2" disabled={busyLine === line.id} onClick={() => effectivate(line)}>
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 px-2" title="Dar baixa em título" onClick={() => setSettleLine(line)}>
                            <Link2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground" title="Ignorar" onClick={() => ignoreLine(line)}>
                            <Ban className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 text-xs text-muted-foreground">
        A situação da importação é atualizada automaticamente conforme as linhas são conciliadas ou ignoradas.
      </div>

      <input
        ref={lineReceiptRef}
        type="file"
        accept="image/*,.pdf,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleLineReceipt(file);
        }}
      />

      <Dialog open={!!descriptionLine} onOpenChange={(open) => { if (!open && !savingDescription) setDescriptionLine(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico e descrição do lançamento</DialogTitle>
            <DialogDescription>{fmtDate(descriptionLine?.date)} · {currency(descriptionLine?.amount)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Histórico do banco</Label>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{descriptionLine?.raw_description}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="statement-description">Descrição do lançamento</Label>
              <Textarea id="statement-description" rows={5} value={descriptionDraft} onChange={e => setDescriptionDraft(e.target.value)} disabled={savingDescription || descriptionLine?.status !== 'pending'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={savingDescription} onClick={() => setDescriptionLine(null)}>Fechar</Button>
            {descriptionLine?.status === 'pending' && <Button onClick={saveDescription} disabled={savingDescription || !descriptionDraft.trim()}>{savingDescription ? 'Salvando…' : 'Salvar'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!catalogTarget} onOpenChange={open => { if (!open && !savingCatalog) setCatalogTarget(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{catalogTarget?.kind === 'category' ? 'Criar categoria' : 'Criar subcategoria'}</DialogTitle>
            <DialogDescription>{catalogTarget?.kind === 'subcategory' ? categories.find(c => c.id === catalogTarget.line.suggested_category_id)?.name : 'Cadastro de categorias'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); void saveCatalog(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="statement-catalog-name">Nome</Label>
              <Input id="statement-catalog-name" autoFocus value={catalogName} onChange={e => setCatalogName(e.target.value)} disabled={savingCatalog} />
            </div>
            {catalogTarget?.kind === 'category' && <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={catalogType} onValueChange={v => setCatalogType(v as 'income' | 'expense' | 'both')} disabled={savingCatalog}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={catalogTarget.line.type}>{catalogTarget.line.type === 'income' ? 'Receita' : 'Despesa'}</SelectItem>
                  <SelectItem value="both">Receita e despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={savingCatalog} onClick={() => setCatalogTarget(null)}>Cancelar</Button>
              <Button type="submit" disabled={savingCatalog || !catalogName.trim()}>{savingCatalog ? 'Criando…' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsLine} onOpenChange={(open) => !open && setDetailsLine(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do comprovante</DialogTitle>
            <DialogDescription>{detailsLine?.receipt_name}</DialogDescription>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{detailsLine?.receipt_details}</p>
          <DialogFooter>
            {detailsLine?.receipt_path && (
              <Button variant="outline" onClick={() => openReceipt(detailsLine.receipt_path!)}>
                <ExternalLink className="w-4 h-4 mr-2" /> Abrir arquivo
              </Button>
            )}
            <Button onClick={() => setDetailsLine(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={!!settleLine} onOpenChange={(open) => !open && setSettleLine(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dar baixa em título</DialogTitle>
            <DialogDescription>
              Vincule este lançamento do extrato a um título pendente de contas a pagar/receber.
            </DialogDescription>
          </DialogHeader>
          {settleLine && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {fmtDate(settleLine.date)} · {settleLine.raw_description} ·{' '}
                <span className="font-medium text-foreground">{currency(settleLine.amount)}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settleCandidates.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhum título pendente compatível</TableCell></TableRow>
                  ) : settleCandidates.map(({ record }) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-sm">{record.description}</TableCell>
                      <TableCell className="text-sm">{fmtDate(record.due_date)}</TableCell>
                      <TableCell className="text-right text-sm">{currency(record.amount)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const account = settleLine.suggested_account_id || currentImport?.account_id;
                            if (!account) {
                              toast.error('Defina a conta da linha antes de dar baixa');
                              return;
                            }
                            try {
                              await reconcileLineAsSettlement(settleLine, record.id, account);
                              setSettleLine(null);
                              await refetchLines();
                              toast.success('Título baixado e linha conciliada');
                            } catch (error) {
                              toast.error('Erro ao dar baixa: ' + (error as Error).message);
                            }
                          }}
                        >
                          Baixar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleLine(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDup} onOpenChange={(open) => !open && setConfirmDup(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Possível duplicidade</DialogTitle>
            <DialogDescription>
              Este lançamento parece já existir no app, por isso não foi efetivado.
            </DialogDescription>
          </DialogHeader>
          {confirmDup && (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-md border p-3">
                <p className="font-medium">{confirmDup.line.suggested_description || confirmDup.line.raw_description}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(confirmDup.line.date)} · {confirmDup.line.type === 'income' ? 'Entrada' : 'Saída'} ·{' '}
                  {currency(confirmDup.line.amount)}
                </p>
              </div>
              <p className="text-muted-foreground">{confirmDup.reason}</p>
              <p className="text-muted-foreground">
                Se já está lançado, ele já conta no saldo: use <strong>Vincular ao existente</strong> — não crie outro lançamento.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDup(null)}>Cancelar</Button>
            {confirmDup && (
              <Button
                variant="secondary"
                onClick={async () => {
                  const line = confirmDup.line;
                  setConfirmDup(null);
                  await ignoreLine(line);
                  await recheckBalance();
                }}
              >
                <Ban className="w-4 h-4 mr-2" /> Ignorar linha
              </Button>
            )}
            {confirmDup?.line.duplicate_of_transaction_id && (
              <Button
                onClick={async () => {
                  const line = confirmDup.line;
                  setConfirmDup(null);
                  await linkAlreadyInApp([line.id]);
                  await recheckBalance();
                }}
              >
                <Link2 className="w-4 h-4 mr-2" /> Vincular ao existente
              </Button>
            )}
            {confirmDup && (
              <Button
                variant="destructive"
                onClick={async () => {
                  const line = confirmDup.line;
                  setConfirmDup(null);
                  await effectivate(line, true);
                }}
              >
                Efetivar mesmo assim
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finishOpen} onOpenChange={(open) => !open && setFinishOpen(false)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Encerrar conciliação</DialogTitle>
            <DialogDescription>
              O saldo do extrato já está batendo com o saldo calculado. Você pode encerrar sem efetivar as linhas
              restantes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {pending > 0 && (
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="ignore-remaining"
                  checked={ignoreRemaining}
                  onCheckedChange={(checked) => setIgnoreRemaining(!!checked)}
                />
                <div className="grid gap-1">
                  <Label htmlFor="ignore-remaining" className="font-medium">
                    Ignorar {pending} linha(s) pendente(s)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    As linhas marcadas como ignoradas não gerarão transações e não aparecerão em novas conciliações.
                  </p>
                </div>
              </div>
            )}
            {pending === 0 && (
              <p className="text-sm text-muted-foreground">Não há linhas pendentes. A conciliação será encerrada.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishOpen(false)} disabled={finishing}>
              Cancelar
            </Button>
            <Button onClick={handleFinishReconciliation} disabled={finishing}>
              {finishing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Encerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { detectFormat };
