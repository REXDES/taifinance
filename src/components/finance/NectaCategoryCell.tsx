import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { categorizeNectaEntry, type NectaLedgerEntry } from '@/hooks/useNectaLedger';
import type { TransactionCategory } from '@/hooks/useTransactionCategories';

interface Props {
  entryId: string;
  companyId: string;
  description: string;
  counterparty?: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  categorySource?: string | null;
  categories: TransactionCategory[];
  onSaved?: () => void;
}

/** Categorização de uma linha da Conta Necta, com memória para os próximos. */
export function NectaCategoryCell({
  entryId, companyId, description, counterparty,
  categoryId, subcategoryId, categorySource, categories, onSaved,
}: Props) {
  const [category, setCategory] = useState(categoryId ?? '');
  const [subcategory, setSubcategory] = useState(subcategoryId ?? '');
  const [saving, setSaving] = useState(false);

  const subcategories = categories.find(c => c.id === category)?.subcategories ?? [];

  const save = async (nextCategory: string, nextSubcategory: string) => {
    setSaving(true);
    try {
      const entry = {
        id: entryId, company_id: companyId, description, counterparty: counterparty ?? null,
      } as NectaLedgerEntry;
      await categorizeNectaEntry(entry, nextCategory || null, nextSubcategory || null);
      toast.success('Lançamento categorizado', {
        description: 'Lançamentos parecidos serão categorizados automaticamente.',
      });
      onSaved?.();
    } catch (error: any) {
      toast.error('Erro ao categorizar', { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <Select
        value={category || 'none'}
        disabled={saving}
        onValueChange={(v) => {
          const next = v === 'none' ? '' : v;
          setCategory(next);
          setSubcategory('');
          save(next, '');
        }}
      >
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categorizar" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem categoria</SelectItem>
          {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {subcategories.length > 0 && (
        <Select
          value={subcategory || 'none'}
          disabled={saving}
          onValueChange={(v) => {
            const next = v === 'none' ? '' : v;
            setSubcategory(next);
            save(category, next);
          }}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subcategoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem subcategoria</SelectItem>
            {subcategories.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {categorySource && categorySource !== 'manual' && category && (
        <Badge variant="outline" className="w-fit text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
          Sugerida
        </Badge>
      )}
    </div>
  );
}

/** Mantém o import do client para não perder o tree-shaking do tipo em build. */
export const _supabase = supabase;
