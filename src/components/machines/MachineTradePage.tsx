import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Search, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useMachineCategories } from '@/hooks/useMachinesModule';
import { maxBid, median, realMarginPct, suggestedSalePrice, verdict } from '@/lib/machineTrade';
import { todayISO, formatBR } from '@/lib/dateUtils';

const db = supabase as any;
const brl = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Setting { id: string; name: string; category_id: string | null; profit_margin_pct: number; recovery_pct: number; keywords: string | null; auction_sites: string | null; }
interface Price { id: string; setting_id: string | null; brand: string | null; model: string; year_from: number | null; year_to: number | null; reference_price: number; suggested_price: number | null; sources: any[]; researched_at: string | null; }
interface Found { title: string; brand?: string; model?: string; year?: number; hours?: number; price?: number; auction_date?: string; location?: string; url: string; }

async function invokeSearch(body: any): Promise<Found[]> {
  const { data, error } = await supabase.functions.invoke('machine-market-search', { body });
  if (error) {
    const d = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let msg = d; try { msg = JSON.parse(d).error ?? d; } catch { /* texto */ }
    throw new Error(msg);
  }
  return data?.items ?? [];
}

function useRows<T>(table: string, companyId: string, order = 'created_at') {
  const [rows, setRows] = useState<T[]>([]);
  const refetch = useCallback(async () => {
    const { data } = await db.from(table).select('*').eq('company_id', companyId).order(order, { ascending: false });
    setRows(data ?? []);
  }, [table, companyId, order]);
  useEffect(() => { refetch(); }, [refetch]);
  return { rows, refetch };
}

