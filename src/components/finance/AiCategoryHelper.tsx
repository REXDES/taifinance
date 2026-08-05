import { useState } from 'react';
import { Lightbulb, Loader2, Check, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFinanceTags } from '@/hooks/useFinanceTags';

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  subcategories?: { id: string; name: string }[];
}

interface AiSuggestion {
  found: boolean;
  category_id?: string;
  category_name?: string;
  subcategory_id?: string;
  subcategory_name?: string;
  suggested_category_name?: string;
  suggested_subcategory_name?: string;
  tag_ids?: string[];
  tag_names?: string[];
  suggested_tag_names?: string[];
  confidence: 'alta' | 'media' | 'baixa';
  explanation: string;
}

interface AiCategoryHelperProps {
  type: 'expense' | 'income';
  categories: Category[];
  onSelectCategory: (categoryId: string, subcategoryId?: string) => void;
  onSuggestCreate?: (categoryName: string, subcategoryName?: string) => void;
  trigger?: React.ReactNode;
  initialDescription?: string;
  companyId?: string | null;
  onSelectTags?: (tagIds: string[]) => void;
}

export function AiCategoryHelper({
  type,
  categories,
  onSelectCategory,
  onSuggestCreate,
  trigger,
  initialDescription,
  companyId,
  onSelectTags,
}: AiCategoryHelperProps) {
  const { toast } = useToast();
  const { tags, createTag } = useFinanceTags(onSelectTags ? (companyId ?? null) : null);
  const [creatingTag, setCreatingTag] = useState<string | null>(null);
  const [extraTagIds, setExtraTagIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({
        title: 'Descreva o lançamento',
        description: 'Por favor, explique qual despesa ou receita você deseja inserir.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('suggest-category', {
        body: {
          description: description.trim(),
          type,
          categories: categories.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            subcategories: c.subcategories || [],
          })),
          tags: onSelectTags ? tags.map(t => ({ id: t.id, name: t.name })) : [],
        },
      });

      if (invokeError) {
        console.error('Edge function error:', invokeError);
        setError(invokeError.message || 'Erro ao processar sugestão');
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setSuggestion(data);
    } catch (err) {
      console.error('Error calling suggest-category:', err);
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const applyTags = () => {
    if (!onSelectTags || !suggestion) return;
    const valid = (suggestion.tag_ids || []).filter(id => tags.some(t => t.id === id));
    const all = Array.from(new Set([...valid, ...extraTagIds]));
    if (all.length > 0) onSelectTags(all);
  };

  const handleCreateTag = async (name: string) => {
    if (!companyId) return;
    setCreatingTag(name);
    const created = await createTag({ name });
    setCreatingTag(null);
    if (created) {
      setExtraTagIds(prev => [...prev, created.id]);
      toast({ title: 'Tag criada', description: name });
    }
  };

  const handleUseSuggestion = () => {
    if (!suggestion) return;
    applyTags();

    if (suggestion.found && suggestion.subcategory_id) {
      onSelectCategory(suggestion.category_id!, suggestion.subcategory_id);
      toast({
        title: 'Categoria aplicada!',
        description: `${suggestion.category_name} → ${suggestion.subcategory_name}`,
      });
    } else if (suggestion.found && suggestion.category_id) {
      onSelectCategory(suggestion.category_id);
      toast({
        title: 'Categoria aplicada!',
        description: suggestion.category_name,
      });
    }

    handleClose();
  };

  const handleCreateNew = () => {
    if (!suggestion || !onSuggestCreate) return;

    applyTags();

    onSuggestCreate(
      suggestion.suggested_category_name || '',
      suggestion.suggested_subcategory_name
    );

    toast({
      title: 'Sugestão de criação',
      description: 'Você pode criar a categoria/subcategoria sugerida.',
    });

    handleClose();
  };

  const handleClose = () => {
    setOpen(false);
    setDescription('');
    setSuggestion(null);
    setError(null);
    setExtraTagIds([]);
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      alta: { color: 'bg-green-500/10 text-green-600 border-green-200', label: 'Alta confiança' },
      media: { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200', label: 'Média confiança' },
      baixa: { color: 'bg-red-500/10 text-red-600 border-red-200', label: 'Baixa confiança' },
    };
    const variant = variants[confidence] || variants.baixa;
    return (
      <Badge variant="outline" className={variant.color}>
        {variant.label}
      </Badge>
    );
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => { setDescription(initialDescription || ''); setOpen(true); }}>{trigger}</div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setDescription(initialDescription || ''); setOpen(true); }}
          className="gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Ajude-me
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Assistente de Categoria
            </DialogTitle>
            <DialogDescription>
              Descreva a {type === 'expense' ? 'despesa' : 'receita'} e a IA sugerirá a melhor categoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Input area */}
            {!suggestion && !error && (
              <>
                <Textarea
                  placeholder={`Ex: ${type === 'expense' ? 'Pagamento do condomínio do apartamento' : 'Rendimento de aluguel do imóvel comercial'}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={loading}
                  className="resize-none"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !description.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Sugerir Categoria
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Error state */}
            {error && (
              <div className="space-y-3">
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                  {error}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    setSuggestion(null);
                  }}
                  className="w-full"
                >
                  Tentar novamente
                </Button>
              </div>
            )}

            {/* Suggestion result */}
            {suggestion && (
              <div className="space-y-4">
                {/* Confidence badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Resultado:</span>
                  {getConfidenceBadge(suggestion.confidence)}
                </div>

                {/* Suggestion details */}
                {suggestion.found && suggestion.subcategory_id ? (
                  // Found exact match with subcategory
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                    <div className="font-medium text-foreground">
                      {suggestion.category_name}
                      <span className="text-muted-foreground"> → {suggestion.subcategory_name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
                  </div>
                ) : suggestion.found && suggestion.category_id && suggestion.suggested_subcategory_name ? (
                  // Found category but suggests creating subcategory
                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg space-y-2">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Sugestão:
                    </div>
                    <div className="text-sm">
                      <div>Categoria existente: <strong>{suggestion.category_name}</strong></div>
                      <div>Criar subcategoria: <strong>{suggestion.suggested_subcategory_name}</strong></div>
                    </div>
                    <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
                  </div>
                ) : (
                  // Suggests creating new category
                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg space-y-2">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Sugestão para criar:
                    </div>
                    <div className="text-sm">
                      {suggestion.suggested_category_name && (
                        <div>Categoria: <strong>{suggestion.suggested_category_name}</strong></div>
                      )}
                      {suggestion.suggested_subcategory_name && (
                        <div>Subcategoria: <strong>{suggestion.suggested_subcategory_name}</strong></div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
                  </div>
                )}

                {/* Tag suggestions */}
                {onSelectTags && (() => {
                  const validTags = (suggestion.tag_ids || [])
                    .map(id => tags.find(t => t.id === id))
                    .filter(Boolean) as { id: string; name: string; color: string }[];
                  const newTagNames = (suggestion.suggested_tag_names || []).filter(
                    n => n && !tags.some(t => t.name.toLowerCase() === n.toLowerCase()),
                  );
                  const created = extraTagIds
                    .map(id => tags.find(t => t.id === id))
                    .filter(Boolean) as { id: string; name: string; color: string }[];
                  if (validTags.length === 0 && newTagNames.length === 0 && created.length === 0) return null;
                  return (
                    <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Tags sugeridas</div>
                      <div className="flex flex-wrap gap-1.5">
                        {[...validTags, ...created].map(t => (
                          <Badge
                            key={t.id}
                            variant="outline"
                            className="text-[11px] border-0"
                            style={{ backgroundColor: `${t.color}22`, color: t.color }}
                          >
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                      {newTagNames.length > 0 && companyId && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {newTagNames.map(n => (
                            <Button
                              key={n}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2"
                              disabled={creatingTag === n}
                              onClick={() => handleCreateTag(n)}
                            >
                              {creatingTag === n ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3 mr-1" />
                              )}
                              Criar "{n}"
                            </Button>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        As tags serão aplicadas ao usar a sugestão.
                      </p>
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {suggestion.found && suggestion.subcategory_id ? (
                    // Use existing category + subcategory
                    <Button onClick={handleUseSuggestion} className="flex-1">
                      <Check className="w-4 h-4 mr-2" />
                      Usar esta categoria
                    </Button>
                  ) : (
                    // Suggest to create (either subcategory or full category)
                    <Button 
                      onClick={() => {
                        if (onSuggestCreate) {
                          handleCreateNew();
                        } else {
                          const isNewSubcategoryOnly = suggestion.found && suggestion.category_id;
                          if (isNewSubcategoryOnly) {
                            toast({
                              title: 'Criar subcategoria',
                              description: `Crie a subcategoria "${suggestion.suggested_subcategory_name}" em Cadastros → Categorias → ${suggestion.category_name}`,
                            });
                          } else {
                            toast({
                              title: 'Criar categoria',
                              description: `Crie a categoria "${suggestion.suggested_category_name}"${suggestion.suggested_subcategory_name ? ` com subcategoria "${suggestion.suggested_subcategory_name}"` : ''} em Cadastros → Categorias`,
                            });
                          }
                          handleClose();
                        }
                      }} 
                      className="flex-1"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {suggestion.found && suggestion.category_id 
                        ? 'Criar subcategoria' 
                        : (onSuggestCreate ? 'Criar categoria' : 'Entendi, vou criar')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSuggestion(null);
                      setDescription('');
                    }}
                  >
                    Nova busca
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
