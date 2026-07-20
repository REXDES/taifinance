import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaymentsListShell } from './PaymentsListShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Props { companyId: string }
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PaymentsChargesPage({ companyId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ charge_type: 'pix', amount: '', description: '', payer_name: '', payer_document: '', payer_email: '', payer_phone: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('cappta_charges').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(200);
    setRows(data ?? []);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.amount) { toast.error('Informe o valor'); return; }
    setSaving(true);
    const { error } = await (supabase as any).from('cappta_charges').insert({
      company_id: companyId, created_by: user?.id,
      charge_type: form.charge_type, amount: Number(form.amount), description: form.description,
      payer_name: form.payer_name || null, payer_document: form.payer_document || null,
      payer_email: form.payer_email || null, payer_phone: form.payer_phone || null,
      due_date: form.due_date || null, status: 'pending',
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Cobrança criada');
    setOpen(false); setForm({ charge_type: 'pix', amount: '', description: '', payer_name: '', payer_document: '', payer_email: '', payer_phone: '', due_date: '' });
    load();
  };

  return (
    <PaymentsListShell title="Cobranças" description="Link de pagamento, boleto e PIX" onRefresh={load} onCreate={() => setOpen(true)} createLabel="Nova cobrança">
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Criada</TableHead><TableHead>Tipo</TableHead><TableHead>Pagador</TableHead>
            <TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma cobrança</TableCell></TableRow>}
            {rows.map(c => (
              <TableRow key={c.id}>
                <TableCell>{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell><Badge variant="outline">{c.charge_type}</Badge></TableCell>
                <TableCell>{c.payer_name ?? '—'}</TableCell>
                <TableCell>{c.due_date ? new Date(c.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell className="text-right">{brl(Number(c.amount || 0))}</TableCell>
                <TableCell><Badge variant={c.status === 'paid' ? 'default' : c.status === 'pending' ? 'secondary' : 'outline'}>{c.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova cobrança</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tipo</Label>
              <Select value={form.charge_type} onValueChange={(v) => setForm(f => ({ ...f, charge_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaymentsListShell>
  );
}
