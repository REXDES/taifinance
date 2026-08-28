import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { nectaCall } from '@/hooks/useNectaApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { BankSelect } from '@/components/payments/BankSelect';
import { NectaCatalogSelect } from '@/components/payments/NectaCatalogSelect';
import { Switch } from '@/components/ui/switch';
import {
  ACCOUNT_TYPE_LABELS, WEEK_DAYS, buildEstablishmentPayload,
  missingEstablishmentFields, invalidEstablishmentFields, mapHomologationStatus, legalPersonOf,
} from '@/lib/nectaEstablishment';
import { translateGatewayError } from '@/lib/nectaFormat';
import { Loader2, Save, ShieldCheck, RefreshCw, FileSignature, AlertTriangle } from 'lucide-react';

interface Props { companyId: string }

const HOMOLOG_LABEL: Record<string, string> = {
  draft: 'Cadastro em elaboração',
  pending: 'Enviado — em análise',
  approved: 'Homologado',
  rejected: 'Recusado',
};
const homologVariant = (s: string): 'default' | 'secondary' | 'outline' | 'destructive' =>
  s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : s === 'pending' ? 'secondary' : 'outline';

const digits = (v?: string | null) => (v ?? '').replace(/\D/g, '');

export function NectaRegistrationPage({ companyId }: Props) {
  const { user } = useAuth();
  const [row, setRow] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [terms, setTerms] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('necta_establishments').select('*')
      .eq('company_id', companyId).eq('is_own_profile', true).order('created_at').limit(1).maybeSingle();
    setRow(data ?? null);
    setForm(data ?? { homologation_status: 'draft', bank_account_type: 'CHECKING', address_state: '', pix_key_type: 'CNPJ' });
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const lookupCep = async (raw: string) => {
    const cep = digits(raw);
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data?.erro) { toast.error('CEP não encontrado'); return; }
      setForm(f => ({
        ...f,
        address_street: data.logradouro || f.address_street,
        address_district: data.bairro || f.address_district,
        address_city: data.localidade || f.address_city,
        address_state: (data.uf || f.address_state || '').toUpperCase(),
      }));
    } catch {
      toast.error('Não foi possível consultar o CEP');
    }
  };



  const save = async () => {
    setSaving(true);
    const payload: Record<string, any> = {
      company_id: companyId,
      is_own_profile: true,
      whatsapp: form.whatsapp ?? null,
      instagram: form.instagram ?? null,
      legal_name: form.legal_name ?? null,
      trade_name: form.trade_name ?? null,
      document: form.document ?? null,
      email: form.email ?? null,
      phone: form.phone ?? null,
      address_zip: form.address_zip ?? null,
      address_street: form.address_street ?? null,
      address_number: form.address_number ?? null,
      address_complement: form.address_complement ?? null,
      address_district: form.address_district ?? null,
      address_city: form.address_city ?? null,
      address_state: form.address_state ?? null,
      bank_code: form.bank_code ?? null,
      bank_name: form.bank_name ?? null,
      bank_agency: form.bank_agency ?? null,
      bank_account: form.bank_account ?? null,
      bank_account_type: form.bank_account_type ?? 'CHECKING',
      bank_account_holder: form.bank_account_holder ?? null,
      bank_account_document: form.bank_account_document ?? null,
      pix_key: form.pix_key ?? null,
      pix_key_type: form.pix_key_type ?? null,
      mcc_id: form.mcc_id || null,
      mcc_name: form.mcc_name || null,
      legal_nature: form.legal_nature || null,
      legal_nature_name: form.legal_nature_name || null,
      birth_date: form.birth_date || null,
      opening_date: form.opening_date || null,
      revenue: form.revenue === '' || form.revenue === null || form.revenue === undefined ? null : Number(form.revenue),
      opening_days: Array.isArray(form.opening_days) && form.opening_days.length ? form.opening_days : null,
      opening_hours: form.opening_hours || null,
      closing_hours: form.closing_hours || null,
      digital_account: form.digital_account !== false,
    };
    let error;
    if (row?.id) ({ error } = await (supabase as any).from('necta_establishments').update(payload).eq('id', row.id));
    else ({ error } = await (supabase as any).from('necta_establishments').insert({ ...payload, created_by: user?.id }));
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Cadastro salvo');
    load();
  };

  const loadTerms = async () => {
    try {
      const t = await nectaCall<any>('/establishments/term-acceptance');
      const list = Array.isArray(t) ? t : (t?.data ?? t?.terms ?? []);
      setTerms(list);
      if (!list.length) toast.info('Nenhum termo pendente de aceite');
    } catch (e) { toast.error((e as Error).message); }
  };

  const signTerm = async (slug: string) => {
    try {
      await nectaCall('/establishments/term-sign', 'POST', { slugTerm: slug });
      await (supabase as any).from('necta_establishments')
        .update({ term_accepted_at: new Date().toISOString(), term_slug: slug }).eq('id', row.id);
      toast.success('Termo assinado');
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const sendHomologation = async () => {
    if (!row?.id) { toast.error('Salve o cadastro antes de enviar'); return; }
    const missing = missingEstablishmentFields(form);
    if (missing.length) { toast.error(`Complete antes de enviar: ${missing.join(', ')}`); return; }
    const invalid = invalidEstablishmentFields(form);
    if (invalid.length) { toast.error('Corrija antes de enviar', { description: invalid.join(' ') }); return; }
    setSending(true);
    try {
      const resp = await nectaCall<any>('/establishments', 'POST', buildEstablishmentPayload(form));
      await (supabase as any).from('necta_establishments').update({
        necta_establishment_id: resp?.id ?? null,
        homologation_status: mapHomologationStatus(resp?.status?.name) === 'approved' ? 'approved' : 'pending',
        necta_status: resp?.status?.name ?? null,
        homologation_sent_at: new Date().toISOString(),
        homologation_notes: null,
        raw: resp,
      }).eq('id', row.id);
      toast.success('Cadastro enviado para homologação');
      load();
    } catch (e) {
      const msg = translateGatewayError((e as Error).message);
      await (supabase as any).from('necta_establishments').update({ homologation_notes: msg }).eq('id', row.id);
      toast.error(msg);
    }
    setSending(false);
  };

  const checkStatus = async () => {
    if (!row?.necta_establishment_id) { toast.error('Envie o cadastro para homologação primeiro'); return; }
    try {
      const resp = await nectaCall<any>(`/establishments/${row.necta_establishment_id}`);
      const mapped = mapHomologationStatus(resp?.status?.name);
      await (supabase as any).from('necta_establishments').update({
        homologation_status: mapped,
        necta_status: resp?.status?.name ?? null,
        homologation_notes: resp?.status?.reference ?? resp?.status?.name ?? null,
        raw: resp,
      }).eq('id', row.id);
      toast.success(`Situação na Necta: ${resp?.status?.name ?? mapped}`);
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Carregando cadastro…</div>;

  const status = form.homologation_status ?? 'draft';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground text-sm">Dados da sua empresa, endereço, conta bancária e homologação</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={homologVariant(status)}>{HOMOLOG_LABEL[status] ?? status}</Badge>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Razão social *</Label><Input value={form.legal_name ?? ''} onChange={e => set('legal_name', e.target.value)} /></div>
          <div><Label>Nome fantasia</Label><Input value={form.trade_name ?? ''} onChange={e => set('trade_name', e.target.value)} /></div>
          <div><Label>CNPJ / CPF *</Label><Input value={form.document ?? ''} onChange={e => set('document', e.target.value)} /></div>
          <div>
            <Label>{legalPersonOf(form.document, form.person_type) === 'JURIDICAL' ? 'Data de abertura *' : 'Data de nascimento *'}</Label>
            {legalPersonOf(form.document, form.person_type) === 'JURIDICAL' ? (
              <Input type="date" value={(form.opening_date ?? '').slice(0, 10)} onChange={e => set('opening_date', e.target.value)} />
            ) : (
              <Input type="date" value={(form.birth_date ?? '').slice(0, 10)} onChange={e => set('birth_date', e.target.value)} />
            )}
          </div>
          <div><Label>E-mail *</Label><Input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} /></div>
          <div><Label>Telefone *</Label><Input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input value={form.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} /></div>
          <div><Label>Instagram</Label><Input value={form.instagram ?? ''} onChange={e => set('instagram', e.target.value)} placeholder="@perfil" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados exigidos pela Necta</CardTitle>
          <CardDescription>Obrigatórios para a homologação do estabelecimento na plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Ramo de atividade (MCC) *</Label>
            <NectaCatalogSelect
              kind="mcc"
              value={form.mcc_id ?? ''}
              label={form.mcc_name}
              onChange={(v, item) => setForm(prev => ({ ...prev, mcc_id: v ?? '', mcc_name: item?.name ?? '' }))}
            />
          </div>
          {legalPersonOf(form.document, form.person_type) === 'JURIDICAL' && (
            <div className="md:col-span-2">
              <Label>Natureza jurídica *</Label>
              <NectaCatalogSelect
                kind="legal-nature"
                value={form.legal_nature ?? ''}
                label={form.legal_nature_name}
                onChange={(v, item) => setForm(prev => ({ ...prev, legal_nature: v ?? '', legal_nature_name: item?.name ?? '' }))}
              />
            </div>
          )}
          <div>
            <Label>Faturamento mensal estimado (R$)</Label>
            <Input type="number" min={0} step="0.01" value={form.revenue ?? ''} onChange={e => set('revenue', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Abre às</Label><Input type="time" value={form.opening_hours ?? ''} onChange={e => set('opening_hours', e.target.value)} /></div>
            <div><Label>Fecha às</Label><Input type="time" value={form.closing_hours ?? ''} onChange={e => set('closing_hours', e.target.value)} /></div>
          </div>
          <div className="md:col-span-2">
            <Label>Dias de funcionamento</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {WEEK_DAYS.map(d => {
                const active = (form.opening_days ?? []).includes(d.value);
                return (
                  <Button
                    key={d.value}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => setForm(prev => {
                      const cur: string[] = prev.opening_days ?? [];
                      return { ...prev, opening_days: active ? cur.filter(x => x !== d.value) : [...cur, d.value] };
                    })}
                  >
                    {d.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Usar conta digital como domicílio</Label>
              <p className="text-xs text-muted-foreground">
                Desligado, os recebimentos vão para a conta bancária informada abaixo
              </p>
            </div>
            <Switch checked={form.digital_account !== false} onCheckedChange={v => set('digital_account', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>CEP *</Label>
            <Input value={form.address_zip ?? ''} onChange={e => set('address_zip', e.target.value)} onBlur={e => lookupCep(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Preenche o endereço automaticamente</p>
          </div>
          <div><Label>Logradouro *</Label><Input value={form.address_street ?? ''} onChange={e => set('address_street', e.target.value)} /></div>
          <div><Label>Número *</Label><Input value={form.address_number ?? ''} onChange={e => set('address_number', e.target.value)} /></div>
          <div><Label>Complemento</Label><Input value={form.address_complement ?? ''} onChange={e => set('address_complement', e.target.value)} /></div>
          <div><Label>Bairro *</Label><Input value={form.address_district ?? ''} onChange={e => set('address_district', e.target.value)} /></div>
          <div><Label>Cidade *</Label><Input value={form.address_city ?? ''} onChange={e => set('address_city', e.target.value)} /></div>
          <div><Label>UF *</Label><Input maxLength={2} value={form.address_state ?? ''} onChange={e => set('address_state', e.target.value.toUpperCase())} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados bancários</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Banco</Label>
            <BankSelect
              code={form.bank_code ?? ''}
              name={form.bank_name ?? ''}
              onChange={(c, n) => setForm(prev => ({ ...prev, bank_code: c, bank_name: n }))}
            />
            <p className="text-xs text-muted-foreground mt-1">Busque pelo nome ou código — preenche código (Compe) e nome automaticamente</p>
          </div>
          <div><Label>Agência</Label><Input value={form.bank_agency ?? ''} onChange={e => set('bank_agency', e.target.value)} /></div>
          <div><Label>Conta (com dígito)</Label><Input value={form.bank_account ?? ''} onChange={e => set('bank_account', e.target.value)} /></div>
          <div><Label>Tipo de conta</Label>
            <Select value={form.bank_account_type ?? 'CHECKING'} onValueChange={v => set('bank_account_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Titular</Label><Input value={form.bank_account_holder ?? ''} onChange={e => set('bank_account_holder', e.target.value)} /></div>
          <div><Label>Documento do titular</Label><Input value={form.bank_account_document ?? ''} onChange={e => set('bank_account_document', e.target.value)} /></div>
          <div><Label>Tipo de chave PIX</Label>
            <Select value={form.pix_key_type ?? 'CNPJ'} onValueChange={v => set('pix_key_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CNPJ">CNPJ</SelectItem>
                <SelectItem value="CPF">CPF</SelectItem>
                <SelectItem value="EMAIL">E-mail</SelectItem>
                <SelectItem value="PHONE">Telefone</SelectItem>
                <SelectItem value="RANDOM">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label>Chave PIX</Label><Input value={form.pix_key ?? ''} onChange={e => set('pix_key', e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homologação</CardTitle>
          <CardDescription>Envie o cadastro para análise e acompanhe a situação do estabelecimento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={homologVariant(status)}>{HOMOLOG_LABEL[status] ?? status}</Badge>
            {row?.necta_establishment_id && <span className="text-xs text-muted-foreground">ID: {row.necta_establishment_id}</span>}
            {row?.homologation_sent_at && <span className="text-xs text-muted-foreground">enviado em {new Date(row.homologation_sent_at).toLocaleString('pt-BR')}</span>}
          </div>

          {row?.homologation_notes && (
            <Alert variant={status === 'rejected' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs break-words">{row.homologation_notes}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={sendHomologation} disabled={sending || status === 'approved'}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Enviar para homologação
            </Button>
            <Button variant="outline" onClick={checkStatus} disabled={!row?.necta_establishment_id}>
              <RefreshCw className="w-4 h-4 mr-2" />Consultar situação
            </Button>
            <Button variant="outline" onClick={loadTerms}>
              <FileSignature className="w-4 h-4 mr-2" />Termos de aceite
            </Button>
          </div>

          {terms.length > 0 && (
            <div className="space-y-2">
              {terms.map((t: any, i: number) => (
                <div key={t.slug ?? i} className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <span>{t.name ?? t.title ?? t.slug}</span>
                  <Button size="sm" variant="outline" onClick={() => signTerm(t.slug ?? t.slugTerm)}>Assinar</Button>
                </div>
              ))}
            </div>
          )}

          {row?.term_accepted_at && (
            <p className="text-xs text-muted-foreground">Termo {row.term_slug} assinado em {new Date(row.term_accepted_at).toLocaleString('pt-BR')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

