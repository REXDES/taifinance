import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Prefilled {
  whatsapp_phone?: string;
  email?: string;
  renda_mensal?: string;
  profissao?: string;
  endereco_entrega?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
}

// Try to extract qualification fields from a Rede BE / bureau raw_response.
// Field names from these APIs vary a lot — be defensive and case-insensitive.
function extractFromConsultation(raw: any): Prefilled {
  if (!raw || typeof raw !== 'object') return {};
  const out: Prefilled = {};

  const walk = (node: any, visit: (k: string, v: any, parentKey: string) => void, parentKey = '') => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, visit, parentKey)); return; }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        visit(k, v, parentKey);
        if (v && typeof v === 'object') walk(v, visit, k);
      }
    }
  };

  const setIf = (key: keyof Prefilled, val: any) => {
    if (out[key]) return;
    if (val == null) return;
    const s = String(val).trim();
    if (!s) return;
    out[key] = s;
  };

  // Telefones: pick first mobile
  const phones: string[] = [];
  walk(raw, (k, v) => {
    const K = k.toUpperCase();
    if ((K === 'DDD_CELULAR' || K === 'TELEFONE_CELULAR' || K === 'CELULAR') && (typeof v === 'string' || typeof v === 'number')) {
      phones.push(String(v));
    }
    if (K === 'NUMERO' && typeof v === 'string' && v.replace(/\D/g, '').length >= 8) {
      phones.push(v);
    }
  });

  // Try DDD+NUMERO pairs inside same object
  walk(raw, (k, v) => {
    if (k.toUpperCase() === 'TELEFONES' && Array.isArray(v)) {
      for (const t of v) {
        if (t && typeof t === 'object') {
          const ddd = (t as any).DDD || (t as any).ddd;
          const num = (t as any).NUMERO || (t as any).numero || (t as any).TELEFONE;
          if (num) phones.push(`${ddd || ''}${num}`);
        }
      }
    }
  });
  if (phones.length) setIf('whatsapp_phone', phones[0].replace(/\D/g, ''));

  // Email
  walk(raw, (k, v) => {
    if (k.toUpperCase().includes('EMAIL') && typeof v === 'string' && v.includes('@')) {
      setIf('email', v);
    }
  });

  // Renda
  walk(raw, (k, v) => {
    const K = k.toUpperCase();
    if ((K.includes('RENDA') || K === 'RENDA_PRESUMIDA' || K === 'FAIXA_RENDA') && (typeof v === 'number' || typeof v === 'string')) {
      const n = Number(String(v).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'));
      if (!isNaN(n) && n > 0) setIf('renda_mensal', String(n));
    }
  });

  // Profissão
  walk(raw, (k, v) => {
    const K = k.toUpperCase();
    if ((K === 'PROFISSAO' || K === 'OCUPACAO' || K === 'CARGO') && typeof v === 'string') {
      setIf('profissao', v);
    }
  });

  // Endereço — primeiro encontrado
  walk(raw, (k, v) => {
    if (k.toUpperCase() === 'ENDERECOS' && Array.isArray(v) && v.length > 0) {
      const e = v[0];
      if (e && typeof e === 'object') {
        const log = (e as any).LOGRADOURO || (e as any).logradouro || '';
        const num = (e as any).NUMERO || (e as any).numero || '';
        const compl = (e as any).COMPLEMENTO || (e as any).complemento || '';
        const bairro = (e as any).BAIRRO || (e as any).bairro || '';
        const parts = [log, num, compl, bairro].filter(Boolean).join(', ');
        if (parts) setIf('endereco_entrega', parts);
        setIf('cep', String((e as any).CEP || (e as any).cep || '').replace(/\D/g, ''));
        setIf('cidade', (e as any).CIDADE || (e as any).cidade || (e as any).MUNICIPIO);
        setIf('uf', (e as any).UF || (e as any).uf || (e as any).ESTADO);
      }
    }
  });

  // Endereço solto (não dentro de array)
  if (!out.endereco_entrega) {
    walk(raw, (k, v) => {
      const K = k.toUpperCase();
      if (K === 'LOGRADOURO' && typeof v === 'string') setIf('endereco_entrega', v);
      if (K === 'CEP' && (typeof v === 'string' || typeof v === 'number')) setIf('cep', String(v).replace(/\D/g, ''));
      if ((K === 'CIDADE' || K === 'MUNICIPIO') && typeof v === 'string') setIf('cidade', v);
      if ((K === 'UF' || K === 'ESTADO') && typeof v === 'string' && v.length <= 2) setIf('uf', v.toUpperCase());
    });
  }

  return out;
}

