import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { nectaCall } from '@/hooks/useNectaApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { BankSelect } from '@/components/payments/BankSelect';
import { NectaCatalogSelect } from '@/components/payments/NectaCatalogSelect';
import { Switch } from '@/components/ui/switch';
import {
  ACCOUNT_TYPE_LABELS, WEEK_DAYS, buildEstablishmentPayload,
  missingEstablishmentFields, invalidEstablishmentFields, mapHomologationStatus,
} from '@/lib/nectaEstablishment';
import { translateGatewayError } from '@/lib/nectaFormat';
import { toast } from 'sonner';
import {
  Loader2, Plus, Pencil, Trash2, ShieldCheck, RefreshCw, MessageCircle,
  Building2, Search, AlertTriangle,
} from 'lucide-react';

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

const emptyForm = () => ({
  person_type: 'PJ',
  legal_name: '',
  trade_name: '',
  document: '',
  email: '',
  phone: '',
  whatsapp: '',
  instagram: '',
  address_zip: '',
  address_street: '',
  address_number: '',
  address_complement: '',
  address_district: '',
  address_city: '',
  address_state: '',
  bank_code: '',
  bank_name: '',
  bank_agency: '',
  bank_account: '',
  bank_account_type: 'CHECKING',
  bank_account_holder: '',
  bank_account_document: '',
  pix_key_type: 'CNPJ',
  pix_key: '',
  notes: '',
  mcc_id: '',
  mcc_name: '',
  legal_nature: '',
  legal_nature_name: '',
  birth_date: '',
  opening_date: '',
  revenue: '',
  opening_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  opening_hours: '09:00',
  closing_hours: '18:00',
  digital_account: true,
  homologation_status: 'draft',
} as Record<string, any>);

