import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUserAccess } from '@/hooks/useUserAccess';
import { useProjects } from '@/hooks/useProjects';
import { useElements } from '@/hooks/useElements';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FolderOpen, Layers, ChevronDown, ChevronRight, Shield } from 'lucide-react';

interface UserAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  companyId: string;
}

interface ProjectWithElements {
  id: string;
  name: string;
  color: string;
  elements: { id: string; name: string; color: string }[];
}

export function UserAccessDialog({ 
  open, 
  onOpenChange, 
  userId, 
  userName,
  companyId 
}: UserAccessDialogProps) {
  const { projectAccess, elementAccess, addProjectAccess, removeProjectAccess, addElementAccess, removeElementAccess, loading } = useUserAccess(userId);
  const { projects } = useProjects(companyId);
  const [projectsWithElements, setProjectsWithElements] = useState<ProjectWithElements[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [loadingElements, setLoadingElements] = useState(false);

  useEffect(() => {
    const fetchAllElements = async () => {
      if (!projects.length) return;

      setLoadingElements(true);
      try {
        const projectsData: ProjectWithElements[] = [];

        for (const project of projects) {
          const { data: elements } = await supabase
            .from('elements')
            .select('id, name, color')
            .eq('project_id', project.id)
            .order('position');

          projectsData.push({
            id: project.id,
            name: project.name,
            color: project.color,
            elements: elements || [],
          });
        }

        setProjectsWithElements(projectsData);
      } catch (error) {
        console.error('Error fetching elements:', error);
      } finally {
        setLoadingElements(false);
      }
    };

    if (open) {
      fetchAllElements();
    }
  }, [projects, open]);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const hasProjectAccess = (projectId: string) => {
    return projectAccess.some(p => p.project_id === projectId);
  };

  const hasElementAccess = (elementId: string) => {
    return elementAccess.some(e => e.element_id === elementId);
  };

  const handleProjectToggle = async (projectId: string, checked: boolean) => {
    if (checked) {
      await addProjectAccess(projectId);
    } else {
      await removeProjectAccess(projectId);
    }
  };

  const handleElementToggle = async (elementId: string, checked: boolean) => {
    if (checked) {
      await addElementAccess(elementId);
    } else {
      await removeElementAccess(elementId);
    }
  };

  const totalAccess = projectAccess.length + elementAccess.length;
  const hasAllAccess = totalAccess === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Acessos de {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Configure os acessos do usuário aos projetos e elementos.
          </div>

          {/* Access All Option */}
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
            <Checkbox
              id="user-access-all"
              checked={hasAllAccess}
              disabled={loading}
              onCheckedChange={async (checked) => {
                if (checked) {
                  // Remove all specific access to grant full access
                  for (const pa of projectAccess) {
                    await removeProjectAccess(pa.project_id);
                  }
                  for (const ea of elementAccess) {
                    await removeElementAccess(ea.element_id);
                  }
                }
              }}
            />
            <label 
              htmlFor="user-access-all"
              className="flex-1 text-sm font-medium cursor-pointer"
            >
              Tudo (acesso completo a todos os projetos e elementos)
            </label>
          </div>

          {!hasAllAccess && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
              Acesso restrito. Selecione projetos/elementos específicos abaixo.
            </div>
          )}

          {loading || loadingElements ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : projectsWithElements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum projeto encontrado
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Selecione itens abaixo para restringir o acesso apenas a eles:
                </p>
                {projectsWithElements.map((project) => (
                  <div key={project.id} className="border border-border rounded-lg overflow-hidden">
                    <Collapsible 
                      open={expandedProjects.has(project.id)}
                      onOpenChange={() => toggleProject(project.id)}
                    >
                      <div className="flex items-center gap-2 p-3 bg-muted/30">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expandedProjects.has(project.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        
                        <Checkbox
                          id={`project-${project.id}`}
                          checked={hasProjectAccess(project.id)}
                          onCheckedChange={(checked) => handleProjectToggle(project.id, !!checked)}
                        />
                        
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: project.color }}
                        />
                        
                        <label 
                          htmlFor={`project-${project.id}`}
                          className="flex-1 text-sm font-medium cursor-pointer flex items-center gap-2"
                        >
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          {project.name}
                        </label>

                        {hasProjectAccess(project.id) && (
                          <Badge variant="secondary" className="text-xs">
                            Projeto
                          </Badge>
                        )}
                      </div>

                      <CollapsibleContent>
                        {project.elements.length > 0 ? (
                          <div className="p-2 pl-12 space-y-1 bg-background">
                            {project.elements.map((element) => (
                              <div 
                                key={element.id}
                                className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                              >
                                <Checkbox
                                  id={`element-${element.id}`}
                                  checked={hasElementAccess(element.id)}
                                  onCheckedChange={(checked) => handleElementToggle(element.id, !!checked)}
                                />
                                
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: element.color }}
                                />
                                
                                <label 
                                  htmlFor={`element-${element.id}`}
                                  className="flex-1 text-sm cursor-pointer flex items-center gap-2"
                                >
                                  <Layers className="h-3 w-3 text-muted-foreground" />
                                  {element.name}
                                </label>

                                {hasElementAccess(element.id) && (
                                  <Badge variant="outline" className="text-xs">
                                    Elemento
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 pl-12 text-xs text-muted-foreground">
                            Nenhum elemento neste projeto
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {totalAccess > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Acesso restrito a: {projectAccess.length} projeto(s) e {elementAccess.length} elemento(s)
              </p>
            </div>
          )}

          {totalAccess === 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-primary font-medium">
                ✓ Acesso completo a todos os projetos e elementos
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