export function QualificationStep({
  applicationId,
  companyId,
  consultationRaw,
  consultationName,
  onCompleted,
}: {
  applicationId: string;
  companyId: string;
  consultationRaw?: any;
  consultationName?: string | null;
  onCompleted: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState<Prefilled>({});
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

  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data }, { data: appRow }] = await Promise.all([
        (supabase as any).from('credit_qualifications').select('*').eq('application_id', applicationId).maybeSingle(),
        (supabase as any).from('credit_applications').select('qualification_draft').eq('id', applicationId).maybeSingle(),
      ]);
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
      } else {
        const pre = extractFromConsultation(consultationRaw);
        setPrefilled(pre);
        const draft = (appRow as any)?.qualification_draft || {};
        setForm((f) => ({
          ...f,
          whatsapp_phone: draft.whatsapp_phone ?? pre.whatsapp_phone ?? '',
          email: draft.email ?? pre.email ?? '',
          renda_mensal: draft.renda_mensal ?? pre.renda_mensal ?? '',
          profissao: draft.profissao ?? pre.profissao ?? '',
          endereco_entrega: draft.endereco_entrega ?? pre.endereco_entrega ?? '',
          cep: draft.cep ?? pre.cep ?? '',
          cidade: draft.cidade ?? pre.cidade ?? '',
          uf: draft.uf ?? pre.uf ?? '',
          notes: draft.notes ?? '',
        }));
      }
      setLoading(false);
      setHydrated(true);
    })();
  }, [applicationId, consultationRaw]);

  // Auto-save draft (debounced) so the user can leave and return without losing data.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(async () => {
      setDraftSaving(true);
      await (supabase as any)
        .from('credit_applications')
        .update({ qualification_draft: form })
        .eq('id', applicationId);
      setDraftSaving(false);
      setDraftSavedAt(new Date());
    }, 700);
    return () => clearTimeout(t);
  }, [form, hydrated, applicationId]);

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
      .update({ current_step: 4, qualification_draft: null })
      .eq('id', applicationId)
      .lt('current_step', 4);
    toast.success('Qualificação salva. Avançando para biometria.');
    setSaving(false);
    onCompleted();
  };

  if (loading) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const prefillKeys = Object.keys(prefilled) as (keyof Prefilled)[];
  const prefillCount = prefillKeys.filter((k) => prefilled[k]).length;
  const isPre = (k: keyof Prefilled) => !!prefilled[k] && form[k as keyof typeof form] === prefilled[k];

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-base font-semibold">Qualificação do cliente</h3>
        <p className="text-xs text-muted-foreground">
          Dados para envio dos links de biometria/contrato e cobrança.
          {consultationName ? <> Cliente: <strong>{consultationName}</strong>.</> : null}
        </p>
        {!existingId && prefillCount > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
            <Sparkles className="w-3 h-3" />
            {prefillCount} {prefillCount === 1 ? 'campo preenchido' : 'campos preenchidos'} a partir da consulta. Você pode editar antes de salvar.
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>WhatsApp *{isPre('whatsapp_phone') && <span className="ml-1 text-[10px] text-emerald-600">(da consulta)</span>}</Label>
          <Input value={form.whatsapp_phone} onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })} placeholder="(DDD) 9 9999-9999" />
        </div>
        <div>
          <Label>E-mail{isPre('email') && <span className="ml-1 text-[10px] text-emerald-600">(da consulta)</span>}</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>Renda mensal (R$){isPre('renda_mensal') && <span className="ml-1 text-[10px] text-emerald-600">(da consulta)</span>}</Label>
          <Input type="number" step="0.01" value={form.renda_mensal} onChange={(e) => setForm({ ...form, renda_mensal: e.target.value })} />
        </div>
        <div>
          <Label>Profissão{isPre('profissao') && <span className="ml-1 text-[10px] text-emerald-600">(da consulta)</span>}</Label>
          <Input value={form.profissao} onChange={(e) => setForm({ ...form, profissao: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Endereço de entrega{isPre('endereco_entrega') && <span className="ml-1 text-[10px] text-emerald-600">(da consulta)</span>}</Label>
          <Input value={form.endereco_entrega} onChange={(e) => setForm({ ...form, endereco_entrega: e.target.value })} />
        </div>
        <div>
          <Label>CEP{isPre('cep') && <span className="ml-1 text-[10px] text-emerald-600">(da consulta)</span>}</Label>
          <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label>Cidade{isPre('cidade') && <span className="ml-1 text-[10px] text-emerald-600">(da consulta)</span>}</Label>
            <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </div>
          <div>
            <Label>UF{isPre('uf') && <span className="ml-1 text-[10px] text-emerald-600">(da consulta)</span>}</Label>
            <Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div className="md:col-span-2">
          <Label>Observações</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          {draftSaving ? 'Salvando rascunho…' : draftSavedAt ? `Rascunho salvo às ${draftSavedAt.toLocaleTimeString('pt-BR')}` : 'Suas alterações são salvas automaticamente como rascunho.'}
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar e avançar para biometria <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
