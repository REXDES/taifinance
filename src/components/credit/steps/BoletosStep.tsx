import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseLocalDate } from '@/lib/dateUtils';
import { useCompanyPaymentsFlag } from '@/hooks/usePaymentsModule';
import { NectaChargesPage } from '@/components/payments/NectaChargesPage';
import { PaymentsBrandName } from '@/contexts/ModuleBrandingContext';

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
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [prefill, setPrefill] = useState<Record<string, string> | null>(null);
  const { enabled: paymentsEnabled } = useCompanyPaymentsFlag(companyId);

  const [sales, setSales] = useState<Record<string, any>>({});

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
      const ids = (pr || []).map((p: any) => p.id);
      if (ids.length) {
        const { data: s } = await (supabase as any).from('necta_sales')
          .select('id, payable_receivable_id, status, boleto_digitable_line, boleto_url, payment_url')
          .in('payable_receivable_id', ids);
        setSales(Object.fromEntries((s || []).map((x: any) => [x.payable_receivable_id, x])));
      } else setSales({});
    }
    setLoading(false);
  }, [applicationId]);

  // Liga cada cobrança emitida no gateway a uma parcela de Contas a Receber do contrato
  const linkGatewaySales = async (created: any[]) => {
    if (!contract || !created?.length) { await refetch(); return; }
    const total = created.length;
    for (let i = 0; i < total; i++) {
      const s = created[i];
      if (!s?.id) continue;
      const { data: pr, error } = await (supabase as any).from('payables_receivables').insert({
        company_id: companyId,
        type: 'receivable',
        description: `${contract.description ?? 'Crédito'} (${i + 1}/${total})`,
        amount: s.amount,
        due_date: s.due_date ?? contract.first_due_date,
        payment_type: total > 1 ? 'installment' : 'single',
        status: 'pending',
        installment_number: i + 1,
        total_installments: total,
        client_supplier_id: clientSupplierId,
        credit_contract_id: contract.id,
        created_by: userId,
      }).select('id').maybeSingle();
      if (error) { toast.error('Erro ao criar parcela: ' + error.message); continue; }
      await (supabase as any).from('necta_sales').update({ payable_receivable_id: pr.id }).eq('id', s.id);
    }
    await (supabase as any).from('credit_applications').update({ status: 'contracted', current_step: 6 }).eq('id', applicationId);
    onCompleted();
    await refetch();
  };

  // Emissão via gateway (Pagando.net): pré-preenche a cobrança com os dados do contrato e do cliente
  const openGatewayCharge = async () => {
    if (!contract) return;
    const [{ data: app }, { data: qual }] = await Promise.all([
      (supabase as any).from('credit_applications').select('nome, documento').eq('id', applicationId).maybeSingle(),
      (supabase as any).from('credit_qualifications').select('whatsapp_phone, email, endereco_entrega, cidade, uf, cep').eq('application_id', applicationId).maybeSingle(),
    ]);
    const n = Number(contract.num_parcelas ?? 1);
    setPrefill({
      method: 'bank_slip',
      amount: String(contract.parcela_amount != null ? Number(contract.parcela_amount).toFixed(2) : ''),
      description: contract.description ?? '',
      installments: '1',
      is_recurring: (n > 1) as any,
      recurrence_interval: 'monthly',
      recurrence_count: String(n),
      due_date: contract.first_due_date ?? '',
      payer_name: app?.nome ?? '',
      payer_document: app?.documento ?? '',
      payer_email: qual?.email ?? '',
      payer_phone: qual?.whatsapp_phone ?? '',
      payer_address_street: qual?.endereco_entrega ?? '',
      payer_address_city: qual?.cidade ?? '',
      payer_address_state: qual?.uf ?? '',
      payer_address_postal_code: qual?.cep ?? '',
    });
    setGatewayOpen(true);
  };

  useEffect(() => { refetch(); }, [refetch]);

  const generate = async () => {
    if (!contract) return;
    setGenerating(true);
    try {
      const base = parseLocalDate(contract.first_due_date);
      const rows = Array.from({ length: contract.num_parcelas }, (_, i) => {
        const d = new Date(base); d.setMonth(d.getMonth() + i);
        const due = d.toISOString().slice(0, 10);
        return {
          company_id: companyId,
          type: 'receivable',
          description: `${contract.description} (${i + 1}/${contract.num_parcelas})`,
          amount: contract.parcela_amount,
          due_date: due,
          payment_type: contract.num_parcelas > 1 ? 'installment' : 'single',
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
  if (!contract) return <p className="p-4 text-sm text-muted-foreground">Conclua a formalização antes de criar as parcelas.</p>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Parcelas / Recebíveis</h3>
        {items.length > 0 && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Geradas</Badge>}
      </div>

      {items.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Crie as {contract.num_parcelas} parcelas no módulo de Contas a Receber. Cada parcela usará a chave PIX configurada na empresa.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
              Gerar parcelas (Cobrança Própria)
            </Button>
            {paymentsEnabled && (
              <Button variant="secondary" onClick={openGatewayCharge} title="Boleto/PIX emitidos pelo gateway — o valor cai na conta Pagando.net e fica disponível para antecipação">
                Emitir via <span className="ml-1"><PaymentsBrandName /></span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Boleto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.installment_number}/{p.total_installments}</TableCell>
                <TableCell>{parseLocalDate(p.due_date).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="text-right">R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  {p.status === 'paid'
                    ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Pago</Badge>
                    : <Badge variant="outline">Pendente</Badge>}
                </TableCell>
                <TableCell>
                  {sales[p.id] ? (
                    <div className="flex flex-wrap gap-1">
                      {sales[p.id].boleto_digitable_line && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigator.clipboard.writeText(sales[p.id].boleto_digitable_line).then(() => toast.success('Linha digitável copiada'))}>Copiar linha</Button>
                      )}
                      {(sales[p.id].boleto_url || sales[p.id].payment_url) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                          <a href={sales[p.id].boleto_url || sales[p.id].payment_url} target="_blank" rel="noreferrer">Abrir boleto</a>
                        </Button>
                      )}
                      {!sales[p.id].boleto_digitable_line && !sales[p.id].boleto_url && !sales[p.id].payment_url && <span className="text-xs text-muted-foreground">Emitido ({sales[p.id].status})</span>}
                    </div>
                  ) : <span className="text-xs text-muted-foreground">Cobrança própria</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {paymentsEnabled && (
        <NectaChargesPage
          companyId={companyId}
          dialogOnly
          externalOpen={gatewayOpen}
          onExternalOpenChange={setGatewayOpen}
          prefill={prefill ?? undefined}
          onCreated={linkGatewaySales}
        />
      )}
    </div>
  );
}