export function MachineTradePage({ companyId }: { companyId: string }) {
  const settings = useRows<Setting>('machine_trade_settings', companyId);
  const prices = useRows<Price>('machine_resale_prices', companyId);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Compra e Venda</h1>
        <p className="text-sm text-muted-foreground">Pesquise preços, encontre leilões e acompanhe o custo de cada máquina até a venda.</p>
      </div>
      <Tabs defaultValue="auctions">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="auctions">Leilões</TabsTrigger>
          <TabsTrigger value="prices">Tabela de venda</TabsTrigger>
          <TabsTrigger value="resale">Minhas revendas</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="auctions"><AuctionsTab companyId={companyId} settings={settings.rows} prices={prices.rows} refetchPrices={prices.refetch} /></TabsContent>
        <TabsContent value="prices"><PricesTab companyId={companyId} settings={settings.rows} prices={prices.rows} refetch={prices.refetch} /></TabsContent>
        <TabsContent value="resale"><ResaleTab companyId={companyId} settings={settings.rows} /></TabsContent>
        <TabsContent value="settings"><SettingsTab companyId={companyId} settings={settings.rows} refetch={settings.refetch} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Configurações ---------------- */
function SettingsTab({ companyId, settings, refetch }: { companyId: string; settings: Setting[]; refetch: () => void }) {
  const { categories } = useMachineCategories(companyId);
  const [form, setForm] = useState({ name: '', category_id: 'none', profit_margin_pct: '20', recovery_pct: '10', keywords: '', auction_sites: '' });
  const add = async () => {
    if (!form.name.trim()) return toast.error('Informe o nome do tipo de máquina');
    const { error } = await db.from('machine_trade_settings').insert({
      company_id: companyId, name: form.name.trim(), category_id: form.category_id === 'none' ? null : form.category_id,
      profit_margin_pct: Number(form.profit_margin_pct) || 0, recovery_pct: Number(form.recovery_pct) || 0,
      keywords: form.keywords || null, auction_sites: form.auction_sites || null,
    });
    if (error) return toast.error(error.message);
    setForm({ ...form, name: '', keywords: '' }); refetch();
  };
  const update = async (id: string, patch: Partial<Setting>) => {
    const { error } = await db.from('machine_trade_settings').update(patch).eq('id', id);
    if (error) toast.error(error.message); else refetch();
  };
  const remove = async (id: string) => { await db.from('machine_trade_settings').delete().eq('id', id); refetch(); };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Margens por tipo de máquina</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Preço de venda = compra × (1 + margem%) + compra × recuperação%. O lance máximo no leilão sai dessa conta.</p>
        <div className="grid gap-2 md:grid-cols-6 items-end">
          <div className="md:col-span-2"><Label>Tipo (ex.: Agrícola, Pesada, Mini)</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Nenhuma</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Margem %</Label><Input type="number" value={form.profit_margin_pct} onChange={e => setForm({ ...form, profit_margin_pct: e.target.value })} /></div>
          <div><Label>Recuperação %</Label><Input type="number" value={form.recovery_pct} onChange={e => setForm({ ...form, recovery_pct: e.target.value })} /></div>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
          <div className="md:col-span-3"><Label>Palavras para pesquisa</Label><Input placeholder="trator, colheitadeira" value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} /></div>
          <div className="md:col-span-3"><Label>Sites de leilão preferidos</Label><Input placeholder="superbid.net, sodresantoro.com.br" value={form.auction_sites} onChange={e => setForm({ ...form, auction_sites: e.target.value })} /></div>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Margem %</TableHead><TableHead>Recuperação %</TableHead><TableHead>Palavras</TableHead><TableHead>Sites</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {settings.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell><Input className="w-20" type="number" defaultValue={s.profit_margin_pct} onBlur={e => update(s.id, { profit_margin_pct: Number(e.target.value) })} /></TableCell>
                <TableCell><Input className="w-20" type="number" defaultValue={s.recovery_pct} onBlur={e => update(s.id, { recovery_pct: Number(e.target.value) })} /></TableCell>
                <TableCell><Input defaultValue={s.keywords ?? ''} onBlur={e => update(s.id, { keywords: e.target.value })} /></TableCell>
                <TableCell><Input defaultValue={s.auction_sites ?? ''} onBlur={e => update(s.id, { auction_sites: e.target.value })} /></TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
              </TableRow>
            ))}
            {!settings.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cadastre ao menos um tipo de máquina.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- Tabela de venda ---------------- */
function PricesTab({ companyId, settings, prices, refetch }: { companyId: string; settings: Setting[]; prices: Price[]; refetch: () => void }) {
  const [form, setForm] = useState({ setting_id: '', brand: '', model: '', year_from: '', year_to: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [review, setReview] = useState<{ price: Price; items: Found[] } | null>(null);
  const add = async () => {
    if (!form.model.trim()) return toast.error('Informe o modelo');
    const { error } = await db.from('machine_resale_prices').insert({
      company_id: companyId, setting_id: form.setting_id || null, brand: form.brand || null, model: form.model.trim(),
      year_from: form.year_from ? Number(form.year_from) : null, year_to: form.year_to ? Number(form.year_to) : null,
    });
    if (error) return toast.error(error.message);
    setForm({ ...form, brand: '', model: '', year_from: '', year_to: '' }); refetch();
  };
  const research = async (p: Price) => {
    setBusy(p.id);
    try {
      const q = [p.brand, p.model, p.year_from && `${p.year_from}`].filter(Boolean).join(' ');
      const items = (await invokeSearch({ action: 'price_research', company_id: companyId, query: q })).filter(i => i.price && i.price > 0);
      if (!items.length) toast.info('Nenhum anúncio com preço encontrado.');
      const sug = median(items.map(i => i.price!));
      await db.from('machine_resale_prices').update({ suggested_price: sug || null, sources: items, researched_at: new Date().toISOString() }).eq('id', p.id);
      refetch(); setReview({ price: { ...p, suggested_price: sug }, items });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const update = async (id: string, patch: any) => { await db.from('machine_resale_prices').update(patch).eq('id', id); refetch(); };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tabela de preços de venda</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-6 items-end">
          <div><Label>Tipo</Label>
            <Select value={form.setting_id} onValueChange={v => setForm({ ...form, setting_id: v })}>
              <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{settings.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Marca</Label><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
          <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
          <div><Label>Ano de</Label><Input type="number" value={form.year_from} onChange={e => setForm({ ...form, year_from: e.target.value })} /></div>
          <div><Label>Ano até</Label><Input type="number" value={form.year_to} onChange={e => setForm({ ...form, year_to: e.target.value })} /></div>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Máquina</TableHead><TableHead>Tipo</TableHead><TableHead>Sugestão da internet</TableHead><TableHead>Meu preço de venda</TableHead><TableHead>Pesquisado</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {prices.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{[p.brand, p.model].filter(Boolean).join(' ')} {p.year_from ? `(${p.year_from}${p.year_to ? `–${p.year_to}` : ''})` : ''}</TableCell>
                <TableCell>{settings.find(s => s.id === p.setting_id)?.name ?? '—'}</TableCell>
                <TableCell>
                  {p.suggested_price ? <button className="underline" onClick={() => setReview({ price: p, items: p.sources ?? [] })}>{brl(p.suggested_price)} ({(p.sources ?? []).length})</button> : '—'}
                  {p.suggested_price ? <Button size="sm" variant="link" onClick={() => update(p.id, { reference_price: p.suggested_price })}>Usar</Button> : null}
                </TableCell>
                <TableCell><Input key={p.reference_price} className="w-32" type="number" defaultValue={p.reference_price || ''} onBlur={e => update(p.id, { reference_price: Number(e.target.value) || 0 })} /></TableCell>
                <TableCell>{p.researched_at ? formatBR(p.researched_at.slice(0, 10)) : '—'}</TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => research(p)}>{busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}<span className="ml-1">Pesquisar preços</span></Button>
                  <Button size="icon" variant="ghost" onClick={async () => { await db.from('machine_resale_prices').delete().eq('id', p.id); refetch(); }}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!prices.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Adicione os modelos que você revende.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!review} onOpenChange={o => !o && setReview(null)}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
          <DialogHeader><DialogTitle>Anúncios de venda encontrados</DialogTitle></DialogHeader>
          <p className="text-sm">Sugestão (mediana): <strong>{brl(review?.price.suggested_price)}</strong></p>
          <Table><TableBody>
            {review?.items.map((i, k) => (
              <TableRow key={k}><TableCell>{i.title}{i.year ? ` · ${i.year}` : ''}{i.hours ? ` · ${i.hours} h` : ''}</TableCell><TableCell>{brl(i.price)}</TableCell>
                <TableCell><a href={i.url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a></TableCell></TableRow>
            ))}
          </TableBody></Table>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- Leilões ---------------- */
type Market = { loading: boolean; price: number; items: Found[] };
function AuctionsTab({ companyId, settings, prices, refetchPrices }: { companyId: string; settings: Setting[]; prices: Price[]; refetchPrices: () => void }) {
  const saved = useRows<any>('machine_auction_opportunities', companyId);
  const [settingId, setSettingId] = useState('');
  const [priceId, setPriceId] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Found[]>([]);
  const [buy, setBuy] = useState<any | null>(null);
  const [market, setMarket] = useState<Record<number, Market>>({});
  const [marketView, setMarketView] = useState<(Market & { title: string }) | null>(null);
  const [addTable, setAddTable] = useState<{ f: Found; k: number } | null>(null);
  const setting = settings.find(s => s.id === settingId);
  const options = prices.filter(p => !settingId || p.setting_id === settingId);

  const matchPrice = (f: Found): Price | undefined => {
    if (priceId !== 'all') return prices.find(p => p.id === priceId);
    const t = `${f.title} ${f.model ?? ''}`.toLowerCase();
    return options.find(p => t.includes(p.model.toLowerCase()));
  };
  const calc = (f: Found, k?: number) => {
    const p = matchPrice(f);
    const s = settings.find(x => x.id === (p?.setting_id ?? settingId)) ?? setting;
    const mkPrice = k != null ? market[k]?.price : undefined;
    const base = p?.reference_price || mkPrice || 0;
    if (!base || !s) return { p, max: null as number | null };
    return { p, s, base, estimated: !p?.reference_price, max: maxBid(base, s.profit_margin_pct, s.recovery_pct) };
  };

  const loadMarket = async (list: Found[]) => {
    const init: Record<number, Market> = {};
    list.forEach((_, i) => { init[i] = { loading: true, price: 0, items: [] }; });
    setMarket(init);
    await Promise.all(list.slice(0, 8).map(async (f, i) => {
      const q = [f.brand, f.model, f.year].filter(Boolean).join(' ') || f.title;
      try {
        const items = (await invokeSearch({ action: 'price_research', company_id: companyId, query: q })).filter(x => x.price && x.price > 0);
        setMarket(m => ({ ...m, [i]: { loading: false, price: median(items.map(x => x.price!)), items } }));
      } catch { setMarket(m => ({ ...m, [i]: { loading: false, price: 0, items: [] } })); }
    }));
    setMarket(m => { const n = { ...m }; Object.keys(n).forEach(key => { if (n[+key].loading) n[+key] = { loading: false, price: 0, items: [] }; }); return n; });
  };

  const isUpcoming = (d?: string | null) => {
    if (!d) return true; // sem data, o filtro do servidor já decidiu
    const m = d.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    let dt: Date | null = null;
    if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; dt = new Date(y, +m[2] - 1, +m[1]); }
    else { const t = Date.parse(d); if (!isNaN(t)) dt = new Date(t); }
    if (!dt || isNaN(dt.getTime())) return true;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return dt.getTime() >= today.getTime();
  };

  const run = async () => {
    if (!setting) return toast.error('Escolha o tipo de máquina');
    const sel = prices.find(p => p.id === priceId);
    const q = query.trim() || (sel ? [sel.brand, sel.model].filter(Boolean).join(' ') : setting.keywords || setting.name);
    setBusy(true); setMarket({});
    try {
      const r = (await invokeSearch({ action: 'auction_search', company_id: companyId, query: q, sites: setting.auction_sites })).filter(f => isUpcoming(f.auction_date));
      setResults(r); if (!r.length) toast.info('Nenhum leilão futuro encontrado.'); else loadMarket(r);
    }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const save = async (f: Found) => {
    const { p, max } = calc(f, results.indexOf(f));
    const { error } = await db.from('machine_auction_opportunities').insert({
      company_id: companyId, setting_id: settingId || null, price_id: p?.id ?? null, title: f.title, url: f.url,
      auction_date: f.auction_date ?? null, location: f.location ?? null, current_bid: f.price ?? null, max_bid: max, reference_price: p?.reference_price ?? null,
    });
    if (error) toast.error(error.message); else { toast.success('Oportunidade salva'); saved.refetch(); }
  };

  const badge = (bid?: number | null, max?: number | null) => {
    if (!bid || !max) return <Badge variant="outline">Sem preço de tabela</Badge>;
    const v = verdict(bid, max);
    return v === 'opportunity' ? <Badge>Oportunidade</Badge> : v === 'limit' ? <Badge variant="secondary">No limite</Badge> : <Badge variant="destructive">Fora</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid gap-2 md:grid-cols-5 items-end">
          <div><Label>Tipo de máquina</Label>
            <Select value={settingId} onValueChange={v => { setSettingId(v); setPriceId('all'); }}>
              <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{settings.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Modelo da tabela</Label>
            <Select value={priceId} onValueChange={setPriceId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos do tipo</SelectItem>{options.map(p => <SelectItem key={p.id} value={p.id}>{[p.brand, p.model].filter(Boolean).join(' ')}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="md:col-span-2"><Label>Pesquisa (opcional)</Label><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="ex.: retroescavadeira JCB 3CX" /></div>
          <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}Buscar leilões</Button>
        </CardContent>
      </Card>
      {!!results.length && (
        <Card><CardHeader><CardTitle className="text-base">Resultados (somente leilões)</CardTitle></CardHeader><CardContent className="overflow-x-auto">
          <p className="text-xs text-muted-foreground mb-2">"Preço de mercado" é a mediana de anúncios da mesma máquina em balcão e outras ofertas fora de leilão.</p>
          <Table>
            <TableHeader><TableRow><TableHead>Lote</TableHead><TableHead>Data do leilão</TableHead><TableHead>Lance</TableHead><TableHead>Preço de mercado</TableHead><TableHead>Lance máximo</TableHead><TableHead>Lucro estimado</TableHead><TableHead>Situação</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{results.map((f, k) => {
              const { p, s, max, base, estimated } = calc(f, k) as any;
              const profit = f.price && base && s ? base - f.price * (1 + s.recovery_pct / 100) : null;
              const mk = market[k];
              return (
                <TableRow key={k}>
                  <TableCell><a href={f.url} target="_blank" rel="noreferrer" className="underline">{f.title}</a>{f.location && <div className="text-xs text-muted-foreground">{f.location}</div>}</TableCell>
                  <TableCell className="whitespace-nowrap">{f.auction_date || '—'}</TableCell>
                  <TableCell>{f.price ? brl(f.price) : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {mk?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mk?.price ? (
                      <button className="underline" onClick={() => setMarketView({ title: f.title, ...mk })}>{brl(mk.price)} ({mk.items.length})</button>
                    ) : mk ? <span className="text-muted-foreground">Sem ofertas</span> : '—'}
                  </TableCell>
                  <TableCell>{max ? <>{brl(max)}{estimated && <div className="text-xs text-muted-foreground">pelo mercado</div>}</> : '—'}</TableCell>
                  <TableCell>{profit != null ? `${brl(profit)} (${((profit / (f.price! * (1 + s.recovery_pct / 100))) * 100).toFixed(1)}%)` : '—'}</TableCell>
                  <TableCell>{badge(f.price, max)}</TableCell>
                  <TableCell className="flex gap-1">
                    {!p && <Button size="sm" variant="secondary" onClick={() => setAddTable({ f, k })}><Plus className="w-4 h-4 mr-1" />Tabela de preço</Button>}
                    <Button size="sm" variant="outline" onClick={() => save(f)}>Salvar</Button>
                  </TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        </CardContent></Card>
      )}
      <Dialog open={!!marketView} onOpenChange={o => !o && setMarketView(null)}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
          <DialogHeader><DialogTitle>Ofertas de mercado (fora de leilão)</DialogTitle></DialogHeader>
          <p className="text-sm">{marketView?.title} — sugestão: <strong>{brl(marketView?.price)}</strong></p>
          <Table><TableBody>{marketView?.items.map((i, n) => (
            <TableRow key={n}><TableCell>{i.title}{i.year ? ` · ${i.year}` : ''}{i.hours ? ` · ${i.hours} h` : ''}</TableCell><TableCell>{brl(i.price)}</TableCell>
              <TableCell><a href={i.url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a></TableCell></TableRow>
          ))}</TableBody></Table>
        </DialogContent>
      </Dialog>
      {addTable && <AddToTableDialog companyId={companyId} settings={settings} defaultSetting={settingId} found={addTable.f} market={market[addTable.k]} onClose={(ok) => { setAddTable(null); if (ok) refetchPrices(); }} />}
      <Card><CardHeader><CardTitle className="text-base">Oportunidades salvas</CardTitle></CardHeader><CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Lote</TableHead><TableHead>Lance</TableHead><TableHead>Lance máximo</TableHead><TableHead>Situação</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{saved.rows.map(o => (
            <TableRow key={o.id}>
              <TableCell>{o.url ? <a href={o.url} target="_blank" rel="noreferrer" className="underline">{o.title}</a> : o.title}<div className="text-xs text-muted-foreground">{o.auction_date}</div></TableCell>
              <TableCell>{brl(o.current_bid)}</TableCell><TableCell>{o.max_bid ? brl(o.max_bid) : '—'}</TableCell>
              <TableCell>{o.status === 'bought' ? <Badge>Comprada</Badge> : o.status === 'discarded' ? <Badge variant="outline">Descartada</Badge> : badge(o.current_bid, o.max_bid)}</TableCell>
              <TableCell className="flex gap-1">
                {o.status === 'saved' && <><Button size="sm" onClick={() => setBuy(o)}>Comprei</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await db.from('machine_auction_opportunities').update({ status: 'discarded' }).eq('id', o.id); saved.refetch(); }}>Descartar</Button></>}
              </TableCell>
            </TableRow>
          ))}{!saved.rows.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nada salvo ainda.</TableCell></TableRow>}</TableBody>
        </Table>
      </CardContent></Card>
      {buy && <BuyDialog companyId={companyId} opp={buy} onClose={() => { setBuy(null); saved.refetch(); }} />}
    </div>
  );
}

function BuyDialog({ companyId, opp, onClose }: { companyId: string; opp: any; onClose: () => void }) {
  const [name, setName] = useState(opp.title?.slice(0, 80) ?? '');
  const [amount, setAmount] = useState(String(opp.current_bid ?? ''));
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const confirm = async () => {
    const value = Number(amount); if (!name || !value) return toast.error('Informe nome e valor pago');
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: m, error } = await db.from('machines').insert({
      company_id: companyId, name, acquisition_value: value, acquisition_date: date, acquisition_source: 'resale_purchase',
      status: 'disponivel', technical_status: 'em_manutencao', usage_purpose: ['venda'], notes: opp.url ? `Leilão: ${opp.url}` : null,
    }).select('id').single();
    if (error) { setSaving(false); return toast.error(error.message); }
    await db.from('payables_receivables').insert({ company_id: companyId, type: 'payable', payment_type: 'single', description: `Compra em leilão: ${name}`, amount: value, due_date: date, status: 'pending', created_by: user?.id ?? null });
    await db.from('machine_auction_opportunities').update({ status: 'bought', machine_id: m.id }).eq('id', opp.id);
    setSaving(false); toast.success('Máquina cadastrada e conta a pagar criada'); onClose();
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar compra</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome da máquina</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Valor pago (com taxas do leilão)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><Label>Data da compra</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={confirm} disabled={saving}>Confirmar compra</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Minhas revendas ---------------- */
function ResaleTab({ companyId, settings }: { companyId: string; settings: Setting[] }) {
  const [machines, setMachines] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [maint, setMaint] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [open, setOpen] = useState<any | null>(null);
  const load = useCallback(async () => {
    const [m, p, mr, s] = await Promise.all([
      db.from('machines').select('*').eq('company_id', companyId).eq('acquisition_source', 'resale_purchase').order('created_at', { ascending: false }),
      db.from('machine_parts_purchases').select('*').eq('company_id', companyId),
      db.from('maintenance_records').select('machine_id,total_cost,status').eq('company_id', companyId),
      db.from('machine_resales').select('*').eq('company_id', companyId),
    ]);
    setMachines(m.data ?? []); setParts(p.data ?? []); setMaint(mr.data ?? []); setSales(s.data ?? []);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);
  const costs = (id: string) => {
    const pc = parts.filter(x => x.machine_id === id).reduce((a, x) => a + Number(x.amount), 0);
    const mc = maint.filter(x => x.machine_id === id && x.status !== 'cancelled').reduce((a, x) => a + Number(x.total_cost || 0), 0);
    return { pc, mc };
  };
  const totals = useMemo(() => sales.reduce((a, s) => ({ sold: a.sold + Number(s.sale_price), profit: a.profit + Number(s.sale_price) - Number(s.total_cost) }), { sold: 0, profit: 0 }), [sales]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Máquinas em revenda</div><div className="text-2xl font-bold">{machines.filter(m => m.status !== 'vendida').length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total vendido</div><div className="text-2xl font-bold">{brl(totals.sold)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Lucro realizado</div><div className="text-2xl font-bold">{brl(totals.profit)}</div></CardContent></Card>
      </div>
      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Máquina</TableHead><TableHead>Compra</TableHead><TableHead>Peças</TableHead><TableHead>Manutenções</TableHead><TableHead>Custo total</TableHead><TableHead>Venda</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{machines.map(m => {
            const { pc, mc } = costs(m.id); const total = Number(m.acquisition_value) + pc + mc; const sale = sales.find(s => s.machine_id === m.id);
            return (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell><TableCell>{brl(m.acquisition_value)}</TableCell><TableCell>{brl(pc)}</TableCell><TableCell>{brl(mc)}</TableCell>
                <TableCell className="font-semibold">{brl(total)}</TableCell>
                <TableCell>{sale ? <span>{brl(sale.sale_price)} <Badge variant="secondary">{Number(sale.real_margin_pct).toFixed(1)}%</Badge></span> : '—'}</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => setOpen(m)}>{sale ? 'Ver' : 'Custos e venda'}</Button></TableCell>
              </TableRow>
            );
          })}{!machines.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Marque "Comprei" em uma oportunidade de leilão para começar.</TableCell></TableRow>}</TableBody>
        </Table>
      </CardContent></Card>
      {open && <ResaleDialog companyId={companyId} machine={open} settings={settings} parts={parts.filter(p => p.machine_id === open.id)} maintCost={costs(open.id).mc} sale={sales.find(s => s.machine_id === open.id)} onClose={() => setOpen(null)} reload={load} />}
    </div>
  );
}

function ResaleDialog({ companyId, machine, settings, parts, maintCost, sale, onClose, reload }: any) {
  const [part, setPart] = useState({ description: '', supplier: '', amount: '', date: todayISO() });
  const [settingId, setSettingId] = useState<string>(settings[0]?.id ?? '');
  const [price, setPrice] = useState('');
  const partsCost = parts.reduce((a: number, p: any) => a + Number(p.amount), 0);
  const purchase = Number(machine.acquisition_value) || 0;
  const recovery = partsCost + maintCost;
  const total = purchase + recovery;
  const margin = settings.find((s: Setting) => s.id === settingId)?.profit_margin_pct ?? 0;
  const suggested = suggestedSalePrice(purchase, recovery, margin);
  const addPart = async () => {
    const amount = Number(part.amount); if (!part.description || !amount) return toast.error('Informe peça e valor');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: pay } = await db.from('payables_receivables').insert({ company_id: companyId, type: 'payable', payment_type: 'single', description: `Peça ${part.description} – ${machine.name}`, amount, due_date: part.date, status: 'pending', created_by: user?.id ?? null }).select('id').single();
    const { error } = await db.from('machine_parts_purchases').insert({ company_id: companyId, machine_id: machine.id, description: part.description, supplier: part.supplier || null, amount, purchase_date: part.date, payable_id: pay?.id ?? null });
    if (error) return toast.error(error.message);
    setPart({ description: '', supplier: '', amount: '', date: todayISO() }); reload();
  };
  const sell = async () => {
    const value = Number(price || suggested); if (!value) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: rec } = await db.from('payables_receivables').insert({ company_id: companyId, type: 'receivable', payment_type: 'single', description: `Venda: ${machine.name}`, amount: value, due_date: todayISO(), status: 'pending', created_by: user?.id ?? null }).select('id').single();
    const { error } = await db.from('machine_resales').insert({ company_id: companyId, machine_id: machine.id, sale_price: value, total_cost: total, real_margin_pct: realMarginPct(value, total), receivable_id: rec?.id ?? null });
    if (error) return toast.error(error.message);
    await db.from('machines').update({ status: 'vendida' }).eq('id', machine.id);
    toast.success('Venda registrada e conta a receber criada'); reload(); onClose();
  };
  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
        <DialogHeader><DialogTitle>{machine.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div><div className="text-muted-foreground">Compra</div>{brl(purchase)}</div>
          <div><div className="text-muted-foreground">Peças</div>{brl(partsCost)}</div>
          <div><div className="text-muted-foreground">Manutenções</div>{brl(maintCost)}</div>
          <div><div className="text-muted-foreground">Custo total</div><strong>{brl(total)}</strong></div>
        </div>
        <h3 className="font-semibold mt-2">Compra de peças</h3>
        {!sale && <div className="grid gap-2 md:grid-cols-5 items-end">
          <Input className="md:col-span-2" placeholder="Peça" value={part.description} onChange={e => setPart({ ...part, description: e.target.value })} />
          <Input placeholder="Fornecedor" value={part.supplier} onChange={e => setPart({ ...part, supplier: e.target.value })} />
          <Input type="number" placeholder="Valor" value={part.amount} onChange={e => setPart({ ...part, amount: e.target.value })} />
          <Button onClick={addPart}><Plus className="w-4 h-4" /></Button>
        </div>}
        <Table><TableBody>{parts.map((p: any) => <TableRow key={p.id}><TableCell>{p.description}</TableCell><TableCell>{p.supplier}</TableCell><TableCell>{formatBR(p.purchase_date)}</TableCell><TableCell>{brl(p.amount)}</TableCell></TableRow>)}</TableBody></Table>
        <p className="text-xs text-muted-foreground">Manutenções são lançadas no menu Manutenções e entram no custo automaticamente.</p>
        {sale ? (
          <p className="text-sm">Vendida em {formatBR(sale.sale_date)} por <strong>{brl(sale.sale_price)}</strong> — lucro {brl(sale.sale_price - sale.total_cost)} ({Number(sale.real_margin_pct).toFixed(1)}%).</p>
        ) : (
          <div className="space-y-2 border-t pt-3">
            <h3 className="font-semibold">Vender</h3>
            <div className="grid gap-2 md:grid-cols-3 items-end">
              <div><Label>Margem do tipo</Label>
                <Select value={settingId} onValueChange={setSettingId}><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>{settings.map((s: Setting) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.profit_margin_pct}%)</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Preço sugerido</Label><div className="h-10 flex items-center font-semibold">{brl(suggested)}</div></div>
              <div><Label>Preço final</Label><Input type="number" placeholder={String(suggested)} value={price} onChange={e => setPrice(e.target.value)} /></div>
            </div>
            <p className="text-sm">Margem real: <strong>{realMarginPct(Number(price || suggested), total).toFixed(1)}%</strong></p>
            <DialogFooter><Button onClick={sell}>Registrar venda</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddToTableDialog({ companyId, settings, defaultSetting, found, market, onClose }: {
  companyId: string; settings: Setting[]; defaultSetting: string; found: Found; market?: { price: number; items: Found[] }; onClose: (ok: boolean) => void;
}) {
  const [settingId, setSettingId] = useState(defaultSetting);
  const [brand, setBrand] = useState(found.brand ?? '');
  const [model, setModel] = useState(found.model ?? found.title.slice(0, 60));
  const [year, setYear] = useState(found.year ? String(found.year) : '');
  const [price, setPrice] = useState(market?.price ? String(market.price) : '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!model.trim()) return toast.error('Informe o modelo');
    setSaving(true);
    const { error } = await db.from('machine_resale_prices').insert({
      company_id: companyId, setting_id: settingId || null, brand: brand || null, model: model.trim(),
      year_from: year ? Number(year) : null, year_to: year ? Number(year) : null,
      reference_price: Number(price) || 0, suggested_price: market?.price || null,
      sources: market?.items ?? [], researched_at: market ? new Date().toISOString() : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Máquina incluída na tabela de venda'); onClose(true);
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Incluir na tabela de venda</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Tipo</Label>
            <Select value={settingId} onValueChange={setSettingId}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{settings.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Marca</Label><Input value={brand} onChange={e => setBrand(e.target.value)} /></div>
            <div><Label>Modelo</Label><Input value={model} onChange={e => setModel(e.target.value)} /></div>
            <div><Label>Ano</Label><Input type="number" value={year} onChange={e => setYear(e.target.value)} /></div>
          </div>
          <div>
            <Label>Preço de venda</Label>
            <Input type="number" value={price} onChange={e => setPrice(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">{market?.price ? `Sugestão do mercado: ${brl(market.price)} (${market.items.length} ofertas). Ajuste se quiser.` : 'Sem sugestão de mercado; informe o preço.'}</p>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>Incluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
