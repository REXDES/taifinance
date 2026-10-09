import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  const [sellerId, setSellerId] = useState('');
  const [found, setFound] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data: h } = await (supabase as any).from('seller_transfers').select('*')
      .or(`from_company_id.eq.${companyId},to_company_id.eq.${companyId}`).order('created_at', { ascending: false }).limit(50);
    setHistory(h ?? []);
    const { data: own } = await supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle();
    const map: Record<string, string> = {};
    if (own) map[own.id] = own.name;
    setNames(map);
  };
  useEffect(() => { if (companyId) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [companyId]);

  const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sellerId.trim());
  const lookup = async () => {
    setFound(null);
    if (!uuidOk) return toast.error('Código inválido (formato UUID)');
    setLooking(true);
    const { data, error } = await supabase.functions.invoke('seller-transfer', { body: { action: 'lookup', from_company_id: companyId, seller_id: sellerId.trim() } });
    setLooking(false);
    if (error || !data?.ok) return toast.error(data?.error ?? 'Conta não encontrada');
    setFound(data.name);
  };

  const submit = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!found) return toast.error('Busque e confirme a conta de destino');
    if (!value || value <= 0) return toast.error('Informe um valor válido');
    if (!confirm(`Transferir ${brl(value)} para ${found}?`)) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('seller-transfer', {
      body: { action: 'transfer', from_company_id: companyId, to_seller_id: sellerId.trim(), amount: value, description: description || undefined, request_id: crypto.randomUUID() },
    });
    setSending(false);
    if (error || data?.ok === false || data?.error) return toast.error(data?.error ?? error?.message ?? 'Falha na transferência');
    toast.success('Transferência enviada'); setAmount(''); setDescription(''); setSellerId(''); setFound(null); load();
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
          <div className="space-y-2 md:col-span-3">
            <Label>Código da conta de destino (UUID do seller Pagando.net)</Label>
            <div className="flex gap-2">
              <Input value={sellerId} onChange={e => { setSellerId(e.target.value); setFound(null); }} placeholder="00000000-0000-0000-0000-000000000000" />
              <Button variant="outline" onClick={lookup} disabled={looking || !uuidOk}>{looking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Buscar</Button>
            </div>
            {found && <p className="text-sm">Destinatário: <strong>{found}</strong></p>}
          </div>
          <div className="space-y-2"><Label>Valor (R$)</Label><Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></div>
          <div className="space-y-2"><Label>Descrição</Label><Input maxLength={200} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="md:col-span-3">
            <Button onClick={submit} disabled={sending || !found}>{sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Transferir</Button>
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
                    <TableCell>{names[t.from_company_id] ?? 'Outra empresa'} → {t.to_seller_name ?? names[t.to_company_id] ?? 'Outra conta'}</TableCell>
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
