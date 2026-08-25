import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Copy, ExternalLink, MessageCircle, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useCreditRules } from '@/hooks/useCreditModule';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SimulationData } from './SimulationStep';

type Contract = {
  id: string;
  pdf_url: string | null;
  contract_status: string;
  whatsapp_accepted_at: string | null;
  whatsapp_accepted_ip: string | null;
  principal_amount: number;
  parcela_amount: number;
  num_parcelas: number;
  juros_mensal_pct: number;
  total_amount: number;
  first_due_date: string;
  description: string;
};

export function ContractStep({
  applicationId,
  companyId,
  application,
  pendingSimulation,
  onCompleted,
  canApprove,
}: {
  applicationId: string;
  companyId: string;
  application: { nome: string | null; documento: string; tipo_documento: string };
  pendingSimulation: SimulationData | null;
  onCompleted: () => void;
  canApprove: boolean;
}) {
  const { rules } = useCreditRules(companyId);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [company, setCompany] = useState<any>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: qual }, { data: comp }] = await Promise.all([
      (supabase as any).from('credit_contracts').select('*').eq('application_id', applicationId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from('credit_qualifications').select('whatsapp_phone').eq('application_id', applicationId).maybeSingle(),
      (supabase as any).from('companies').select('name, fantasy_name, cnpj, address, city, state').eq('id', companyId).maybeSingle(),
    ]);
    setContract(c);
    setWhatsapp(qual?.whatsapp_phone || '');
    setCompany(comp);
    setLoading(false);
  }, [applicationId, companyId]);

  useEffect(() => { refetch(); }, [refetch]);

  const generatePdf = async (data: SimulationData, contractId: string): Promise<string> => {
    const doc = new jsPDF();
    const margin = 14;
    let y = 18;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRATO DE VENDA A PRAZO', 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Credor: ${company?.fantasy_name || company?.name || ''}${company?.cnpj ? ' - CNPJ: ' + company.cnpj : ''}`, margin, y); y += 5;
    doc.text(`${company?.address || ''} ${company?.city || ''}/${company?.state || ''}`, margin, y); y += 8;
    doc.text(`Devedor: ${application.nome || ''} - ${application.tipo_documento}: ${application.documento}`, margin, y); y += 8;
    doc.setFont('helvetica', 'bold'); doc.text('Operação:', margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Descrição: ${data.description}`, margin, y); y += 5;
    doc.text(`Valor principal: R$ ${data.principal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 5;
    doc.text(`Juros mensal: ${data.juros_mensal_pct}% · ${data.num_parcelas}x de R$ ${data.parcela_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 5;
    doc.text(`Total: R$ ${data.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · 1º vencimento: ${new Date(data.first_due_date + 'T00:00:00').toLocaleDateString('pt-BR')}`, margin, y); y += 8;

    const base = new Date(data.first_due_date + 'T00:00:00');
    const rows = Array.from({ length: data.num_parcelas }, (_, i) => {
      const d = new Date(base); d.setMonth(d.getMonth() + i);
      return [String(i + 1), d.toLocaleDateString('pt-BR'), `R$ ${data.parcela_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`];
    });
    autoTable(doc, { head: [['Parcela', 'Vencimento', 'Valor']], body: rows, startY: y, theme: 'grid', styles: { fontSize: 9 } });
    y = (doc as any).lastAutoTable.finalY + 8;

    if (rules?.contract_clauses) {
      doc.setFont('helvetica', 'bold'); doc.text('Cláusulas:', margin, y); y += 5;
      doc.setFont('helvetica', 'normal');
      const split = doc.splitTextToSize(rules.contract_clauses, 180);
      doc.text(split, margin, y);
      y += split.length * 4.5;
    }
    if (rules) {
      doc.text(`Em caso de atraso: multa de ${rules.multa_atraso_pct}% + mora diária de ${rules.mora_diaria_pct}%.`, margin, y); y += 8;
    }
    doc.text(`Documento aceito eletronicamente via WhatsApp em ${new Date().toLocaleString('pt-BR')}.`, margin, y);

    const blob = doc.output('blob');
    const path = `contracts/${applicationId}/${contractId}.pdf`;
    const { error } = await (supabase as any).storage.from('credit-documents').upload(path, blob, { contentType: 'application/pdf', upsert: true });
    if (error) throw error;
    return path;
  };

  const generate = async () => {
    if (!pendingSimulation) { toast.error('Volte para a Simulação e confirme os dados primeiro'); return; }
    setGenerating(true);
    try {
      const { data: created, error } = await (supabase as any).from('credit_contracts').insert({
        application_id: applicationId,
        company_id: companyId,
        principal_amount: pendingSimulation.principal,
        num_parcelas: pendingSimulation.num_parcelas,
        juros_mensal_pct: pendingSimulation.juros_mensal_pct,
        parcela_amount: pendingSimulation.parcela_amount,
        total_amount: pendingSimulation.total_amount,
        first_due_date: pendingSimulation.first_due_date,
        description: pendingSimulation.description,
        contract_status: 'active',
      }).select().single();
      if (error) throw error;
      const pdfPath = await generatePdf(pendingSimulation, created.id);
      await (supabase as any).from('credit_contracts').update({ pdf_url: pdfPath }).eq('id', created.id);
      toast.success('Contrato gerado');
      await refetch();
    } catch (e: any) {
      toast.error('Erro ao gerar contrato: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async () => {
    if (!contract?.pdf_url) return;
    const { data } = await (supabase as any).storage.from('credit-documents').createSignedUrl(contract.pdf_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const sendWhatsApp = async () => {
    if (!whatsapp || !contract?.pdf_url) return;
    const { data } = await (supabase as any).storage.from('credit-documents').createSignedUrl(contract.pdf_url, 7 * 24 * 3600);
    const url = data?.signedUrl || '';
    const msg = encodeURIComponent(`Olá! Segue o contrato da sua compra a prazo. Confirme o aceite respondendo "ACEITO". Link: ${url}`);
    const phone = whatsapp.replace(/\D/g, '');
    const full = phone.length === 10 || phone.length === 11 ? `55${phone}` : phone;
    window.open(`https://wa.me/${full}?text=${msg}`, '_blank');
  };

  const registerAccept = async () => {
    if (!contract) return;
    let ip = '';
    try { ip = await fetch('https://api.ipify.org').then(r => r.text()); } catch {}
    await (supabase as any).from('credit_contracts').update({
      whatsapp_accepted_at: new Date().toISOString(),
      whatsapp_accepted_ip: ip || null,
    }).eq('id', contract.id);
    await (supabase as any).from('credit_applications').update({ current_step: 6 }).eq('id', applicationId).lt('current_step', 6);
    toast.success('Aceite registrado');
    onCompleted();
    refetch();
  };

  if (loading) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  if (!contract) {
    return (
      <div className="p-4 space-y-3">
        <h3 className="text-base font-semibold">Contrato digital</h3>
        {pendingSimulation ? (
          <>
            <p className="text-sm text-muted-foreground">Gere o contrato em PDF com base na simulação confirmada.</p>
            <Button onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Gerar contrato (PDF)
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Volte para a etapa Simulação e confirme os dados.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Contrato digital</h3>
        {contract.whatsapp_accepted_at
          ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Aceito</Badge>
          : <Badge variant="outline">Aguardando aceite</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Principal" value={`R$ ${Number(contract.principal_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <Stat label="Parcelas" value={`${contract.num_parcelas}x R$ ${Number(contract.parcela_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <Stat label="Total" value={`R$ ${Number(contract.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={downloadPdf}><Download className="w-3 h-3 mr-1" />Baixar PDF</Button>
        <Button size="sm" variant="outline" onClick={sendWhatsApp}><MessageCircle className="w-3 h-3 mr-1" />Enviar por WhatsApp</Button>
        {!contract.whatsapp_accepted_at && canApprove && (
          <Button size="sm" onClick={registerAccept}><CheckCircle2 className="w-3 h-3 mr-1" />Registrar aceite</Button>
        )}
      </div>

      {contract.whatsapp_accepted_at && (
        <p className="text-xs text-muted-foreground">
          Aceito em {new Date(contract.whatsapp_accepted_at).toLocaleString('pt-BR')}
          {contract.whatsapp_accepted_ip && ` · IP ${contract.whatsapp_accepted_ip}`}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-card p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
