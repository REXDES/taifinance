import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaymentsListShell } from './PaymentsListShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Copy, FileText, RefreshCw, Receipt, Ban, Loader2 } from 'lucide-react';

interface Props { companyId: string }
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando emissão',
  issued: 'Emitido / aguardando pagamento',
  registered: 'Registrado',
  overdue: 'Vencido',
  paid: 'Liquidado',
  canceled: 'Cancelado',
};

const statusVariant = (s: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (s === 'paid') return 'default';
  if (s === 'overdue') return 'destructive';
  if (s === 'canceled') return 'outline';
  return 'secondary';
};

const OPEN_STATUSES = ['pending', 'issued', 'registered', 'overdue'];

export function PaymentsChargesPage({ companyId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ charge_type: 'boleto_pix', amount: '', description: '', payer_name: '', payer_document: '', payer_email: '', payer_phone: '', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('cappta_charges').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(200);
    setRows(data ?? []);
    return data ?? [];
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: reflect webhook-driven status changes immediately
  useEffect(() => {
    const channel = supabase
      .channel(`cappta-charges-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cappta_charges', filter: `company_id=eq.${companyId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, load]);

  const syncOpen = useCallback(async (silent = false) => {
    if (!silent) setSyncingAll(true);
    const { data, error } = await supabase.functions.invoke('cappta-charge', {
      body: { action: 'sync_open', company_id: companyId },
    });
    if (!silent) setSyncingAll(false);
    if (error) { if (!silent) toast.error(error.message); return; }
    if (!silent) toast.success(`${(data as any)?.synced ?? 0} cobrança(s) atualizada(s)`);
    load();
  }, [companyId, load]);

  // Polling every 2 min while there are open charges (online tracking)
  useEffect(() => {
    const hasOpen = rows.some(r => OPEN_STATUSES.includes(r.status) && r.cappta_charge_id);
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (!hasOpen) return;
    timerRef.current = window.setInterval(() => { syncOpen(true); }, 120000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [rows, syncOpen]);

  const submit = async () => {
    if (!form.amount) { toast.error('Informe o valor'); return; }
    const isBoleto = form.charge_type !== 'link';
    if (isBoleto && !form.due_date) { toast.error('Informe o vencimento'); return; }
    setSaving(true);
    const { data: created, error } = await (supabase as any).from('cappta_charges').insert({
      company_id: companyId, created_by: user?.id,
      charge_type: form.charge_type, amount: Number(form.amount), description: form.description,
      payer_name: form.payer_name || null, payer_document: form.payer_document || null,
      payer_email: form.payer_email || null, payer_phone: form.payer_phone || null,
      due_date: form.due_date || null, status: 'pending',
    }).select('*').maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Cobrança criada');
    setOpen(false);
    setForm({ charge_type: 'boleto_pix', amount: '', description: '', payer_name: '', payer_document: '', payer_email: '', payer_phone: '', due_date: '' });
    await load();
    if (created && form.charge_type !== 'link') issue(created.id);
  };

  const issue = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke('cappta-charge', { body: { action: 'issue', charge_id: id } });
    setBusyId(null);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(`Falha na emissão: ${err}`); load(); return; }
    toast.success('Boleto/PIX emitido');
    const charges = await load();
    const updated = charges.find((c: any) => c.id === id);
    if (updated) setDetail(updated);
  };

  const syncOne = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke('cappta-charge', { body: { action: 'sync', charge_id: id } });
    setBusyId(null);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    const charges = await load();
    const updated = charges.find((c: any) => c.id === id);
    if (updated) { setDetail(d => (d && d.id === id ? updated : d)); toast.success(`Status: ${STATUS_LABEL[updated.status] ?? updated.status}`); }
  };

  const cancel = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke('cappta-charge', { body: { action: 'cancel', charge_id: id } });
    setBusyId(null);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    toast.success('Cobrança cancelada');
    setDetail(null);
    load();
  };

  const copy = (value?: string | null, label = 'Código') => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  return (
    <PaymentsListShell title="Cobranças" description="Boleto híbrido (boleto + PIX), link de pagamento e acompanhamento até a liquidação" onRefresh={load} onCreate={() => setOpen(true)} createLabel="Nova cobrança">
      <div className="flex justify-end mb-3">
        <Button variant="outline" size="sm" onClick={() => syncOpen()} disabled={syncingAll}>
          {syncingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar status
        </Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Criada</TableHead><TableHead>Tipo</TableHead><TableHead>Pagador</TableHead>
            <TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead><TableHead>Sincronizado</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma cobrança</TableCell></TableRow>}
            {rows.map(c => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                <TableCell>{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell><Badge variant="outline">{c.charge_type}</Badge></TableCell>
                <TableCell>{c.payer_name ?? '—'}</TableCell>
                <TableCell>{c.due_date ? new Date(c.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell className="text-right">{brl(Number(c.amount || 0))}</TableCell>
                <TableCell><Badge variant={statusVariant(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString('pt-BR') : '—'}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  {!c.cappta_charge_id && c.status !== 'canceled' ? (
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

      {/* Detail / tracking dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cobrança {detail ? brl(Number(detail.amount || 0)) : ''}</DialogTitle>
            <DialogDescription>
              {detail?.payer_name ?? 'Pagador não informado'} · venc. {detail?.due_date ? new Date(detail.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</Badge>
                {detail.provider_status && <span className="text-xs text-muted-foreground">operadora: {detail.provider_status}</span>}
              </div>
              {detail.paid_at && <p className="text-muted-foreground">Liquidado em {new Date(detail.paid_at).toLocaleString('pt-BR')}</p>}
              {detail.sync_error && <p className="text-destructive text-xs">Erro: {detail.sync_error}</p>}

              {detail.boleto_digitable_line && (
                <div>
                  <Label>Linha digitável</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={detail.boleto_digitable_line} />
                    <Button size="icon" variant="outline" onClick={() => copy(detail.boleto_digitable_line, 'Linha digitável')}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
              {detail.pix_copy_paste && (
                <div>
                  <Label>PIX copia e cola</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={detail.pix_copy_paste} />
                    <Button size="icon" variant="outline" onClick={() => copy(detail.pix_copy_paste, 'PIX')}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
              {(detail.boleto_url || detail.payment_url) && (
                <Button variant="outline" size="sm" asChild>
                  <a href={detail.boleto_url || detail.payment_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" />Abrir boleto / link
                  </a>
                </Button>
              )}
              {detail.last_sync_at && (
                <p className="text-xs text-muted-foreground">Última verificação: {new Date(detail.last_sync_at).toLocaleString('pt-BR')}</p>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {detail && !detail.cappta_charge_id && detail.status !== 'canceled' && (
              <Button onClick={() => issue(detail.id)} disabled={busyId === detail.id}>
                <Receipt className="h-4 w-4 mr-2" />Emitir boleto/PIX
              </Button>
            )}
            {detail?.cappta_charge_id && (
              <Button variant="outline" onClick={() => syncOne(detail.id)} disabled={busyId === detail.id}>
                <RefreshCw className="h-4 w-4 mr-2" />Consultar status
              </Button>
            )}
            {detail && OPEN_STATUSES.includes(detail.status) && (
              <Button variant="destructive" onClick={() => cancel(detail.id)} disabled={busyId === detail.id}>
                <Ban className="h-4 w-4 mr-2" />Cancelar cobrança
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova cobrança</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tipo</Label>
              <Select value={form.charge_type} onValueChange={(v) => setForm(f => ({ ...f, charge_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto_pix">Boleto + PIX (híbrido)</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="link">Link de pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome do pagador</Label><Input value={form.payer_name} onChange={e => setForm(f => ({ ...f, payer_name: e.target.value }))} /></div>
              <div><Label>Documento</Label><Input value={form.payer_document} onChange={e => setForm(f => ({ ...f, payer_document: e.target.value }))} /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.payer_email} onChange={e => setForm(f => ({ ...f, payer_email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.payer_phone} onChange={e => setForm(f => ({ ...f, payer_phone: e.target.value }))} /></div>
            </div>
            <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            <p className="text-xs text-muted-foreground">Boleto e PIX são emitidos na Cappta ao salvar. O status é atualizado automaticamente por webhook e por consulta periódica até a liquidação.</p>
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
