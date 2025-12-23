import { useState, useEffect, useRef } from 'react';
import { Search, FolderKanban, Layers, CheckSquare, ListTree, MessageCircle, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectResult: (result: {
    type: 'project' | 'element' | 'task' | 'subtask' | 'comment';
    projectId?: string;
    elementId?: string;
    taskId?: string;
  }) => void;
}

const typeIcons = {
  project: FolderKanban,
  element: Layers,
  task: CheckSquare,
  subtask: ListTree,
  comment: MessageCircle,
};

const typeLabels = {
  project: 'Projeto',
  element: 'Elemento',
  task: 'Tarefa',
  subtask: 'Sub-tarefa',
  comment: 'Comentário',
};

export function GlobalSearchDialog({ open, onOpenChange, onSelectResult }: GlobalSearchDialogProps) {
  const { query, setQuery, results, loading } = useGlobalSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [open, setQuery]);

  const handleSelect = (result: typeof results[0]) => {
    onSelectResult({
      type: result.type,
      projectId: result.projectId,
      elementId: result.elementId,
      taskId: result.type === 'comment' || result.type === 'subtask' ? result.taskId : result.type === 'task' ? result.id : undefined,
    });
    onOpenChange(false);
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, typeof results>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="sr-only">Pesquisar</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar projetos, elementos, tarefas..."
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="p-2">
            {loading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Pesquisando...
              </p>
            )}

            {!loading && query.length >= 2 && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum resultado encontrado
              </p>
            )}

            {!loading && query.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Digite pelo menos 2 caracteres para pesquisar
              </p>
            )}

            {!loading && results.length > 0 && (
              <div className="space-y-4">
                {Object.entries(groupedResults).map(([type, items]) => {
                  const Icon = typeIcons[type as keyof typeof typeIcons];
                  const label = typeLabels[type as keyof typeof typeLabels];

                  return (
                    <div key={type}>
                      <p className="text-xs font-medium text-muted-foreground uppercase px-2 mb-1">
                        {label}s
                      </p>
                      <div className="space-y-1">
                        {items.map((result) => (
                          <button
                            key={`${result.type}-${result.id}`}
                            onClick={() => handleSelect(result)}
                            className={cn(
                              "w-full flex items-start gap-3 px-3 py-2 rounded-md text-left",
                              "hover:bg-muted transition-colors"
                            )}
                          >
                            <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {result.name}
                              </p>
                              {result.parentName && (
                                <p className="text-xs text-muted-foreground truncate">
                                  em {result.parentName}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-2 border-t text-xs text-muted-foreground text-center">
          Pressione <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+K</kbd> para abrir
        </div>
      </DialogContent>
    </Dialog>
  );
}
