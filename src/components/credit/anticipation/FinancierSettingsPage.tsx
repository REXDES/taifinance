import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeleteConfirmDialog } from '@/components/finance/DeleteConfirmDialog';
import { FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface Props { companyId: string }

const DEFAULT_RULES = {
  monthly_discount_rate: 3, min_days: 1, max_days: 180, min_installments: 1, max_installments: 24,
  min_title_amount: 0, max_title_amount: null as number | null, limit_per_cedent: null as number | null,
  limit_per_debtor: null as number | null, min_score: null as number | null, requires_invoice: true, notes: '', active: true,
};

export function FinancierSettingsPage({ companyId }: Props) {
  const db = supabase as any;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isFin, setIsFin] = useState(false);
  const [rules, setRules] = useState<any>(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplName, setTplName] = useState('');
  const [tplKind, setTplKind] = useState('cessao');
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: r }, { data: t }] = await Promise.all([
      db.from('companies').select('is_financiador').eq('id', companyId).maybeSingle(),
      db.from('financier_credit_rules').select('*').eq('financier_company_id', companyId).maybeSingle(),
      db.from('financier_contract_templates').select('*').eq('financier_company_id', companyId).order('created_at', { ascending: false }),
    ]);
    setIsFin(!!c?.is_financiador);
    setRules(r ?? DEFAULT_RULES);
    setTemplates(t ?? []);
    setLoading(false);
  };
  useEffect(() => { if (companyId) load(); }, [companyId]);

  const num = (k: string) => ({
    value: rules[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRules({ ...rules, [k]: e.target.value === '' ? null : Number(e.target.value) }),
    type: 'number',
  });

  const saveRules = async () => {
    setSaving(true);
    const { id, created_at, updated_at, ...rest } = rules;
    const { error } = await db.from('financier_credit_rules').upsert({ ...DEFAULT_RULES, ...rest, financier_company_id: companyId }, { onConflict: 'financier_company_id' });
    setSaving(false);
    error ? toast.error(error.message) : toast.success('Regras salvas');
  };

  const addTemplate = async () => {
    if (!tplName.trim() || !tplFile) return toast.error('Informe nome e arquivo');
    const path = `${companyId}/templates/${crypto.randomUUID()}-${tplFile.name}`;
    const { error: upErr } = await supabase.storage.from('anticipation-docs').upload(path, tplFile);
    if (upErr) return toast.error(upErr.message);
    const { error } = await db.from('financier_contract_templates').insert({ financier_company_id: companyId, name: tplName.trim(), kind: tplKind, storage_path: path, created_by: user?.id });
    if (error) return toast.error(error.message);
    setTplName(''); setTplFile(null); toast.success('Modelo adicionado'); load();
  };

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from('anticipation-docs').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!isFin) return (
    <Card><CardHeader><CardTitle>Financiador</CardTitle>
      <CardDescription>Esta empresa não está habilitada como financiador. Peça ao administrador para ativar em Gerenciar Empresa → Módulos.</CardDescription>
    </CardHeader></Card>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Financiador</h1><p className="text-muted-foreground">Regras de crédito e contratos padrão para antecipação.</p></div>
      <Card>
        <CardHeader><CardTitle>Regras de crédito</CardTitle><CardDescription>Vistas pelos cedentes ao solicitar antecipação.</CardDescription></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><Label>Deságio mensal (%)</Label><Input step="0.01" {...num('monthly_discount_rate')} /></div>
          <div><Label>Prazo mínimo (dias)</Label><Input {...num('min_days')} /></div>
          <div><Label>Prazo máximo (dias)</Label><Input {...num('max_days')} /></div>
          <div><Label>Parcelas mínimas</Label><Input {...num('min_installments')} /></div>
          <div><Label>Parcelas máximas</Label><Input {...num('max_installments')} /></div>
          <div><Label>Score mínimo do sacado (1–100)</Label><Input {...num('min_score')} /></div>
          <div><Label>Valor mínimo do título (R$)</Label><Input step="0.01" {...num('min_title_amount')} /></div>
          <div><Label>Valor máximo do título (R$)</Label><Input step="0.01" {...num('max_title_amount')} /></div>
          <div><Label>Limite por cedente (R$)</Label><Input step="0.01" {...num('limit_per_cedent')} /></div>
          <div><Label>Limite por sacado (R$)</Label><Input step="0.01" {...num('limit_per_debtor')} /></div>
          <div className="flex items-center gap-2 pt-6"><Switch checked={!!rules.requires_invoice} onCheckedChange={v => setRules({ ...rules, requires_invoice: v })} /><Label>Exigir nota fiscal</Label></div>
          <div className="flex items-center gap-2 pt-6"><Switch checked={!!rules.active} onCheckedChange={v => setRules({ ...rules, active: v })} /><Label>Aceitando novas solicitações</Label></div>
          <div className="sm:col-span-2 lg:col-span-3"><Label>Observações aos cedentes</Label><Textarea value={rules.notes ?? ''} onChange={e => setRules({ ...rules, notes: e.target.value })} /></div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end"><Button onClick={saveRules} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar regras</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contratos padrão</CardTitle><CardDescription>Modelos de cessão, aditivos e termos.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2"><Label>Nome</Label><Input value={tplName} onChange={e => setTplName(e.target.value)} /></div>
            <div><Label>Tipo</Label>
              <Select value={tplKind} onValueChange={setTplKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cessao">Contrato de cessão</SelectItem>
                  <SelectItem value="aditivo">Aditivo</SelectItem>
                  <SelectItem value="notificacao">Notificação ao sacado</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Arquivo</Label><Input type="file" onChange={e => setTplFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <div className="flex justify-end"><Button variant="outline" onClick={addTemplate}><Upload className="w-4 h-4 mr-2" />Adicionar modelo</Button></div>
          <div className="divide-y divide-border">
            {templates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum modelo enviado.</p>}
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2">
                <button className="flex items-center gap-2 text-sm hover:underline" onClick={() => t.storage_path && openFile(t.storage_path)}>
                  <FileText className="w-4 h-4" />{t.name} <span className="text-muted-foreground">({t.kind})</span>
                </button>
                <Button variant="ghost" size="icon" onClick={() => setToDelete(t)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={o => !o && setToDelete(null)}
        title="Excluir modelo"
        description={`Excluir "${toDelete?.name}"?`}
        onConfirm={async () => {
          await db.from('financier_contract_templates').delete().eq('id', toDelete.id);
          if (toDelete.storage_path) await supabase.storage.from('anticipation-docs').remove([toDelete.storage_path]);
          setToDelete(null); load();
        }}
      />
    </div>
  );
}
