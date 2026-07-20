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

const empty = { legal_name: '', trade_name: '', document: '', document_type: 'cnpj', email: '', phone: '', address_zip: '', address_street: '', address_number: '', address_neighborhood: '', address_city: '', address_state: '' };

export function PaymentsMerchantsPage({ companyId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('cappta_merchants').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    setRows(data ?? []);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.legal_name || !form.document) { toast.error('Preencha razão social e documento'); return; }
    const { error } = await (supabase as any).from('cappta_merchants').insert({ company_id: companyId, created_by: user?.id, ...form, status: 'pending' });
    if (error) { toast.error(error.message); return; }
    toast.success('Estabelecimento criado');
    setOpen(false); setForm(empty); load();
  };

  return (
    <PaymentsListShell title="Estabelecimentos" description="Merchants credenciados na Cappta" onRefresh={load} onCreate={() => setOpen(true)} createLabel="Novo estabelecimento">
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Razão / Fantasia</TableHead><TableHead>Documento</TableHead>
            <TableHead>E-mail</TableHead><TableHead>Cidade/UF</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum estabelecimento</TableCell></TableRow>}
            {rows.map(m => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="font-medium">{m.legal_name}</div>
                  {m.trade_name && <div className="text-xs text-muted-foreground">{m.trade_name}</div>}
                </TableCell>
                <TableCell className="font-mono text-xs">{m.document}</TableCell>
                <TableCell>{m.email ?? '—'}</TableCell>
                <TableCell>{[m.address_city, m.address_state].filter(Boolean).join('/') || '—'}</TableCell>
                <TableCell><Badge variant={m.status === 'approved' ? 'default' : 'secondary'}>{m.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo estabelecimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.document_type} onValueChange={(v) => setForm(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cnpj">CNPJ</SelectItem><SelectItem value="cpf">CPF</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Documento</Label><Input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} /></div>
            </div>
            <div><Label>Razão Social</Label><Input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} /></div>
            <div><Label>Nome Fantasia</Label><Input value={form.trade_name} onChange={e => setForm(f => ({ ...f, trade_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>CEP</Label><Input value={form.address_zip} onChange={e => setForm(f => ({ ...f, address_zip: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Rua</Label><Input value={form.address_street} onChange={e => setForm(f => ({ ...f, address_street: e.target.value }))} /></div>
              <div><Label>Nº</Label><Input value={form.address_number} onChange={e => setForm(f => ({ ...f, address_number: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Bairro</Label><Input value={form.address_neighborhood} onChange={e => setForm(f => ({ ...f, address_neighborhood: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Cidade</Label><Input value={form.address_city} onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))} /></div>
              <div><Label>UF</Label><Input maxLength={2} value={form.address_state} onChange={e => setForm(f => ({ ...f, address_state: e.target.value.toUpperCase() }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PaymentsListShell>
  );
}
