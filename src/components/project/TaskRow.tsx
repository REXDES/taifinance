import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FileText, GripVertical, MessageCircle, Paperclip, CalendarDays, User, MoreHorizontal, EyeOff, ChevronDown, ChevronRight, Plus, Lock } from 'lucide-react';
import { calculateAggregatedStatus } from '@/lib/taskStatusUtils';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { StatusBadge } from './StatusBadge';
import { Task, Status, User as UserType } from '@/types';
import { SortableSubTaskRow } from './SortableSubTaskRow';
import { InlineSubtaskCreator } from './InlineSubtaskCreator';

interface TaskRowProps {
  task: Task;
  status: Status | undefined;
  responsible: UserType | undefined;
  onStatusChange: (taskId: string, statusId: string) => void;
  onOpenChat: (taskId: string, defaultTab?: 'comments' | 'attachments') => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  statuses: Status[];
  users: UserType[];
  isSelected?: boolean;
  onSelectionChange?: (taskId: string, selected: boolean) => void;
  isHiddenView?: boolean;
  dragListeners?: Record<string, unknown>;
  isDragging?: boolean;
  subtasks?: Task[];
  onCreateSubtask?: (parentId: string, name: string, color: string) => void;
  selectedTaskIds?: string[];
  commentCount?: number;
  getCommentCount?: (taskId: string) => number;
}

