import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PackageMinus, ShoppingCart, Wallet } from 'lucide-react';

interface Props { companyId: string; }

interface MovementRow {
  id: string;
  movement_type: 'venda' | 'baixa';
  movement_date: string;
  reason: string | null;
  buyer_name: string | null;
  sale_amount: number;
  payment_mode: 'cash' | 'installments' | null;
  down_payment: number;
  installments_count: number | null;
  notes: string | null;
  machine?: { id: string; name: string; brand: string | null; model: string | null; serial_number: string | null; acquisition_value: number } | null;
}

const fmtBRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

export function MachineMovementsReportPage({ companyId }: Props) {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'venda' | 'baixa'>('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [search, setSearch] = useState('');

  const fetchRows = useCallback(async () => {
    if (!companyId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('machine_movements')
      .select('*, machine:machines(id, name, brand, model, serial_number, acquisition_value)')
      .eq('company_id', companyId)
      .order('movement_date', { ascending: false });
    if (error) { console.error(error); toast.error('Erro ao carregar movimentações'); }
    setRows((data || []) as MovementRow[]);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (typeFilter !== 'all' && r.movement_type !== typeFilter) return false;
    if (start && r.movement_date < start) return false;
    if (end && r.movement_date > end) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = [r.machine?.name, r.machine?.serial_number, r.buyer_name, r.reason].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, typeFilter, start, end, search]);

  const stats = useMemo(() => {
    const sales = filtered.filter(r => r.movement_type === 'venda');
    const writeOffs = filtered.filter(r => r.movement_type === 'baixa');
    return {
      salesCount: sales.length,
      salesTotal: sales.reduce((s, r) => s + Number(r.sale_amount || 0), 0),
      writeOffCount: writeOffs.length,
      writeOffValue: writeOffs.reduce((s, r) => s + Number(r.machine?.acquisition_value || 0), 0),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Vendidos e Baixados</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Itens vendidos</CardTitle>
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.salesCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de vendas</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(stats.salesTotal)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Itens baixados</CardTitle>
            <PackageMinus className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.writeOffCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valor baixado (aquisição)</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(stats.writeOffValue)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label>Tipo</Label>
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="venda">Vendas</SelectItem>
                <SelectItem value="baixa">Baixas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>De</Label><Input type="date" className="w-40" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" className="w-40" value={end} onChange={e => setEnd(e.target.value)} /></div>
          <div className="flex-1 min-w-[200px]"><Label>Buscar</Label><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Item, nº série, comprador ou motivo" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Item</TableHead>
                  <TableHead>Nº Série</TableHead><TableHead>Comprador / Motivo</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor aquisição</TableHead>
                  <TableHead className="text-right">Valor venda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={8}>Carregando...</TableCell></TableRow> :
                  filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma movimentação encontrada</TableCell></TableRow> :
                  filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{fmtDate(r.movement_date)}</TableCell>
                      <TableCell>
                        <Badge variant={r.movement_type === 'venda' ? 'default' : 'destructive'}>
                          {r.movement_type === 'venda' ? 'Venda' : 'Baixa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.machine?.name || '-'}
                        <div className="text-xs text-muted-foreground">{[r.machine?.brand, r.machine?.model].filter(Boolean).join(' ')}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.machine?.serial_number || '-'}</TableCell>
                      <TableCell>{r.movement_type === 'venda' ? (r.buyer_name || '-') : (r.reason || '-')}</TableCell>
                      <TableCell>
                        {r.movement_type === 'venda'
                          ? (r.payment_mode === 'cash'
                            ? 'À vista'
                            : `Parcelado ${r.installments_count || 1}x${Number(r.down_payment) > 0 ? ` + entrada ${fmtBRL(Number(r.down_payment))}` : ''}`)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(r.machine?.acquisition_value || 0))}</TableCell>
                      <TableCell className="text-right">{r.movement_type === 'venda' ? fmtBRL(Number(r.sale_amount)) : '-'}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
