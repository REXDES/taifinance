import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Copy, Users } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTaskRow } from './SortableTaskRow';
import { StatusSummary } from './StatusBadge';
import { Element, Task, Status, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SortableElementCardProps {
  element: Element;
  tasks: Task[];
  statuses: Status[];
  users: User[];
  onToggleExpand: (elementId: string) => void;
  onAddTask: (elementId: string) => void;
  onOpenChat: (taskId: string, defaultTab?: 'comments' | 'attachments') => void;
  onStatusChange: (taskId: string, statusId: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  selectedTaskIds?: string[];
  onSelectionChange?: (taskId: string, selected: boolean) => void;
  showHidden?: boolean;
  isOver?: boolean;
  onCreateSubtask?: (parentId: string, name: string, color: string) => void;
  getSubtasks?: (parentTaskId: string) => Task[];
  onEditElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onDuplicateElement?: (elementId: string) => void;
  onOpenWorkGroup?: (elementId: string) => void;
  workGroupCount?: number;
  getCommentCount?: (taskId: string) => number;
}

export function SortableElementCard({
  element,
  tasks,
  statuses,
  users,
  onToggleExpand,
  onAddTask,
  onOpenChat,
  onStatusChange,
  onTaskUpdate,
  onDeleteTask,
  selectedTaskIds = [],
  onSelectionChange,
  showHidden = false,
  isOver = false,
  onCreateSubtask,
  getSubtasks,
  onEditElement,
  onDeleteElement,
  onDuplicateElement,
  onOpenWorkGroup,
  workGroupCount = 0,
  getCommentCount,
}: SortableElementCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: element.id,
    data: {
      type: 'element',
      element,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Filter to show only root tasks (without parent)
  const elementTasks = tasks.filter(t => t.elementId === element.id && !t.parentTaskId);
  const taskIds = elementTasks.map(t => t.id);

  const allElementTasks = tasks.filter(t => t.elementId === element.id);
  const taskStatusSummary = statuses.map(status => ({
    statusId: status.id,
    count: allElementTasks.filter(t => t.statusId === status.id).length,
  }));

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={`bg-card rounded-lg border overflow-hidden mb-4 ${
            isOver ? 'border-primary border-2' : 'border-border'
          }`}
        >
          {/* Element Header */}
          <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent/50 rounded"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>

            <button
              className="p-0.5"
              onClick={() => onToggleExpand(element.id)}
            >
              {element.isExpanded ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            <h3
              className="font-medium text-lg cursor-pointer"
              style={{ color: `hsl(${element.color})` }}
              onClick={() => onToggleExpand(element.id)}
            >
              {element.name}
            </h3>

            {/* Work Group Icon */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWorkGroup?.(element.id);
                    }}
                  >
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {workGroupCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="absolute -top-1 -right-1 h-4 min-w-[16px] p-0 flex items-center justify-center text-[10px]"
                      >
                        {workGroupCount}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Grupo de Trabalho ({workGroupCount} membros)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {!element.isExpanded && (
              <span className="text-sm text-muted-foreground">
                {allElementTasks.length} Tarefas
              </span>
            )}

            <div className="flex-1" />

            {!element.isExpanded && (
              <>
                <StatusSummary
                  taskStatuses={taskStatusSummary}
                  statuses={statuses}
                  totalTasks={allElementTasks.length}
                />
                <div className="text-sm text-muted-foreground min-w-[100px] text-center hidden lg:block">
                  Cronograma
                </div>
              </>
            )}
          </div>

          {/* Tasks */}
          {element.isExpanded && (
            <div className="task-list-container overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Column Headers */}
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground border-t border-border">
                  <div className="w-[56px] flex-shrink-0" />
                  <div className="min-w-[120px] flex-1">Tarefa</div>
                  <div className="col-status w-[130px] flex-shrink-0">Status</div>
                  <div className="col-prioridade w-[80px] flex-shrink-0">Prioridade</div>
                  <div className="col-valor w-[90px] flex-shrink-0">Valor</div>
                  <div className="col-cronograma w-[100px] flex-shrink-0">Cronograma</div>
                  <div className="col-responsavel w-[100px] flex-shrink-0">Responsável</div>
                  <div className="col-observacao w-[120px] flex-shrink-0">Observação</div>
                  <div className="w-[64px] flex-shrink-0">Ações</div>
                </div>

                {/* Task Rows */}
                <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                {elementTasks.map(task => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      status={statuses.find(s => s.id === task.statusId)}
                      responsible={users.find(u => u.id === task.responsibleId)}
                      statuses={statuses}
                      users={users}
                      onStatusChange={onStatusChange}
                      onOpenChat={onOpenChat}
                      onTaskUpdate={onTaskUpdate}
                      onDeleteTask={onDeleteTask}
                      isSelected={selectedTaskIds.includes(task.id)}
                      onSelectionChange={onSelectionChange}
                      isHiddenView={showHidden}
                      subtasks={getSubtasks?.(task.id) || []}
                      onCreateSubtask={onCreateSubtask}
                      selectedTaskIds={selectedTaskIds}
                      commentCount={getCommentCount?.(task.id) || 0}
                      getCommentCount={getCommentCount}
                    />
                  ))}
                </SortableContext>

                {/* Add Task Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTask(element.id);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 w-full transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar tarefa
                </button>
              </div>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-popover">
        <ContextMenuItem onClick={() => onEditElement?.(element.id)}>
          <Pencil className="w-4 h-4 mr-2" />
          Renomear Elemento
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicateElement?.(element.id)}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicar Elemento
        </ContextMenuItem>
        <ContextMenuItem 
          className="text-destructive focus:text-destructive"
          onClick={() => onDeleteElement?.(element.id)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir Elemento
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
