import { useState, useEffect } from 'react';
import { HelpCircle, Search, Settings, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';
import { GlobalSearchDialog } from '@/components/GlobalSearchDialog';
import { User as UserType } from '@/types';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  reference_id?: string | null;
  reference_type?: string | null;
}

interface HeaderProps {
  currentUser: UserType | null;
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onRequestPushPermission: () => void;
  onNotificationClick?: (notification: Notification) => void;
  onSearchResult?: (result: {
    type: 'project' | 'element' | 'task' | 'subtask' | 'comment';
    projectId?: string;
    elementId?: string;
    taskId?: string;
  }) => void;
  onSignOut?: () => void;
}

export function Header({ 
  currentUser, 
  notifications, 
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onRequestPushPermission,
  onNotificationClick,
  onSearchResult,
  onSignOut 
}: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 pl-3 pr-4 py-2 text-sm bg-background border border-input rounded-md w-64 text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Pesquisar...</span>
          <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={onMarkAsRead}
          onMarkAllAsRead={onMarkAllAsRead}
          onRequestPushPermission={onRequestPushPermission}
          onNotificationClick={onNotificationClick}
        />
        
        <Button variant="ghost" size="icon">
          <HelpCircle className="w-5 h-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {currentUser?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <GlobalSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectResult={(result) => onSearchResult?.(result)}
      />
    </header>
  );
}
