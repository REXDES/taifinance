import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Paperclip, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatBR, parseLocalDate } from '@/lib/dateUtils';

interface Props { companyId: string }

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const ASSIGNMENT_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  requested: { label: 'Aguardando financiador', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Recusado', variant: 'destructive' },
  assigned: { label: 'Cedido', variant: 'default' },
  paid_by_debtor: { label: 'Pago — repasse pendente', variant: 'secondary' },
  settled: { label: 'Liquidado ao financiador', variant: 'outline' },
  settlement_failed: { label: 'Falha no repasse', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
};

function daysUntil(due: string) {
  const d = parseLocalDate(due); const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((d.getTime() - t.getTime()) / 86400000));
}
/** Deságio simples pró-rata: face * taxa_mensal * dias/30. */
export function computeDiscount(face: number, monthlyRate: number, days: number) {
  const discount = Math.round(face * (monthlyRate / 100) * (days / 30) * 100) / 100;
  return { discount, net: Math.max(0, Math.round((face - discount) * 100) / 100) };
}

export function AnticipationPage({ companyId }: Props) {
  const db = supabase as any;
  const { user } = useAuth();
  const [isFin, setIsFin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [titles, setTitles] = useState<any[]>([]);
  const [financiers, setFinanciers] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<Record<string, any[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [finId, setFinId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: comp }, { data: links }, { data: prs }, { data: sales }, { data: asg }, { data: att }] = await Promise.all([
      db.from('companies').select('is_financiador').eq('id', companyId).maybeSingle(),
      db.from('financier_cedent_links').select('financier_company_id').eq('cedent_company_id', companyId).eq('active', true),
      db.from('payables_receivables').select('id, description, amount, due_date, status, client_supplier_id, clients_suppliers(name)')
        .eq('company_id', companyId).eq('type', 'receivable').eq('status', 'pending').order('due_date'),
      db.from('necta_sales').select('id, payable_receivable_id, payment_method').eq('company_id', companyId).not('payable_receivable_id', 'is', null),
      db.from('receivable_assignments').select('*, payables_receivables(description, due_date, clients_suppliers(name))')
        .or(`cedent_company_id.eq.${companyId},financier_company_id.eq.${companyId}`).order('created_at', { ascending: false }),
      db.from('receivable_assignment_attachments').select('*').eq('company_id', companyId),
    ]);
    setIsFin(!!comp?.is_financiador);
    const finIds = (links ?? []).map((l: any) => l.financier_company_id);
    if (finIds.length) {
      const [{ data: fc }, { data: fr }] = await Promise.all([
        db.from('companies').select('id, name').in('id', finIds),
        db.from('financier_credit_rules').select('*').in('financier_company_id', finIds),
      ]);
      setFinanciers((fc ?? []).map((c: any) => ({ ...c, rules: (fr ?? []).find((r: any) => r.financier_company_id === c.id) })));
    } else setFinanciers([]);
    const saleByPr = new Map<string, any>((sales ?? []).map((s: any) => [s.payable_receivable_id, s]));
    const active = new Set((asg ?? []).filter((a: any) => !['rejected', 'cancelled'].includes(a.status)).map((a: any) => a.payable_receivable_id));
    setTitles((prs ?? []).filter((p: any) => saleByPr.has(p.id) && !active.has(p.id)).map((p: any) => ({ ...p, sale: saleByPr.get(p.id) })));
    setMine((asg ?? []).filter((a: any) => a.cedent_company_id === companyId));
    setReceived((asg ?? []).filter((a: any) => a.financier_company_id === companyId));
    const map: Record<string, any[]> = {};
    (att ?? []).forEach((a: any) => { (map[a.payable_receivable_id] ||= []).push(a); });
    setAttachments(map);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const fin = financiers.find(f => f.id === finId);
  const rules = fin?.rules;

  const check = (t: any): string | null => {
    if (!rules) return 'Financiador sem regras configuradas';
    if (!rules.active) return 'Financiador não está aceitando solicitações';
    const d = daysUntil(t.due_date);
    if (d < rules.min_days) return `Prazo menor que ${rules.min_days} dias`;
    if (d > rules.max_days) return `Prazo maior que ${rules.max_days} dias`;
    if (Number(t.amount) < Number(rules.min_title_amount ?? 0)) return 'Abaixo do valor mínimo';
    if (rules.max_title_amount && Number(t.amount) > Number(rules.max_title_amount)) return 'Acima do valor máximo';
    if (rules.requires_invoice && !(attachments[t.id]?.length)) return 'Anexe a nota fiscal';
    return null;
  };

  const simulation = useMemo(() => {
    if (!rules) return null;
    let face = 0, discount = 0;
    titles.filter(t => selected.has(t.id)).forEach(t => {
      const r = computeDiscount(Number(t.amount), Number(rules.monthly_discount_rate), daysUntil(t.due_date));
      face += Number(t.amount); discount += r.discount;
    });
    return { face, discount, net: face - discount };
  }, [selected, titles, rules]);

  const usedByFin = useMemo(() => mine.filter(a => a.financier_company_id === finId && ['requested', 'approved', 'assigned', 'paid_by_debtor', 'settlement_failed'].includes(a.status))
    .reduce((s, a) => s + Number(a.face_amount), 0), [mine, finId]);

  const upload = async (prId: string, file: File) => {
    const path = `${companyId}/invoices/${prId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('anticipation-docs').upload(path, file);
    if (error) return toast.error(error.message);
    await db.from('receivable_assignment_attachments').insert({ payable_receivable_id: prId, company_id: companyId, file_name: file.name, storage_path: path, uploaded_by: user?.id });
    toast.success('Nota fiscal anexada'); load();
  };
  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from('anticipation-docs').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const request = async () => {
    if (!fin || !rules) return;
    const chosen = titles.filter(t => selected.has(t.id));
    const blocked = chosen.find(t => check(t));
    if (blocked) return toast.error(`${blocked.description}: ${check(blocked)}`);
    if (rules.max_installments && chosen.length > rules.max_installments) return toast.error(`Máximo de ${rules.max_installments} títulos por solicitação`);
    if (chosen.length < (rules.min_installments ?? 1)) return toast.error(`Mínimo de ${rules.min_installments} títulos`);
    if (rules.limit_per_cedent && usedByFin + (simulation?.face ?? 0) > Number(rules.limit_per_cedent)) return toast.error('Limite por cedente excedido');
    if (rules.limit_per_debtor) {
      const byDebtor: Record<string, number> = {};
      chosen.forEach(t => { byDebtor[t.client_supplier_id] = (byDebtor[t.client_supplier_id] ?? 0) + Number(t.amount); });
      if (Object.values(byDebtor).some(v => v > Number(rules.limit_per_debtor))) return toast.error('Limite por sacado excedido');
    }
    setSending(true);
    const rows = chosen.map(t => {
      const r = computeDiscount(Number(t.amount), Number(rules.monthly_discount_rate), daysUntil(t.due_date));
      return {
        payable_receivable_id: t.id, necta_sale_id: t.sale?.id, cedent_company_id: companyId, financier_company_id: fin.id,
        face_amount: t.amount, discount_rate: rules.monthly_discount_rate, discount_amount: r.discount, net_amount: r.net,
        due_date: t.due_date, status: 'requested', requested_by: user?.id,
        title_description: t.description, debtor_name: t.clients_suppliers?.name ?? null,
      };
    });
    const { error } = await db.from('receivable_assignments').insert(rows);
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success('Solicitação enviada ao financiador'); setSelected(new Set()); load();
  };

  const act = async (action: string, a: any, extra: any = {}) => {
    setBusy(a.id);
    const { data, error } = await supabase.functions.invoke('receivable-assignment', { body: { action, assignment_id: a.id, ...extra } });
    setBusy(null);
    if (error || data?.error || data?.ok === false) return toast.error(data?.error ?? error?.message ?? 'Falha');
    toast.success('Atualizado'); load();
  };

  const AssignmentTable = ({ rows, asFinancier }: { rows: any[]; asFinancier: boolean }) => (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Título</TableHead><TableHead>Sacado</TableHead><TableHead>Vencimento</TableHead>
        <TableHead className="text-right">Face</TableHead><TableHead className="text-right">Líquido</TableHead>
        <TableHead>Status</TableHead><TableHead />
      </TableRow></TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nada por aqui.</TableCell></TableRow>}
        {rows.map(a => {
          const s = ASSIGNMENT_STATUS[a.status] ?? { label: a.status, variant: 'outline' };
          return (
            <TableRow key={a.id}>
              <TableCell>{a.title_description ?? a.payables_receivables?.description}</TableCell>
              <TableCell>{a.debtor_name ?? a.payables_receivables?.clients_suppliers?.name ?? '—'}</TableCell>
              <TableCell>{formatBR(a.due_date)}</TableCell>
              <TableCell className="text-right">{brl(a.face_amount)}</TableCell>
              <TableCell className="text-right">{brl(a.net_amount)}</TableCell>
              <TableCell><Badge variant={s.variant}>{s.label}</Badge>{a.rejection_reason && <div className="text-xs text-muted-foreground mt-1">{a.rejection_reason}</div>}</TableCell>
              <TableCell className="text-right space-x-2 whitespace-nowrap">
                {busy === a.id && <Loader2 className="w-4 h-4 animate-spin inline" />}
                {asFinancier && a.status === 'requested' && <>
                  <Button size="sm" onClick={() => act('approve', a)}>Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={() => { setRejecting(a); setReason(''); }}>Recusar</Button>
                </>}
                {!asFinancier && a.status === 'requested' && <Button size="sm" variant="outline" onClick={() => act('cancel', a)}>Cancelar</Button>}
                {['settlement_failed', 'paid_by_debtor'].includes(a.status) && <Button size="sm" variant="outline" onClick={() => act('retry', a)}><RefreshCw className="w-3 h-3 mr-1" />Reprocessar repasse</Button>}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Antecipação</h1>
        <p className="text-muted-foreground">Ceda boletos Pagando.net a um financiador. Quando o sacado paga, o valor líquido vai direto para a conta do financiador.</p></div>
      <Tabs defaultValue={isFin && financiers.length === 0 ? 'financier' : 'request'}>
        <TabsList>
          <TabsTrigger value="request">Solicitar</TabsTrigger>
          <TabsTrigger value="mine">Meus títulos antecipados</TabsTrigger>
          {isFin && <TabsTrigger value="financier">Mesa do financiador</TabsTrigger>}
        </TabsList>

        <TabsContent value="request" className="space-y-4">
          {financiers.length === 0 ? (
            <Card><CardHeader><CardDescription>Nenhum financiador liberado para esta empresa.</CardDescription></CardHeader></Card>
          ) : <>
            <Card>
              <CardHeader><CardTitle>Financiador</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={finId || undefined} onValueChange={setFinId}>
                  <SelectTrigger className="max-w-sm"><SelectValue placeholder="Escolha o financiador" /></SelectTrigger>
                  <SelectContent>{financiers.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
                {rules && (
                  <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Deságio</span><div className="font-semibold">{rules.monthly_discount_rate}% a.m.</div></div>
                    <div><span className="text-muted-foreground">Prazo</span><div className="font-semibold">{rules.min_days}–{rules.max_days} dias</div></div>
                    <div><span className="text-muted-foreground">Títulos</span><div className="font-semibold">{rules.min_installments}–{rules.max_installments}</div></div>
                    <div><span className="text-muted-foreground">Limite cedente</span><div className="font-semibold">{rules.limit_per_cedent ? `${brl(usedByFin)} / ${brl(rules.limit_per_cedent)}` : 'Livre'}</div></div>
                    <div><span className="text-muted-foreground">Limite sacado</span><div className="font-semibold">{rules.limit_per_debtor ? brl(rules.limit_per_debtor) : 'Livre'}</div></div>
                    <div><span className="text-muted-foreground">Nota fiscal</span><div className="font-semibold">{rules.requires_invoice ? 'Obrigatória' : 'Opcional'}</div></div>
                    {rules.notes && <p className="sm:col-span-3 lg:col-span-6 text-muted-foreground">{rules.notes}</p>}
                  </div>
                )}
                {fin && !rules && <p className="text-sm text-muted-foreground">Este financiador ainda não configurou suas regras.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Títulos elegíveis</CardTitle><CardDescription>Boletos Pagando.net em aberto.</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead /><TableHead>Título</TableHead><TableHead>Sacado</TableHead><TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead><TableHead>Nota fiscal</TableHead><TableHead>Situação</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {titles.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum boleto em aberto disponível.</TableCell></TableRow>}
                    {titles.map(t => {
                      const issue = fin ? check(t) : null;
                      return (
                        <TableRow key={t.id}>
                          <TableCell><Checkbox checked={selected.has(t.id)} onCheckedChange={v => { const n = new Set(selected); v ? n.add(t.id) : n.delete(t.id); setSelected(n); }} /></TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell>{t.clients_suppliers?.name ?? '—'}</TableCell>
                          <TableCell>{formatBR(t.due_date)}</TableCell>
                          <TableCell className="text-right">{brl(t.amount)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {(attachments[t.id] ?? []).map(a => <button key={a.id} className="text-xs underline text-left" onClick={() => openFile(a.storage_path)}>{a.file_name}</button>)}
                              <Label className="inline-flex items-center gap-1 text-xs cursor-pointer text-primary">
                                <Paperclip className="w-3 h-3" />Anexar
                                <Input type="file" className="hidden" onChange={e => e.target.files?.[0] && upload(t.id, e.target.files[0])} />
                              </Label>
                            </div>
                          </TableCell>
                          <TableCell>{fin ? (issue ? <span className="text-xs text-destructive">{issue}</span> : <Badge variant="outline">Elegível</Badge>) : '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {simulation && selected.size > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-6 text-sm">
                    <div>Face: <b>{brl(simulation.face)}</b></div>
                    <div>Deságio: <b>{brl(simulation.discount)}</b></div>
                    <div>Líquido: <b>{brl(simulation.net)}</b></div>
                    <Button onClick={request} disabled={sending}>{sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Solicitar antecipação</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>}
        </TabsContent>

        <TabsContent value="mine"><Card><CardContent className="pt-6"><AssignmentTable rows={mine} asFinancier={false} /></CardContent></Card></TabsContent>
        {isFin && <TabsContent value="financier"><Card><CardContent className="pt-6"><AssignmentTable rows={received} asFinancier /></CardContent></Card></TabsContent>}
      </Tabs>

      <Dialog open={!!rejecting} onOpenChange={o => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar solicitação</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo" value={reason} onChange={e => setReason(e.target.value)} />
          <DialogFooter><Button onClick={async () => { await act('reject', rejecting, { reason }); setRejecting(null); }}>Recusar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
