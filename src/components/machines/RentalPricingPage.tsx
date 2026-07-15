import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { useMachines, useMachineTypes, useMachineCategories, useRentalPriceTables, RentalPriceTable } from '@/hooks/useMachinesModule';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props { companyId: string; }

type Unit = 'hour' | 'day' | 'week' | 'month';
const UNITS: { key: Unit; label: string }[] = [
  { key: 'hour', label: 'Hora' },
  { key: 'day', label: 'Diária' },
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensal' },
];

const USAGE_LABEL: Record<string, string> = { locacao: 'Locação', venda: 'Venda', estoque: 'Estoque' };

type SaveState = 'idle' | 'saving' | 'saved';

export function RentalPricingPage({ companyId }: Props) {
  const { machines, loading: mLoading, refetch: refetchMachines } = useMachines(companyId) as any;
  const [usageSaving, setUsageSaving] = useState<Record<string, boolean>>({});

  const toggleUsage = async (machine: any, value: string) => {
    const current: string[] = machine.usage_purpose || ['locacao'];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    setUsageSaving(s => ({ ...s, [machine.id]: true }));
    try {
      const { error } = await (supabase as any).from('machines').update({ usage_purpose: next }).eq('id', machine.id);
      if (error) throw error;
      await refetchMachines();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar utilização');
    } finally {
      setUsageSaving(s => ({ ...s, [machine.id]: false }));
    }
  };
  const { types } = useMachineTypes(companyId);
  const { categories: dbCategories } = useMachineCategories(companyId);
  const { tables, refetch } = useRentalPriceTables(companyId);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [usageFilter, setUsageFilter] = useState<string>('locacao');
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  // key: machineId::unit -> { enabled, price, id }
  const [grid, setGrid] = useState<Record<string, { enabled: boolean; price: string; id?: string }>>({});

  const buildGrid = useCallback((rows: RentalPriceTable[]) => {
    const g: Record<string, { enabled: boolean; price: string; id?: string }> = {};
    machines.forEach((m: any) => {
      UNITS.forEach(u => {
        const found = rows.find(r => r.machine_id === m.id && r.unit === u.key);
        g[`${m.id}::${u.key}`] = found
          ? { enabled: true, price: String(found.price), id: found.id }
          : { enabled: false, price: '' };
      });
    });
    setGrid(g);
  }, [machines]);

  useEffect(() => { buildGrid(tables); }, [buildGrid, tables]);

  const typeName = (id: string | null) => types.find(t => t.id === id)?.name || '-';

  const filtered = useMemo(() => machines.filter((m: any) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'all' && (m.category || 'equipamento') !== categoryFilter) return false;
    if (typeFilter !== 'all' && (m.type_id || 'none') !== typeFilter) return false;
    if (usageFilter !== 'all') {
      const usages: string[] = (m.usage_purpose || ['locacao']);
      if (!usages.includes(usageFilter)) return false;
    }
    return true;
  }), [machines, search, categoryFilter, typeFilter, usageFilter]);

  const setKey = (machineId: string, unit: Unit, patch: Partial<{ enabled: boolean; price: string }>) => {
    setGrid(g => ({ ...g, [`${machineId}::${unit}`]: { ...g[`${machineId}::${unit}`], ...patch } }));
  };

  const persist = async (machineId: string, unit: Unit) => {
    const key = `${machineId}::${unit}`;
    const cell = grid[key];
    if (!cell) return;
    setSaveStates(s => ({ ...s, [key]: 'saving' }));
    try {
      if (!cell.enabled) {
        if (cell.id) {
          const { error } = await (supabase as any).from('rental_price_tables').delete().eq('id', cell.id);
          if (error) throw error;
        }
      } else {
        const priceNum = parseFloat((cell.price || '0').replace(',', '.'));
        if (Number.isNaN(priceNum) || priceNum < 0) throw new Error('Valor inválido');
        if (cell.id) {
          const { error } = await (supabase as any).from('rental_price_tables').update({ price: priceNum }).eq('id', cell.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from('rental_price_tables').insert({
            company_id: companyId, machine_id: machineId, unit, min_qty: 1, price: priceNum,
          });
          if (error) throw error;
        }
      }
      setSaveStates(s => ({ ...s, [key]: 'saved' }));
      setTimeout(() => setSaveStates(s => ({ ...s, [key]: 'idle' })), 1200);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
      setSaveStates(s => ({ ...s, [key]: 'idle' }));
    }
  };

  const catOptions = useMemo(() => {
    if (dbCategories.length > 0) return dbCategories.map(c => ({ value: c.name, label: c.name }));
    return [{ value: 'maquina', label: 'Máquina' }, { value: 'equipamento', label: 'Equipamento' }, { value: 'ferramenta', label: 'Ferramenta' }];
  }, [dbCategories]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Tabela de Preços de Locação</h1>
          <p className="text-sm text-muted-foreground">Marque as modalidades disponíveis e edite os valores diretamente na planilha.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar item..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {catOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="none">Sem tipo</SelectItem>
            {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={usageFilter} onValueChange={setUsageFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Utilização" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas utilizações</SelectItem>
            <SelectItem value="locacao">Somente Locação</SelectItem>
            <SelectItem value="venda">Somente Venda</SelectItem>
            <SelectItem value="estoque">Somente Estoque</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Utilização</TableHead>
                {UNITS.map(u => (
                  <TableHead key={u.key} className="min-w-[150px]">{u.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mLoading ? (
                <TableRow><TableCell colSpan={4 + UNITS.length}>Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4 + UNITS.length} className="text-center py-8 text-muted-foreground">Nenhum item encontrado</TableCell></TableRow>
              ) : filtered.map((m: any) => {
                const usages: string[] = m.usage_purpose || ['locacao'];
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell><Badge variant="secondary">{m.category || 'equipamento'}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{typeName(m.type_id)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap items-center">
                        {(['locacao','venda','estoque'] as const).map(u => {
                          const active = usages.includes(u);
                          return (
                            <button
                              key={u}
                              type="button"
                              disabled={usageSaving[m.id]}
                              onClick={() => toggleUsage(m, u)}
                              className="focus:outline-none"
                              title="Clique para alternar"
                            >
                              <Badge
                                variant={active ? 'default' : 'outline'}
                                className={`text-xs cursor-pointer ${active ? '' : 'opacity-50 hover:opacity-100'}`}
                              >
                                {USAGE_LABEL[u]}
                              </Badge>
                            </button>
                          );
                        })}
                        {usageSaving[m.id] && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                    </TableCell>
                    {UNITS.map(u => {
                      const key = `${m.id}::${u.key}`;
                      const cell = grid[key] || { enabled: false, price: '' };
                      const state = saveStates[key] || 'idle';
                      return (
                        <TableCell key={u.key}>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={cell.enabled}
                              onCheckedChange={(v) => {
                                const enabled = !!v;
                                setKey(m.id, u.key, { enabled });
                                // Only persist immediately when DISABLING (removes row).
                                // When enabling, wait until the user types a price and blurs,
                                // otherwise a stale-state persist reverts the toggle.
                                if (!enabled) setTimeout(() => persist(m.id, u.key), 0);
                              }}
                            />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="R$"
                              disabled={!cell.enabled}
                              value={cell.price}
                              onChange={e => setKey(m.id, u.key, { price: e.target.value })}
                              onBlur={() => cell.enabled && persist(m.id, u.key)}
                              className="h-8 w-24"
                            />
                            {state === 'saving' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                            {state === 'saved' && <Check className="w-3 h-3 text-green-600" />}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Dica: desmarque a modalidade para desabilitar a locação daquele item naquela unidade. Os valores são salvos automaticamente ao sair do campo.
      </div>
    </div>
  );
}
