import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaymentsListShell } from './PaymentsListShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props { companyId: string }

export function PaymentsWebhooksPage({ companyId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const webhookUrl = `${supaUrl}/functions/v1/cappta-webhook`;

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('cappta_webhook_events').select('*').eq('company_id', companyId).order('received_at', { ascending: false }).limit(200);
    setRows(data ?? []);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  return (
    <PaymentsListShell title="Webhooks" description="Eventos recebidos da Cappta" onRefresh={load}>
      <Card>
        <CardHeader><CardTitle className="text-base">URL para configurar na Cappta</CardTitle></CardHeader>
        <CardContent>
          <code className="block p-2 rounded bg-muted text-xs break-all">{webhookUrl}</code>
          <p className="text-xs text-muted-foreground mt-2">Configure esta URL no portal Cappta para receber eventos de transação, cobrança e liquidação.</p>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Recebido</TableHead><TableHead>Evento</TableHead>
            <TableHead>Processado</TableHead><TableHead>Erro</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum evento</TableCell></TableRow>}
            {rows.map(e => (
              <TableRow key={e.id}>
                <TableCell>{new Date(e.received_at).toLocaleString('pt-BR')}</TableCell>
                <TableCell className="font-mono text-xs">{e.event_type}</TableCell>
                <TableCell><Badge variant={e.processed ? 'default' : 'secondary'}>{e.processed ? 'Sim' : 'Não'}</Badge></TableCell>
                <TableCell className="text-destructive text-xs">{e.error ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </PaymentsListShell>
  );
}
