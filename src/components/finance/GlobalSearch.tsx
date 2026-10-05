import { useEffect, useMemo, useState } from 'react';
import { CornerDownLeft, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { FinanceView } from '@/pages/Finance';
import { seedGlobalSearch } from '@/lib/globalSearchSeed';
import {
  listSearchableScreens,
  normalizeText,
  type SearchableScreen,
  type SearchAccessContext,
} from './globalSearchIndex';

interface PersonRow {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  type: 'client' | 'supplier' | 'both';
}

const TYPE_LABEL: Record<PersonRow['type'], string> = {
  client: 'Cliente',
  supplier: 'Fornecedor',
  both: 'Cliente e fornecedor',
};

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  access: SearchAccessContext;
  onNavigate: (view: FinanceView) => void;
}

const digitsOnly = (v: string) => v.replace(/\D/g, '');

function rankScreen(screen: SearchableScreen, tokens: string[]): number | null {
  const label = normalizeText(screen.label);
  const haystack = [label, normalizeText(screen.section), ...screen.keywords.map(normalizeText)].join(' | ');
  if (!tokens.every((t) => haystack.includes(t))) return null;
  if (label.startsWith(tokens[0])) return 0;
  if (tokens.every((t) => label.includes(t))) return 1;
  return 2;
}

export function GlobalSearch({ open, onOpenChange, companyId, access, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<PersonRow[]>([]);

  const canSearchPeople = access.isSupervisor || (!access.isAdminMode && access.can('registry.clients_suppliers'));

  // Atalho Ctrl/Cmd + K em qualquer ponto da tela.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  // Carrega as pessoas da empresa ao abrir: a lista é pequena e filtrar no
  // navegador permite ignorar acentos ("joao" acha "João") e responder na hora.
  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    if (!companyId || !canSearchPeople || access.isAdminMode) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('clients_suppliers')
        .select('id, name, document, email, type')
        .eq('company_id', companyId)
        .order('name')
        .limit(1000);
      if (!cancelled && !error) setPeople((data ?? []) as PersonRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, companyId, canSearchPeople, access.isAdminMode]);

  const screens = useMemo(() => listSearchableScreens(access), [access]);

  const tokens = useMemo(() => normalizeText(query).split(/\s+/).filter(Boolean), [query]);

  const screenResults = useMemo(() => {
    if (!tokens.length) return screens;
    return screens
      .map((s) => ({ s, rank: rankScreen(s, tokens) }))
      .filter((r): r is { s: SearchableScreen; rank: number } => r.rank !== null)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.s)
      .slice(0, 8);
  }, [screens, tokens]);

  const peopleResults = useMemo(() => {
    if (query.trim().length < 2) return [];
    const queryDigits = digitsOnly(query);
    return people
      .filter((p) => {
        const haystack = normalizeText(`${p.name} ${p.email ?? ''}`);
        if (tokens.every((t) => haystack.includes(t))) return true;
        return queryDigits.length >= 3 && digitsOnly(p.document ?? '').includes(queryDigits);
      })
      .slice(0, 6);
  }, [people, query, tokens]);

  const goToScreen = (view: FinanceView) => {
    onOpenChange(false);
    onNavigate(view);
  };

  const goToPerson = (person: PersonRow) => {
    onOpenChange(false);
    seedGlobalSearch('clients-suppliers', person.name);
    onNavigate('clients-suppliers');
  };

  // Sem busca digitada: mostra as telas agrupadas por seção (um menu navegável pelo teclado).
  const grouped = useMemo(() => {
    if (tokens.length) return null;
    const map = new Map<string, SearchableScreen[]>();
    for (const s of screens) {
      const list = map.get(s.section) ?? [];
      list.push(s);
      map.set(s.section, list);
    }
    return [...map.entries()];
  }, [screens, tokens]);

  const renderScreen = (s: SearchableScreen) => (
    <CommandItem key={s.view} value={`screen-${s.view}`} onSelect={() => goToScreen(s.view)} className="gap-3">
      <span className="text-muted-foreground shrink-0">{s.icon ?? <CornerDownLeft className="w-4 h-4" />}</span>
      <span className="flex-1 truncate">{s.label}</span>
      <span className="text-xs text-muted-foreground shrink-0">{s.section}</span>
    </CommandItem>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        {/* O filtro é nosso (ignora acentos e entende sinônimos), então desligamos o do cmdk. */}
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Para onde você quer ir? Digite uma tela ou o nome de uma pessoa…"
          />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>Nada encontrado. Tente outra palavra, como "boleto", "cliente" ou "extrato".</CommandEmpty>

            {grouped
              ? grouped.map(([section, list]) => (
                  <CommandGroup key={section} heading={section}>
                    {list.map(renderScreen)}
                  </CommandGroup>
                ))
              : screenResults.length > 0 && (
                  <CommandGroup heading="Telas">{screenResults.map(renderScreen)}</CommandGroup>
                )}

            {peopleResults.length > 0 && (
              <CommandGroup heading="Clientes e fornecedores">
                {peopleResults.map((p) => (
                  <CommandItem key={p.id} value={`person-${p.id}`} onSelect={() => goToPerson(p)} className="gap-3">
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{TYPE_LABEL[p.type]}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
