import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, FileCheck2, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

type DocumentRow = { id: string; document_type: string; file_name: string; status: string };
type Payload = { request: { status: string; expires_at: string }; establishment: Record<string, any>; documents: DocumentRow[] };

const sections = [
  { title: 'Identificação', fields: [['legal_name', 'Nome completo / razão social'], ['trade_name', 'Nome fantasia'], ['document', 'CPF / CNPJ'], ['email', 'E-mail'], ['phone', 'Telefone com DDD']] },
  { title: 'Atividade', fields: [['mcc_id', 'Código da atividade (MCC)'], ['revenue', 'Faturamento mensal estimado']] },
  { title: 'Endereço', fields: [['address_zip', 'CEP'], ['address_street', 'Logradouro'], ['address_number', 'Número'], ['address_complement', 'Complemento'], ['address_district', 'Bairro'], ['address_city', 'Cidade'], ['address_state', 'UF']] },
  { title: 'Conta bancária', fields: [['bank_code', 'Código do banco'], ['bank_name', 'Banco'], ['bank_agency', 'Agência'], ['bank_account', 'Conta com dígito'], ['bank_account_holder', 'Titular'], ['bank_account_document', 'CPF/CNPJ do titular']] },
] as const;

async function call(token: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('necta-homologation', { body: { token, ...body } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function NectaHomologationPublic() {
  const { token = '' } = useParams<{ token: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await call(token, { action: 'get' }) as Payload;
      setData(response); setForm(response.establishment ?? {});
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message.includes('non-2xx') ? 'Este link é inválido ou expirou. Solicite um novo link à empresa.' : message || 'Não foi possível abrir o formulário.');
    }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const personType = form.person_type === 'PF' ? 'PF' : 'PJ';
  const completed = useMemo(() => {
    const keys = ['legal_name', 'document', 'email', 'phone', 'mcc_id', 'address_zip', 'address_street', 'address_number', 'address_district', 'address_city', 'address_state', 'bank_code', 'bank_agency', 'bank_account', personType === 'PF' ? 'birth_date' : 'opening_date'];
    return Math.round(keys.filter((key) => String(form[key] ?? '').trim()).length / keys.length * 100);
  }, [form, personType]);

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try { await call(token, { action: 'save', fields: form }); toast.success('Dados salvos'); return true; }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); return false; }
    finally { setSaving(false); }
  };

  const upload = async (type: string, file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'application/pdf'].includes(file.type)) { toast.error('Envie JPG, JPEG ou PDF.'); return; }
    const payload = new FormData();
    payload.append('token', token); payload.append('action', 'upload'); payload.append('document_type', type); payload.append('file', file);
    const { data: response, error: uploadError } = await supabase.functions.invoke('necta-homologation', { body: payload });
    if (uploadError || response?.error) toast.error(response?.error ?? uploadError?.message ?? 'Falha no envio');
    else { toast.success('Documento recebido'); await load(); }
  };

  const removeDocument = async (id: string) => {
    try { await call(token, { action: 'delete_document', document_id: id }); await load(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Não foi possível remover.'); }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await call(token, { action: 'save', fields: form });
      await call(token, { action: 'submit', accept_terms: accepted });
      await load(); setStep(6);
    }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Não foi possível concluir.'); }
    finally { setSaving(false); }
  };

  if (loading) return <Center><Loader2 className="h-8 w-8 animate-spin text-primary" /></Center>;
  if (error) return <Center><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></Center>;
  if (!data) return null;
  if (['ready', 'submitted', 'under_review', 'approved'].includes(data.request.status)) return <Center><CheckCircle2 className="h-12 w-12 text-primary" /><h1 className="text-2xl font-bold">Cadastro recebido</h1><p className="max-w-md text-center text-muted-foreground">Seus dados e documentos foram enviados para conferência. Você será avisado sobre o andamento.</p></Center>;

  return <main className="min-h-screen bg-background px-4 py-8">
    <div className="mx-auto max-w-3xl space-y-5">
      <header><p className="text-sm font-semibold text-primary">TAI FINANCE</p><h1 className="text-2xl font-bold">Cadastro para homologação</h1><p className="text-muted-foreground">Revise seus dados e envie os documentos solicitados.</p></header>
      <div className="space-y-2"><div className="flex justify-between text-sm"><span>Progresso do cadastro</span><strong>{completed}%</strong></div><Progress value={completed} /></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{['Identificação', 'Atividade', 'Endereço', 'Conta', 'Documentos', 'Termos'].map((label, index) => <Button key={label} variant={step === index ? 'default' : 'outline'} size="sm" onClick={() => setStep(index)}>{index + 1}. {label}</Button>)}</div>

      {step < 4 && sections[step] && <Card><CardHeader><CardTitle>{sections[step].title}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        {step === 0 && <><div><Label>Tipo de cadastro</Label><Select value={personType} onValueChange={(value) => setForm((current) => ({ ...current, person_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PF">Pessoa física</SelectItem><SelectItem value="PJ">Pessoa jurídica</SelectItem></SelectContent></Select></div><div><Label>{personType === 'PF' ? 'Data de nascimento' : 'Data de abertura'}</Label><Input type="date" value={form[personType === 'PF' ? 'birth_date' : 'opening_date'] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [personType === 'PF' ? 'birth_date' : 'opening_date']: event.target.value }))} /></div>{personType === 'PJ' && <div><Label>Natureza jurídica</Label><Input value={form.legal_nature ?? ''} onChange={(event) => setForm((current) => ({ ...current, legal_nature: event.target.value }))} /></div>}</>}
        {sections[step].fields.map(([key, label]) => <div key={key} className={key === 'address_street' ? 'sm:col-span-2' : ''}><Label>{label}</Label><Input type={key === 'email' ? 'email' : 'text'} value={form[key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></div>)}
      </CardContent></Card>}

      {step === 4 && <Card><CardHeader><CardTitle>Documentos</CardTitle></CardHeader><CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">Envie arquivos legíveis em JPG, JPEG ou PDF, com até 10 MB.</p>
        {[['SELFIE', 'Selfie do responsável'], ['IDENTIFICATION_DOCUMENT', 'Documento de identificação']].map(([type, label]) => <div key={type} className="rounded-md border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{label}</p><p className="text-xs text-muted-foreground">Obrigatório</p></div><label><input className="hidden" type="file" accept="image/jpeg,application/pdf" onChange={(event) => upload(type, event.target.files?.[0])} /><Button asChild variant="outline"><span><Upload className="mr-2 h-4 w-4" />Enviar</span></Button></label></div>{data.documents.filter((document) => document.document_type === type).map((document) => <div key={document.id} className="mt-3 flex items-center justify-between rounded bg-muted p-2 text-sm"><span><FileCheck2 className="mr-2 inline h-4 w-4" />{document.file_name}</span><Button size="icon" variant="ghost" aria-label="Remover documento" onClick={() => removeDocument(document.id)}><Trash2 className="h-4 w-4" /></Button></div>)}</div>)}
      </CardContent></Card>}

      {step === 5 && <Card><CardHeader><CardTitle>Termos e envio</CardTitle></CardHeader><CardContent className="space-y-5"><Alert><AlertDescription>Declaro que as informações e os documentos enviados são verdadeiros e autorizo seu uso para análise cadastral e homologação nos meios de pagamento.</AlertDescription></Alert><div className="flex items-start gap-3"><Checkbox id="terms" checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} /><Label htmlFor="terms" className="leading-5">Li e aceito os termos de cadastro e tratamento dos dados.</Label></div><Button onClick={submit} disabled={!accepted || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Concluir e enviar para análise</Button></CardContent></Card>}

      <div className="flex justify-between"><Button variant="outline" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>Voltar</Button>{step < 5 && <Button onClick={async () => { if (await save()) setStep((current) => current + 1); }}>Salvar e continuar</Button>}</div>
    </div>
  </main>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-6">{children}</main>;
}