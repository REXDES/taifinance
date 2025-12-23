import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Home, Briefcase, Building2, MoreHorizontal, Plus, Search, Star, Settings, Users, Pencil, Trash2, Check, User, Mail, ListChecks, Copy, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Company {
  id: string;
  name: string;
  color: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  company_id: string;
}

interface SidebarProps {
  projects: Project[];
  companies: Company[];
  selectedProjectId: string | null;
  selectedCompanyId: string | null;
  onSelectProject: (id: string) => void;
  onSelectCompany: (id: string) => void;
  onCreateProject: () => void;
  onCreateCompany: () => void;
  onEditCompany?: (id: string) => void;
  onDeleteCompany?: (id: string) => void;
  onEditProject?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  onDuplicateProject?: (id: string) => void;
  onOpenProfile?: () => void;
  onOpenUsers?: () => void;
  onOpenInvitations?: () => void;
  onOpenStatusConfig?: () => void;
  onNavigateHome?: () => void;
  onNavigateMyWork?: () => void;
  isHomeView?: boolean;
  isSupervisor?: boolean;
}

export function Sidebar({
  projects,
  companies,
  selectedProjectId,
  selectedCompanyId,
  onSelectProject,
  onSelectCompany,
  onCreateProject,
  onCreateCompany,
  onEditCompany,
  onDeleteCompany,
  onEditProject,
  onDeleteProject,
  onDuplicateProject,
  onOpenProfile,
  onOpenUsers,
  onOpenInvitations,
  onOpenStatusConfig,
  onNavigateHome,
  onNavigateMyWork,
  isHomeView = false,
  isSupervisor = false,
}: SidebarProps) {
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [workspacesExpanded, setWorkspacesExpanded] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const filteredProjects = projects.filter(p => p.company_id === selectedCompanyId);
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-14" : "w-64"
      )}>
        {/* Logo */}
        <div className={cn("p-4 border-b border-border", collapsed && "px-2")}>
          <div className={cn(
            "flex",
            collapsed ? "flex-col items-center gap-2" : "items-center justify-between"
          )}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-bold text-sm">TAI</span>
              </div>
              {!collapsed && <span className="font-semibold text-foreground">TAI Project</span>}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="w-6 h-6"
                  onClick={() => setCollapsed(!collapsed)}
                >
                  {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{collapsed ? 'Expandir menu' : 'Recolher menu'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {collapsed ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("w-full", isHomeView && "bg-accent")}
                      onClick={onNavigateHome}
                    >
                      <Home className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Página inicial</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-full"
                      onClick={onNavigateMyWork}
                    >
                      <Briefcase className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Meu trabalho</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-2 text-foreground hover:bg-accent",
                    isHomeView && "bg-accent"
                  )}
                  onClick={onNavigateHome}
                >
                  <Home className="w-4 h-4" />
                  Página inicial
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-2 text-foreground hover:bg-accent"
                  onClick={onNavigateMyWork}
                >
                  <Briefcase className="w-4 h-4" />
                  Meu trabalho
                </Button>
              </>
            )}
          </div>

          {/* Favorites */}
          {!collapsed && (
            <div className="mt-4">
              <button
                onClick={() => setFavoritesExpanded(!favoritesExpanded)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground w-full"
              >
                {favoritesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Star className="w-3 h-3" />
                <span>Favoritos</span>
              </button>
            </div>
          )}

          {collapsed && (
            <div className="mt-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-full">
                    <Star className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Favoritos</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Workspaces */}
          <div className="mt-4">
            {!collapsed ? (
              <>
                <div className="flex items-center justify-between px-2 py-1">
                  <button
                    onClick={() => setWorkspacesExpanded(!workspacesExpanded)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {workspacesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>Áreas de trabalho</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="w-6 h-6">
                      <MoreHorizontal className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-6 h-6">
                      <Search className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {workspacesExpanded && (
                  <div className="mt-2 space-y-1">
                    {/* Company Selector */}
                    {companies.length > 0 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-2 px-2 py-2 rounded-md bg-accent/50 w-full hover:bg-accent transition-colors">
                            <div 
                              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0"
                              style={{ backgroundColor: selectedCompany ? `hsl(${selectedCompany.color})` : 'hsl(var(--muted))' }}
                            >
                              {selectedCompany?.name.charAt(0) || '?'}
                            </div>
                            <span className="text-sm font-medium text-foreground flex-1 truncate text-left">
                              {selectedCompany?.name || 'Selecione uma empresa'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          {companies.map((company) => (
                            <DropdownMenuItem key={company.id} onClick={() => onSelectCompany(company.id)}>
                              <div 
                                className="w-4 h-4 rounded mr-2"
                                style={{ backgroundColor: `hsl(${company.color})` }}
                              />
                              {company.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="px-2 py-2 text-sm text-muted-foreground">
                        Nenhuma empresa cadastrada
                      </div>
                    )}

                    {/* Action Buttons */}
                    {selectedCompanyId && (
                      <div className="mt-2">
                        <Button 
                          variant="default" 
                          size="sm"
                          className="w-full gap-1"
                          onClick={onCreateProject}
                        >
                          <Plus className="w-3 h-3" />
                          Novo Projeto
                        </Button>
                      </div>
                    )}

                    {/* Projects List */}
                    {filteredProjects.length > 0 && (
                      <div className="space-y-0.5 mt-2">
                        {filteredProjects.map((project) => (
                          <ContextMenu key={project.id}>
                            <ContextMenuTrigger asChild>
                              <button
                                onClick={() => onSelectProject(project.id)}
                                className={cn(
                                  'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors',
                                  selectedProjectId === project.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-foreground hover:bg-accent'
                                )}
                              >
                                <div 
                                  className="w-4 h-4 rounded flex items-center justify-center"
                                  style={{ backgroundColor: `hsl(${project.color})` }}
                                />
                                <span className="truncate">{project.name}</span>
                              </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="bg-popover">
                              <ContextMenuItem onClick={() => onEditProject?.(project.id)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Renomear Projeto
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => onDuplicateProject?.(project.id)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicar Projeto
                              </ContextMenuItem>
                              <ContextMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDeleteProject?.(project.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir Projeto
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Collapsed mode - show company and projects as icons */
              <div className="space-y-1">
                {selectedCompany && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        className="w-full flex items-center justify-center p-2 rounded-md hover:bg-accent"
                        onClick={() => setCollapsed(false)}
                      >
                        <div 
                          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-primary-foreground"
                          style={{ backgroundColor: `hsl(${selectedCompany.color})` }}
                        >
                          {selectedCompany.name.charAt(0)}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{selectedCompany.name}</TooltipContent>
                  </Tooltip>
                )}
                {filteredProjects.map((project) => (
                  <Tooltip key={project.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onSelectProject(project.id)}
                        className={cn(
                          'w-full flex items-center justify-center p-2 rounded-md transition-colors',
                          selectedProjectId === project.id
                            ? 'bg-primary/10'
                            : 'hover:bg-accent'
                        )}
                      >
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: `hsl(${project.color})` }}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{project.name}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-border space-y-2">
          {/* Settings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-full">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Configurações</TooltipContent>
                </Tooltip>
              ) : (
                <Button variant="ghost" className="w-full justify-start gap-2 text-foreground hover:bg-accent">
                  <Settings className="w-4 h-4" />
                  Configurações
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-64 bg-popover">
              {/* Empresas - apenas para supervisores */}
              {isSupervisor && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Building2 className="w-4 h-4 mr-2" />
                    Empresas
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64 bg-popover">
                    <DropdownMenuLabel>Empresas cadastradas</DropdownMenuLabel>
                    {companies.length > 0 ? (
                      <>
                        {companies.map((company) => (
                          <DropdownMenuItem 
                            key={company.id} 
                            onClick={() => onSelectCompany(company.id)}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: `hsl(${company.color})` }}
                              />
                              <span>{company.name}</span>
                            </div>
                            {selectedCompanyId === company.id && (
                              <Check className="w-4 h-4 text-green-500" />
                            )}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </>
                    ) : (
                      <div className="px-2 py-2 text-sm text-muted-foreground">
                        Nenhuma empresa cadastrada
                      </div>
                    )}
                    <DropdownMenuItem onClick={onCreateCompany}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Empresa
                    </DropdownMenuItem>
                    {selectedCompanyId && (
                      <>
                        <DropdownMenuItem onClick={() => onEditCompany?.(selectedCompanyId)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar Empresa
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDeleteCompany?.(selectedCompanyId)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir Empresa
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              
              {/* Meu Perfil - sempre disponível */}
              <DropdownMenuItem onClick={onOpenProfile}>
                <User className="w-4 h-4 mr-2" />
                Meu Perfil
              </DropdownMenuItem>
              
              {/* Gerenciar Usuários, Convites e Status - apenas com empresa selecionada */}
              {selectedCompanyId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onOpenUsers}>
                    <Users className="w-4 h-4 mr-2" />
                    Gerenciar Usuários
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenInvitations}>
                    <Mail className="w-4 h-4 mr-2" />
                    Convites
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenStatusConfig}>
                    <ListChecks className="w-4 h-4 mr-2" />
                    Configurar Status
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Credits */}
          {!collapsed && (
            <div className="text-[10px] text-muted-foreground text-center pt-1">
              Criado por Rone Tadeu
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
