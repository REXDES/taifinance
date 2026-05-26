import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export function QualificationStep({
  applicationId,
  companyId,
  onCompleted,
}: {
  applicationId: string;
  companyId: string;
  onCompleted: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    whatsapp_phone: '',
    email: '',
    renda_mensal: '',
    profissao: '',
    endereco_entrega: '',
    cep: '',
    cidade: '',
    uf: '',
    notes: '',
  });
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('credit_qualifications')
        .select('*')
        .eq('application_id', applicationId)
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        setForm({
          whatsapp_phone: data.whatsapp_phone || '',
          email: data.email || '',
          renda_mensal: data.renda_mensal != null ? String(data.renda_mensal) : '',
          profissao: data.profissao || '',
          endereco_entrega: data.endereco_entrega || '',
          cep: data.cep || '',
          cidade: data.cidade || '',
          uf: data.uf || '',
          notes: data.notes || '',
        });
      }
      setLoading(false);
    })();
  }, [applicationId]);

  const save = async () => {
    if (!form.whatsapp_phone.trim()) {
      toast.error('WhatsApp é obrigatório');
      return;
    }
    setSaving(true);
    const payload: any = {
      application_id: applicationId,
      company_id: companyId,
      whatsapp_phone: form.whatsapp_phone.trim(),
      email: form.email.trim() || null,
      renda_mensal: form.renda_mensal ? Number(form.renda_mensal) : null,
      profissao: form.profissao.trim() || null,
      endereco_entrega: form.endereco_entrega.trim() || null,
      cep: form.cep.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = existingId
      ? await (supabase as any).from('credit_qualifications').update(payload).eq('id', existingId)
      : await (supabase as any).from('credit_qualifications').insert(payload);
    if (error) {
      toast.error('Erro: ' + error.message);
      setSaving(false);
      return;
    }
    await (supabase as any)
      .from('credit_applications')
      .update({ current_step: 3 })
      .eq('id', applicationId)
      .lt('current_step', 3);
    toast.success('Qualificação salva. Avançando para biometria.');
    setSaving(false);
    onCompleted();
  };

  if (loading) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-base font-semibold">Qualificação do cliente</h3>
        <p className="text-xs text-muted-foreground">Dados para envio dos links de biometria/contrato e cobrança.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>WhatsApp *</Label>
          <Input value={form.whatsapp_phone} onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })} placeholder="(DDD) 9 9999-9999" />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>Renda mensal (R$)</Label>
          <Input type="number" step="0.01" value={form.renda_mensal} onChange={(e) => setForm({ ...form, renda_mensal: e.target.value })} />
        </div>
        <div>
          <Label>Profissão</Label>
          <Input value={form.profissao} onChange={(e) => setForm({ ...form, profissao: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Endereço de entrega</Label>
          <Input value={form.endereco_entrega} onChange={(e) => setForm({ ...form, endereco_entrega: e.target.value })} />
        </div>
        <div>
          <Label>CEP</Label>
          <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </div>
          <div>
            <Label>UF</Label>
            <Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div className="md:col-span-2">
          <Label>Observações</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar e avançar <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
