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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Props { companyId: string }

export function PaymentsPlansPage({ companyId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', rates_json: '[]' });

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('cappta_plans').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    setRows(data ?? []);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    let rates: any = [];
    try { rates = JSON.parse(form.rates_json || '[]'); } catch { toast.error('JSON de taxas inválido'); return; }
    const { error } = await (supabase as any).from('cappta_plans').insert({ company_id: companyId, name: form.name, description: form.description, rates });
    if (error) { toast.error(error.message); return; }
    toast.success('Plano criado');
    setOpen(false); setForm({ name: '', description: '', rates_json: '[]' }); load();
  };

  return (
    <PaymentsListShell title="Planos & Taxas" description="Tabelas de MDR / antecipação" onRefresh={load} onCreate={() => setOpen(true)} createLabel="Novo plano">
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead><TableHead>Descrição</TableHead>
            <TableHead>Taxas</TableHead><TableHead>Ativo</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum plano</TableCell></TableRow>}
            {rows.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.description ?? '—'}</TableCell>
                <TableCell>{Array.isArray(p.rates) ? `${p.rates.length} regra(s)` : '—'}</TableCell>
                <TableCell><Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Sim' : 'Não'}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo plano</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <Label>Taxas (JSON)</Label>
              <Textarea rows={6} value={form.rates_json} onChange={e => setForm(f => ({ ...f, rates_json: e.target.value }))} placeholder='[{"brand":"visa","product":"credit","installments":1,"mdr":2.99}]' />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PaymentsListShell>
  );
}
