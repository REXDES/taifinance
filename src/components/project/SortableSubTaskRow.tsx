import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SubTaskRow } from './SubTaskRow';
import { Task, Status, User as UserType } from '@/types';

interface SortableSubTaskRowProps {
  task: Task;
  status: Status | undefined;
  responsible: UserType | undefined;
  statuses: Status[];
  users: UserType[];
  onStatusChange: (taskId: string, statusId: string) => void;
  onOpenChat: (taskId: string, defaultTab?: 'comments' | 'attachments') => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  isSelected?: boolean;
  onSelectionChange?: (taskId: string, selected: boolean) => void;
  isHiddenView?: boolean;
  commentCount?: number;
}

export function SortableSubTaskRow(props: SortableSubTaskRowProps) {
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
      type: 'subtask',
      task: props.task,
      parentTaskId: props.task.parentTaskId,
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
      <SubTaskRow
        {...props}
        dragListeners={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}
