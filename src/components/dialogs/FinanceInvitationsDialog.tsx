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
import { useCompanies } from '@/hooks/useCompanies';
import { useAccounts } from '@/hooks/useAccounts';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Plus, Trash2, CalendarIcon, Copy, Check, ChevronDown, ChevronRight, Building2, Wallet, Layers } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface FinanceInvitationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  currentUserRole: AppRole;
  invitationLimit: number | null;
  invitationsCreated: number;
}

interface GroupWithAccounts {
  id: string;
  name: string;
  color: string;
  accounts: { id: string; name: string; color: string }[];
}

const roleLabels: Record<AppRole, string> = {
  supervisor: 'Supervisor',
  gerente: 'Gerente',
  operador: 'Operador',
};

export function FinanceInvitationsDialog({ open, onOpenChange, companyId, currentUserRole, invitationLimit, invitationsCreated }: FinanceInvitationsDialogProps) {
  const { invitations, loading, createInvitation, deleteInvitation } = useUsers(companyId);
  
  const canCreateInvitation = currentUserRole === 'supervisor' || 
    (currentUserRole === 'gerente' && invitationLimit !== null && invitationsCreated < invitationLimit);
  const remainingInvitations = invitationLimit !== null ? invitationLimit - invitationsCreated : null;
  const { companies, refetch: refetchCompanies } = useCompanies();
  const { accounts, groups } = useAccounts(companyId);
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
  const [userCompanyIds, setUserCompanyIds] = useState<Set<string>>(new Set());
  
  const isSupervisor = currentUserRole === 'supervisor';
  const isGerente = currentUserRole === 'gerente';
  
  // Access control state
  const [selectedInviteCompanies, setSelectedInviteCompanies] = useState<Set<string>>(new Set(companyId ? [companyId] : []));
  const [groupsWithAccounts, setGroupsWithAccounts] = useState<GroupWithAccounts[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [accessAll, setAccessAll] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [companyLimit, setCompanyLimit] = useState<number | null>(null);
  const [customRoleId, setCustomRoleId] = useState<string | null>(null);
  const { roles: customRoles } = useCustomRoles();

  // Fetch user's accessible companies for managers
  useEffect(() => {
    const fetchUserCompanies = async () => {
      if (!user || isSupervisor) return;
      const { data } = await supabase
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user.id);
      if (data) {
        setUserCompanyIds(new Set(data.map(uc => uc.company_id)));
      }
    };
    fetchUserCompanies();
  }, [user, isSupervisor]);

  // Filter companies for managers
  const availableCompanies = isSupervisor 
    ? companies 
    : companies.filter(c => userCompanyIds.has(c.id));

  // Build groups with accounts structure
  useEffect(() => {
    if (!showForm) return;

    const groupsData: GroupWithAccounts[] = [];
    
    // Accounts without group
    const ungroupedAccounts = accounts.filter(a => !a.group_id);
    if (ungroupedAccounts.length > 0) {
      groupsData.push({
        id: 'ungrouped',
        name: 'Sem Grupo',
        color: '#6B7280',
        accounts: ungroupedAccounts.map(a => ({ id: a.id, name: a.name, color: a.color })),
      });
    }

    // Grouped accounts
    for (const group of groups) {
      const groupAccounts = accounts.filter(a => a.group_id === group.id);
      groupsData.push({
        id: group.id,
        name: group.name,
        color: group.color,
        accounts: groupAccounts.map(a => ({ id: a.id, name: a.name, color: a.color })),
      });
    }

    setGroupsWithAccounts(groupsData);
  }, [accounts, groups, showForm]);

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleInviteCompanyToggle = (companyId: string, checked: boolean) => {
    const newSelected = new Set(selectedInviteCompanies);
    if (checked) {
      newSelected.add(companyId);
    } else {
      newSelected.delete(companyId);
    }
    setSelectedInviteCompanies(newSelected);
  };

  const handleGroupToggle = (groupId: string, checked: boolean) => {
    const newSelected = new Set(selectedGroups);
    if (checked) {
      newSelected.add(groupId);
    } else {
      newSelected.delete(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleAccountToggle = (accountId: string, checked: boolean) => {
    const newSelected = new Set(selectedAccounts);
    if (checked) {
      newSelected.add(accountId);
    } else {
      newSelected.delete(accountId);
    }
    setSelectedAccounts(newSelected);
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
    if (!email.trim() || !name.trim() || selectedInviteCompanies.size === 0) return;
    
    // Use first selected company as the main one for the invitation record
    const mainCompanyId = Array.from(selectedInviteCompanies)[0];
    
    setSaving(true);
    const result = await createInvitation(email.trim(), role, name.trim(), expiresAt.toISOString(), mainCompanyId, role === 'gerente' ? companyLimit : null, customRoleId);
    
    if (result) {
      // Save access selections
      try {
        // Save all selected companies to invitation_company_access
        const companyInserts = Array.from(selectedInviteCompanies).map(cId => ({
          invitation_id: result.id,
          company_id: cId,
        }));
        if (companyInserts.length > 0) {
          await supabase.from('invitation_company_access').insert(companyInserts);
        }
        
        // Save account group access (excluding 'ungrouped')
        const realGroupIds = Array.from(selectedGroups).filter(id => id !== 'ungrouped');
        if (realGroupIds.length > 0) {
          const groupInserts = realGroupIds.map(groupId => ({
            invitation_id: result.id,
            account_group_id: groupId,
          }));
          await supabase.from('invitation_account_group_access').insert(groupInserts);
        }
        
        // Save account access
        if (selectedAccounts.size > 0) {
          const accountInserts = Array.from(selectedAccounts).map(accountId => ({
            invitation_id: result.id,
            account_id: accountId,
          }));
          await supabase.from('invitation_account_access').insert(accountInserts);
        }
      } catch (error) {
        console.error('Error saving invitation access:', error);
      }
      
      setCreatedInvite(result);
    }
    
    setSaving(false);
    resetForm();
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
    setSelectedInviteCompanies(new Set(companyId ? [companyId] : []));
    setAccessAll(true);
    setSelectedGroups(new Set());
    setSelectedAccounts(new Set());
    setExpandedGroups(new Set());
    setCompanyLimit(null);
    setCustomRoleId(null);
  };

  const totalAccessSelected = selectedGroups.size + selectedAccounts.size;

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
                <Label className="flex items-center gap-2">
                  Empresas
                  {selectedInviteCompanies.size > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedInviteCompanies.size} selecionada(s)
                    </Badge>
                  )}
                </Label>
                <div className="border rounded-lg p-2 space-y-1 max-h-[120px] overflow-y-auto">
                  {availableCompanies.map((company) => (
                    <div 
                      key={company.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30"
                    >
                      <Checkbox
                        id={`invite-company-${company.id}`}
                        checked={selectedInviteCompanies.has(company.id)}
                        onCheckedChange={(checked) => handleInviteCompanyToggle(company.id, !!checked)}
                      />
                      <div 
                        className="w-3 h-3 rounded flex-shrink-0" 
                        style={{ backgroundColor: `hsl(${company.color})` }}
                      />
                      <label 
                        htmlFor={`invite-company-${company.id}`}
                        className="flex-1 text-sm cursor-pointer flex items-center gap-1"
                      >
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {company.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteRole">Cargo</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador">Operador</SelectItem>
                    {isSupervisor && (
                      <>
                        <SelectItem value="gerente">Gerente</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {isGerente && (
                  <p className="text-xs text-muted-foreground">
                    Gerentes só podem convidar operadores
                  </p>
                )}
              </div>

              {/* Custom role selector */}
              {customRoles.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="inviteCustomRole">Cargo customizado (opcional)</Label>
                  <Select value={customRoleId || 'none'} onValueChange={(v) => setCustomRoleId(v === 'none' ? null : v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {customRoles.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se informado, as permissões do cargo customizado serão aplicadas ao usuário após aceitar o convite.
                  </p>
                </div>
              )}

              {/* Company limit field for gerente role */}
              {role === 'gerente' && (
                <div className="space-y-2">
                  <Label htmlFor="companyLimit">Limite de Empresas</Label>
                  <p className="text-xs text-muted-foreground">
                    Quantas empresas este gerente pode criar/adicionar
                  </p>
                  <Input
                    id="companyLimit"
                    type="number"
                    min={0}
                    value={companyLimit ?? ''}
                    onChange={(e) => setCompanyLimit(e.target.value ? parseInt(e.target.value, 10) : null)}
                    placeholder="0 = não pode criar empresas"
                  />
                </div>
              )}

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
                  Controle de Acesso
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
                        setSelectedGroups(new Set());
                        setSelectedAccounts(new Set());
                      }
                    }}
                  />
                  <label 
                    htmlFor="access-all"
                    className="flex-1 text-sm font-medium cursor-pointer"
                  >
                    Acesso Completo (todos os grupos e contas das empresas selecionadas)
                  </label>
                </div>
                
                {!accessAll && (
                  <ScrollArea className="h-[250px] border rounded-lg">
                    <div className="p-2 space-y-3">
                      {/* Account Groups Section */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground px-1">Grupos de Contas e Contas</p>
                        {groupsWithAccounts.map((group) => (
                          <div key={group.id} className="border border-border/50 rounded overflow-hidden">
                            <Collapsible 
                              open={expandedGroups.has(group.id)}
                              onOpenChange={() => toggleGroup(group.id)}
                            >
                              <div className="flex items-center gap-2 p-2 bg-muted/20">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5">
                                    {expandedGroups.has(group.id) ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                
                                {group.id !== 'ungrouped' && (
                                  <Checkbox
                                    id={`inv-group-${group.id}`}
                                    checked={selectedGroups.has(group.id)}
                                    onCheckedChange={(checked) => handleGroupToggle(group.id, !!checked)}
                                  />
                                )}
                                
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: group.color }}
                                />
                                
                                <label 
                                  htmlFor={`inv-group-${group.id}`}
                                  className="flex-1 text-xs font-medium cursor-pointer flex items-center gap-1"
                                >
                                  <Layers className="h-3 w-3 text-muted-foreground" />
                                  {group.name}
                                  <Badge variant="outline" className="text-[10px] ml-1">
                                    {group.accounts.length}
                                  </Badge>
                                </label>
                              </div>

                              <CollapsibleContent>
                                {group.accounts.length > 0 ? (
                                  <div className="p-1 pl-8 space-y-1 bg-background">
                                    {group.accounts.map((account) => (
                                      <div 
                                        key={account.id}
                                        className="flex items-center gap-2 p-1 rounded hover:bg-muted/30"
                                      >
                                        <Checkbox
                                          id={`inv-account-${account.id}`}
                                          checked={selectedAccounts.has(account.id)}
                                          onCheckedChange={(checked) => handleAccountToggle(account.id, !!checked)}
                                        />
                                        <div 
                                          className="w-2 h-2 rounded-full flex-shrink-0" 
                                          style={{ backgroundColor: account.color }}
                                        />
                                        <label 
                                          htmlFor={`inv-account-${account.id}`}
                                          className="flex-1 text-xs cursor-pointer flex items-center gap-1"
                                        >
                                          <Wallet className="h-3 w-3 text-muted-foreground" />
                                          {account.name}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-2 pl-8 text-xs text-muted-foreground">
                                    Nenhuma conta neste grupo
                                  </div>
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        ))}
                        
                        {groupsWithAccounts.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Nenhum grupo ou conta cadastrada
                          </p>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={resetForm} className="flex-1">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateInvitation}
                  disabled={!email.trim() || !name.trim() || saving}
                  className="flex-1"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Criar Convite
                </Button>
              </div>
            </div>
          ) : !createdInvite && (
            <div className="space-y-2">
              {isGerente && remainingInvitations !== null && (
                <p className="text-sm text-muted-foreground">
                  Convites disponíveis: <span className="font-medium">{remainingInvitations}</span> de {invitationLimit}
                </p>
              )}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setShowForm(true)}
                disabled={!canCreateInvitation}
              >
                <Plus className="h-4 w-4" />
                Novo Convite
              </Button>
              {!canCreateInvitation && isGerente && (
                <p className="text-xs text-destructive">
                  Você atingiu o limite de convites permitido.
                </p>
              )}
            </div>
          )}

          {/* Invitations List */}
          {!showForm && !createdInvite && (
            loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum convite pendente
              </div>
            ) : (
              <div className="space-y-2">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      isExpired(invitation.expires_at) ? "bg-destructive/5 border-destructive/20" : "bg-muted/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {invitation.name || invitation.email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {invitation.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {roleLabels[invitation.role]}
                          </Badge>
                          {isExpired(invitation.expires_at) ? (
                            <span className="text-xs text-destructive">Expirado</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Expira em {format(new Date(invitation.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopyLink(invitation.id)}
                          disabled={isExpired(invitation.expires_at)}
                        >
                          {copiedId === invitation.id ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteInvitation(invitation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
