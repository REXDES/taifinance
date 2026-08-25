import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { brl } from '@/hooks/useNectaApi';
import { PaymentsListShell } from './PaymentsListShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy, FileText, RefreshCw, Receipt, Ban, Loader2, MessageCircle } from 'lucide-react';

interface Props { companyId: string }

const METHOD_LABEL: Record<string, string> = {
  pix: 'PIX',
  bank_slip: 'Boleto',
  pix_cappta: 'Bolepix (boleto + PIX)',
  credit_card: 'Cartão de crédito',
  link: 'Link de pagamento',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando emissão',
  issued: 'Em aberto',
  overdue: 'Vencida',
  paid: 'Paga',
  refunded: 'Estornada',
  canceled: 'Cancelada',
};

const statusVariant = (s: string): 'default' | 'secondary' | 'outline' | 'destructive' =>
  s === 'paid' ? 'default' : s === 'overdue' || s === 'refunded' ? 'destructive' : s === 'canceled' ? 'outline' : 'secondary';

const OPEN_STATUSES = ['pending', 'issued', 'overdue'];
const ADDRESS_REQUIRED_METHODS = ['bank_slip', 'pix_cappta'];

const emptyForm = {
  method: 'pix', amount: '', description: '', installments: '1',
  payer_name: '', payer_document: '', payer_email: '', payer_phone: '', due_date: '',
  payer_address_street: '', payer_address_number: '', payer_address_complement: '',
  payer_address_neighborhood: '', payer_address_city: '', payer_address_state: '', payer_address_postal_code: '',
  account_id: '', is_recurring: false, recurrence_interval: 'monthly', recurrence_count: '12',
  card_holder: '', card_number: '', card_month: '', card_year: '', card_cvv: '',
};

const digitsOnly = (v: string) => v.replace(/\D/g, '');

