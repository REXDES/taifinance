import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, Copy, ExternalLink, MessageCircle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Biometry = {
  id: string;
  public_token: string;
  status: string;
  selfie_url: string | null;
  doc_front_url: string | null;
  doc_back_url: string | null;
  similarity_score: number | null;
  liveness_passed: boolean | null;
  ocr_data: any;
  ai_analysis: any;
  rejection_reason: string | null;
  completed_at: string | null;
  link_sent_at: string | null;
};

export function BiometryStep({
  applicationId,
  companyId,
  onCompleted,
  canApprove,
}: {
  applicationId: string;
  companyId: string;
  onCompleted: () => void;
  canApprove: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState<Biometry | null>(null);
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const refetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [{ data: bioData }, { data: qual }] = await Promise.all([
      (supabase as any).from('credit_biometry').select('*').eq('application_id', applicationId).maybeSingle(),
      (supabase as any).from('credit_qualifications').select('whatsapp_phone').eq('application_id', applicationId).maybeSingle(),
    ]);
    setBio(bioData);
    setWhatsapp(qual?.whatsapp_phone || '');
    if (!loading || !silent) setLoading(false);
  }, [applicationId, loading]);

  useEffect(() => { refetch(false); }, [applicationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh silencioso enquanto pendente/analisando (não pisca a tela)
  useEffect(() => {
    if (!bio || bio.status === 'approved' || bio.status === 'rejected') return;
    const t = setInterval(() => refetch(true), 5000);
    return () => clearInterval(t);
  }, [bio?.status, refetch]); // eslint-disable-line react-hooks/exhaustive-deps


  const generate = async () => {
    setCreating(true);
    const { error } = await (supabase as any).from('credit_biometry').insert({
      application_id: applicationId,
      company_id: companyId,
      status: 'pending',
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Link de biometria gerado');
    await refetch();
  };

  const publicUrl = bio ? `${window.location.origin}/credit/biometry/${bio.public_token}` : '';

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado');
  };

  const sendWhatsApp = async () => {
    if (!whatsapp) { toast.error('Cliente sem WhatsApp na qualificação'); return; }
    const text = `Olá! Para concluir sua análise de crédito, faça sua biometria neste link: ${publicUrl}`;
    let sentViaApi = false;
    try {
      const { data, error } = await (supabase as any).functions.invoke('notify-whatsapp', {
        body: { action: 'send_text', to: whatsapp, text },
      });
      if (!error && data?.ok) {
        sentViaApi = true;
        toast.success('Mensagem enviada via WhatsApp');
      } else {
        const reason = data?.data?.error?.message || error?.message || 'Janela de 24h expirada ou número não habilitado';
        toast.error(`Não foi possível enviar pelo sistema: ${reason}. Abrindo WhatsApp Web…`);
      }
    } catch (e: any) {
      toast.error('Falha ao chamar o serviço de WhatsApp. Abrindo WhatsApp Web…');
    }
    if (!sentViaApi) {
      const phone = whatsapp.replace(/\D/g, '');
      const full = phone.length === 10 || phone.length === 11 ? `55${phone}` : phone;
      window.open(`https://wa.me/${full}?text=${encodeURIComponent(text)}`, '_blank');
    }
    if (bio && !bio.link_sent_at) {
      await (supabase as any).from('credit_biometry').update({ link_sent_at: new Date().toISOString(), status: bio.status === 'pending' ? 'sent' : bio.status }).eq('id', bio.id);
      refetch(true);
    }
  };

  const manualDecision = async (decision: 'approved' | 'rejected') => {
    if (!bio) return;
    await (supabase as any).from('credit_biometry').update({
      status: decision,
      completed_at: new Date().toISOString(),
      rejection_reason: decision === 'rejected' ? 'Reprovado manualmente pelo gerente' : null,
    }).eq('id', bio.id);
    if (decision === 'approved') {
      await (supabase as any).from('credit_applications').update({ current_step: 5 }).eq('id', applicationId).lt('current_step', 5);
      toast.success('Biometria aprovada manualmente');
      onCompleted();
    } else {
      toast.success('Biometria rejeitada');
    }
    refetch();
  };

  useEffect(() => {
    if (bio?.status === 'approved') {
      (supabase as any).from('credit_applications').update({ current_step: 5 }).eq('id', applicationId).lt('current_step', 5);
    }
  }, [bio?.status, applicationId]);

  if (loading) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  if (!bio) {
    return (
      <div className="p-4 space-y-3">
        <h3 className="text-base font-semibold">Biometria do cliente</h3>
        <p className="text-sm text-muted-foreground">Gere um link único para o cliente capturar selfie + documento. A análise é feita por IA e segue os parâmetros configurados em Regras de crédito.</p>
        <Button onClick={generate} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
          Gerar link de biometria
        </Button>
      </div>
    );
  }

  const statusBadge = bio.status === 'approved'
    ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Aprovada</Badge>
    : bio.status === 'rejected'
    ? <Badge className="bg-destructive/15 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" />Rejeitada</Badge>
    : bio.status === 'analyzing'
    ? <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Analisando</Badge>
    : <Badge variant="outline">{bio.status}</Badge>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Biometria do cliente</h3>
        {statusBadge}
      </div>

      <div className="rounded border bg-muted/30 p-3 space-y-2">
        <div className="text-xs text-muted-foreground">Link público para o cliente</div>
        <div className="flex gap-2">
          <input readOnly value={publicUrl} className="flex-1 bg-background border rounded px-2 py-1 text-xs font-mono" />
          <Button size="sm" variant="outline" onClick={copyLink}><Copy className="w-3 h-3" /></Button>
          <Button size="sm" variant="outline" onClick={() => window.open(publicUrl, '_blank')}><ExternalLink className="w-3 h-3" /></Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={sendWhatsApp}><MessageCircle className="w-3 h-3 mr-1" />Enviar por WhatsApp</Button>
          <Button size="sm" variant="ghost" onClick={refetch}><RefreshCw className="w-3 h-3 mr-1" />Atualizar</Button>
        </div>
        {bio.link_sent_at && <p className="text-[11px] text-muted-foreground">Enviado em {new Date(bio.link_sent_at).toLocaleString('pt-BR')}</p>}
      </div>

      {(bio.selfie_url || bio.doc_front_url) && (
        <div className="grid grid-cols-3 gap-2">
          {bio.selfie_url && <Thumb url={bio.selfie_url} label="Selfie" />}
          {bio.doc_front_url && <Thumb url={bio.doc_front_url} label="Doc (frente)" />}
          {bio.doc_back_url && <Thumb url={bio.doc_back_url} label="Doc (verso)" />}
        </div>
      )}

      {bio.similarity_score != null && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Similaridade IA" value={`${bio.similarity_score}%`} />
          <Stat label="Liveness" value={bio.liveness_passed ? 'Passou' : 'Falhou'} />
        </div>
      )}
      {bio.ai_analysis?.reasoning && (
        <div className="text-xs text-muted-foreground rounded border p-2 bg-muted/30">
          <div className="font-semibold mb-1">Análise da IA</div>
          {bio.ai_analysis.reasoning}
        </div>
      )}
      {bio.rejection_reason && (
        <div className="text-xs text-destructive rounded border border-destructive/30 bg-destructive/5 p-2">
          {bio.rejection_reason}
        </div>
      )}

      {canApprove && bio.status !== 'approved' && bio.status !== 'rejected' && (bio.selfie_url || bio.similarity_score != null) && (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => manualDecision('rejected')}>Rejeitar manualmente</Button>
          <Button size="sm" onClick={() => manualDecision('approved')}>Aprovar manualmente</Button>
        </div>
      )}
    </div>
  );
}

function Thumb({ url, label }: { url: string; label: string }) {
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      // url stored is the path inside the bucket
      const { data } = await (supabase as any).storage.from('credit-documents').createSignedUrl(url, 3600);
      setSigned(data?.signedUrl || null);
    })();
  }, [url]);
  return (
    <div className="rounded border overflow-hidden bg-muted/30">
      {signed ? <img src={signed} alt={label} className="w-full h-32 object-cover" /> : <div className="w-full h-32 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>}
      <div className="text-[11px] text-center py-1">{label}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-card p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
