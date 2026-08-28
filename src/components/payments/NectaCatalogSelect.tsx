import { useEffect, useMemo, useState } from 'react';
import { nectaCall } from '@/hooks/useNectaApi';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CatalogItem { id: string; name: string; reference?: string; code?: string; category?: string }

interface Props {
  kind: 'mcc' | 'legal-nature';
  /** MCC: uuid do MCC. Natureza jurídica: código (ex.: 2062). */
  value?: string | null;
  label?: string | null;
  onChange: (value: string | null, item: CatalogItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Seletor com busca alimentado pelos catálogos oficiais da Necta (/mccs, /public/legal-natures). */
export function NectaCatalogSelect({ kind, value, label, onChange, placeholder, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || items.length || loading) return;
    setLoading(true);
    nectaCall<any>(kind === 'mcc' ? '/mccs' : '/public/legal-natures')
      .then((resp) => {
        const list = Array.isArray(resp) ? resp : (resp?.data ?? []);
        setItems(list as CatalogItem[]);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, kind, items.length, loading]);

  const keyOf = (i: CatalogItem) => (kind === 'mcc' ? i.id : (i.code ?? i.id));

  const selected = useMemo(() => items.find((i) => keyOf(i) === value), [items, value]);
  const display = selected
    ? `${kind === 'legal-nature' && selected.code ? `${selected.code} — ` : ''}${selected.name}`
    : (label || (value ? String(value) : ''));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, 100);
    return items
      .filter((i) => `${i.name} ${i.reference ?? ''} ${i.code ?? ''} ${i.category ?? ''}`.toLowerCase().includes(q))
      .slice(0, 100);
  }, [items, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" disabled={disabled} className="w-full justify-between font-normal">
          <span className={cn('truncate', !display && 'text-muted-foreground')}>
            {display || placeholder || (kind === 'mcc' ? 'Selecione o ramo de atividade' : 'Selecione a natureza jurídica')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(28rem,90vw)]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar..." value={search} onValueChange={setSearch} />
          <CommandList>
            {loading && (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Carregando catálogo da Necta…
              </div>
            )}
            {error && <div className="p-3 text-xs text-destructive break-words">{error}</div>}
            {!loading && !error && <CommandEmpty>Nada encontrado</CommandEmpty>}
            <CommandGroup>
              {filtered.map((item) => {
                const k = keyOf(item);
                return (
                  <CommandItem key={item.id} value={k} onSelect={() => { onChange(k, item); setOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', value === k ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">
                      {kind === 'legal-nature' && item.code ? `${item.code} — ` : ''}
                      {item.name}
                      {kind === 'mcc' && item.reference ? ` (${item.reference})` : ''}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
