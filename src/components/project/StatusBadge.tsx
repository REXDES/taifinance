import { cn } from '@/lib/utils';
import { Status } from '@/types';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-medium min-w-[100px]',
        className
      )}
      style={{ 
        backgroundColor: `hsl(${status.color})`,
        color: 'white'
      }}
    >
      {status.name}
    </span>
  );
}

interface StatusSummaryProps {
  taskStatuses: { statusId: string; count: number }[];
  statuses: Status[];
  totalTasks: number;
}

export function StatusSummary({ taskStatuses, statuses, totalTasks }: StatusSummaryProps) {
  if (totalTasks === 0) return null;

  return (
    <div className="flex h-6 rounded-md overflow-hidden min-w-[120px]">
      {taskStatuses.map(({ statusId, count }) => {
        const status = statuses.find(s => s.id === statusId);
        if (!status || count === 0) return null;
        const percentage = (count / totalTasks) * 100;
        
        return (
          <div
            key={statusId}
            className="h-full"
            style={{ 
              width: `${percentage}%`,
              backgroundColor: `hsl(${status.color})`
            }}
            title={`${status.name}: ${count}`}
          />
        );
      })}
    </div>
  );
}
