import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { Calendar } from '@/components/ui/calendar';
import { useUsers } from '@/hooks/useUsers';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Plus, Trash2, Clock, CalendarIcon, Copy, Check, ChevronDown, ChevronRight, FolderOpen, Layers } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface InvitationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
}

interface ProjectWithElements {
  id: string;
  name: string;
  color: string;
  elements: { id: string; name: string; color: string }[];
}

const roleLabels: Record<AppRole, string> = {
  supervisor: 'Supervisor',
  gerente: 'Gerente',
  operador: 'Operador',
};

export function InvitationsDialog({ open, onOpenChange, companyId }: InvitationsDialogProps) {
  const { invitations, loading, createInvitation, deleteInvitation } = useUsers(companyId);
  const { projects } = useProjects(companyId);
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('operador');
  const [expiresAt, setExpiresAt] = useState<Date>(addDays(new Date(), 7));
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{ id: string; tempPassword: string } | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);
  
  // Access control state
  const [projectsWithElements, setProjectsWithElements] = useState<ProjectWithElements[]>([]);
  const [loadingElements, setLoadingElements] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [accessAll, setAccessAll] = useState(true);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkSupervisor = async () => {
      if (!user) return;
      const { data } = await supabase.rpc('is_supervisor', { _user_id: user.id });
      setIsSupervisor(!!data);
    };
    checkSupervisor();
  }, [user]);

  useEffect(() => {
    const fetchAllElements = async () => {
      if (!projects.length || !showForm) return;

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

    fetchAllElements();
  }, [projects, showForm]);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const handleProjectToggle = (projectId: string, checked: boolean) => {
    const newSelected = new Set(selectedProjects);
    if (checked) {
      newSelected.add(projectId);
    } else {
      newSelected.delete(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleElementToggle = (elementId: string, checked: boolean) => {
    const newSelected = new Set(selectedElements);
    if (checked) {
      newSelected.add(elementId);
    } else {
      newSelected.delete(elementId);
    }
    setSelectedElements(newSelected);
  };

  const generateInviteLink = (invitationId: string) => {
    return `${window.location.origin}/auth?invite=${invitationId}`;
  };

  const handleCopyLink = async (invitationId: string) => {
    const link = generateInviteLink(invitationId);
    await navigator.clipboard.writeText(link);
    setCopiedId(invitationId);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyPassword = async (password: string) => {
    await navigator.clipboard.writeText(password);
    toast({ title: 'Senha copiada!' });
  };

  const handleCreateInvitation = async () => {
    if (!email.trim() || !name.trim()) return;
    
    setSaving(true);
    const result = await createInvitation(email.trim(), role, name.trim(), expiresAt.toISOString());
    
    if (result) {
      // Save access selections
      try {
        const accessInserts = [];
        
        for (const projectId of selectedProjects) {
          accessInserts.push({
            invitation_id: result.id,
            project_id: projectId,
            element_id: null,
          });
        }
        
        for (const elementId of selectedElements) {
          accessInserts.push({
            invitation_id: result.id,
            project_id: null,
            element_id: elementId,
          });
        }
        
        if (accessInserts.length > 0) {
          const { error } = await supabase
            .from('invitation_access')
            .insert(accessInserts);
          
          if (error) {
            console.error('Error saving invitation access:', error);
          }
        }
      } catch (error) {
        console.error('Error saving invitation access:', error);
      }
      
      setCreatedInvite(result);
    }
    
    setSaving(false);
    setName('');
    setEmail('');
    setRole('operador');
    setExpiresAt(addDays(new Date(), 7));
    setAccessAll(true);
    setSelectedProjects(new Set());
    setSelectedElements(new Set());
    setShowForm(false);
  };

  const handleCloseCreatedInvite = () => {
    setCreatedInvite(null);
  };

  const handleDeleteInvitation = async (id: string) => {
    await deleteInvitation(id);
  };

  const isExpired = (expiresAtDate: string) => {
    return new Date(expiresAtDate) < new Date();
  };

  const resetForm = () => {
    setShowForm(false);
    setName('');
    setEmail('');
    setRole('operador');
    setExpiresAt(addDays(new Date(), 7));
    setAccessAll(true);
    setSelectedProjects(new Set());
    setSelectedElements(new Set());
    setExpandedProjects(new Set());
  };

  const totalAccessSelected = selectedProjects.size + selectedElements.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Convites Pendentes
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto flex-1">
          {/* Created Invite Success */}
          {createdInvite && (
            <div className="p-4 border-2 border-primary rounded-lg space-y-4 bg-primary/5">
              <div className="text-center">
                <Check className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-medium">Convite criado com sucesso!</p>
                <p className="text-sm text-muted-foreground">Envie o link e a senha ao convidado</p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Link do Convite</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={generateInviteLink(createdInvite.id)} 
                    className="text-xs bg-muted"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopyLink(createdInvite.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Senha do Convite</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={createdInvite.tempPassword} 
                    className="text-lg font-mono font-bold tracking-widest bg-muted text-center"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCopyPassword(createdInvite.tempPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-destructive">Esta senha só será exibida uma vez!</p>
              </div>
              
              <Button onClick={handleCloseCreatedInvite} className="w-full">
                Entendi
              </Button>
            </div>
          )}

          {/* Add Invitation Form */}
          {!createdInvite && showForm ? (
            <div className="p-4 border border-border rounded-lg space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteName">Nome do Convidado</Label>
                <Input
                  id="inviteName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="inviteRole">Cargo</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    {isSupervisor && (
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Validade do Convite</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expiresAt && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expiresAt ? format(expiresAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiresAt}
                      onSelect={(date) => date && setExpiresAt(date)}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Access Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Acesso a Projetos/Elementos
                  {!accessAll && totalAccessSelected > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {totalAccessSelected} selecionado(s)
                    </Badge>
                  )}
                </Label>
                
                {/* Access All Option */}
                <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                  <Checkbox
                    id="access-all"
                    checked={accessAll}
                    onCheckedChange={(checked) => {
                      setAccessAll(!!checked);
                      if (checked) {
                        setSelectedProjects(new Set());
                        setSelectedElements(new Set());
                      }
                    }}
                  />
                  <label 
                    htmlFor="access-all"
                    className="flex-1 text-sm font-medium cursor-pointer"
                  >
                    Tudo (acesso completo a todos os projetos e elementos)
                  </label>
                </div>
                
                {!accessAll && (
                  loadingElements ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[200px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {projectsWithElements.map((project) => (
                          <div key={project.id} className="border border-border/50 rounded overflow-hidden">
                            <Collapsible 
                              open={expandedProjects.has(project.id)}
                              onOpenChange={() => toggleProject(project.id)}
                            >
                              <div className="flex items-center gap-2 p-2 bg-muted/20">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5">
                                    {expandedProjects.has(project.id) ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                
                                <Checkbox
                                  id={`inv-project-${project.id}`}
                                  checked={selectedProjects.has(project.id)}
                                  onCheckedChange={(checked) => handleProjectToggle(project.id, !!checked)}
                                />
                                
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: project.color }}
                                />
                                
                                <label 
                                  htmlFor={`inv-project-${project.id}`}
                                  className="flex-1 text-xs font-medium cursor-pointer flex items-center gap-1"
                                >
                                  <FolderOpen className="h-3 w-3 text-muted-foreground" />
                                  {project.name}
                                </label>
                              </div>

                              <CollapsibleContent>
                                {project.elements.length > 0 ? (
                                  <div className="p-1 pl-8 space-y-1 bg-background">
                                    {project.elements.map((element) => (
                                      <div 
                                        key={element.id}
                                        className="flex items-center gap-2 p-1 rounded hover:bg-muted/30"
                                      >
                                        <Checkbox
                                          id={`inv-element-${element.id}`}
                                          checked={selectedElements.has(element.id)}
                                          onCheckedChange={(checked) => handleElementToggle(element.id, !!checked)}
                                        />
                                        
                                        <div 
                                          className="w-2 h-2 rounded-full flex-shrink-0" 
                                          style={{ backgroundColor: element.color }}
                                        />
                                        
                                        <label 
                                          htmlFor={`inv-element-${element.id}`}
                                          className="flex-1 text-xs cursor-pointer flex items-center gap-1"
                                        >
                                          <Layers className="h-3 w-3 text-muted-foreground" />
                                          {element.name}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-2 pl-8 text-xs text-muted-foreground">
                                    Nenhum elemento
                                  </div>
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateInvitation} 
                  disabled={saving || !email.trim() || !name.trim()}
                  className="flex-1"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Convite
                </Button>
              </div>
            </div>
          ) : !createdInvite && (
            <Button onClick={() => setShowForm(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Novo Convite
            </Button>
          )}

          {/* Invitations List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum convite pendente
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="p-3 rounded-lg bg-muted/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      {invitation.name && (
                        <p className="font-medium text-sm">{invitation.name}</p>
                      )}
                      <p className="text-sm text-muted-foreground">{invitation.email}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {roleLabels[invitation.role]}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {isExpired(invitation.expires_at) ? (
                            <span className="text-destructive">Expirado</span>
                          ) : (
                            <>Expira {format(new Date(invitation.expires_at), "dd 'de' MMM", { locale: ptBR })}</>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteInvitation(invitation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {!isExpired(invitation.expires_at) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleCopyLink(invitation.id)}
                    >
                      {copiedId === invitation.id ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar Link do Convite
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
