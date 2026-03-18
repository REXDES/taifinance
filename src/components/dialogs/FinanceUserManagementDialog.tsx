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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFinanceUserAccess } from '@/hooks/useFinanceUserAccess';
import { useCompanies } from '@/hooks/useCompanies';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield, Building2, Wallet, Layers, ChevronDown, ChevronRight, Users, Settings, UserPen, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface FinanceUserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string | null;
  currentUserRole?: AppRole;
  selectedCompanyId?: string | null;
}

interface GroupWithAccounts {
  id: string;
  name: string;
  color: string;
  company_id: string;
  accounts: { id: string; name: string; color: string }[];
}

const roleLabels: Record<AppRole, string> = {
  supervisor: 'Supervisor',
  gerente: 'Gerente',
  operador: 'Operador',
};

export function FinanceUserManagementDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  userAvatar,
  currentUserRole = 'operador',
  selectedCompanyId,
}: FinanceUserManagementDialogProps) {
  const {
    companyAccess,
    accountGroupAccess,
    accountAccess,
    roleInfo,
    loading,
    addCompanyAccess,
    removeCompanyAccess,
    addAccountGroupAccess,
    removeAccountGroupAccess,
    addAccountAccess,
    removeAccountAccess,
    updateRole,
    updateCompanyLimit,
    updateInvitationLimit,
    hasCompanyAccess,
    hasAccountGroupAccess,
    hasAccountAccess,
  } = useFinanceUserAccess(userId);

  const { companies } = useCompanies();
  const { toast } = useToast();
  const [groupsWithAccounts, setGroupsWithAccounts] = useState<GroupWithAccounts[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(false);
  const [companyLimitInput, setCompanyLimitInput] = useState<string>('');
  const [invitationLimitInput, setInvitationLimitInput] = useState<string>('');
  const [profileFullName, setProfileFullName] = useState(userName);
  const [profileWhatsapp, setProfileWhatsapp] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const isSupervisor = currentUserRole === 'supervisor';
  const isGerente = currentUserRole === 'gerente';
  const canManageAccounts = isSupervisor || isGerente;

  // Set limit inputs when roleInfo loads
  useEffect(() => {
    if (roleInfo?.company_limit !== undefined) {
      setCompanyLimitInput(roleInfo.company_limit?.toString() ?? '');
    }
    if (roleInfo?.invitation_limit !== undefined) {
      setInvitationLimitInput(roleInfo.invitation_limit?.toString() ?? '');
    }
  }, [roleInfo]);

  // Fetch profile data for editing
  useEffect(() => {
    const fetchProfile = async () => {
      if (!open || !userId) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, whatsapp_phone')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) {
        setProfileFullName(data.full_name || '');
        setProfileWhatsapp((data as any).whatsapp_phone || '');
      }
    };
    fetchProfile();
  }, [open, userId]);

  // Fetch all groups and accounts
  useEffect(() => {
    const fetchGroupsAndAccounts = async () => {
      if (!open) return;

      setLoadingData(true);
      try {
        // Get all groups
        const { data: groups } = await supabase
          .from('account_groups')
          .select('id, name, color, company_id')
          .order('name');

        // Get all accounts
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, name, color, group_id, company_id')
          .order('name');

        if (!groups || !accounts) {
          setGroupsWithAccounts([]);
          return;
        }

        const groupsData: GroupWithAccounts[] = [];

        // Build grouped structure
        for (const group of groups) {
          const groupAccounts = accounts.filter(a => a.group_id === group.id);
          groupsData.push({
            id: group.id,
            name: group.name,
            color: group.color,
            company_id: group.company_id,
            accounts: groupAccounts.map(a => ({ id: a.id, name: a.name, color: a.color })),
          });
        }

        // Add ungrouped accounts per company
        const companiesWithUngrouped = new Set<string>();
        accounts.filter(a => !a.group_id).forEach(a => companiesWithUngrouped.add(a.company_id));

        for (const companyId of companiesWithUngrouped) {
          const ungroupedAccounts = accounts.filter(a => !a.group_id && a.company_id === companyId);
          if (ungroupedAccounts.length > 0) {
            groupsData.push({
              id: `ungrouped-${companyId}`,
              name: 'Sem Grupo',
              color: '#6B7280',
              company_id: companyId,
              accounts: ungroupedAccounts.map(a => ({ id: a.id, name: a.name, color: a.color })),
            });
          }
        }

        setGroupsWithAccounts(groupsData);
      } catch (error) {
        console.error('Error fetching groups and accounts:', error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchGroupsAndAccounts();
  }, [open]);

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleCompanyToggle = async (companyId: string, checked: boolean) => {
    if (checked) {
      await addCompanyAccess(companyId);
    } else {
      await removeCompanyAccess(companyId);
    }
  };

  const handleGroupToggle = async (groupId: string, checked: boolean) => {
    if (groupId.startsWith('ungrouped-')) return; // Can't add access to virtual ungrouped
    
    if (checked) {
      await addAccountGroupAccess(groupId);
    } else {
      await removeAccountGroupAccess(groupId);
    }
  };

  const handleAccountToggle = async (accountId: string, checked: boolean) => {
    if (checked) {
      await addAccountAccess(accountId);
    } else {
      await removeAccountAccess(accountId);
    }
  };

  const handleRoleChange = async (newRole: AppRole) => {
    await updateRole(newRole);
  };

  const handleCompanyLimitSave = async () => {
    const limit = companyLimitInput ? parseInt(companyLimitInput, 10) : null;
    await updateCompanyLimit(limit);
  };

  const handleInvitationLimitSave = async () => {
    const limit = invitationLimitInput ? parseInt(invitationLimitInput, 10) : null;
    await updateInvitationLimit(limit);
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.charAt(0).toUpperCase();
  };

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.name || 'Empresa';
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileFullName || null,
          whatsapp_phone: profileWhatsapp || null,
        } as any)
        .eq('user_id', userId);
      if (error) throw error;
      toast({ title: 'Cadastro atualizado com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar cadastro', description: error.message, variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Filter groups by accessible companies for display
  const accessibleCompanyIds = companyAccess.map(c => c.company_id);
  const isSupervisorRole = roleInfo?.role === 'supervisor';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userAvatar || undefined} />
              <AvatarFallback>{getInitials(userName, userEmail)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{userName}</p>
              <p className="text-sm text-muted-foreground font-normal">{userEmail}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading || loadingData ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="role" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile" className="flex items-center gap-1">
                <UserPen className="h-4 w-4" />
                Cadastro
              </TabsTrigger>
              <TabsTrigger value="role" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                Cargo
              </TabsTrigger>
              <TabsTrigger value="companies" className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                Empresas
              </TabsTrigger>
              <TabsTrigger value="accounts" className="flex items-center gap-1">
                <Wallet className="h-4 w-4" />
                Contas
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="flex-1 overflow-auto space-y-4 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profileName">Nome Completo</Label>
                  <Input
                    id="profileName"
                    value={profileFullName}
                    onChange={(e) => setProfileFullName(e.target.value)}
                    placeholder="Nome do usuário"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileEmail">Email</Label>
                  <Input
                    id="profileEmail"
                    value={userEmail}
                    disabled
                    className="opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileWhatsapp">WhatsApp</Label>
                  <Input
                    id="profileWhatsapp"
                    value={profileWhatsapp}
                    onChange={(e) => setProfileWhatsapp(e.target.value)}
                    placeholder="+55 11 99999-9999"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número usado para notificações via WhatsApp
                  </p>
                </div>

                <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full gap-2">
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Cadastro
                </Button>
              </div>
            </TabsContent>

            {/* Role Tab */}
            <TabsContent value="role" className="flex-1 overflow-auto space-y-4 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Cargo do Usuário</Label>
                  <Select
                    value={roleInfo?.role || 'operador'}
                    onValueChange={handleRoleChange}
                    disabled={!isSupervisor}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operador">Operador</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isSupervisor && (
                    <p className="text-xs text-muted-foreground">
                      Apenas supervisores podem alterar cargos
                    </p>
                  )}
                </div>

                {roleInfo?.role === 'gerente' && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                      <Label htmlFor="companyLimit">Limite de Empresas</Label>
                      <p className="text-xs text-muted-foreground">
                        Quantas empresas este gerente pode criar/adicionar
                      </p>
                      <div className="flex gap-2">
                        <Input
                          id="companyLimit"
                          type="number"
                          min={0}
                          value={companyLimitInput}
                          onChange={(e) => setCompanyLimitInput(e.target.value)}
                          placeholder="0 = não pode criar"
                          disabled={!isSupervisor}
                        />
                        <Button
                          onClick={handleCompanyLimitSave}
                          disabled={!isSupervisor}
                          size="sm"
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="invitationLimit">Limite de Convites</Label>
                      <p className="text-xs text-muted-foreground">
                        Quantos convites este gerente pode enviar
                      </p>
                      <div className="flex gap-2">
                        <Input
                          id="invitationLimit"
                          type="number"
                          min={0}
                          value={invitationLimitInput}
                          onChange={(e) => setInvitationLimitInput(e.target.value)}
                          placeholder="0 = não pode convidar"
                          disabled={!isSupervisor}
                        />
                        <Button
                          onClick={handleInvitationLimitSave}
                          disabled={!isSupervisor}
                          size="sm"
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 border rounded-lg space-y-2">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Resumo de Permissões
                  </Label>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cargo:</span>
                      <Badge variant={roleInfo?.role === 'supervisor' ? 'default' : roleInfo?.role === 'gerente' ? 'secondary' : 'outline'}>
                        {roleLabels[roleInfo?.role || 'operador']}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Empresas:</span>
                      <span>{isSupervisorRole ? 'Todas' : companyAccess.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grupos de Contas:</span>
                      <span>{accountGroupAccess.length || 'Todos'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contas Específicas:</span>
                      <span>{accountAccess.length || 'Todas'}</span>
                    </div>
                    {roleInfo?.role === 'gerente' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Limite de Empresas:</span>
                          <span>{roleInfo.company_limit ?? 'Não pode'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Limite de Convites:</span>
                          <span>{roleInfo.invitation_limit ?? 'Não pode'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Companies Tab */}
            <TabsContent value="companies" className="flex-1 overflow-hidden pt-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Selecione as empresas que o usuário pode acessar.
                  {isSupervisorRole && ' Supervisores têm acesso a todas as empresas.'}
                </p>

                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-4">
                    {companies.map((company) => (
                      <div
                        key={company.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30"
                      >
                        <Checkbox
                          id={`company-${company.id}`}
                          checked={isSupervisorRole || hasCompanyAccess(company.id)}
                          onCheckedChange={(checked) => handleCompanyToggle(company.id, !!checked)}
                          disabled={isSupervisorRole || !isSupervisor}
                        />
                        <div
                          className="w-4 h-4 rounded flex-shrink-0"
                          style={{ backgroundColor: `hsl(${company.color})` }}
                        />
                        <label
                          htmlFor={`company-${company.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <p className="font-medium">{company.name}</p>
                        </label>
                        {(isSupervisorRole || hasCompanyAccess(company.id)) && (
                          <Badge variant="secondary" className="text-xs">Acesso</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Accounts Tab */}
            <TabsContent value="accounts" className="flex-1 overflow-hidden pt-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Configure acesso granular a grupos de contas e contas específicas.
                  Se nenhum item for selecionado, o usuário terá acesso completo às empresas permitidas.
                </p>

                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-4">
                    {/* Group by company - managers only see selected company */}
                    {companies.filter(c => {
                      if (isSupervisor) return isSupervisorRole || hasCompanyAccess(c.id);
                      if (isGerente && selectedCompanyId) return c.id === selectedCompanyId;
                      return hasCompanyAccess(c.id);
                    }).map(company => {
                      const companyGroups = groupsWithAccounts.filter(g => g.company_id === company.id);
                      if (companyGroups.length === 0) return null;

                      return (
                        <div key={company.id} className="border rounded-lg overflow-hidden">
                          <div className="p-2 bg-muted/50 font-medium text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {company.name}
                          </div>
                          
                          {companyGroups.map((group) => (
                            <Collapsible
                              key={group.id}
                              open={expandedGroups.has(group.id)}
                              onOpenChange={() => toggleGroup(group.id)}
                            >
                              <div className="flex items-center gap-2 p-2 border-t hover:bg-muted/30">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    {expandedGroups.has(group.id) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>

                                {!group.id.startsWith('ungrouped-') && (
                                  <Checkbox
                                    id={`group-${group.id}`}
                                    checked={hasAccountGroupAccess(group.id)}
                                    onCheckedChange={(checked) => handleGroupToggle(group.id, !!checked)}
                                    disabled={!canManageAccounts}
                                  />
                                )}

                                <div
                                  className="w-3 h-3 rounded flex-shrink-0"
                                  style={{ backgroundColor: group.color }}
                                />
                                
                                <label
                                  htmlFor={`group-${group.id}`}
                                  className="flex-1 text-sm cursor-pointer flex items-center gap-1"
                                >
                                  <Layers className="h-3 w-3 text-muted-foreground" />
                                  {group.name}
                                  <Badge variant="outline" className="ml-1 text-xs">
                                    {group.accounts.length}
                                  </Badge>
                                </label>

                                {hasAccountGroupAccess(group.id) && (
                                  <Badge variant="secondary" className="text-xs">Grupo</Badge>
                                )}
                              </div>

                              <CollapsibleContent>
                                <div className="p-2 pl-10 space-y-1 bg-background border-t">
                                  {group.accounts.map((account) => (
                                    <div
                                      key={account.id}
                                      className="flex items-center gap-2 p-2 rounded hover:bg-muted/30"
                                    >
                                      <Checkbox
                                        id={`account-${account.id}`}
                                        checked={hasAccountAccess(account.id)}
                                        onCheckedChange={(checked) => handleAccountToggle(account.id, !!checked)}
                                        disabled={!canManageAccounts}
                                      />
                                      
                                      <div
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: account.color }}
                                      />
                                      
                                      <label
                                        htmlFor={`account-${account.id}`}
                                        className="flex-1 text-sm cursor-pointer flex items-center gap-1"
                                      >
                                        <Wallet className="h-3 w-3 text-muted-foreground" />
                                        {account.name}
                                      </label>

                                      {hasAccountAccess(account.id) && (
                                        <Badge variant="outline" className="text-xs">Conta</Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Summary */}
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  {accountGroupAccess.length === 0 && accountAccess.length === 0 ? (
                    <p className="text-primary font-medium">
                      ✓ Acesso completo a todas as contas das empresas permitidas
                    </p>
                  ) : (
                    <p>
                      Acesso restrito: {accountGroupAccess.length} grupo(s) e {accountAccess.length} conta(s)
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
