import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MODULE_DEFAULTS, ModuleKey, useModuleBranding } from '@/contexts/ModuleBrandingContext';
import { Loader2, Puzzle, Trash2, Upload } from 'lucide-react';

type Draft = { display_name: string; logo_url: string | null; color: string };

/** Reduz a imagem para no máximo 128px e devolve como data URL (PNG). */
async function toSmallDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    const max = 128;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ModuleSettingsPage() {
  const { toast } = useToast();
  const { refetch } = useModuleBranding();
  const keys = Object.keys(MODULE_DEFAULTS) as ModuleKey[];
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('module_branding').select('*');
      const map: Record<string, Draft> = {};
      keys.forEach(k => { map[k] = { display_name: '', logo_url: null, color: '' }; });
      (data ?? []).forEach(r => {
        map[r.module_key] = { display_name: r.display_name ?? '', logo_url: r.logo_url, color: r.color ?? '' };
      });
      setDrafts(map);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (k: string, patch: Partial<Draft>) => setDrafts(d => ({ ...d, [k]: { ...d[k], ...patch } }));

  const save = async (k: ModuleKey) => {
    setSaving(k);
    const d = drafts[k];
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('module_branding').upsert({
      module_key: k,
      display_name: d.display_name.trim() || null,
      logo_url: d.logo_url,
      color: d.color || null,
      updated_at: new Date().toISOString(),
      updated_by: u?.user?.id ?? null,
    });
    setSaving(null);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    await refetch();
    toast({ title: 'Módulo atualizado' });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Puzzle className="w-5 h-5 text-primary" /> Configuração de Módulos</h1>
        <p className="text-sm text-muted-foreground">Defina o nome, o logo e a cor que os usuários veem em cada módulo. Campos vazios usam o padrão.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {keys.map(k => {
          const d = drafts[k];
          const name = d.display_name.trim() || MODULE_DEFAULTS[k].name;
          return (
            <Card key={k}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2" style={d.color ? { color: d.color } : undefined}>
                  {d.logo_url && <img src={d.logo_url} alt="" className="w-6 h-6 object-contain rounded-sm" />}
                  {name}
                </CardTitle>
                <CardDescription>{MODULE_DEFAULTS[k].description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome exibido</Label>
                  <Input placeholder={MODULE_DEFAULTS[k].name} value={d.display_name} onChange={e => update(k, { display_name: e.target.value })} />
                </div>
                <div className="flex items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cor</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={d.color || '#888888'} onChange={e => update(k, { color: e.target.value })} className="h-9 w-12 rounded border border-input bg-background" />
                      {d.color && <Button variant="ghost" size="sm" onClick={() => update(k, { color: '' })}>Padrão</Button>}
                    </div>
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Logo</Label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <label className="cursor-pointer">
                          <Upload className="w-4 h-4 mr-1" /> Enviar
                          <input type="file" accept="image/*" className="hidden" onChange={async e => {
                            const f = e.target.files?.[0]; if (!f) return;
                            update(k, { logo_url: await toSmallDataUrl(f) });
                          }} />
                        </label>
                      </Button>
                      {d.logo_url && <Button variant="ghost" size="sm" onClick={() => update(k, { logo_url: null })}><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => save(k)} disabled={saving === k}>
                    {saving === k && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
