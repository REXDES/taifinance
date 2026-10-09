import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

const brl = (v: number) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  done: { label: 'Concluída', variant: 'default' },
  pending: { label: 'Processando', variant: 'secondary' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

export default function SellerTransferPage({ companyId }: { companyId: string }) {
  const [dests, setDests] = useState<{ id: string; name: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase.functions.invoke('seller-transfer', { body: { action: 'destinations', from_company_id: companyId } });
    const list = data?.companies ?? [];
    setDests(list);
    const { data: h } = await (supabase as any).from('seller_transfers').select('*')
      .or(`from_company_id.eq.${companyId},to_company_id.eq.${companyId}`).order('created_at', { ascending: false }).limit(50);
    setHistory(h ?? []);
    const { data: own } = await supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle();
    const map: Record<string, string> = {};
    list.forEach((c: any) => { map[c.id] = c.name; });
    if (own) map[own.id] = own.name;
    setNames(map);
  };
  useEffect(() => { if (companyId) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [companyId]);

  const submit = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!to) return toast.error('Escolha a empresa de destino');
    if (!value || value <= 0) return toast.error('Informe um valor válido');
    setSending(true);
    const { data, error } = await supabase.functions.invoke('seller-transfer', {
      body: { action: 'transfer', from_company_id: companyId, to_company_id: to, amount: value, description: description || undefined, request_id: crypto.randomUUID() },
    });
    setSending(false);
    if (error || data?.ok === false || data?.error) return toast.error(data?.error ?? error?.message ?? 'Falha na transferência');
    toast.success('Transferência enviada'); setAmount(''); setDescription(''); load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transferir entre contas</h1>
        <p className="text-muted-foreground">Envie saldo da sua conta Pagando.net para a conta Pagando.net de outra empresa.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Nova transferência</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Destino</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue placeholder={dests.length ? 'Escolha a empresa' : 'Nenhuma empresa disponível'} /></SelectTrigger>
              <SelectContent>{dests.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Valor (R$)</Label><Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></div>
          <div className="space-y-2"><Label>Descrição</Label><Input maxLength={200} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="md:col-span-3">
            <Button onClick={submit} disabled={sending}>{sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Transferir</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Origem → Destino</TableHead>
              <TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {history.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma transferência.</TableCell></TableRow>}
              {history.map(t => {
                const s = STATUS[t.status] ?? STATUS.pending;
                const out = t.from_company_id === companyId;
                return (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{t.kind === 'disbursement' ? 'Desembolso antecipação' : 'Transferência'}{t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}</TableCell>
                    <TableCell>{names[t.from_company_id] ?? 'Outra empresa'} → {names[t.to_company_id] ?? 'Outra empresa'}</TableCell>
                    <TableCell className="text-right">{out ? '-' : '+'}{brl(t.amount)}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge>{t.error && <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate" title={t.error}>{t.error}</div>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
