import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaymentsListShell } from './PaymentsListShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props { companyId: string }
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PaymentsTransactionsPage({ companyId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('cappta_transactions').select('*').eq('company_id', companyId).order('captured_at', { ascending: false }).limit(200);
    setRows(data ?? []);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);
  return (
    <PaymentsListShell title="Transações" description="Vendas capturadas via terminais Cappta" onRefresh={load}>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>NSU</TableHead><TableHead>Bandeira</TableHead>
            <TableHead>Produto</TableHead><TableHead>Parc.</TableHead>
            <TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Taxa</TableHead>
            <TableHead className="text-right">Líquido</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma transação</TableCell></TableRow>}
            {rows.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.captured_at ? new Date(t.captured_at).toLocaleString('pt-BR') : '—'}</TableCell>
                <TableCell className="font-mono text-xs">{t.nsu ?? '—'}</TableCell>
                <TableCell>{t.brand ?? '—'}</TableCell>
                <TableCell>{t.product ?? '—'}</TableCell>
                <TableCell>{t.installments ?? 1}x</TableCell>
                <TableCell className="text-right">{brl(Number(t.gross_amount || 0))}</TableCell>
                <TableCell className="text-right text-muted-foreground">{brl(Number(t.fee_amount || 0))}</TableCell>
                <TableCell className="text-right font-medium">{brl(Number(t.net_amount || 0))}</TableCell>
                <TableCell><Badge variant={t.status === 'approved' ? 'default' : 'secondary'}>{t.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </PaymentsListShell>
  );
}
