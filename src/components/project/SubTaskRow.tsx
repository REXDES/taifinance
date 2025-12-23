import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GripVertical, MessageCircle, CalendarDays, User, MoreHorizontal, EyeOff, Trash2 } from 'lucide-react';
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
import { Task, Status, User as UserType } from '@/types';

interface SubTaskRowProps {
  task: Task;
  status: Status | undefined;
  responsible: UserType | undefined;
  onStatusChange: (taskId: string, statusId: string) => void;
  onOpenChat: (taskId: string, defaultTab?: 'comments' | 'attachments') => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  statuses: Status[];
  users: UserType[];
  isSelected?: boolean;
  onSelectionChange?: (taskId: string, selected: boolean) => void;
  isHiddenView?: boolean;
  dragListeners?: Record<string, unknown>;
  isDragging?: boolean;
  commentCount?: number;
}

export function SubTaskRow({
  task,
  status,
  responsible,
  onStatusChange,
  onOpenChat,
  onTaskUpdate,
  onDelete,
  statuses,
  users,
  isSelected = false,
  onSelectionChange,
  isHiddenView = false,
  dragListeners,
  isDragging = false,
  commentCount = 0,
}: SubTaskRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [estimatedValue, setEstimatedValue] = useState(task.estimatedValue?.toString() || '');

  const formatDateRange = () => {
    if (!task.startDate && !task.endDate) return '-';
    const start = task.startDate ? format(new Date(task.startDate), 'dd/MM', { locale: ptBR }) : '';
    const end = task.endDate ? format(new Date(task.endDate), 'dd/MM', { locale: ptBR }) : '';
    if (start && end) return `${start} - ${end}`;
    return start || end;
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

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-1.5 pl-12 border-b border-border/50 hover:bg-accent/20 transition-colors bg-muted/10',
        isHovered && 'bg-accent/20',
        isSelected && 'bg-primary/10',
        isHiddenView && task.isHidden && 'opacity-60',
        isDragging && 'opacity-50'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox e Drag */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          {...dragListeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-0.5 hover:bg-accent/50 rounded opacity-50",
            isDragging && "cursor-grabbing"
          )}
        >
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </button>
        <Checkbox 
          className="border-border w-3 h-3" 
          checked={isSelected}
          onCheckedChange={(checked) => onSelectionChange?.(task.id, !!checked)}
        />
      </div>

      {/* Nome */}
      <div className="flex items-center gap-2 min-w-[100px] flex-1">
        <div 
          className="w-1 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: `hsl(${task.color})` }}
        />
        <span className="truncate text-xs text-foreground">{task.name}</span>
        {isHiddenView && task.isHidden && (
          <EyeOff className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0 w-[100px]">
        <Select
          value={task.statusId || ''}
          onValueChange={(value) => onStatusChange(task.id, value)}
        >
          <SelectTrigger className="h-6 w-full border-0 p-0 bg-transparent hover:opacity-80 focus:ring-0 [&>svg]:hidden">
            <SelectValue>
              {status ? (
                <div 
                  className="flex items-center justify-center h-5 w-full text-[10px] font-medium rounded px-2"
                  style={{ 
                    backgroundColor: `hsl(${status.color})`,
                    color: 'white'
                  }}
                >
                  {status.name}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">-</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-[100]">
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `hsl(${s.color})` }}
                  />
                  {s.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prioridade */}
      <div className="flex-shrink-0 w-[60px]">
        <div className="flex items-center gap-1">
          <Slider
            value={[task.priority || 0]}
            onValueChange={handlePriorityChange}
            max={5}
            step={1}
            className="w-10"
          />
          <span className="text-[10px] text-muted-foreground w-3">{task.priority || 0}</span>
        </div>
      </div>

      {/* Valor */}
      <div className="flex-shrink-0 w-[70px]">
        <Popover open={editingValue} onOpenChange={setEditingValue}>
          <PopoverTrigger asChild>
            <button className="text-xs text-muted-foreground text-left hover:text-foreground cursor-pointer truncate w-full">
              {task.estimatedValue ? `R$ ${task.estimatedValue.toLocaleString('pt-BR')}` : '-'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-2 bg-popover border border-border shadow-lg z-[100]" align="start">
            <div className="flex flex-col gap-2">
              <Input
                type="text"
                placeholder="R$ 0,00"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleValueSave()}
                className="h-7 text-xs"
              />
              <Button size="sm" className="h-6 text-xs" onClick={handleValueSave}>Salvar</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Cronograma */}
      <div className="flex-shrink-0 w-[80px]">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
              <CalendarDays className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{formatDateRange()}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border border-border shadow-lg z-[100]" align="start">
            <div className="flex flex-col gap-2 p-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Início</label>
                <Calendar
                  mode="single"
                  selected={task.startDate ? new Date(task.startDate) : undefined}
                  onSelect={(date) => handleDateChange('startDate', date)}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim</label>
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
      <div className="flex-shrink-0 w-[80px]">
        <Select
          value={task.responsibleId || 'none'}
          onValueChange={(value) => handleResponsibleChange(value === 'none' ? undefined : value)}
        >
          <SelectTrigger className="h-6 w-full border-0 bg-transparent px-0 hover:bg-accent/50 rounded focus:ring-0">
            <SelectValue>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{responsible?.name?.split(' ')[0] || '-'}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-[100]">
            <SelectItem value="none">
              <span className="text-muted-foreground">Nenhum</span>
            </SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-6 h-6 relative"
          onClick={() => onOpenChat(task.id)}
        >
          <MessageCircle className="w-3 h-3" />
          {commentCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-medium rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
              {commentCount > 99 ? '99+' : commentCount}
            </span>
          )}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="w-6 h-6">
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1 bg-popover border border-border shadow-lg z-[100]" align="end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Excluir
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