export function TaskRow({ 
  task, 
  status, 
  responsible, 
  onStatusChange, 
  onOpenChat, 
  onTaskUpdate,
  onDeleteTask,
  statuses, 
  users, 
  isSelected = false, 
  onSelectionChange, 
  isHiddenView = false, 
  dragListeners, 
  isDragging = false,
  subtasks = [],
  onCreateSubtask,
  selectedTaskIds = [],
  commentCount = 0,
  getCommentCount,
}: TaskRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editingObservation, setEditingObservation] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [observationValue, setObservationValue] = useState(task.observation || '');
  const [estimatedValue, setEstimatedValue] = useState(task.estimatedValue?.toString() || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false);

  const hasSubtasks = subtasks.length > 0;

  // Calcula status agregado quando há sub-tarefas
  const aggregatedStatus = useMemo(() => {
    if (!hasSubtasks) return null;
    return calculateAggregatedStatus(subtasks, statuses);
  }, [subtasks, statuses, hasSubtasks]);

  // Status a ser exibido
  const displayStatus = hasSubtasks && aggregatedStatus?.status 
    ? aggregatedStatus.status
    : status;

  // Se pode editar status (só quando não há sub-tarefas)
  const canEditStatus = !hasSubtasks;

  const formatDateRange = () => {
    if (!task.startDate && !task.endDate) return '-';
    const start = task.startDate ? format(new Date(task.startDate), 'dd/MM', { locale: ptBR }) : '';
    const end = task.endDate ? format(new Date(task.endDate), 'dd/MM', { locale: ptBR }) : '';
    if (start && end) return `${start} - ${end}`;
    return start || end;
  };

  const handleObservationSave = () => {
    onTaskUpdate(task.id, { observation: observationValue || undefined });
    setEditingObservation(false);
  };

  const handleValueSave = () => {
    const value = parseFloat(estimatedValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    onTaskUpdate(task.id, { estimatedValue: isNaN(value) ? undefined : value });
    setEditingValue(false);
  };

  const handleDateChange = (field: 'startDate' | 'endDate', date: Date | undefined) => {
    onTaskUpdate(task.id, { [field]: date?.toISOString().split('T')[0] });
  };

  const handleResponsibleChange = (userId: string | undefined) => {
    onTaskUpdate(task.id, { responsibleId: userId });
  };

  const handlePriorityChange = (value: number[]) => {
    onTaskUpdate(task.id, { priority: value[0] });
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleAddSubtask = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
    setIsCreatingSubtask(true);
  };

  const handleCreateSubtask = (name: string, color: string) => {
    onCreateSubtask?.(task.id, name, color);
    setIsCreatingSubtask(false);
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2 border-b border-border hover:bg-accent/30 transition-colors',
          isHovered && 'bg-accent/30',
          isSelected && 'bg-primary/10',
          isHiddenView && task.isHidden && 'opacity-60'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Checkbox, Expand e Drag */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            {...dragListeners}
            className={cn(
              "cursor-grab active:cursor-grabbing p-0.5 hover:bg-accent/50 rounded",
              isDragging && "cursor-grabbing"
            )}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          <Checkbox 
            className="border-border" 
            checked={isSelected}
            onCheckedChange={(checked) => onSelectionChange?.(task.id, !!checked)}
          />
          {/* Expand/Collapse button */}
          <button
            onClick={handleToggleExpand}
            className={cn(
              "p-0.5 hover:bg-accent/50 rounded transition-colors",
              !hasSubtasks && "invisible"
            )}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Nome da Tarefa */}
        <div className="flex items-center gap-2 min-w-[120px] flex-1">
          <div 
            className="w-1 h-6 rounded-full flex-shrink-0"
            style={{ backgroundColor: `hsl(${task.color})` }}
          />
          <span className="truncate text-sm text-foreground font-medium">{task.name}</span>
          {hasSubtasks && (
            <span className="text-xs text-muted-foreground">({subtasks.length})</span>
          )}
          {task.description && (
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          {isHiddenView && task.isHidden && (
            <EyeOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          {/* Add subtask button */}
          {isHovered && onCreateSubtask && (
            <button
              onClick={handleAddSubtask}
              className="p-0.5 hover:bg-accent/50 rounded transition-colors"
              title="Adicionar sub-tarefa"
            >
              <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Status */}
        <div className="col-status flex-shrink-0 w-[130px]">
          {canEditStatus ? (
            <Select
              value={task.statusId || ''}
              onValueChange={(value) => onStatusChange(task.id, value)}
            >
              <SelectTrigger className="h-8 w-full border-0 p-0 bg-transparent hover:opacity-80 focus:ring-0 [&>svg]:hidden">
                <SelectValue>
                  {status ? (
                    <div 
                      className="flex items-center justify-center h-7 w-full text-xs font-medium rounded-md px-3"
                      style={{ 
                        backgroundColor: `hsl(${status.color})`,
                        color: 'white'
                      }}
                    >
                      {status.name}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm px-2">Sem status</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-[100]">
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `hsl(${s.color})` }}
                      />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            // Status agregado (não editável)
            <div 
              className="flex items-center justify-center h-7 w-full text-xs font-medium rounded-md px-2 gap-1 cursor-not-allowed"
              style={{ 
                backgroundColor: displayStatus ? `hsl(${displayStatus.color})` : 'hsl(var(--muted))',
                color: 'white'
              }}
              title="Status calculado baseado nas sub-tarefas"
            >
              <Lock className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {displayStatus?.name || 'Sem status'}
              </span>
              <span className="flex-shrink-0">
                ({aggregatedStatus?.progress.completed}/{aggregatedStatus?.progress.total})
              </span>
            </div>
          )}
        </div>

        {/* Prioridade */}
        <div className="col-prioridade flex-shrink-0 w-[80px]">
          <div className="flex items-center gap-2">
            <Slider
              value={[task.priority || 0]}
              onValueChange={handlePriorityChange}
              max={5}
              step={1}
              className="w-14"
            />
            <span className="text-xs text-muted-foreground w-4">{task.priority || 0}</span>
          </div>
        </div>

        {/* Valor Estimado */}
        <div className="col-valor flex-shrink-0 w-[90px]">
          <Popover open={editingValue} onOpenChange={setEditingValue}>
            <PopoverTrigger asChild>
              <button className="text-sm text-muted-foreground text-left hover:text-foreground cursor-pointer truncate w-full">
                {task.estimatedValue ? `R$ ${task.estimatedValue.toLocaleString('pt-BR')}` : '-'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2 bg-popover border border-border shadow-lg z-[100]" align="start">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">Valor Estimado</label>
                <Input
                  type="text"
                  placeholder="R$ 0,00"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleValueSave()}
                  className="h-8"
                />
                <Button size="sm" onClick={handleValueSave}>Salvar</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Cronograma */}
        <div className="col-cronograma flex-shrink-0 w-[100px]">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                <CalendarDays className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{formatDateRange()}</span>
              </button>
            </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border border-border shadow-lg z-[100] max-h-[70vh] overflow-y-auto" align="start">
              <div className="flex flex-col gap-4 p-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Inicial</label>
                  <Calendar
                    mode="single"
                    selected={task.startDate ? new Date(task.startDate) : undefined}
                    onSelect={(date) => handleDateChange('startDate', date)}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Final</label>
                  <Calendar
                    mode="single"
                    selected={task.endDate ? new Date(task.endDate) : undefined}
                    onSelect={(date) => handleDateChange('endDate', date)}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Responsável */}
        <div className="col-responsavel flex-shrink-0 w-[100px]">
          <Select
            value={task.responsibleId || 'none'}
            onValueChange={(value) => handleResponsibleChange(value === 'none' ? undefined : value)}
          >
            <SelectTrigger className="h-8 w-full border-0 bg-transparent px-1 hover:bg-accent/50 rounded focus:ring-0">
              <SelectValue>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{responsible?.name || '-'}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border shadow-lg z-[100]">
              <SelectItem value="none">
                <span className="text-muted-foreground">Nenhum</span>
              </SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    {u.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Observação */}
        <div className="col-observacao flex-shrink-0 w-[120px]">
          <Popover open={editingObservation} onOpenChange={setEditingObservation}>
            <PopoverTrigger asChild>
              <button className="text-sm text-muted-foreground text-left hover:text-foreground cursor-pointer truncate w-full">
                {task.observation || '-'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 bg-popover border border-border shadow-lg z-[100]" align="start">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">Observação</label>
                <Input
                  type="text"
                  placeholder="Digite a observação..."
                  value={observationValue}
                  onChange={(e) => setObservationValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleObservationSave()}
                  className="h-8"
                />
                <Button size="sm" onClick={handleObservationSave}>Salvar</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Ações */}
        <div className="col-acoes items-center gap-1 flex-shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-7 h-7 relative"
            onClick={() => onOpenChat(task.id, 'comments')}
            title="Comentários"
          >
            <MessageCircle className="w-4 h-4" />
            {commentCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-medium rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {commentCount > 99 ? '99+' : commentCount}
              </span>
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-7 h-7"
            onClick={() => onOpenChat(task.id, 'attachments')}
            title="Anexos"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
        </div>

        {/* Menu More */}
        <div className="col-more flex-shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="w-7 h-7">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0 bg-popover border border-border shadow-lg z-[100] max-h-[70vh] overflow-y-auto" align="end">
              <div className="flex flex-col gap-3 p-3">
                <div className="menu-status">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Status {hasSubtasks && <span className="text-xs text-muted-foreground">(automático)</span>}
                  </label>
                  {canEditStatus ? (
                    <Select
                      value={task.statusId || ''}
                      onValueChange={(value) => onStatusChange(task.id, value)}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-[100]">
                        {statuses.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: `hsl(${s.color})` }}
                              />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div 
                      className="flex items-center h-8 w-full rounded-md border border-input bg-muted px-3 text-sm gap-2"
                      title="Status calculado baseado nas sub-tarefas"
                    >
                      <Lock className="w-3 h-3 text-muted-foreground" />
                      {displayStatus && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `hsl(${displayStatus.color})` }}
                        />
                      )}
                      <span className="truncate">{displayStatus?.name || 'Sem status'}</span>
                      <span className="text-muted-foreground ml-auto">
                        {aggregatedStatus?.progress.completed}/{aggregatedStatus?.progress.total}
                      </span>
                    </div>
                  )}
                </div>

                <div className="menu-prioridade">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[task.priority || 0]}
                      onValueChange={handlePriorityChange}
                      max={5}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground w-4">{task.priority || 0}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor Estimado</label>
                  <Input
                    type="text"
                    placeholder="R$ 0,00"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    onBlur={handleValueSave}
                    className="h-8"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Inicial</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {task.startDate ? format(new Date(task.startDate), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar...'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[200]" align="start">
                      <Calendar
                        mode="single"
                        selected={task.startDate ? new Date(task.startDate) : undefined}
                        onSelect={(date) => handleDateChange('startDate', date)}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Final</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {task.endDate ? format(new Date(task.endDate), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar...'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[200]" align="start">
                      <Calendar
                        mode="single"
                        selected={task.endDate ? new Date(task.endDate) : undefined}
                        onSelect={(date) => handleDateChange('endDate', date)}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsável</label>
                  <Select
                    value={task.responsibleId || 'none'}
                    onValueChange={(value) => handleResponsibleChange(value === 'none' ? undefined : value)}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border shadow-lg z-[100]">
                      <SelectItem value="none">Nenhum</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Observação</label>
                  <Input
                    type="text"
                    placeholder="Digite a observação..."
                    value={observationValue}
                    onChange={(e) => setObservationValue(e.target.value)}
                    onBlur={handleObservationSave}
                    className="h-8"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Subtasks */}
      {isExpanded && (
        <div className="border-l-2 border-muted ml-6">
          {/* Subtasks Header */}
          <div className="flex items-center gap-2 px-4 py-1 pl-12 bg-muted/30 border-b border-border/50 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1 flex-shrink-0 w-8"></div>
            <div className="min-w-[100px] flex-1">Sub-tarefa</div>
            <div className="w-[100px] flex-shrink-0">Status</div>
            <div className="w-[60px] flex-shrink-0">Prior.</div>
            <div className="w-[70px] flex-shrink-0">Valor</div>
            <div className="w-[80px] flex-shrink-0">Cronograma</div>
            <div className="w-[80px] flex-shrink-0">Responsável</div>
            <div className="w-[60px] flex-shrink-0"></div>
          </div>
          <SortableContext 
            items={subtasks.map(s => s.id)} 
            strategy={verticalListSortingStrategy}
          >
            {subtasks.map(subtask => (
              <SortableSubTaskRow
                key={subtask.id}
                task={subtask}
                status={statuses.find(s => s.id === subtask.statusId)}
                responsible={users.find(u => u.id === subtask.responsibleId)}
                statuses={statuses}
                users={users}
                onStatusChange={onStatusChange}
                onOpenChat={onOpenChat}
                onTaskUpdate={onTaskUpdate}
                onDelete={onDeleteTask || (() => {})}
                isSelected={selectedTaskIds.includes(subtask.id)}
                onSelectionChange={onSelectionChange}
                isHiddenView={isHiddenView}
                commentCount={getCommentCount?.(subtask.id) || 0}
              />
            ))}
          </SortableContext>
          {isCreatingSubtask && (
            <InlineSubtaskCreator
              onSave={handleCreateSubtask}
              onCancel={() => setIsCreatingSubtask(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
