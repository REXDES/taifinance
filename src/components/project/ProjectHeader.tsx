import { useState } from 'react';
import { ChevronDown, Link2, RotateCcw, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Project } from '@/types';
import { InvitationsDialog } from '@/components/dialogs/InvitationsDialog';

type ViewMode = 'list' | 'kanban' | 'gantt';

interface ProjectHeaderProps {
  project: Project;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ProjectHeader({ project, viewMode, onViewModeChange }: ProjectHeaderProps) {
  const [invitationsOpen, setInvitationsOpen] = useState(false);

  return (
    <div className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1">
            <Link2 className="w-4 h-4" />
            Integrar
          </Button>
          <Button variant="ghost" size="sm" className="gap-1">
            <RotateCcw className="w-4 h-4" />
            Automatizar
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setInvitationsOpen(true)}>
            <UserPlus className="w-4 h-4" />
            Convidar
          </Button>
        </div>
      </div>

      <InvitationsDialog
        open={invitationsOpen}
        onOpenChange={setInvitationsOpen}
        companyId={project.companyId}
      />

      <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)}>
        <TabsList className="bg-transparent border-b-0 p-0 h-auto gap-0">
          <TabsTrigger 
            value="list"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Quadro principal
          </TabsTrigger>
          <TabsTrigger 
            value="gantt"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Gantt
          </TabsTrigger>
          <TabsTrigger 
            value="kanban"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Kanban
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
