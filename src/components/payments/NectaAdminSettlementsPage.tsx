import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { nectaCall, centsToBRL, brl } from '@/hooks/useNectaApi';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Download } from 'lucide-react';

interface Props { companyId: string | null }

const firstDayOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export function NectaAdminSettlementsPage({ companyId }: Props) {
  const [start, setStart] = useState(firstDayOfMonth());
  const [end, setEnd] = useState(today());
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [merchants, setMerchants] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from('necta_settlements').select('*')
      .order('settlement_date', { ascending: false }).limit(500);
    if (start) q = q.gte('settlement_date', start);
    if (end) q = q.lte('settlement_date', end);
    if (status !== 'all') q = q.eq('status', status);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  }, [start, end, status]);

  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('necta-sale', {
      body: { action: 'settlements_sync', company_id: companyId, start_date: start, end_date: end, limit: 200 },
    });
    setSyncing(false);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    toast.success(`${(data as any)?.saved ?? 0} liquidação(ões) sincronizada(s)`);
    load();
  };

  const openDetail = async (row: any) => {
    setDetail(row);
    setMerchants([]);
    if (!row.necta_settlement_id) return;
    try {
      const resp = await nectaCall<any>(`/settlements/${row.necta_settlement_id}/merchants`);
      setMerchants(Array.isArray(resp) ? resp : (resp?.data ?? []));
    } catch (e) { toast.error((e as Error).message); }
  };

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const t = search.toLowerCase();
    return (r.merchant_name ?? '').toLowerCase().includes(t) || (r.merchant_document ?? '').includes(t);
  });

  const totals = filtered.reduce((acc, r) => ({
    gross: acc.gross + Number(r.gross_amount || 0),
    fee: acc.fee + Number(r.fee_amount || 0),
    net: acc.net + Number(r.net_amount || 0),
  }), { gross: 0, fee: 0, net: 0 });

  const statuses = Array.from(new Set(rows.map(r => r.status).filter(Boolean)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pagamentos — Liquidações</h1>
          <p className="text-muted-foreground text-sm">Liquidações do marketplace com detalhamento por lojista</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">De</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-[150px]" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-[150px]" /></div>
          <div><Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Lojista</Label><Input placeholder="nome ou documento" value={search} onChange={e => setSearch(e.target.value)} className="w-[180px]" /></div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button size="sm" onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Buscar na Necta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[['Bruto', totals.gross], ['Taxas', totals.fee], ['Líquido', totals.net]].map(([label, v]: any) => (
          <Card key={label}><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{brl(v)}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Lojista</TableHead><TableHead>Status</TableHead>
            <TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Taxas</TableHead>
            <TableHead className="text-right">Líquido</TableHead><TableHead className="text-right">Ordens</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma liquidação. Use "Buscar na Necta".</TableCell></TableRow>}
            {filtered.map(r => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => openDetail(r)}>
                <TableCell>{r.settlement_date ? new Date(r.settlement_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell>{r.merchant_name ?? '—'}</TableCell>
                <TableCell><Badge variant="secondary">{r.status ?? '—'}</Badge></TableCell>
                <TableCell className="text-right">{brl(Number(r.gross_amount || 0))}</TableCell>
                <TableCell className="text-right">{brl(Number(r.fee_amount || 0))}</TableCell>
                <TableCell className="text-right">{brl(Number(r.net_amount || 0))}</TableCell>
                <TableCell className="text-right">{r.orders_count ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-3xl">
          <DialogHeader>
            <DialogTitle>Liquidação {detail?.settlement_date ? new Date(detail.settlement_date + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Líquido {brl(Number(detail?.net_amount || 0))} · {detail?.orders_count ?? 0} ordens</p>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Lojista</TableHead><TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Taxas</TableHead><TableHead className="text-right">Líquido</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {merchants.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem detalhamento por lojista</TableCell></TableRow>}
                {merchants.map((m: any, i: number) => (
                  <TableRow key={m.id ?? i}>
                    <TableCell>{m.merchantName ?? m.name ?? m.document ?? '—'}</TableCell>
                    <TableCell className="text-right">{brl(centsToBRL(m.grossAmount ?? m.totalAmount))}</TableCell>
                    <TableCell className="text-right">{brl(centsToBRL(m.feeAmount ?? m.fees))}</TableCell>
                    <TableCell className="text-right">{brl(centsToBRL(m.netAmount ?? m.liquidAmount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
