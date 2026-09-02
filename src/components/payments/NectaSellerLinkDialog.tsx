import { useCallback, useEffect, useMemo, useState } from 'react';
import { nectaAction } from '@/hooks/useNectaApi';
import { useCompanies } from '@/hooks/useCompanies';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Link2, Search, Info } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLinked?: () => void;
}

/**
 * Vínculo explícito seller (Necta) ↔ empresa (TAI Finance).
 * Só o Modo Administrativo usa esta tela: lista os sellers existentes na Necta,
 * permite escolher quais importar e a qual empresa cada um pertence.
 */
export function NectaSellerLinkDialog({ open, onOpenChange, onLinked }: Props) {
  const { companies } = useCompanies();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sellers, setSellers] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({}); // sellerId -> companyId
  const [search, setSearch] = useState('');
  const [bulkCompany, setBulkCompany] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await nectaAction<any>('list_sellers');
      setSellers(r?.sellers ?? []);
      setLinks(r?.links ?? []);
      setSelected({});
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const companyName = (id?: string | null) => companies.find(c => c.id === id)?.name ?? '—';

  const linkedCompanies = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const l of links) {
      const k = String(l.necta_establishment_id);
      map[k] = [...(map[k] ?? []), l.company_id];
    }
    return map;
  }, [links]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter(s =>
      [s?.name, s?.document, s?.email].some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [sellers, search]);

  const toggle = (id: string, checked: boolean) =>
    setSelected(prev => {
      const next = { ...prev };
      if (checked) next[id] = prev[id] || bulkCompany || '';
      else delete next[id];
      return next;
    });

  const applyBulk = (companyId: string) => {
    setBulkCompany(companyId);
    setSelected(prev => Object.fromEntries(Object.keys(prev).map(k => [k, companyId])));
  };

  const selectAllVisible = (checked: boolean) =>
    setSelected(prev => {
      if (!checked) return {};
      const next = { ...prev };
      for (const s of filtered) next[String(s.id)] = next[String(s.id)] || bulkCompany || '';
      return next;
    });

  const entries = Object.entries(selected);
  const pending = entries.filter(([, c]) => !c).length;

  const save = async () => {
    if (!entries.length) { toast.error('Selecione ao menos um seller'); return; }
    if (pending) { toast.error('Escolha a empresa de todos os sellers selecionados'); return; }
    setSaving(true);
    try {
      const r = await nectaAction<any>('link_sellers', {
        items: entries.map(([necta_establishment_id, company_id]) => ({
          necta_establishment_id,
          company_id,
          seller: sellers.find(s => String(s?.id) === necta_establishment_id) ?? null,
        })),
      });
      toast.success(`${r?.imported ?? 0} vinculado(s) e ${r?.updated ?? 0} atualizado(s)`);
      if (r?.errors?.length) toast.error(r.errors[0]);
      onLinked?.();
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-y-auto max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Vincular sellers da Necta às empresas</DialogTitle>
          <DialogDescription>
            Selecione os estabelecimentos já cadastrados na Necta e escolha a qual empresa do TAI Finance cada um pertence
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-xs">
            O vínculo define qual empresa poderá emitir cobranças em nome do seller. Um seller pode ser vinculado a mais de uma empresa,
            e reimportar com outra empresa cria um novo vínculo sem apagar o anterior.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome, documento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={bulkCompany} onValueChange={applyBulk}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Empresa para os selecionados" /></SelectTrigger>
            <SelectContent>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Atualizar'}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" />Buscando sellers na Necta…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every(s => selected[String(s.id)] !== undefined)}
                      onCheckedChange={v => selectAllVisible(!!v)}
                    />
                  </TableHead>
                  <TableHead>Seller na Necta</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Já vinculado a</TableHead>
                  <TableHead className="w-56">Empresa no TAI Finance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum seller encontrado na Necta
                  </TableCell></TableRow>
                )}
                {filtered.map(s => {
                  const id = String(s.id);
                  const isSel = selected[id] !== undefined;
                  const already = linkedCompanies[id] ?? [];
                  return (
                    <TableRow key={id}>
                      <TableCell><Checkbox checked={isSel} onCheckedChange={v => toggle(id, !!v)} /></TableCell>
                      <TableCell>
                        <p className="font-medium">{s?.name ?? '—'}</p>
                        {s?.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                      </TableCell>
                      <TableCell className="text-sm">{s?.document ?? '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{s?.status?.name ?? '—'}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {already.length ? already.map(c => companyName(c)).join(', ') : 'Não vinculado'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selected[id] || ''}
                          onValueChange={v => setSelected(prev => ({ ...prev, [id]: v }))}
                          disabled={!isSel}
                        >
                          <SelectTrigger><SelectValue placeholder="Escolher empresa" /></SelectTrigger>
                          <SelectContent>
                            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="items-center gap-2">
          <span className="text-xs text-muted-foreground mr-auto">
            {entries.length} selecionado(s){pending ? ` — ${pending} sem empresa definida` : ''}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !entries.length}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
            Vincular selecionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