export function NectaChargesPage({ companyId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tab, setTab] = useState<'open' | 'paid' | 'recurring' | 'review' | 'all'>('open');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const timerRef = useRef<number | null>(null);

  const [companyName, setCompanyName] = useState('');

  const load = useCallback(async () => {
    const [{ data }, { data: accs }, { data: company }] = await Promise.all([
      (supabase as any).from('necta_sales').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(300),
      (supabase as any).from('accounts').select('id, name').eq('company_id', companyId).order('name'),
      (supabase as any).from('companies').select('name').eq('id', companyId).maybeSingle(),
    ]);
    setRows(data ?? []);
    setAccounts(accs ?? []);
    setCompanyName(company?.name ?? '');
    return data ?? [];
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`necta-sales-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'necta_sales', filter: `company_id=eq.${companyId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, load]);

  const syncOpen = useCallback(async (silent = false) => {
    if (!silent) setSyncingAll(true);
    const { data, error } = await supabase.functions.invoke('necta-sale', { body: { action: 'sync_open', company_id: companyId } });
    if (!silent) setSyncingAll(false);
    const err = error?.message ?? (data as any)?.error;
    if (err) { if (!silent) toast.error(err); return; }
    if (!silent) toast.success(`${(data as any)?.synced ?? 0} cobrança(s) verificada(s)`);
    load();
  }, [companyId, load]);

  useEffect(() => {
    const hasOpen = rows.some(r => OPEN_STATUSES.includes(r.status) && (r.necta_sale_id || r.necta_payment_link_id));
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (!hasOpen) return;
    timerRef.current = window.setInterval(() => { syncOpen(true); }, 120000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [rows, syncOpen]);

  const issue = async (id: string, card?: Record<string, string>) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke('necta-sale', {
      body: { action: 'issue', sale_id: id, credit_card: card },
    });
    setBusyId(null);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(`Falha na emissão: ${err}`); load(); return; }
    toast.success('Cobrança emitida');
    const list = await load();
    const updated = list.find((s: any) => s.id === id);
    if (updated) setDetail(updated);
  };

  const submit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Informe o valor'); return; }
    if (form.method !== 'pix' && !form.due_date) { toast.error('Informe o vencimento'); return; }
    if (form.method === 'credit_card' && (!form.card_number || !form.card_holder)) { toast.error('Informe os dados do cartão'); return; }
    const docDigits = digitsOnly(form.payer_document);
    if (docDigits.length !== 11 && docDigits.length !== 14) { toast.error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido do pagador'); return; }
    if (ADDRESS_REQUIRED_METHODS.includes(form.method)) {
      const addressOk = form.payer_address_street && form.payer_address_number
        && form.payer_address_neighborhood && form.payer_address_city
        && form.payer_address_state && digitsOnly(form.payer_address_postal_code).length === 8;
      if (!addressOk) { toast.error('Endereço completo do pagador é obrigatório para emitir boleto'); return; }
    }
    setSaving(true);

    const recurrenceCount = form.is_recurring ? Math.max(1, Number(form.recurrence_count || 1)) : 1;
    const baseDue = form.due_date ? new Date(`${form.due_date}T00:00:00`) : null;
    const created: any[] = [];

    for (let i = 0; i < recurrenceCount; i++) {
      let due: string | null = form.due_date || null;
      if (baseDue && i > 0) {
        const d = new Date(baseDue);
        if (form.recurrence_interval === 'weekly') d.setDate(d.getDate() + 7 * i);
        else if (form.recurrence_interval === 'yearly') d.setFullYear(d.getFullYear() + i);
        else d.setMonth(d.getMonth() + i);
        due = d.toISOString().slice(0, 10);
      }
      const { data, error } = await (supabase as any).from('necta_sales').insert({
        company_id: companyId, created_by: user?.id,
        method: form.method, amount: Number(form.amount),
        installments: Number(form.installments || 1),
        description: form.description || null,
        payer_name: form.payer_name || null, payer_document: form.payer_document || null,
        payer_email: form.payer_email || null, payer_phone: form.payer_phone || null,
        payer_address_street: form.payer_address_street || null,
        payer_address_number: form.payer_address_number || null,
        payer_address_complement: form.payer_address_complement || null,
        payer_address_neighborhood: form.payer_address_neighborhood || null,
        payer_address_city: form.payer_address_city || null,
        payer_address_state: form.payer_address_state || null,
        payer_address_postal_code: form.payer_address_postal_code || null,
        due_date: due, account_id: form.account_id || null,
        is_recurring: form.is_recurring, recurrence_interval: form.is_recurring ? form.recurrence_interval : null,
        recurrence_count: form.is_recurring ? recurrenceCount : null,
        recurrence_index: form.is_recurring ? i + 1 : null,
        parent_sale_id: created[0]?.id ?? null,
        status: 'pending',
      }).select('*').maybeSingle();
      if (error) { setSaving(false); toast.error(error.message); return; }
      created.push(data);
    }

    setSaving(false);
    setOpen(false);
    toast.success(recurrenceCount > 1 ? `${recurrenceCount} cobranças criadas` : 'Cobrança criada');
    const card = form.method === 'credit_card'
      ? { holderName: form.card_holder, number: form.card_number, expirationMonth: form.card_month, expirationYear: form.card_year, cvv: form.card_cvv }
      : undefined;
    setForm({ ...emptyForm });
    await load();
    // Emite a primeira imediatamente; as demais recorrências ficam para emissão sob demanda
    if (created[0]) issue(created[0].id, card);
  };

  const syncOne = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke('necta-sale', { body: { action: 'sync', sale_id: id } });
    setBusyId(null);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    const list = await load();
    const updated = list.find((s: any) => s.id === id);
    if (updated) { setDetail(d => (d && d.id === id ? updated : d)); toast.success(`Situação: ${STATUS_LABEL[updated.status] ?? updated.status}`); }
  };

  const voidSale = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke('necta-sale', { body: { action: 'void', sale_id: id } });
    setBusyId(null);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    toast.success('Cobrança cancelada/estornada');
    setDetail(null);
    load();
  };

  const copy = (value?: string | null, label = 'Código') => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  const markReviewed = async (id: string) => {
    setBusyId(id);
    const { error } = await (supabase as any).from('necta_sales')
      .update({ reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
      .eq('id', id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Marcada como revisada');
    setDetail(null);
    load();
  };

  const needsReview = (r: any) => r.needs_review && !r.reviewed_at;

  const paymentInfoFor = (sale: any): string | null => {
    if (sale.method === 'link') return sale.payment_url ?? null;
    if (sale.method === 'bank_slip' || sale.method === 'pix_cappta') return sale.pix_copy_paste ?? sale.boleto_digitable_line ?? null;
    return sale.pix_copy_paste ?? null;
  };

  const sendWhatsapp = async (sale: any) => {
    if (!sale.payer_phone) { toast.error('Cadastre o telefone do pagador para enviar por WhatsApp'); return; }
    const paymentInfo = paymentInfoFor(sale);
    if (!paymentInfo) { toast.error('Ainda não há código/link para enviar'); return; }
    setSendingWhatsapp(true);
    const { data, error } = await supabase.functions.invoke('send-necta-charge-whatsapp', {
      body: {
        phone: sale.payer_phone, companyName, description: sale.description || 'Cobrança',
        amount: sale.amount, method: sale.method === 'pix_cappta' ? 'pix_cappta' : sale.method, paymentInfo,
      },
    });
    setSendingWhatsapp(false);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(`Falha ao enviar: ${err}`); return; }
    toast.success('Enviado por WhatsApp');
  };

  const filtered = rows.filter(r =>
    tab === 'open' ? OPEN_STATUSES.includes(r.status)
    : tab === 'paid' ? r.status === 'paid'
    : tab === 'recurring' ? r.is_recurring
    : tab === 'review' ? needsReview(r)
    : true);

  const totals = {
    open: rows.filter(r => OPEN_STATUSES.includes(r.status)).reduce((s, r) => s + Number(r.amount || 0), 0),
    paid: rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount || 0), 0),
    review: rows.filter(needsReview).length,
  };

  return (
    <PaymentsListShell
      title="Cobranças"
      description="Gere cobranças por PIX, boleto, bolepix, cartão ou link e acompanhe até a liquidação — o status reflete na Gestão Financeira"
      onRefresh={load}
      onCreate={() => setOpen(true)}
      createLabel="Nova cobrança"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="open">Em aberto</TabsTrigger>
            <TabsTrigger value="paid">Pagas</TabsTrigger>
            <TabsTrigger value="recurring">Recorrentes</TabsTrigger>
            <TabsTrigger value="review">Revisão{totals.review > 0 ? ` (${totals.review})` : ''}</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Em aberto: <strong>{brl(totals.open)}</strong> · Pagas: <strong>{brl(totals.paid)}</strong></span>
          <Button variant="outline" size="sm" onClick={() => syncOpen()} disabled={syncingAll}>
            {syncingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar status
          </Button>
        </div>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Criada</TableHead><TableHead>Método</TableHead><TableHead>Pagador</TableHead>
            <TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead><TableHead>Recorrência</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma cobrança</TableCell></TableRow>}
            {filtered.map(c => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                <TableCell>{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell><Badge variant="outline">{METHOD_LABEL[c.method] ?? c.method}</Badge></TableCell>
                <TableCell>{c.payer_name ?? '—'}</TableCell>
                <TableCell>{c.due_date ? new Date(c.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell className="text-right">{brl(Number(c.amount || 0))}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                  {needsReview(c) && <Badge variant="destructive" className="ml-1">Revisar</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.is_recurring ? `${c.recurrence_index ?? 1}/${c.recurrence_count ?? 1}` : '—'}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  {!c.necta_sale_id && !c.necta_payment_link_id && c.status !== 'canceled' ? (
                    <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => issue(c.id)}>
                      {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Receipt className="h-4 w-4 mr-1" />Emitir</>}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => syncOne(c.id)}>
                      {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Detalhe */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cobrança {detail ? brl(Number(detail.amount || 0)) : ''}</DialogTitle>
            <DialogDescription>
              {detail?.payer_name ?? 'Pagador não informado'} · {detail ? (METHOD_LABEL[detail.method] ?? detail.method) : ''}
              {detail?.due_date ? ` · venc. ${new Date(detail.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusVariant(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</Badge>
                {needsReview(detail) && <Badge variant="destructive">Precisa de revisão</Badge>}
                {detail.provider_status && <span className="text-xs text-muted-foreground">operadora: {detail.provider_status}</span>}
              </div>
              {needsReview(detail) && (
                <div className="border border-destructive/40 bg-destructive/5 rounded-md p-3 text-xs space-y-1">
                  <p className="font-medium text-destructive">Pendente de revisão manual</p>
                  <p className="text-muted-foreground">{detail.review_reason ?? 'Situação inesperada detectada nesta cobrança.'}</p>
                  <p className="text-muted-foreground">Nenhuma baixa em Contas a Receber foi revertida automaticamente — confirme se é um estorno legítimo, erro de input ou possível fraude antes de agir.</p>
                </div>
              )}
              {detail.reviewed_at && <p className="text-xs text-muted-foreground">Revisada em {new Date(detail.reviewed_at).toLocaleString('pt-BR')}</p>}
              {detail.paid_at && <p className="text-muted-foreground">Paga em {new Date(detail.paid_at).toLocaleString('pt-BR')}</p>}
              {detail.transaction_id && <p className="text-xs text-muted-foreground">Lançamento financeiro gerado automaticamente.</p>}
              {detail.payable_receivable_id && <p className="text-xs text-muted-foreground">Vinculada a um recebível em Contas a Pagar/Receber.</p>}
              {detail.sync_error && <p className="text-destructive text-xs break-words">Erro: {detail.sync_error}</p>}

              {detail.boleto_digitable_line && (
                <div><Label>Linha digitável</Label>
                  <div className="flex gap-2"><Input readOnly value={detail.boleto_digitable_line} />
                    <Button size="icon" variant="outline" onClick={() => copy(detail.boleto_digitable_line, 'Linha digitável')}><Copy className="h-4 w-4" /></Button></div>
                </div>
              )}
              {detail.pix_copy_paste && (
                <div><Label>PIX copia e cola</Label>
                  <div className="flex gap-2"><Input readOnly value={detail.pix_copy_paste} />
                    <Button size="icon" variant="outline" onClick={() => copy(detail.pix_copy_paste, 'PIX')}><Copy className="h-4 w-4" /></Button></div>
                </div>
              )}
              {(detail.boleto_url || detail.payment_url) && (
                <Button variant="outline" size="sm" asChild>
                  <a href={detail.boleto_url || detail.payment_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" />Abrir boleto / link
                  </a>
                </Button>
              )}
              {detail.last_sync_at && <p className="text-xs text-muted-foreground">Última verificação: {new Date(detail.last_sync_at).toLocaleString('pt-BR')}</p>}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {detail && needsReview(detail) && (
              <Button variant="secondary" onClick={() => markReviewed(detail.id)} disabled={busyId === detail.id}>
                {busyId === detail.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Marcar como revisado
              </Button>
            )}
            {detail && !detail.necta_sale_id && !detail.necta_payment_link_id && detail.status !== 'canceled' && (
              <Button onClick={() => issue(detail.id)} disabled={busyId === detail.id}><Receipt className="h-4 w-4 mr-2" />Emitir</Button>
            )}
            {detail && (detail.necta_sale_id || detail.necta_payment_link_id) && (
              <Button variant="outline" onClick={() => syncOne(detail.id)} disabled={busyId === detail.id}><RefreshCw className="h-4 w-4 mr-2" />Consultar status</Button>
            )}
            {detail && paymentInfoFor(detail) && (
              <Button variant="outline" onClick={() => sendWhatsapp(detail)} disabled={sendingWhatsapp}>
                {sendingWhatsapp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}Enviar por WhatsApp
              </Button>
            )}
            {detail && [...OPEN_STATUSES, 'paid'].includes(detail.status) && (
              <Button variant="destructive" onClick={() => voidSale(detail.id)} disabled={busyId === detail.id}>
                <Ban className="h-4 w-4 mr-2" />{detail.status === 'paid' ? 'Estornar' : 'Cancelar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova cobrança */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova cobrança</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Método</Label>
              <Select value={form.method} onValueChange={(v) => setForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="bank_slip">Boleto</SelectItem>
                  <SelectItem value="pix_cappta">Bolepix (boleto + PIX)</SelectItem>
                  <SelectItem value="credit_card">Cartão de crédito</SelectItem>
                  <SelectItem value="link">Link de pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            </div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome do pagador</Label><Input value={form.payer_name} onChange={e => setForm(f => ({ ...f, payer_name: e.target.value }))} /></div>
              <div><Label>Documento (CPF/CNPJ) *</Label><Input value={form.payer_document} onChange={e => setForm(f => ({ ...f, payer_document: e.target.value }))} /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.payer_email} onChange={e => setForm(f => ({ ...f, payer_email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.payer_phone} onChange={e => setForm(f => ({ ...f, payer_phone: e.target.value }))} /></div>
            </div>

            <div className="border rounded-md p-3 space-y-3">
              <Label className="text-xs text-muted-foreground">
                Endereço do pagador{ADDRESS_REQUIRED_METHODS.includes(form.method) ? ' *' : ' (opcional)'}
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label>Rua</Label><Input value={form.payer_address_street} onChange={e => setForm(f => ({ ...f, payer_address_street: e.target.value }))} /></div>
                <div><Label>Número</Label><Input value={form.payer_address_number} onChange={e => setForm(f => ({ ...f, payer_address_number: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Complemento</Label><Input value={form.payer_address_complement} onChange={e => setForm(f => ({ ...f, payer_address_complement: e.target.value }))} /></div>
                <div><Label>Bairro</Label><Input value={form.payer_address_neighborhood} onChange={e => setForm(f => ({ ...f, payer_address_neighborhood: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Cidade</Label><Input value={form.payer_address_city} onChange={e => setForm(f => ({ ...f, payer_address_city: e.target.value }))} /></div>
                <div><Label>UF</Label><Input maxLength={2} value={form.payer_address_state} onChange={e => setForm(f => ({ ...f, payer_address_state: e.target.value.toUpperCase() }))} /></div>
                <div><Label>CEP</Label><Input value={form.payer_address_postal_code} onChange={e => setForm(f => ({ ...f, payer_address_postal_code: e.target.value }))} /></div>
              </div>
            </div>

            {form.method === 'credit_card' && (
              <div className="grid grid-cols-2 gap-3 border rounded-md p-3">
                <div className="col-span-2"><Label>Nome impresso no cartão</Label><Input value={form.card_holder} onChange={e => setForm(f => ({ ...f, card_holder: e.target.value }))} /></div>
                <div className="col-span-2"><Label>Número do cartão</Label><Input value={form.card_number} onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))} /></div>
                <div><Label>Mês</Label><Input placeholder="12" value={form.card_month} onChange={e => setForm(f => ({ ...f, card_month: e.target.value }))} /></div>
                <div><Label>Ano</Label><Input placeholder="2030" value={form.card_year} onChange={e => setForm(f => ({ ...f, card_year: e.target.value }))} /></div>
                <div><Label>CVV</Label><Input value={form.card_cvv} onChange={e => setForm(f => ({ ...f, card_cvv: e.target.value }))} /></div>
                <div><Label>Parcelas</Label><Input type="number" min={1} value={form.installments} onChange={e => setForm(f => ({ ...f, installments: e.target.value }))} /></div>
              </div>
            )}

            <div><Label>Conta de recebimento (Gestão Financeira)</Label>
              <Select value={form.account_id || 'none'} onValueChange={(v) => setForm(f => ({ ...f, account_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não lançar em conta</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label>Cobrança recorrente</Label>
                <p className="text-xs text-muted-foreground">Gera uma cobrança por período a partir do vencimento</p>
              </div>
              <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm(f => ({ ...f, is_recurring: v }))} />
            </div>
            {form.is_recurring && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Periodicidade</Label>
                  <Select value={form.recurrence_interval} onValueChange={(v) => setForm(f => ({ ...f, recurrence_interval: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Quantidade</Label><Input type="number" min={1} value={form.recurrence_count} onChange={e => setForm(f => ({ ...f, recurrence_count: e.target.value }))} /></div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">A primeira cobrança é emitida na Necta ao salvar. O status é atualizado por webhook e por consulta periódica, refletindo em Contas a Pagar/Receber e no extrato da conta.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar e emitir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaymentsListShell>
  );
}
