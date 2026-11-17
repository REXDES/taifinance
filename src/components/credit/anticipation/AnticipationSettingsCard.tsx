import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { platformFee } from '@/lib/anticipationFee';

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  /** Estabelecimento principal da Pagando lido no "Testar conexão" (sugestão de destino da taxa). */
  suggestedRecipientId?: string | null;
}

/** Configuração global da antecipação (só o supervisor altera; o banco também só aceita dele). */
export function AnticipationSettingsCard({ suggestedRecipientId }: Props) {
  const db = supabase as any;
  const { user } = useAuth();
  const { isSupervisor } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState({
    platform_fee_percent: '0', platform_fee_fixed: '0', platform_fee_payer: 'cedent',
    platform_fee_recipient_type: 'SELLER', platform_fee_recipient_id: '', split_base: 'gross',
    internal_transfer_enabled: false,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await db.from('anticipation_settings').select('*').maybeSingle();
      if (error || !data) setMissing(true);
      else {
        setForm({
          platform_fee_percent: String(data.platform_fee_percent ?? 0),
          platform_fee_fixed: String(data.platform_fee_fixed ?? 0),
          platform_fee_payer: data.platform_fee_payer ?? 'cedent',
          platform_fee_recipient_type: data.platform_fee_recipient_type ?? 'SELLER',
          platform_fee_recipient_id: data.platform_fee_recipient_id ?? '',
          split_base: data.split_base ?? 'gross',
          internal_transfer_enabled: !!data.internal_transfer_enabled,
        });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));
  const pct = Number(String(form.platform_fee_percent).replace(',', '.')) || 0;
  const fixed = Number(String(form.platform_fee_fixed).replace(',', '.')) || 0;
  const preview = { ...form, platform_fee_percent: pct, platform_fee_fixed: fixed };
  const exampleFee = platformFee(preview, 1000);
  const feeConfigured = pct > 0 || fixed > 0;
  const hasRecipient = form.platform_fee_recipient_type === 'MARKETPLACE' || !!form.platform_fee_recipient_id.trim();

  const save = async () => {
    if (pct < 0 || pct >= 100 || fixed < 0) return toast.error('Taxa inválida.');
    setSaving(true);
    const { error } = await db.from('anticipation_settings').update({
      platform_fee_percent: pct, platform_fee_fixed: fixed, platform_fee_payer: form.platform_fee_payer,
      platform_fee_recipient_type: form.platform_fee_recipient_type,
      platform_fee_recipient_id: form.platform_fee_recipient_id.trim() || null,
      split_base: form.split_base, internal_transfer_enabled: form.internal_transfer_enabled,
      updated_by: user?.id ?? null,
    }).eq('id', true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Configuração da antecipação salva. Vale para as próximas solicitações e aprovações.');
  };

  if (loading) return <div className="p-4"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  if (missing) {
    return (
      <Card><CardContent className="pt-6 text-sm text-muted-foreground">
        A configuração da antecipação ainda não existe neste banco. Aplique a migração 0020 (antecipação) e recarregue a página.
      </CardContent></Card>
    );
  }

  const disabled = !isSupervisor;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Antecipação — taxa da Pagando e repasse</CardTitle>
        <CardDescription>
          A taxa é calculada no banco em cada solicitação e travada na aprovação. Quando o sacado paga, vai à conta de destino num split
          separado do repasse ao financiador. Sem conta de destino, a taxa não é cobrada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {disabled && <p className="text-xs text-muted-foreground">Somente o administrador da plataforma altera esta configuração.</p>}
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label>Taxa percentual (% do boleto)</Label>
            <Input inputMode="decimal" value={form.platform_fee_percent} disabled={disabled} onChange={e => set('platform_fee_percent', e.target.value)} /></div>
          <div><Label>Taxa fixa por título (R$)</Label>
            <Input inputMode="decimal" value={form.platform_fee_fixed} disabled={disabled} onChange={e => set('platform_fee_fixed', e.target.value)} /></div>
          <div><Label>Quem paga a taxa</Label>
            <Select value={form.platform_fee_payer} disabled={disabled} onValueChange={v => set('platform_fee_payer', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cedent">Cedente (sai do desembolso)</SelectItem>
                <SelectItem value="financier">Financiador (sai do ganho dele)</SelectItem>
              </SelectContent>
            </Select></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label>Destino da taxa</Label>
            <Select value={form.platform_fee_recipient_type} disabled={disabled} onValueChange={v => set('platform_fee_recipient_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SELLER">Estabelecimento da Pagando</SelectItem>
                <SelectItem value="MARKETPLACE">Marketplace (confirmar com a Necta)</SelectItem>
              </SelectContent>
            </Select></div>
          <div className="sm:col-span-2"><Label>ID na Necta (UUID)</Label>
            <div className="flex gap-2">
              <Input value={form.platform_fee_recipient_id} disabled={disabled} placeholder="UUID do estabelecimento principal da Pagando"
                onChange={e => set('platform_fee_recipient_id', e.target.value)} />
              {suggestedRecipientId && !disabled && form.platform_fee_recipient_id !== suggestedRecipientId && (
                <Button type="button" variant="outline" size="sm" onClick={() => { set('platform_fee_recipient_type', 'SELLER'); set('platform_fee_recipient_id', suggestedRecipientId); }}>
                  Usar o principal
                </Button>
              )}
            </div></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Base do repasse ao financiador</Label>
            <Select value={form.split_base} disabled={disabled} onValueChange={v => set('split_base', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gross">Valor pago pelo sacado (com juros e multa)</SelectItem>
                <SelectItem value="net">Valor líquido (após a taxa da Necta)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Confirme com a Necta se o split é sobre o bruto ou o líquido antes de mudar.</p></div>
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div>
              <Label>Transferência Pagando.net no desembolso</Label>
              <p className="text-xs text-muted-foreground">Desligada até a Necta confirmar a transferência entre contas digitais para o marketplace. Com ela desligada, o financiador desembolsa por PIX, boleto ou por fora.</p>
            </div>
            <Switch checked={form.internal_transfer_enabled} disabled={disabled} onCheckedChange={v => set('internal_transfer_enabled', v)} />
          </div>
        </div>
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          {!feeConfigured && 'Sem taxa da plataforma.'}
          {feeConfigured && !hasRecipient && <span className="text-amber-700 dark:text-amber-400">Taxa configurada, mas desligada: informe a conta de destino.</span>}
          {feeConfigured && hasRecipient && <>Exemplo: boleto de R$ 1.000,00 → taxa de <b>{brl(exampleFee)}</b>, paga pelo {form.platform_fee_payer === 'cedent' ? 'cedente (desembolso menor)' : 'financiador (sai do ganho dele)'}.</>}
        </div>
        {!disabled && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar configuração</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
