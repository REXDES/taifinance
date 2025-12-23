import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Filter, EyeOff, Eye, ArrowUpDown, LayoutGrid, MoreHorizontal, Search, User, X, ArrowUp, ArrowDown, Check, Trash2, UserPlus, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortField = 'name' | 'status' | 'priority' | 'value' | 'schedule' | 'responsible' | null;
type SortDirection = 'asc' | 'desc';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SortableElementCard } from './SortableElementCard';
import { Element, Task, Status, User as UserType } from '@/types';

interface Filters {
  nameInitials: string[];
  statuses: string[];
  priorities: number[];
  responsibles: string[];
}

interface ListViewProps {
  elements: Element[];
  tasks: Task[];
  statuses: Status[];
  users: UserType[];
  onToggleExpand: (elementId: string) => void;
  onAddTask: (elementId: string) => void;
  onAddElement: () => void;
  onOpenChat: (taskId: string, defaultTab?: 'comments' | 'attachments') => void;
  onStatusChange: (taskId: string, statusId: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onBulkUpdate?: (taskIds: string[], updates: Partial<Task>) => Promise<boolean>;
  onBulkDelete?: (taskIds: string[]) => Promise<boolean>;
  onReorderElements?: (activeId: string, overId: string) => void;
  onReorderTasks?: (activeId: string, overId: string, newElementId?: string) => void;
  onCreateSubtask?: (parentId: string, name: string, color: string) => void;
  onDeleteTask?: (taskId: string) => void;
  getSubtasks?: (parentTaskId: string) => Task[];
  onEditElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onDuplicateElement?: (elementId: string) => void;
  onOpenWorkGroup?: (elementId: string) => void;
  workGroupCounts?: Record<string, number>;
  getCommentCount?: (taskId: string) => number;
}

export function ListView({
  elements,
  tasks,
  statuses,
  users,
  onToggleExpand,
  onAddTask,
  onAddElement,
  onOpenChat,
  onStatusChange,
  onTaskUpdate,
  onBulkUpdate,
  onBulkDelete,
  onReorderElements,
  onReorderTasks,
  onCreateSubtask,
  onDeleteTask,
  getSubtasks,
  onEditElement,
  onDeleteElement,
  onDuplicateElement,
  onOpenWorkGroup,
  workGroupCounts = {},
  getCommentCount,
}: ListViewProps) {
  const [filters, setFilters] = useState<Filters>({
    nameInitials: [],
    statuses: [],
    priorities: [],
    responsibles: [],
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'element' | 'task' | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [overElementId, setOverElementId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Count hidden tasks
  const hiddenCount = useMemo(() => {
    return tasks.filter(t => t.isHidden).length;
  }, [tasks]);

  // Get unique initials from task names
  const availableInitials = useMemo(() => {
    const initials = new Set<string>();
    tasks.forEach(task => {
      const initial = task.name.charAt(0).toUpperCase();
      if (initial) initials.add(initial);
    });
    return Array.from(initials).sort();
  }, [tasks]);

  // Filter and sort tasks based on current filters and sort
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(task => {
      // Filter by hidden status
      if (showHidden) {
        if (!task.isHidden) return false;
      } else {
        if (task.isHidden) return false;
      }

      // Filter by name initials
      if (filters.nameInitials.length > 0) {
        const taskInitial = task.name.charAt(0).toUpperCase();
        if (!filters.nameInitials.includes(taskInitial)) return false;
      }

      // Filter by status
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(task.statusId)) return false;
      }

      // Filter by priority
      if (filters.priorities.length > 0) {
        const taskPriority = task.priority ?? 0;
        if (!filters.priorities.includes(taskPriority)) return false;
      }

      // Filter by responsible
      if (filters.responsibles.length > 0) {
        if (!task.responsibleId || !filters.responsibles.includes(task.responsibleId)) return false;
      }

      return true;
    });

    // Apply sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'status':
            const statusA = statuses.find(s => s.id === a.statusId);
            const statusB = statuses.find(s => s.id === b.statusId);
            comparison = (statusA?.importance ?? 0) - (statusB?.importance ?? 0);
            break;
          case 'priority':
            comparison = (a.priority ?? 0) - (b.priority ?? 0);
            break;
          case 'value':
            comparison = (a.estimatedValue ?? 0) - (b.estimatedValue ?? 0);
            break;
          case 'schedule':
            const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
            const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
            comparison = dateA - dateB;
            break;
          case 'responsible':
            const userA = users.find(u => u.id === a.responsibleId)?.name ?? '';
            const userB = users.find(u => u.id === b.responsibleId)?.name ?? '';
            comparison = userA.localeCompare(userB);
            break;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [tasks, filters, sortField, sortDirection, statuses, users, showHidden]);

  const handleSelectionChange = (taskId: string, selected: boolean) => {
    setSelectedTaskIds(prev => 
      selected 
        ? [...prev, taskId]
        : prev.filter(id => id !== taskId)
    );
  };

  const clearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleBulkHide = async () => {
    if (onBulkUpdate && selectedTaskIds.length > 0) {
      const success = await onBulkUpdate(selectedTaskIds, { is_hidden: !showHidden } as any);
      if (success) {
        clearSelection();
      }
    }
  };

  const handleBulkDelete = async () => {
    if (onBulkDelete && selectedTaskIds.length > 0) {
      const success = await onBulkDelete(selectedTaskIds);
      if (success) {
        clearSelection();
      }
    }
  };

  const handleBulkResponsible = async (userId: string | undefined) => {
    if (onBulkUpdate && selectedTaskIds.length > 0) {
      const success = await onBulkUpdate(selectedTaskIds, { responsible_id: userId || null } as any);
      if (success) {
        clearSelection();
      }
    }
  };

  const handleOpenRename = () => {
    if (selectedTaskIds.length === 1) {
      const task = tasks.find(t => t.id === selectedTaskIds[0]);
      if (task) {
        setRenameValue(task.name);
        setRenameDialogOpen(true);
      }
    }
  };

  const handleRename = () => {
    if (selectedTaskIds.length === 1 && renameValue.trim()) {
      onTaskUpdate(selectedTaskIds[0], { name: renameValue.trim() });
      setRenameDialogOpen(false);
      clearSelection();
    }
  };

  const toggleInitial = (initial: string) => {
    setFilters(prev => ({
      ...prev,
      nameInitials: prev.nameInitials.includes(initial)
        ? prev.nameInitials.filter(i => i !== initial)
        : [...prev.nameInitials, initial],
    }));
  };

  const toggleStatus = (statusId: string) => {
    setFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(statusId)
        ? prev.statuses.filter(s => s !== statusId)
        : [...prev.statuses, statusId],
    }));
  };

  const togglePriority = (priority: number) => {
    setFilters(prev => ({
      ...prev,
      priorities: prev.priorities.includes(priority)
        ? prev.priorities.filter(p => p !== priority)
        : [...prev.priorities, priority],
    }));
  };

  const toggleResponsible = (userId: string) => {
    setFilters(prev => ({
      ...prev,
      responsibles: prev.responsibles.includes(userId)
        ? prev.responsibles.filter(r => r !== userId)
        : [...prev.responsibles, userId],
    }));
  };

  const clearFilters = () => {
    setFilters({
      nameInitials: [],
      statuses: [],
      priorities: [],
      responsibles: [],
    });
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearSort = () => {
    setSortField(null);
    setSortDirection('asc');
  };

  const sortFieldLabels: Record<NonNullable<SortField>, string> = {
    name: 'Nome',
    status: 'Status',
    priority: 'Prioridade',
    value: 'Valor',
    schedule: 'Cronograma',
    responsible: 'Responsável',
  };

  const activeFiltersCount = 
    filters.nameInitials.length + 
    filters.statuses.length + 
    filters.priorities.length + 
    filters.responsibles.length;

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveType(active.data.current?.type || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && activeType === 'task') {
      const overData = over.data.current;
      if (overData?.type === 'element') {
        setOverElementId(over.id as string);
      } else if (overData?.elementId) {
        setOverElementId(overData.elementId);
      } else {
        setOverElementId(null);
      }
    } else {
      setOverElementId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);
    setOverElementId(null);

    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'element' && overData?.type === 'element') {
      // Reordering elements
      onReorderElements?.(active.id as string, over.id as string);
    } else if (activeData?.type === 'task') {
      // Reordering tasks
      if (overData?.type === 'task') {
        // Task dropped on another task
        const newElementId = overData.elementId !== activeData.elementId 
          ? overData.elementId 
          : undefined;
        onReorderTasks?.(active.id as string, over.id as string, newElementId);
      } else if (overData?.type === 'element') {
        // Task dropped on element header
        onReorderTasks?.(active.id as string, active.id as string, over.id as string);
      }
    } else if (activeData?.type === 'subtask') {
      // Reordering subtasks within the same parent
      if (overData?.type === 'subtask' && activeData.parentTaskId === overData.parentTaskId) {
        onReorderTasks?.(active.id as string, over.id as string);
      }
    }
  };

  const sortedElements = useMemo(() => 
    [...elements].sort((a, b) => a.order - b.order),
    [elements]
  );

  const elementIds = useMemo(() => sortedElements.map(e => e.id), [sortedElements]);

  return (
    <div className="flex-1 overflow-auto p-6 bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button className="gap-2">
          Criar tarefa
        </Button>
        
        <Button variant="ghost" size="sm" className="gap-1">
          <Search className="w-4 h-4" />
          Pesquisar
        </Button>
        
        <Button variant="ghost" size="sm" className="gap-1">
          <User className="w-4 h-4" />
          Pessoa
        </Button>
        
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant={activeFiltersCount > 0 ? "secondary" : "ghost"} 
              size="sm" 
              className="gap-1"
            >
              <Filter className="w-4 h-4" />
              Filtro
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 max-h-[60vh] overflow-y-auto bg-popover border border-border shadow-lg z-[100]" align="start">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-foreground">Filtros</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  <X className="w-3 h-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {/* Filter by Name Initials */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Inicial do Nome
                </label>
                <div className="flex flex-wrap gap-1">
                  {availableInitials.map(initial => (
                    <button
                      key={initial}
                      onClick={() => toggleInitial(initial)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                        filters.nameInitials.includes(initial)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      {initial}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter by Status */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Status
                </label>
                <div className="space-y-2">
                  {statuses.map(status => (
                    <label key={status.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.statuses.includes(status.id)}
                        onCheckedChange={() => toggleStatus(status.id)}
                      />
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: `hsl(${status.color})` }}
                        />
                        <span className="text-sm">{status.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filter by Priority */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Prioridade
                </label>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map(priority => (
                    <button
                      key={priority}
                      onClick={() => togglePriority(priority)}
                      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                        filters.priorities.includes(priority)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter by Responsible */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Responsável
                </label>
                <div className="space-y-2">
                  {users.map(user => (
                    <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.responsibles.includes(user.id)}
                        onCheckedChange={() => toggleResponsible(user.id)}
                      />
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{user.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant={sortField ? "secondary" : "ghost"} 
              size="sm" 
              className="gap-1"
            >
              <ArrowUpDown className="w-4 h-4" />
              Ordenar
              {sortField && (
                <Badge variant="default" className="ml-1 h-5 px-1 flex items-center justify-center text-xs">
                  {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-popover border border-border shadow-lg z-[100]" align="start">
            <div className="flex items-center justify-between mb-2 px-2">
              <h4 className="font-medium text-foreground text-sm">Ordenar por</h4>
              {sortField && (
                <Button variant="ghost" size="sm" onClick={clearSort} className="h-6 text-xs px-2">
                  <X className="w-3 h-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            
            <div className="space-y-1">
              {(['name', 'status', 'priority', 'value', 'schedule', 'responsible'] as const).map(field => (
                <button
                  key={field}
                  onClick={() => handleSortChange(field)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                    sortField === field
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <span>{sortFieldLabels[field]}</span>
                  <div className="flex items-center gap-1">
                    {sortField === field && (
                      <>
                        {sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                        <Check className="w-3 h-3" />
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        <Button 
          variant={showHidden ? "secondary" : "ghost"} 
          size="sm" 
          className="gap-1"
          onClick={() => {
            setShowHidden(!showHidden);
            clearSelection();
          }}
        >
          {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showHidden ? 'Ver visíveis' : 'Ocultar'}
          {hiddenCount > 0 && !showHidden && (
            <Badge variant="outline" className="ml-1 h-5 px-1.5 text-xs">
              {hiddenCount}
            </Badge>
          )}
        </Button>
        
        <Button variant="ghost" size="sm" className="gap-1">
          <LayoutGrid className="w-4 h-4" />
          Agrupar por
        </Button>
        
        <Button variant="ghost" size="icon" className="w-8 h-8">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtros ativos:</span>
          {filters.nameInitials.map(initial => (
            <Badge 
              key={`initial-${initial}`} 
              variant="secondary" 
              className="gap-1 cursor-pointer"
              onClick={() => toggleInitial(initial)}
            >
              Inicial: {initial}
              <X className="w-3 h-3" />
            </Badge>
          ))}
          {filters.statuses.map(statusId => {
            const status = statuses.find(s => s.id === statusId);
            return (
              <Badge 
                key={`status-${statusId}`} 
                variant="secondary" 
                className="gap-1 cursor-pointer"
                onClick={() => toggleStatus(statusId)}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: status ? `hsl(${status.color})` : undefined }}
                />
                {status?.name}
                <X className="w-3 h-3" />
              </Badge>
            );
          })}
          {filters.priorities.map(priority => (
            <Badge 
              key={`priority-${priority}`} 
              variant="secondary" 
              className="gap-1 cursor-pointer"
              onClick={() => togglePriority(priority)}
            >
              Prioridade: {priority}
              <X className="w-3 h-3" />
            </Badge>
          ))}
          {filters.responsibles.map(userId => {
            const user = users.find(u => u.id === userId);
            return (
              <Badge 
                key={`responsible-${userId}`} 
                variant="secondary" 
                className="gap-1 cursor-pointer"
                onClick={() => toggleResponsible(userId)}
              >
                {user?.name}
                <X className="w-3 h-3" />
              </Badge>
            );
          })}
        </div>
      )}

      {/* Active Sort Display */}
      {sortField && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Ordenação:</span>
          <Badge 
            variant="secondary" 
            className="gap-1 cursor-pointer"
            onClick={clearSort}
          >
            {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {sortFieldLabels[sortField]}
            <X className="w-3 h-3" />
          </Badge>
        </div>
      )}

      {/* Elements with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className={selectedTaskIds.length > 0 ? 'pb-20' : ''}>
          <SortableContext items={elementIds} strategy={verticalListSortingStrategy}>
            {sortedElements.map(element => (
              <SortableElementCard
                key={element.id}
                element={element}
                tasks={filteredTasks}
                statuses={statuses}
                users={users}
                onToggleExpand={onToggleExpand}
                onAddTask={onAddTask}
                onOpenChat={onOpenChat}
                onStatusChange={onStatusChange}
                onTaskUpdate={onTaskUpdate}
                onDeleteTask={onDeleteTask}
                selectedTaskIds={selectedTaskIds}
                onSelectionChange={handleSelectionChange}
                showHidden={showHidden}
                isOver={overElementId === element.id}
                onCreateSubtask={onCreateSubtask}
                getSubtasks={getSubtasks}
                onEditElement={onEditElement}
                onDeleteElement={onDeleteElement}
                onDuplicateElement={onDuplicateElement}
                onOpenWorkGroup={onOpenWorkGroup}
                workGroupCount={workGroupCounts[element.id] || 0}
                getCommentCount={getCommentCount}
              />
            ))}
          </SortableContext>
        </div>

        <DragOverlay>
          {activeId && activeType === 'element' && (
            <div className="bg-card rounded-lg border border-primary shadow-lg p-4 opacity-90">
              <span className="font-medium">
                {elements.find(e => e.id === activeId)?.name}
              </span>
            </div>
          )}
          {activeId && activeType === 'task' && (
            <div className="bg-card rounded-lg border border-primary shadow-lg p-3 opacity-90">
              <span className="text-sm font-medium">
                {tasks.find(t => t.id === activeId)?.name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add Element Button */}
      <Button
        variant="outline"
        className={selectedTaskIds.length > 0 ? 'mt-4 mb-20' : 'mt-4'}
        onClick={onAddElement}
      >
        + Adicionar elemento
      </Button>

      {/* Bulk Actions Footer */}
      {selectedTaskIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
          <div className="flex items-center justify-between px-6 py-3 max-w-screen-xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectedTaskIds.length} {selectedTaskIds.length === 1 ? 'tarefa selecionada' : 'tarefas selecionadas'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Rename Button (only when 1 item selected) */}
              {selectedTaskIds.length === 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleOpenRename}
                >
                  <Pencil className="w-4 h-4" />
                  Renomear
                </Button>
              )}
              
              {/* Hide/Unhide Button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleBulkHide}
              >
                {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {showHidden ? 'Desocultar' : 'Ocultar'}
              </Button>
              
              {/* Delete Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir tarefas</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir {selectedTaskIds.length} {selectedTaskIds.length === 1 ? 'tarefa' : 'tarefas'}? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              {/* Change Responsible */}
              <Select onValueChange={(value) => handleBulkResponsible(value === 'none' ? undefined : value)}>
                <SelectTrigger className="w-[160px] h-9">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    <span className="text-sm">Responsável</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Clear Selection */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={clearSelection}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Renomear</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              placeholder="Nome da tarefa..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
