import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceUserManagementDialog } from './FinanceUserManagementDialog';
import { Loader2, Trash2, UserCog, Settings2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface FinanceUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  isSupervisor: boolean;
  currentUserRole: AppRole;
}

const roleLabels: Record<AppRole, string> = {
  supervisor: 'Supervisor',
  gerente: 'Gerente',
  operador: 'Operador',
};

const roleBadgeVariant: Record<AppRole, 'default' | 'secondary' | 'outline'> = {
  supervisor: 'default',
  gerente: 'secondary',
  operador: 'outline',
};

export function FinanceUsersDialog({ open, onOpenChange, companyId, isSupervisor, currentUserRole }: FinanceUsersDialogProps) {
  const { users, loading, removeUserFromCompany } = useUsers(companyId);
  const { user: currentUser } = useAuth();
  const [userToRemove, setUserToRemove] = useState<string | null>(null);
  const [selectedUserForManagement, setSelectedUserForManagement] = useState<{
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null>(null);

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.charAt(0).toUpperCase();
  };

  const handleRemoveUser = async () => {
    if (userToRemove) {
      await removeUserFromCompany(userToRemove);
      setUserToRemove(null);
    }
  };

  const handleOpenManagement = (userId: string, userName: string, userEmail: string, userAvatar: string | null) => {
    setSelectedUserForManagement({ id: userId, name: userName, email: userEmail, avatar: userAvatar });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Gestão de Usuários
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários da empresa, seus cargos e permissões de acesso.
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>
                        {getInitials(user.full_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {user.full_name || user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={roleBadgeVariant[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                    
                    {/* Gerentes não podem gerenciar supervisores, mas podem gerenciar a si mesmos */}
                    {(isSupervisor || (currentUserRole === 'gerente' && (user.user_id === currentUser?.id || user.role !== 'supervisor'))) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleOpenManagement(
                            user.user_id,
                            user.full_name || user.email,
                            user.email,
                            user.avatar_url
                          )}
                        >
                          <Settings2 className="h-4 w-4" />
                          Gerenciar
                        </Button>
                        {user.user_id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setUserToRemove(user.user_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToRemove} onOpenChange={() => setUserToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário será removido desta empresa mas sua conta continuará ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveUser} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedUserForManagement && (
        <FinanceUserManagementDialog
          open={!!selectedUserForManagement}
          onOpenChange={(open) => !open && setSelectedUserForManagement(null)}
          userId={selectedUserForManagement.id}
          userName={selectedUserForManagement.name}
          userEmail={selectedUserForManagement.email}
          userAvatar={selectedUserForManagement.avatar}
          currentUserRole={currentUserRole}
          selectedCompanyId={companyId}
        />
      )}
    </>
  );
}
