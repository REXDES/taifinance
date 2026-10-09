import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props { companyId: string; moduleEnabled?: boolean }

/** Configuração administrativa: empresa atua como Financiador e quais cedentes a enxergam. */
export function FinancierAdminCard({ companyId, moduleEnabled = true }: Props) {
  const db = supabase as any;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFin, setIsFin] = useState(false);
  const [sellerId, setSellerId] = useState('');
  const [cedents, setCedents] = useState<Array<{ id: string; name: string }>>([]);
  const [linked, setLinked] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: list }, { data: links }] = await Promise.all([
        db.from('companies').select('is_financiador, necta_seller_id').eq('id', companyId).maybeSingle(),
        db.from('companies').select('id, name').eq('credit_module_enabled', true).eq('anticipation_module_enabled', true).neq('id', companyId).order('name'),
        db.from('financier_cedent_links').select('cedent_company_id, active').eq('financier_company_id', companyId),
      ]);
      setIsFin(!!c?.is_financiador);
      setSellerId(c?.necta_seller_id ?? '');
      setCedents(list ?? []);
      setLinked(new Set((links ?? []).filter((l: any) => l.active).map((l: any) => l.cedent_company_id)));
      setLoading(false);
    })();
  }, [companyId]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await db.from('companies').update({ is_financiador: isFin, necta_seller_id: sellerId.trim() || null }).eq('id', companyId);
      if (error) throw error;
      const { data: existing } = await db.from('financier_cedent_links').select('id, cedent_company_id').eq('financier_company_id', companyId);
      const have = new Map<string, string>((existing ?? []).map((l: any) => [l.cedent_company_id, l.id]));
      const upserts = cedents.map(c => ({ financier_company_id: companyId, cedent_company_id: c.id, active: isFin && linked.has(c.id) }))
        .filter(r => r.active || have.has(r.cedent_company_id));
      if (upserts.length) {
        const { error: e2 } = await db.from('financier_cedent_links').upsert(upserts, { onConflict: 'financier_company_id,cedent_company_id' });
        if (e2) throw e2;
      }
      toast.success('Configuração de financiador salva');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-4"><Loader2 className="w-4 h-4 animate-spin" /></div>;

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label className="text-base flex items-center gap-2"><Landmark className="w-4 h-4" /> Financiador (antecipação)</Label>
          <p className="text-sm text-muted-foreground">
            A empresa passa a antecipar títulos de cedentes autorizados. O valor é liquidado automaticamente na conta digital dela quando o sacado paga.
          </p>
        </div>
        <Switch checked={isFin} onCheckedChange={setIsFin} />
      </div>
      {isFin && (
        <>
          <div className="space-y-1">
            <Label>ID do seller na Pagando (conta digital que recebe)</Label>
            <Input value={sellerId} onChange={e => setSellerId(e.target.value)} placeholder="UUID do estabelecimento" />
          </div>
          <div className="space-y-2">
            <Label>Cedentes autorizados (empresas com Antecipação ativa)</Label>
            {cedents.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa com o módulo Antecipação ativo.</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {cedents.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={linked.has(c.id)} onCheckedChange={v => {
                    const n = new Set(linked); v ? n.add(c.id) : n.delete(c.id); setLinked(n);
                  }} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar financiador</Button>
      </div>
    </div>
  );
}
