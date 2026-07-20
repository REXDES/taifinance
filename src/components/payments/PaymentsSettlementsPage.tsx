import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaymentsListShell } from './PaymentsListShell';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props { companyId: string }
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PaymentsSettlementsPage({ companyId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('cappta_settlements').select('*').eq('company_id', companyId).order('settlement_date', { ascending: false }).limit(200);
    setRows(data ?? []);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);
  return (
    <PaymentsListShell title="Liquidações" description="Repasses recebidos da Cappta" onRefresh={load}>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead className="text-right">Bruto</TableHead>
            <TableHead className="text-right">Taxas</TableHead><TableHead className="text-right">Líquido</TableHead>
            <TableHead className="text-right">Qtd Tx</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma liquidação</TableCell></TableRow>}
            {rows.map(s => (
              <TableRow key={s.id}>
                <TableCell>{new Date(s.settlement_date + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="text-right">{brl(Number(s.gross_amount || 0))}</TableCell>
                <TableCell className="text-right text-muted-foreground">{brl(Number(s.fee_amount || 0))}</TableCell>
                <TableCell className="text-right font-medium">{brl(Number(s.net_amount || 0))}</TableCell>
                <TableCell className="text-right">{s.transactions_count ?? 0}</TableCell>
                <TableCell>{s.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </PaymentsListShell>
  );
}
