import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Copy, ExternalLink, FileText, Loader2, QrCode, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Method = 'transfer' | 'pix' | 'bank_slip' | 'manual';
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const OPTIONS: { id: Method; title: string; desc: string; icon: any }[] = [
  { id: 'transfer', title: 'Transferência Pagando.net', desc: 'Sai do saldo da sua conta Pagando.net direto para o cedente.', icon: ArrowRightLeft },
  { id: 'pix', title: 'Cobrança PIX', desc: 'O cedente gera um PIX e você paga de qualquer banco.', icon: QrCode },
  { id: 'bank_slip', title: 'Cobrança boleto', desc: 'O cedente gera um boleto (vence em 2 dias) e você paga de qualquer banco.', icon: FileText },
  { id: 'manual', title: 'Cobrança própria', desc: 'Você paga por fora (TED/PIX) e registra aqui, com comprovante.', icon: Wallet },
];

interface Props { assignment: any | null; companyId: string; onClose: () => void; onDone: () => void }

export function DisburseDialog({ assignment: a, companyId, onClose, onDone }: Props) {
  const [method, setMethod] = useState<Method>('transfer');
  const [busy, setBusy] = useState(false);
  const [sale, setSale] = useState<any>(null);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke('seller-transfer', { body: { assignment_id: a.id, ...body } });
    const err = data?.error ?? (data?.ok === false ? 'Falha' : null) ?? error?.message;
    if (err) throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
    return data;
  };

  useEffect(() => {
    setSale(null); setNote(''); setFile(null);
    if (!a) return;
    if (a.disbursement_method === 'pix_charge') setMethod('pix');
    else if (a.disbursement_method === 'boleto_charge') setMethod('bank_slip');
    else setMethod('transfer');
    if (a.disbursement_sale_id) call({ action: 'disburse_status' }).then(d => setSale(d.sale)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  if (!a) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const confirm = () => run(async () => {
    if (method === 'transfer') {
      await call({ action: 'disburse' });
      toast.success('Desembolso enviado'); onDone(); onClose();
    } else if (method === 'manual') {
      let proof: string | undefined;
      if (file) {
        proof = `${companyId}/disbursements/${a.id}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from('anticipation-docs').upload(proof, file);
        if (error) throw new Error(error.message);
      }
      await call({ action: 'disburse_manual', proof_path: proof, note: note || undefined });
      toast.success('Desembolso registrado'); onDone(); onClose();
    } else {
      const d = await call({ action: 'disburse_charge', method });
      setSale(d.sale); toast.success('Cobrança gerada'); onDone();
    }
  });

  const check = () => run(async () => {
    const d = await call({ action: 'disburse_status' });
    setSale(d.sale);
    if (d.disbursed) { toast.success('Pagamento confirmado — desembolso concluído'); onDone(); onClose(); }
    else toast.info('Pagamento ainda não identificado');
  });

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('Copiado'); };
  const showSale = sale && (method === 'pix' || method === 'bank_slip') && sale.method === method;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg overflow-y-auto max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Desembolsar ao cedente</DialogTitle>
          <DialogDescription>{a.title_description} — valor líquido <b>{brl(a.net_amount)}</b></DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {OPTIONS.map(o => (
            <button key={o.id} type="button" onClick={() => setMethod(o.id)}
              className={cn('flex gap-3 rounded-md border p-3 text-left transition-colors', method === o.id ? 'border-primary bg-primary/5' : 'hover:bg-muted')}>
              <o.icon className="w-5 h-5 mt-0.5 text-primary shrink-0" />
              <div><div className="font-medium text-sm">{o.title}</div><div className="text-xs text-muted-foreground">{o.desc}</div></div>
            </button>
          ))}
        </div>

        {method === 'manual' && (
          <div className="space-y-2">
            <Label>Comprovante (opcional)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <Label>Observação (opcional)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ex.: TED Banco X em 29/10" />
          </div>
        )}

        {showSale && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{method === 'pix' ? 'PIX gerado' : 'Boleto gerado'}</span>
              <Badge variant={sale.status === 'paid' ? 'default' : 'secondary'}>{sale.status === 'paid' ? 'Pago' : 'Aguardando pagamento'}</Badge>
            </div>
            {sale.pix_copy_paste && <Button variant="outline" size="sm" className="w-full" onClick={() => copy(sale.pix_copy_paste)}><Copy className="w-3 h-3 mr-2" />Copiar PIX copia e cola</Button>}
            {sale.boleto_digitable_line && <Button variant="outline" size="sm" className="w-full" onClick={() => copy(sale.boleto_digitable_line)}><Copy className="w-3 h-3 mr-2" />Copiar linha digitável</Button>}
            {(sale.boleto_url || sale.payment_url) && <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(sale.boleto_url || sale.payment_url, '_blank', 'noopener')}><ExternalLink className="w-3 h-3 mr-2" />Abrir boleto</Button>}
            {!sale.pix_copy_paste && !sale.boleto_digitable_line && <p className="text-xs text-muted-foreground">Código ainda sendo gerado — clique em "Verificar pagamento" em instantes.</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          {showSale
            ? <Button onClick={check} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}Verificar pagamento</Button>
            : <Button onClick={confirm} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {method === 'transfer' ? 'Transferir' : method === 'manual' ? 'Registrar pagamento' : 'Gerar cobrança'}
              </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
