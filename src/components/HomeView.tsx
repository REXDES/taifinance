import { Briefcase, Star, Layers, FolderKanban, Users, User, AlertTriangle, CheckSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MyWorkElement {
  id: string;
  name: string;
  color: string;
  projectId: string;
  projectName: string;
  companyId: string;
  type: 'responsible' | 'workgroup';
}

interface FavoriteElement {
  id: string;
  name: string;
  color: string;
  projectId: string;
  projectName: string;
  companyId: string;
}

interface PriorityTask {
  id: string;
  name: string;
  color: string;
  elementId: string;
  elementName: string;
  projectId: string;
  projectName: string;
  companyId: string;
  type: 'responsible' | 'workgroup';
}

interface HomeViewProps {
  myWorkElements: MyWorkElement[];
  favoriteElements: FavoriteElement[];
  priorityTasks: PriorityTask[];
  onSelectElement: (elementId: string, projectId: string, companyId: string) => void;
  onSelectTask: (taskId: string, elementId: string, projectId: string, companyId: string) => void;
  onToggleFavorite: (elementId: string) => void;
  favoriteIds: string[];
  loading: boolean;
}

export function HomeView({
  myWorkElements,
  favoriteElements,
  priorityTasks,
  onSelectElement,
  onSelectTask,
  onToggleFavorite,
  favoriteIds,
  loading,
}: HomeViewProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-hidden">
      <h1 className="text-2xl font-bold mb-6">Página Inicial</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-4rem)]">
        {/* Tarefas Prioritárias */}
        <div className="bg-card rounded-lg border border-border p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Tarefas Prioritárias</h2>
          </div>

          <ScrollArea className="flex-1">
            {priorityTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma tarefa prioritária pendente.
                <br />
                <span className="text-xs">Tarefas com importância 2 e status "A fazer" aparecerão aqui.</span>
              </p>
            ) : (
              <div className="space-y-2">
                {priorityTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelectTask(task.id, task.elementId, task.projectId, task.companyId)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left group"
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `hsl(${task.color})` }}
                    >
                      <CheckSquare className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Layers className="w-3 h-3" />
                        <span className="truncate">{task.elementName}</span>
                        <span className="text-muted-foreground/50">•</span>
                        <FolderKanban className="w-3 h-3" />
                        <span className="truncate">{task.projectName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.type === 'responsible' ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          Resp.
                        </span>
                      ) : (
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          Grupo
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Meu Trabalho */}
        <div className="bg-card rounded-lg border border-border p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Meu Trabalho</h2>
          </div>

          <ScrollArea className="flex-1">
            {myWorkElements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Você não está em nenhum grupo de trabalho ou como responsável de tarefas.
              </p>
            ) : (
              <div className="space-y-2">
                {myWorkElements.map((element) => (
                  <button
                    key={element.id}
                    onClick={() => onSelectElement(element.id, element.projectId, element.companyId)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left group"
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `hsl(${element.color})` }}
                    >
                      <Layers className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{element.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FolderKanban className="w-3 h-3" />
                        <span className="truncate">{element.projectName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {element.type === 'responsible' ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          Resp.
                        </span>
                      ) : (
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          Grupo
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(element.id);
                        }}
                        className={cn(
                          "p-1 rounded hover:bg-accent transition-colors",
                          favoriteIds.includes(element.id) ? "text-yellow-500" : "text-muted-foreground"
                        )}
                      >
                        <Star className={cn("w-4 h-4", favoriteIds.includes(element.id) && "fill-current")} />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Favoritos */}
        <div className="bg-card rounded-lg border border-border p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Favoritos</h2>
          </div>

          <ScrollArea className="flex-1">
            {favoriteElements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Você ainda não favoritou nenhum elemento.
                <br />
                <span className="text-xs">Clique na estrela ao lado de um elemento para favoritar.</span>
              </p>
            ) : (
              <div className="space-y-2">
                {favoriteElements.map((element) => (
                  <button
                    key={element.id}
                    onClick={() => onSelectElement(element.id, element.projectId, element.companyId)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left group"
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `hsl(${element.color})` }}
                    >
                      <Layers className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{element.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FolderKanban className="w-3 h-3" />
                        <span className="truncate">{element.projectName}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(element.id);
                      }}
                      className="p-1 rounded hover:bg-accent transition-colors text-yellow-500"
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
