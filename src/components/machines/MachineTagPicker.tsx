import { useState, useMemo } from 'react';
import { Check, Plus, X, Tag as TagIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useMachineTags } from '@/hooks/useMachineTags';

interface Props {
  companyId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
}

const PALETTE = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

export function MachineTagPicker({ companyId, value, onChange, placeholder = 'Adicionar lembretes...', className }: Props) {
  const { tags, createTag } = useMachineTags(companyId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = useMemo(() => tags.filter(t => value.includes(t.id)), [tags, value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tags.filter(t => t.name.toLowerCase().includes(q)) : tags;
  }, [tags, query]);
  const exact = useMemo(() => tags.some(t => t.name.toLowerCase() === query.trim().toLowerCase()), [tags, query]);

  const toggle = (id: string) => value.includes(id) ? onChange(value.filter(v => v !== id)) : onChange([...value, id]);

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    const created = await createTag({ name, color: PALETTE[tags.length % PALETTE.length] });
    setCreating(false);
    if (created) { onChange([...value, created.id]); setQuery(''); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn('justify-start font-normal min-h-8 h-auto py-1 w-full', className)}>
          <TagIcon className="w-3 h-3 mr-1.5 text-muted-foreground shrink-0" />
          {selected.length === 0 ? (
            <span className="text-muted-foreground text-xs">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selected.map(t => (
                <Badge key={t.id} variant="outline" className="text-[10px] px-1.5 py-0 border-0" style={{ backgroundColor: `${t.color}22`, color: t.color }}>
                  {t.name}
                </Badge>
              ))}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b">
          <Input autoFocus placeholder="Buscar ou criar lembrete..." value={query} onChange={e => setQuery(e.target.value)} className="h-8" />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 && !query && (
            <p className="text-xs text-muted-foreground text-center py-4 px-2">Nenhuma tag cadastrada</p>
          )}
          {filtered.map(tag => {
            const checked = value.includes(tag.id);
            return (
              <button key={tag.id} type="button" onClick={() => toggle(tag.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent text-left">
                <div className={cn('w-4 h-4 rounded border flex items-center justify-center', checked ? 'bg-primary border-primary' : 'border-input')}>
                  {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 truncate" title={tag.description || undefined}>{tag.name}</span>
              </button>
            );
          })}
          {query.trim() && !exact && (
            <button type="button" disabled={creating} onClick={handleCreate}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent text-left border-t mt-1 text-primary">
              <Plus className="w-4 h-4" /> Criar "{query.trim()}"
            </button>
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t p-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{selected.length} selecionada(s)</span>
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange([])}>
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
