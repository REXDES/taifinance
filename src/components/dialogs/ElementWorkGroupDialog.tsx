import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserPlus, X, Users } from 'lucide-react';
import { useElementWorkGroup } from '@/hooks/useElementWorkGroup';
import { User } from '@/types';

interface ElementWorkGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elementId: string;
  elementName: string;
  companyUsers: User[];
}

export function ElementWorkGroupDialog({
  open,
  onOpenChange,
  elementId,
  elementName,
  companyUsers,
}: ElementWorkGroupDialogProps) {
  const { members, loading, addMember, removeMember } = useElementWorkGroup(elementId);
  const [adding, setAdding] = useState(false);

  const memberUserIds = members.map(m => m.user_id);
  const availableUsers = companyUsers.filter(u => !memberUserIds.includes(u.id));

  const handleAddMember = async (userId: string) => {
    setAdding(true);
    await addMember(userId);
    setAdding(false);
  };

  const handleRemoveMember = async (userId: string) => {
    await removeMember(userId);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Grupo de Trabalho - {elementName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Members */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              Membros ({members.length})
            </h4>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Carregando...
                </p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum membro no grupo
                </p>
              ) : (
                <div className="space-y-2">
                  {members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(member.profile?.full_name || member.profile?.email || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {member.profile?.full_name || member.profile?.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.profile?.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(member.user_id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Add Members */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              Adicionar Membros
            </h4>
            <ScrollArea className="h-[150px] border rounded-md p-2">
              {availableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Todos os usuários já estão no grupo
                </p>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleAddMember(user.id)}
                        disabled={adding}
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <p className="text-xs text-muted-foreground">
            Membros do grupo receberão notificações sobre alterações no elemento e suas tarefas.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
