import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskRow } from './TaskRow';
import { Task, Status, User as UserType } from '@/types';

interface SortableTaskRowProps {
  task: Task;
  status: Status | undefined;
  responsible: UserType | undefined;
  statuses: Status[];
  users: UserType[];
  onStatusChange: (taskId: string, statusId: string) => void;
  onOpenChat: (taskId: string, defaultTab?: 'comments' | 'attachments') => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  isSelected?: boolean;
  onSelectionChange?: (taskId: string, selected: boolean) => void;
  isHiddenView?: boolean;
  subtasks?: Task[];
  onCreateSubtask?: (parentId: string, name: string, color: string) => void;
  selectedTaskIds?: string[];
  commentCount?: number;
  getCommentCount?: (taskId: string) => number;
}

export function SortableTaskRow(props: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: props.task.id,
    data: {
      type: 'task',
      task: props.task,
      elementId: props.task.elementId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskRow
        {...props}
        dragListeners={listeners}
        isDragging={isDragging}
        subtasks={props.subtasks}
        onCreateSubtask={props.onCreateSubtask}
        onDeleteTask={props.onDeleteTask}
        selectedTaskIds={props.selectedTaskIds}
      />
    </div>
  );
}
