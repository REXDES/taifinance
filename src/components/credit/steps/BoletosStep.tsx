import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function BoletosStep({
  applicationId,
  companyId,
  clientSupplierId,
  onCompleted,
  userId,
}: {
  applicationId: string;
  companyId: string;
  clientSupplierId: string | null;
  userId: string | null;
  onCompleted: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: c } = await (supabase as any).from('credit_contracts').select('*').eq('application_id', applicationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setContract(c);
    if (c) {
      const { data: pr } = await (supabase as any).from('payables_receivables')
        .select('*')
        .eq('credit_contract_id', c.id)
        .order('installment_number', { ascending: true });
      setItems(pr || []);
    }
    setLoading(false);
  }, [applicationId]);

  useEffect(() => { refetch(); }, [refetch]);

  const generate = async () => {
    if (!contract) return;
    setGenerating(true);
    try {
      const base = new Date(contract.first_due_date + 'T00:00:00');
      const rows = Array.from({ length: contract.num_parcelas }, (_, i) => {
        const d = new Date(base); d.setMonth(d.getMonth() + i);
        const due = d.toISOString().slice(0, 10);
        return {
          company_id: companyId,
          type: 'receivable',
          description: `${contract.description} (${i + 1}/${contract.num_parcelas})`,
          amount: contract.parcela_amount,
          due_date: due,
          payment_type: 'pix',
          status: 'pending',
          installment_number: i + 1,
          total_installments: contract.num_parcelas,
          client_supplier_id: clientSupplierId,
          credit_contract_id: contract.id,
          created_by: userId,
        };
      });
      const { error } = await (supabase as any).from('payables_receivables').insert(rows);
      if (error) throw error;
      await (supabase as any).from('credit_applications').update({ status: 'contracted', current_step: 6 }).eq('id', applicationId);
      toast.success(`${rows.length} parcelas geradas em Contas a Receber`);
      onCompleted();
      await refetch();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!contract) return <p className="p-4 text-sm text-muted-foreground">Gere o contrato antes de criar as parcelas.</p>;
  if (!contract.whatsapp_accepted_at) return <p className="p-4 text-sm text-muted-foreground">Aguardando aceite do contrato pelo cliente.</p>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Parcelas / Recebíveis</h3>
        {items.length > 0 && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Geradas</Badge>}
      </div>

      {items.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Crie as {contract.num_parcelas} parcelas no módulo de Contas a Receber. Cada parcela usará a chave PIX configurada na empresa.</p>
          <Button onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
            Gerar parcelas
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.installment_number}/{p.total_installments}</TableCell>
                <TableCell>{new Date(p.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="text-right">R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  {p.status === 'paid'
                    ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Pago</Badge>
                    : <Badge variant="outline">Pendente</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
