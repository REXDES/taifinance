import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { BRAZILIAN_BANKS, BankEntry, formatBankCode } from '@/lib/banks';

interface BankSelectProps {
  /** Código COMPE atual (ex.: "341"). */
  code: string;
  /** Nome do banco atual. */
  name: string;
  /** Chamado com o código e o nome do banco selecionado. */
  onChange: (code: string, name: string) => void;
  disabled?: boolean;
}

/** Normaliza texto para busca (remove acentos). */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Seletor com busca de bancos brasileiros.
 * Lista estática local + tentativa de atualização via BrasilAPI em runtime.
 */
export function BankSelect({ code, name, onChange, disabled }: BankSelectProps) {
  const [open, setOpen] = useState(false);
  const [banks, setBanks] = useState<BankEntry[]>(BRAZILIAN_BANKS);

  // Atualiza a lista com a BrasilAPI (melhor esforço — fallback = lista estática)
  useEffect(() => {
    let cancelled = false;
    fetch('https://brasilapi.com.br/api/banks/v1')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: Array<{ ispb: string; code: number | null; name: string; fullName: string }>) => {
        if (cancelled || !Array.isArray(data)) return;
        const list: BankEntry[] = data
          .filter(b => b.code != null)
          .map(b => ({ code: String(b.code), name: b.name || b.fullName }))
          .sort((a, b) => Number(a.code) - Number(b.code));
        if (list.length > 0) setBanks(list);
      })
      .catch(() => { /* mantém lista estática */ });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => {
    const c = formatBankCode(code);
    return banks.find(b => formatBankCode(b.code) === c);
  }, [banks, code]);

  const label = selected
    ? `${formatBankCode(selected.code)} — ${selected.name}`
    : (code || name ? `${code ? formatBankCode(code) + ' — ' : ''}${name || ''}`.trim() : '');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !label && 'text-muted-foreground')}>
            {label || 'Selecione o banco...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(value, search) => {
          const s = norm(search);
          const v = norm(value);
          return v.includes(s) ? 1 : 0;
        }}>
          <CommandInput placeholder="Buscar por nome ou código..." />
          <CommandList>
            <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
            <CommandGroup>
              {banks.map(b => {
                const value = `${formatBankCode(b.code)} ${b.name}`;
                const isSel = formatBankCode(b.code) === formatBankCode(code);
                return (
                  <CommandItem
                    key={b.code + b.name}
                    value={value}
                    onSelect={() => {
                      onChange(formatBankCode(b.code), b.name);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', isSel ? 'opacity-100' : 'opacity-0')} />
                    <span className="font-mono text-xs text-muted-foreground mr-2">{formatBankCode(b.code)}</span>
                    <span className="truncate">{b.name}</span>
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
