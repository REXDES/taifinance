import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User as UserIcon, Users } from 'lucide-react';

interface FinanceHeaderProps {
  user: User | null;
  onSignOut: () => void;
  companyName?: string;
  onOpenUsers?: () => void;
  showUsersButton?: boolean;
}

export function FinanceHeader({ user, onSignOut, companyName, onOpenUsers, showUsersButton }: FinanceHeaderProps) {
  const initials = user?.email?.substring(0, 2).toUpperCase() || 'U';

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {companyName && (
          <span className="text-sm text-muted-foreground">
            {companyName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {showUsersButton && onOpenUsers && (
          <Button variant="ghost" size="icon" onClick={onOpenUsers} title="Gerenciar Usuários">
            <Users className="h-5 w-5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <UserIcon className="mr-2 h-4 w-4" />
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
