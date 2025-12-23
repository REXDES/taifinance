import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { 
  format, 
  eachDayOfInterval, 
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  startOfMonth, 
  endOfMonth, 
  startOfYear,
  endOfYear,
  addMonths,
  addYears,
  addWeeks,
  addDays,
  addQuarters,
  differenceInDays, 
  differenceInWeeks,
  differenceInMonths,
  differenceInQuarters,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, GripVertical } from 'lucide-react';
import { Task, Element, Status } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GanttViewProps {
  elements: Element[];
  tasks: Task[];
  statuses: Status[];
  onUpdateTask?: (taskId: string, updates: { startDate?: string; endDate?: string }) => void;
}

type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year';
type DragType = 'start' | 'end' | 'move';

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
  quarter: 'Trimestre',
  semester: 'Semestre',
  year: 'Ano',
};

const STORAGE_KEY = 'gantt-view-mode';

export function GanttView({ elements, tasks, statuses, onUpdateTask }: GanttViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as ViewMode) || 'month';
  });
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState<{
    taskId: string;
    type: DragType;
    startX: number;
    originalStartDate: string;
    originalEndDate: string;
    currentDeltaX: number;
  } | null>(null);
  const draggingRef = useRef(dragging);
  const containerRef = useRef<HTMLDivElement>(null);
  const onUpdateTaskRef = useRef(onUpdateTask);
  const calculateNewDateRef = useRef<((pixelDelta: number, baseDate: string) => string) | null>(null);

  // Keep refs in sync
  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  useEffect(() => {
    onUpdateTaskRef.current = onUpdateTask;
  }, [onUpdateTask]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  // Reset offset when view mode changes
  useEffect(() => {
    setOffset(0);
  }, [viewMode]);

  const today = new Date();

  const { periods, cellWidth, getTaskPosition, formatHeader, formatSubHeader, periodLabel, firstPeriod } = useMemo(() => {
    let periods: Date[] = [];
    let cellWidth = 40;
    let rangeStart: Date;
    let rangeEnd: Date;
    let periodLabel = '';

    switch (viewMode) {
      case 'day':
        rangeStart = startOfMonth(addMonths(today, offset));
        rangeEnd = endOfMonth(addMonths(today, offset));
        periods = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
        cellWidth = 40;
        periodLabel = format(rangeStart, 'MMMM yyyy', { locale: ptBR });
        break;
      case 'week':
        rangeStart = startOfMonth(addMonths(today, offset * 3 - 1));
        rangeEnd = endOfMonth(addMonths(today, offset * 3 + 2));
        periods = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { locale: ptBR });
        cellWidth = 80;
        periodLabel = `${format(rangeStart, 'MMM yyyy', { locale: ptBR })} - ${format(rangeEnd, 'MMM yyyy', { locale: ptBR })}`;
        break;
      case 'month':
        rangeStart = startOfYear(addYears(today, offset));
        rangeEnd = endOfYear(addYears(today, offset));
        periods = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
        cellWidth = 100;
        periodLabel = format(rangeStart, 'yyyy', { locale: ptBR });
        break;
      case 'quarter':
        rangeStart = startOfYear(addYears(today, offset * 2));
        rangeEnd = endOfYear(addYears(today, offset * 2 + 1));
        periods = eachQuarterOfInterval({ start: rangeStart, end: rangeEnd });
        cellWidth = 120;
        periodLabel = `${format(rangeStart, 'yyyy', { locale: ptBR })} - ${format(rangeEnd, 'yyyy', { locale: ptBR })}`;
        break;
      case 'semester':
        rangeStart = startOfYear(addYears(today, offset * 3));
        rangeEnd = endOfYear(addYears(today, offset * 3 + 2));
        const semesters: Date[] = [];
        let current = rangeStart;
        while (current <= rangeEnd) {
          semesters.push(current);
          current = addMonths(current, 6);
        }
        periods = semesters;
        cellWidth = 150;
        periodLabel = `${format(rangeStart, 'yyyy', { locale: ptBR })} - ${format(rangeEnd, 'yyyy', { locale: ptBR })}`;
        break;
      case 'year':
        rangeStart = startOfYear(addYears(today, offset * 6 - 2));
        rangeEnd = endOfYear(addYears(today, offset * 6 + 3));
        const years: Date[] = [];
        let yearCurrent = rangeStart;
        while (yearCurrent <= rangeEnd) {
          years.push(yearCurrent);
          yearCurrent = addYears(yearCurrent, 1);
        }
        periods = years;
        cellWidth = 120;
        periodLabel = `${format(rangeStart, 'yyyy', { locale: ptBR })} - ${format(rangeEnd, 'yyyy', { locale: ptBR })}`;
        break;
    }

    const formatHeader = (date: Date): string => {
      switch (viewMode) {
        case 'day':
          return format(date, 'dd', { locale: ptBR });
        case 'week':
          return format(date, 'dd/MM', { locale: ptBR });
        case 'month':
          return format(date, 'MMM', { locale: ptBR });
        case 'quarter':
          return `Q${Math.ceil((date.getMonth() + 1) / 3)}`;
        case 'semester':
          return date.getMonth() < 6 ? '1º Sem' : '2º Sem';
        case 'year':
          return format(date, 'yyyy', { locale: ptBR });
      }
    };

    const formatSubHeader = (date: Date): string => {
      switch (viewMode) {
        case 'day':
          return format(date, 'EEE', { locale: ptBR });
        case 'week':
          return `Sem ${format(date, 'w', { locale: ptBR })}`;
        case 'month':
          return format(date, 'yyyy', { locale: ptBR });
        case 'quarter':
          return format(date, 'yyyy', { locale: ptBR });
        case 'semester':
          return format(date, 'yyyy', { locale: ptBR });
        case 'year':
          return '';
      }
    };

    const getTaskPosition = (task: Task) => {
      if (!task.startDate || !task.endDate) return null;
      
      const start = parseISO(task.startDate);
      const end = parseISO(task.endDate);
      const firstPeriod = periods[0];
      const lastPeriod = periods[periods.length - 1];

      if (!firstPeriod || !lastPeriod) return null;

      let startOffset: number;
      let endOffset: number;

      switch (viewMode) {
        case 'day':
          startOffset = differenceInDays(start, firstPeriod);
          endOffset = differenceInDays(end, firstPeriod) + 1;
          break;
        case 'week':
          startOffset = differenceInWeeks(start, firstPeriod);
          endOffset = differenceInWeeks(end, firstPeriod) + 1;
          break;
        case 'month':
          startOffset = differenceInMonths(start, firstPeriod);
          endOffset = differenceInMonths(end, firstPeriod) + 1;
          break;
        case 'quarter':
          startOffset = differenceInQuarters(start, firstPeriod);
          endOffset = differenceInQuarters(end, firstPeriod) + 1;
          break;
        case 'semester':
          startOffset = Math.floor(differenceInMonths(start, firstPeriod) / 6);
          endOffset = Math.floor(differenceInMonths(end, firstPeriod) / 6) + 1;
          break;
        case 'year':
          startOffset = start.getFullYear() - firstPeriod.getFullYear();
          endOffset = end.getFullYear() - firstPeriod.getFullYear() + 1;
          break;
      }

      // Task is completely before visible range
      if (endOffset <= 0) return null;
      
      // Task is completely after visible range
      if (startOffset >= periods.length) return null;

      // Clamp to visible range
      const clampedStart = Math.max(0, startOffset);
      const clampedEnd = Math.min(periods.length, endOffset);
      const width = clampedEnd - clampedStart;

      if (width <= 0) return null;

      return {
        left: clampedStart * cellWidth,
        width: width * cellWidth,
      };
    };

    return { periods, cellWidth, getTaskPosition, formatHeader, formatSubHeader, periodLabel, firstPeriod: periods[0] };
  }, [viewMode, today, offset]);

  const calculateNewDate = useCallback((pixelDelta: number, baseDate: string): string => {
    const baseDateObj = parseISO(baseDate);
    const periodDelta = Math.round(pixelDelta / cellWidth);

    let newDate: Date;
    switch (viewMode) {
      case 'day':
        newDate = addDays(baseDateObj, periodDelta);
        break;
      case 'week':
        newDate = addWeeks(baseDateObj, periodDelta);
        break;
      case 'month':
        newDate = addMonths(baseDateObj, periodDelta);
        break;
      case 'quarter':
        newDate = addQuarters(baseDateObj, periodDelta);
        break;
      case 'semester':
        newDate = addMonths(baseDateObj, periodDelta * 6);
        break;
      case 'year':
        newDate = addYears(baseDateObj, periodDelta);
        break;
    }
    return format(newDate, 'yyyy-MM-dd');
  }, [viewMode, cellWidth]);

  // Keep calculateNewDate ref in sync
  useEffect(() => {
    calculateNewDateRef.current = calculateNewDate;
  }, [calculateNewDate]);


  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    taskId: string,
    type: DragType,
    startDate: string,
    endDate: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({
      taskId,
      type,
      startX: e.clientX,
      originalStartDate: startDate,
      originalEndDate: endDate,
      currentDeltaX: 0,
    });
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const currentDrag = draggingRef.current;
      if (!currentDrag) return;
      const deltaX = e.clientX - currentDrag.startX;
      setDragging(prev => prev ? { ...prev, currentDeltaX: deltaX } : null);
    };

    const onMouseUp = () => {
      const currentDrag = draggingRef.current;
      const updateFn = onUpdateTaskRef.current;
      const calcDateFn = calculateNewDateRef.current;
      
      if (currentDrag && updateFn && calcDateFn) {
        const deltaX = currentDrag.currentDeltaX;
        
        // Store final drag state for visual continuity
        const finalDrag = { ...currentDrag, currentDeltaX: deltaX };
        
        // Perform the update
        let didUpdate = false;
        if (currentDrag.type === 'start') {
          const newStartDate = calcDateFn(deltaX, currentDrag.originalStartDate);
          const newStart = parseISO(newStartDate);
          const originalEnd = parseISO(currentDrag.originalEndDate);
          if (newStart <= originalEnd) {
            updateFn(currentDrag.taskId, { startDate: newStartDate });
            didUpdate = true;
          }
        } else if (currentDrag.type === 'end') {
          const newEndDate = calcDateFn(deltaX, currentDrag.originalEndDate);
          const newEnd = parseISO(newEndDate);
          const originalStart = parseISO(currentDrag.originalStartDate);
          if (newEnd >= originalStart) {
            updateFn(currentDrag.taskId, { endDate: newEndDate });
            didUpdate = true;
          }
        } else if (currentDrag.type === 'move') {
          const newStartDate = calcDateFn(deltaX, currentDrag.originalStartDate);
          const newEndDate = calcDateFn(deltaX, currentDrag.originalEndDate);
          updateFn(currentDrag.taskId, { startDate: newStartDate, endDate: newEndDate });
          didUpdate = true;
        }
        
        // Keep drag state briefly to maintain visual position during async update
        if (didUpdate) {
          // Use a brief timeout to allow the state update to propagate
          setTimeout(() => {
            setDragging(null);
          }, 100);
        } else {
          setDragging(null);
        }
      } else {
        setDragging(null);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging?.taskId]);

  const goToPrevious = () => setOffset(prev => prev - 1);
  const goToNext = () => setOffset(prev => prev + 1);
  const goToToday = () => setOffset(0);

  return (
    <div className="flex-1 overflow-auto bg-background" ref={containerRef}>
      {/* View Mode Selector & Navigation */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Visualizar por:</span>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VIEW_MODE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-8 px-3 gap-1.5"
            >
              <CalendarDays className="h-4 w-4" />
              <span>Hoje</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm font-medium text-foreground capitalize">
              {periodLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-max">
        {/* Header */}
        <div className="flex border-b border-border sticky top-0 bg-card z-10">
          <div className="w-64 px-4 py-2 font-medium text-sm text-foreground border-r border-border flex-shrink-0">
            Tarefa
          </div>
          <div className="flex">
            {periods.map((period, index) => (
              <div 
                key={index}
                className="px-1 py-2 text-center text-xs text-muted-foreground border-r border-border"
                style={{ width: cellWidth }}
              >
                <div>{formatHeader(period)}</div>
                {formatSubHeader(period) && (
                  <div className="text-[10px]">{formatSubHeader(period)}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        {elements.map(element => {
          const elementTasks = tasks.filter(t => t.elementId === element.id);
          
          return (
            <div key={element.id}>
              {/* Element Row */}
              <div className="flex border-b border-border bg-muted/20">
                <div 
                  className="w-64 px-4 py-3 font-medium text-sm border-r border-border flex-shrink-0"
                  style={{ color: `hsl(${element.color})` }}
                >
                  {element.name}
                </div>
                <div className="flex-1 relative" style={{ width: periods.length * cellWidth }}>
                  <div className="flex">
                    {periods.map((_, index) => (
                      <div key={index} className="h-10 border-r border-border/50" style={{ width: cellWidth }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Task Rows */}
              {elementTasks.map(task => {
                const position = getTaskPosition(task);
                const status = statuses.find(s => s.id === task.statusId);
                const isDragging = dragging?.taskId === task.id;
                
                // Calculate visual offset during drag
                let visualLeft = position?.left ?? 0;
                let visualWidth = position?.width ?? 0;
                
                if (isDragging && dragging && position) {
                  const deltaPixels = dragging.currentDeltaX;
                  
                  if (dragging.type === 'move') {
                    visualLeft = position.left + deltaPixels;
                  } else if (dragging.type === 'start') {
                    visualLeft = position.left + deltaPixels;
                    visualWidth = position.width - deltaPixels;
                  } else if (dragging.type === 'end') {
                    visualWidth = position.width + deltaPixels;
                  }
                  
                  // Enforce minimum width during drag
                  const minWidth = cellWidth / 2;
                  if (visualWidth < minWidth) {
                    if (dragging.type === 'start') {
                      visualLeft = position.left + position.width - minWidth;
                    }
                    visualWidth = minWidth;
                  }
                }
                
                // Show bar if position exists
                const shouldShowBar = position && task.startDate && task.endDate && visualWidth > 0;
                
                return (
                  <div key={task.id} className="flex border-b border-border hover:bg-accent/20">
                    <div className="w-64 px-4 py-2 text-sm text-foreground border-r border-border flex-shrink-0 truncate pl-8">
                      {task.name}
                    </div>
                    <div className="flex-1 relative h-10" style={{ width: periods.length * cellWidth }}>
                      <div className="flex absolute inset-0">
                        {periods.map((_, index) => (
                          <div key={index} className="h-full border-r border-border/50" style={{ width: cellWidth }} />
                        ))}
                      </div>
                      {shouldShowBar && (
                        <div
                          className={`absolute top-2 h-6 rounded-md flex items-center text-xs font-medium group ${
                            isDragging ? 'opacity-70 shadow-lg' : ''
                          } ${onUpdateTask ? 'cursor-move' : ''}`}
                          style={{ 
                            left: visualLeft,
                            width: visualWidth,
                            backgroundColor: status ? `hsl(${status.color})` : `hsl(${task.color})`,
                            color: 'white',
                            transition: isDragging ? 'none' : 'left 0.1s, width 0.1s'
                          }}
                          onMouseDown={onUpdateTask ? (e) => handleMouseDown(e, task.id, 'move', task.startDate!, task.endDate!) : undefined}
                        >
                          {/* Left resize handle */}
                          {onUpdateTask && (
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/20 rounded-l-md"
                              onMouseDown={(e) => handleMouseDown(e, task.id, 'start', task.startDate!, task.endDate!)}
                            >
                              <GripVertical className="h-3 w-3" />
                            </div>
                          )}
                          
                          <span className="truncate px-2 flex-1">{task.name}</span>
                          
                          {/* Right resize handle */}
                          {onUpdateTask && (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/20 rounded-r-md"
                              onMouseDown={(e) => handleMouseDown(e, task.id, 'end', task.startDate!, task.endDate!)}
                            >
                              <GripVertical className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
