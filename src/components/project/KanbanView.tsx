import { useState, useMemo, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, GripVertical, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Task, Status, User, Element } from '@/types';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface KanbanViewProps {
  tasks: Task[];
  elements: Element[];
  statuses: Status[];
  users: User[];
  onTaskClick: (taskId: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onReorderTasks: (activeId: string, overId: string, newElementId?: string) => void;
  onCreateTask: (elementId: string, name: string, color: string, statusId?: string) => Promise<void>;
  onCreateSubtask: (parentId: string, name: string, color: string) => void;
  getSubtasks: (parentId: string) => Task[];
}

interface DraggableTaskCardProps {
  task: Task;
  subtasks: Task[];
  users: User[];
  statuses: Status[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTaskClick: (taskId: string) => void;
  onAddSubtask: (parentId: string) => void;
  isAddingSubtask: boolean;
  newSubtaskName: string;
  onNewSubtaskNameChange: (name: string) => void;
  onSubmitSubtask: () => void;
  onCancelSubtask: () => void;
}

function DraggableTaskCard({
  task,
  subtasks,
  users,
  statuses,
  isExpanded,
  onToggleExpand,
  onTaskClick,
  onAddSubtask,
  isAddingSubtask,
  newSubtaskName,
  onNewSubtaskNameChange,
  onSubmitSubtask,
  onCancelSubtask,
}: DraggableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const responsible = users.find(u => u.id === task.responsibleId);
  const hasSubtasks = subtasks.length > 0;

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-50')}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-accent rounded"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
            
            <div 
              className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
              style={{ backgroundColor: `hsl(${task.color})` }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                {hasSubtasks && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand();
                    }}
                    className="p-0.5 hover:bg-accent rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                )}
                <p 
                  className="text-sm font-medium text-foreground truncate flex-1 cursor-pointer"
                  onClick={() => onTaskClick(task.id)}
                >
                  {task.name}
                </p>
              </div>
              
              {hasSubtasks && (
                <span className="text-xs text-muted-foreground ml-5">
                  {subtasks.length} sub-tarefa{subtasks.length !== 1 ? 's' : ''}
                </span>
              )}
              
              {task.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
              
              {responsible && (
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[10px] text-primary-foreground">
                      {responsible.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {responsible.name}
                  </span>
                </div>
              )}

              {/* Expanded Subtasks */}
              {isExpanded && hasSubtasks && (
                <div className="mt-2 space-y-1 border-l-2 border-muted pl-2 ml-1">
                  {subtasks.map(subtask => {
                    const subtaskStatus = statuses.find(s => s.id === subtask.statusId);
                    return (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-2 py-1 px-2 rounded bg-muted/50 cursor-pointer hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskClick(subtask.id);
                        }}
                      >
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: subtaskStatus ? `hsl(${subtaskStatus.color})` : 'hsl(var(--muted))' }}
                        />
                        <span className="text-xs text-foreground truncate">{subtask.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Subtask */}
              {isExpanded && (
                <div className="mt-2">
                  {isAddingSubtask ? (
                    <div className="flex gap-1">
                      <Input
                        value={newSubtaskName}
                        onChange={(e) => onNewSubtaskNameChange(e.target.value)}
                        placeholder="Nome da sub-tarefa"
                        className="h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onSubmitSubtask();
                          if (e.key === 'Escape') onCancelSubtask();
                        }}
                      />
                      <Button size="sm" className="h-7 px-2" onClick={onSubmitSubtask}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSubtask(task.id);
                      }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="w-3 h-3" />
                      Sub-tarefa
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function KanbanView({ 
  tasks, 
  elements,
  statuses, 
  users, 
  onTaskClick,
  onTaskUpdate,
  onReorderTasks,
  onCreateTask,
  onCreateSubtask,
  getSubtasks,
}: KanbanViewProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [addingTaskFor, setAddingTaskFor] = useState<{ statusId: string; elementId: string } | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('kanban-status-sort-order');
    return (saved === 'desc' ? 'desc' : 'asc');
  });

  // Persist sort order
  useEffect(() => {
    localStorage.setItem('kanban-status-sort-order', sortOrder);
  }, [sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Sort statuses based on order preference
  const sortedStatuses = useMemo(() => {
    return [...statuses].sort((a, b) => {
      const diff = a.importance - b.importance;
      return sortOrder === 'asc' ? diff : -diff;
    });
  }, [statuses, sortOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get root tasks only (no parent)
  const rootTasks = useMemo(() => 
    tasks.filter(t => !t.parentTaskId),
    [tasks]
  );

  // Group tasks by status, sorted by order
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    statuses.forEach(s => {
      grouped[s.id] = rootTasks
        .filter(t => t.statusId === s.id)
        .sort((a, b) => a.order - b.order);
    });
    return grouped;
  }, [rootTasks, statuses]);

  const handleToggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleAddSubtask = (parentId: string) => {
    setAddingSubtaskFor(parentId);
    setNewSubtaskName('');
  };

  const handleSubmitSubtask = () => {
    if (addingSubtaskFor && newSubtaskName.trim()) {
      const parentTask = tasks.find(t => t.id === addingSubtaskFor);
      onCreateSubtask(addingSubtaskFor, newSubtaskName.trim(), parentTask?.color || '262 83% 58%');
      setAddingSubtaskFor(null);
      setNewSubtaskName('');
    }
  };

  const handleCancelSubtask = () => {
    setAddingSubtaskFor(null);
    setNewSubtaskName('');
  };

  const handleAddTask = (statusId: string) => {
    if (elements.length === 1) {
      setAddingTaskFor({ statusId, elementId: elements[0].id });
      setNewTaskName('');
    } else {
      setAddingTaskFor({ statusId, elementId: '' });
      setNewTaskName('');
    }
  };

  const handleSubmitTask = async () => {
    if (addingTaskFor && newTaskName.trim() && addingTaskFor.elementId) {
      await onCreateTask(addingTaskFor.elementId, newTaskName.trim(), '262 83% 58%', addingTaskFor.statusId);
      setAddingTaskFor(null);
      setNewTaskName('');
    }
  };

  const handleCancelTask = () => {
    setAddingTaskFor(null);
    setNewTaskName('');
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = rootTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;
    
    // Check if over a status column (empty area)
    if (overId.startsWith('status-')) {
      const newStatusId = overId.replace('status-', '');
      if (activeTask.statusId !== newStatusId) {
        onTaskUpdate(activeTask.id, { statusId: newStatusId });
      }
    } else {
      // Over another task
      const overTask = rootTasks.find(t => t.id === overId);
      if (overTask && activeTask.statusId !== overTask.statusId) {
        onTaskUpdate(activeTask.id, { statusId: overTask.statusId });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    const activeTaskId = active.id as string;
    const overId = over.id as string;
    
    if (activeTaskId === overId) return;
    
    // If over a status column, position at end
    if (overId.startsWith('status-')) {
      const newStatusId = overId.replace('status-', '');
      const tasksInColumn = tasksByStatus[newStatusId] || [];
      const lastTask = tasksInColumn[tasksInColumn.length - 1];
      if (lastTask && lastTask.id !== activeTaskId) {
        onReorderTasks(activeTaskId, lastTask.id);
      }
    } else {
      // Reorder relative to another task
      onReorderTasks(activeTaskId, overId);
    }
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-auto p-6 bg-background">
        {/* Sort Order Toggle */}
        <div className="flex items-center mb-3">
          <button
            onClick={toggleSortOrder}
            className="flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title={sortOrder === 'asc' ? 'Ordenar por importância decrescente' : 'Ordenar por importância crescente'}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-4 min-w-max">
          {sortedStatuses.map(status => {
              const statusTasks = tasksByStatus[status.id] || [];
              const taskIds = statusTasks.map(t => t.id);
              
              return (
                <div 
                  key={status.id} 
                  className="w-80 flex-shrink-0"
                >
                  {/* Column Header */}
                  <div 
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-t-lg"
                    style={{ backgroundColor: `hsl(${status.color})` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" style={{ color: 'white' }}>
                        {status.name}
                      </span>
                      <span 
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                      >
                        {statusTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAddTask(status.id)}
                      className="p-1 rounded hover:bg-white/20 transition-colors"
                      title="Adicionar tarefa"
                    >
                      <Plus className="w-4 h-4" style={{ color: 'white' }} />
                    </button>
                  </div>

                  {/* Tasks - Sortable Area */}
                  <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                    <DroppableColumn statusId={status.id}>
                      {statusTasks.map(task => {
                        const subtasks = getSubtasks(task.id);
                        const isExpanded = expandedTasks.has(task.id);
                        
                        return (
                          <DraggableTaskCard
                            key={task.id}
                            task={task}
                            subtasks={subtasks}
                            users={users}
                            statuses={statuses}
                            isExpanded={isExpanded}
                            onToggleExpand={() => handleToggleExpand(task.id)}
                            onTaskClick={onTaskClick}
                            onAddSubtask={handleAddSubtask}
                            isAddingSubtask={addingSubtaskFor === task.id}
                            newSubtaskName={newSubtaskName}
                            onNewSubtaskNameChange={setNewSubtaskName}
                            onSubmitSubtask={handleSubmitSubtask}
                            onCancelSubtask={handleCancelSubtask}
                          />
                        );
                      })}

                      {/* Add Task Form */}
                      {addingTaskFor?.statusId === status.id ? (
                        <Card className="p-3 space-y-2">
                          <Input
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            placeholder="Nome da tarefa"
                            className="h-8"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && addingTaskFor.elementId) handleSubmitTask();
                              if (e.key === 'Escape') handleCancelTask();
                            }}
                          />
                          
                          {elements.length > 1 && (
                            <select
                              value={addingTaskFor.elementId}
                              onChange={(e) => setAddingTaskFor({ ...addingTaskFor, elementId: e.target.value })}
                              className="w-full h-8 px-2 text-sm border rounded-md bg-background"
                            >
                              <option value="">Selecione o elemento</option>
                              {elements.map(el => (
                                <option key={el.id} value={el.id}>{el.name}</option>
                              ))}
                            </select>
                          )}
                          
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="h-7" 
                              onClick={handleSubmitTask}
                              disabled={!newTaskName.trim() || !addingTaskFor.elementId}
                            >
                              Criar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={handleCancelTask}>
                              Cancelar
                            </Button>
                          </div>
                        </Card>
                      ) : (
                        <button 
                          className="w-full flex items-center justify-center gap-1 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
                          onClick={() => handleAddTask(status.id)}
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar
                        </button>
                      )}
                    </DroppableColumn>
                  </SortableContext>
                </div>
              );
            })}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask ? (
          <Card className="w-80 shadow-lg rotate-3">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div 
                  className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: `hsl(${activeTask.color})` }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {activeTask.name}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface DroppableColumnProps {
  statusId: string;
  children: React.ReactNode;
}

function DroppableColumn({ statusId, children }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useSortable({
    id: `status-${statusId}`,
    disabled: true,
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "bg-muted/30 rounded-b-lg p-2 min-h-[200px] space-y-2 transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/20"
      )}
    >
      {children}
    </div>
  );
}
