import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  onRefresh?: () => void;
  onCreate?: () => void;
  createLabel?: string;
  children: ReactNode;
}

export function PaymentsListShell({ title, description, onRefresh, onCreate, createLabel = 'Novo', children }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          )}
          {onCreate && (
            <Button size="sm" onClick={onCreate}>
              <Plus className="w-4 h-4 mr-2" /> {createLabel}
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
