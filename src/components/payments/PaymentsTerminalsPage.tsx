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
import { toast } from 'sonner';

interface Props { companyId: string }

export function PaymentsTerminalsPage({ companyId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ serial_number: '', model: '', brand: '', logic_number: '' });

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('cappta_terminals').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    setRows(data ?? []);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const { error } = await (supabase as any).from('cappta_terminals').insert({ company_id: companyId, ...form, status: 'pending' });
    if (error) { toast.error(error.message); return; }
    toast.success('Terminal cadastrado');
    setOpen(false); setForm({ serial_number: '', model: '', brand: '', logic_number: '' }); load();
  };

  return (
    <PaymentsListShell title="Terminais (POS)" description="Maquininhas credenciadas" onRefresh={load} onCreate={() => setOpen(true)} createLabel="Novo terminal">
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Serial</TableHead><TableHead>Modelo</TableHead><TableHead>Marca</TableHead>
            <TableHead>Nº Lógico</TableHead><TableHead>Ativado</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum terminal</TableCell></TableRow>}
            {rows.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.serial_number ?? '—'}</TableCell>
                <TableCell>{t.model ?? '—'}</TableCell>
                <TableCell>{t.brand ?? '—'}</TableCell>
                <TableCell>{t.logic_number ?? '—'}</TableCell>
                <TableCell>{t.activated_at ? new Date(t.activated_at).toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell><Badge variant={t.status === 'active' ? 'default' : 'secondary'}>{t.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo terminal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nº Serial</Label><Input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} /></div>
            <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
            <div><Label>Marca</Label><Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
            <div><Label>Nº Lógico</Label><Input value={form.logic_number} onChange={e => setForm(f => ({ ...f, logic_number: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PaymentsListShell>
  );
}