export function NectaEstablishmentsPage({ companyId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('necta_establishments')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_own_profile', false)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm(), ...row }); setOpen(true); };

  const lookupCep = async (raw: string) => {
    const cep = digits(raw);
    if (cep.length !== 8) return;
    setCepLoading(true);
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
    } finally {
      setCepLoading(false);
    }
  };

  const save = async () => {
    if (!form.legal_name || !form.document) {
      toast.error('Informe o nome e o documento');
      return;
    }
    setSaving(true);
    const payload: Record<string, any> = {
      company_id: companyId,
      is_own_profile: false,
      person_type: form.person_type ?? 'PJ',
      legal_name: form.legal_name ?? null,
      trade_name: form.trade_name ?? null,
      document: form.document ?? null,
      email: form.email ?? null,
      phone: form.phone ?? null,
      whatsapp: form.whatsapp ?? null,
      instagram: form.instagram ?? null,
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
      pix_key_type: form.pix_key_type ?? null,
      pix_key: form.pix_key ?? null,
      notes: form.notes ?? null,
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
    let error: any;
    let savedId = editing?.id as string | undefined;
    if (editing?.id) {
      ({ error } = await (supabase as any).from('necta_establishments').update(payload).eq('id', editing.id));
    } else {
      const res = await (supabase as any).from('necta_establishments')
        .insert({ ...payload, created_by: user?.id, homologation_status: 'draft' })
        .select('id').maybeSingle();
      error = res.error;
      savedId = res.data?.id;
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Estabelecimento atualizado' : 'Estabelecimento cadastrado');
    setOpen(false);
    await load();
    return savedId;
  };

  const sendHomologation = async (row: any) => {
    const missing = missingEstablishmentFields(row);
    if (missing.length) {
      toast.error(`Complete antes de enviar: ${missing.join(', ')}`);
      return;
    }
    const invalid = invalidEstablishmentFields(row);
    if (invalid.length) {
      toast.error('Corrija antes de enviar', { description: invalid.join(' ') });
      return;
    }
    setSendingId(row.id);
    try {
      const resp = await nectaCall<any>('/establishments', 'POST', buildEstablishmentPayload(row));
      await (supabase as any).from('necta_establishments').update({
        necta_establishment_id: resp?.id ?? null,
        homologation_status: mapHomologationStatus(resp?.status?.name) === 'approved' ? 'approved' : 'pending',
        necta_status: resp?.status?.name ?? null,
        homologation_sent_at: new Date().toISOString(),
        homologation_notes: null,
        raw: resp,
      }).eq('id', row.id);
      toast.success('Enviado para homologação');
      await load();
    } catch (e) {
      const msg = translateGatewayError((e as Error).message);
      await (supabase as any).from('necta_establishments').update({ homologation_notes: msg }).eq('id', row.id);
      toast.error(msg);
      await load();
    } finally {
      setSendingId(null);
    }
  };

  const checkStatus = async (row: any) => {
    if (!row.necta_establishment_id) { toast.error('Envie o cadastro para homologação primeiro'); return; }
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
      await load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from('necta_establishments').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Cadastro excluído');
    setDeleteTarget(null);
    await load();
  };

  const openWhatsapp = (row: any) => {
    const phone = digits(row.whatsapp || row.phone);
    if (!phone) { toast.error('Nenhum telefone/WhatsApp cadastrado'); return; }
    const full = phone.length <= 11 ? `55${phone}` : phone;
    window.open(`https://wa.me/${full}`, '_blank', 'noopener');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.legal_name, r.trade_name, r.document, r.email, r.phone, r.whatsapp]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Estabelecimentos</h1>
          <p className="text-muted-foreground text-sm">
            Cadastre pessoas e empresas para emitir cobranças e acompanhe a homologação de cada uma
          </p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo estabelecimento</Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />Cadastros ({filtered.length})
            </CardTitle>
            <CardDescription>Nome, documento, contato e situação da homologação</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome, documento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" />Carregando cadastros…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Homologação</TableHead>
                    <TableHead className="text-right w-56">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Nenhum estabelecimento cadastrado ainda
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(row => {
                    const status = row.homologation_status ?? 'draft';
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium">{row.legal_name}</p>
                          {row.trade_name && <p className="text-xs text-muted-foreground">{row.trade_name}</p>}
                          {row.address_city && (
                            <p className="text-xs text-muted-foreground">{row.address_city}/{row.address_state}</p>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline">{row.person_type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</Badge></TableCell>
                        <TableCell className="text-sm">{row.document || '—'}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-1">
                            <span>{row.phone || row.whatsapp || '—'}</span>
                            {row.email && <span className="text-xs text-muted-foreground">{row.email}</span>}
                            {row.instagram && <span className="text-xs text-muted-foreground">{row.instagram}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={homologVariant(status)}>{HOMOLOG_LABEL[status] ?? status}</Badge>
                          {row.homologation_sent_at && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              enviado em {new Date(row.homologation_sent_at).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" title="Abrir WhatsApp" onClick={() => openWhatsapp(row)}>
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Enviar para homologação"
                              disabled={sendingId === row.id || status === 'approved'}
                              onClick={() => sendHomologation(row)}
                            >
                              {sendingId === row.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <ShieldCheck className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Consultar situação"
                              disabled={!row.necta_establishment_id}
                              onClick={() => checkStatus(row)}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(row)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              title="Excluir"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar estabelecimento' : 'Novo estabelecimento'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Identificação</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de pessoa *</Label>
                  <Select value={form.person_type ?? 'PJ'} onValueChange={v => set('person_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PF">Pessoa Física</SelectItem>
                      <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{form.person_type === 'PF' ? 'CPF *' : 'CNPJ *'}</Label>
                  <Input value={form.document ?? ''} onChange={e => set('document', e.target.value)} />
                </div>
                <div>
                  <Label>{form.person_type === 'PF' ? 'Nome completo *' : 'Razão social *'}</Label>
                  <Input value={form.legal_name ?? ''} onChange={e => set('legal_name', e.target.value)} />
                </div>
                <div>
                  <Label>{form.person_type === 'PF' ? 'Apelido' : 'Nome fantasia'}</Label>
                  <Input value={form.trade_name ?? ''} onChange={e => set('trade_name', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Dados exigidos pela Necta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Ramo de atividade (MCC) *</Label>
                  <NectaCatalogSelect
                    kind="mcc"
                    value={form.mcc_id ?? ''}
                    label={form.mcc_name}
                    onChange={(v, item) => setForm(prev => ({ ...prev, mcc_id: v ?? '', mcc_name: item?.name ?? '' }))}
                  />
                </div>
                {form.person_type === 'PJ' && (
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
                {form.person_type === 'PF' ? (
                  <div>
                    <Label>Data de nascimento *</Label>
                    <Input type="date" value={(form.birth_date ?? '').slice(0, 10)} onChange={e => set('birth_date', e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <Label>Data de abertura *</Label>
                    <Input type="date" value={(form.opening_date ?? '').slice(0, 10)} onChange={e => set('opening_date', e.target.value)} />
                  </div>
                )}
                <div>
                  <Label>Faturamento mensal estimado (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={form.revenue ?? ''} onChange={e => set('revenue', e.target.value)} />
                </div>
                <div><Label>Abre às</Label><Input type="time" value={form.opening_hours ?? ''} onChange={e => set('opening_hours', e.target.value)} /></div>
                <div><Label>Fecha às</Label><Input type="time" value={form.closing_hours ?? ''} onChange={e => set('closing_hours', e.target.value)} /></div>
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
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>CEP *</Label>
                  <div className="relative">
                    <Input
                      value={form.address_zip ?? ''}
                      onChange={e => set('address_zip', e.target.value)}
                      onBlur={e => lookupCep(e.target.value)}
                      placeholder="00000-000"
                    />
                    {cepLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-2 top-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Preenche o endereço automaticamente</p>
                </div>
                <div><Label>Logradouro *</Label><Input value={form.address_street ?? ''} onChange={e => set('address_street', e.target.value)} /></div>
                <div><Label>Número *</Label><Input value={form.address_number ?? ''} onChange={e => set('address_number', e.target.value)} /></div>
                <div><Label>Complemento</Label><Input value={form.address_complement ?? ''} onChange={e => set('address_complement', e.target.value)} /></div>
                <div><Label>Bairro *</Label><Input value={form.address_district ?? ''} onChange={e => set('address_district', e.target.value)} /></div>
                <div><Label>Cidade *</Label><Input value={form.address_city ?? ''} onChange={e => set('address_city', e.target.value)} /></div>
                <div><Label>UF *</Label><Input maxLength={2} value={form.address_state ?? ''} onChange={e => set('address_state', e.target.value.toUpperCase())} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Contato</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>E-mail *</Label><Input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} /></div>
                <div><Label>Telefone *</Label><Input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} /></div>
                <div><Label>WhatsApp</Label><Input value={form.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} placeholder="(00) 00000-0000" /></div>
                <div><Label>Instagram</Label><Input value={form.instagram ?? ''} onChange={e => set('instagram', e.target.value)} placeholder="@perfil" /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Dados bancários</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div>
                  <Label>Tipo de conta</Label>
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
                <div>
                  <Label>Tipo de chave PIX</Label>
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
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Observações</h3>
              <Textarea rows={3} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
            </section>

            {editing && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={homologVariant(editing.homologation_status ?? 'draft')}>
                    {HOMOLOG_LABEL[editing.homologation_status ?? 'draft'] ?? editing.homologation_status}
                  </Badge>
                  {editing.necta_establishment_id && (
                    <span className="text-xs text-muted-foreground">ID Necta: {editing.necta_establishment_id}</span>
                  )}
                </div>
                {editing.homologation_notes && (
                  <Alert variant={editing.homologation_status === 'rejected' ? 'destructive' : 'default'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs break-words">{editing.homologation_notes}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            {editing && (
              <Button
                variant="secondary"
                disabled={sendingId === editing.id || editing.homologation_status === 'approved'}
                onClick={async () => {
                  await save();
                  const { data } = await (supabase as any).from('necta_establishments')
                    .select('*').eq('id', editing.id).maybeSingle();
                  if (data) await sendHomologation(data);
                }}
              >
                <ShieldCheck className="w-4 h-4 mr-2" />Salvar e enviar para homologação
              </Button>
            )}
            <Button onClick={() => save()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        onConfirm={remove}
        title="Excluir estabelecimento"
        description={`Tem certeza que deseja excluir "${deleteTarget?.legal_name ?? ''}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
