import { User } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User as UserIcon, Users, Download, Shield, RefreshCw, Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface FinanceHeaderProps {
  user: User | null;
  onSignOut: () => void;
  companyName?: string;
  onOpenUsers?: () => void;
  showUsersButton?: boolean;
  isAdminMode?: boolean;
  canSwitchMode?: boolean;
  onSwitchMode?: () => void;
  onOpenMobileMenu?: () => void;
}

export function FinanceHeader({
  user,
  onSignOut,
  companyName,
  onOpenUsers,
  showUsersButton,
  isAdminMode,
  canSwitchMode,
  onSwitchMode,
  onOpenMobileMenu,
}: FinanceHeaderProps) {
  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  const { toast } = useToast();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      toast({
        title: 'Instalação não disponível',
        description: 'O app já está instalado ou seu navegador não suporta instalação.',
      });
      return;
    }

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      toast({ title: 'App instalado com sucesso!' });
      setInstallPrompt(null);
    }
  };

  return (
    <header className="h-14 border-b border-border bg-card px-3 md:px-4 flex items-center justify-between shrink-0">
      {/* Left side */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Hamburger — only on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {isAdminMode && (
          <Badge variant="default" className="gap-1 bg-primary/15 text-primary hover:bg-primary/20 shrink-0">
            <Shield className="h-3 w-3" />
            <span className="hidden sm:inline">Modo Administrativo</span>
            <span className="sm:hidden">Admin</span>
          </Badge>
        )}
        {companyName && !isAdminMode && (
          <span className="text-sm text-muted-foreground truncate">{companyName}</span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleInstallClick}
          title="Instalar aplicativo"
          className={installPrompt ? 'text-primary' : 'text-muted-foreground'}
        >
          <Download className="h-5 w-5" />
        </Button>

        {showUsersButton && onOpenUsers && (
          <Button variant="ghost" size="icon" onClick={onOpenUsers} title="Gerenciar Usuários" className="hidden md:inline-flex">
            <Users className="h-5 w-5" />
          </Button>
        )}

        {canSwitchMode && onSwitchMode && (
          <Button variant="ghost" size="icon" onClick={onSwitchMode} title="Trocar modo de acesso">
            <RefreshCw className="h-5 w-5" />
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
              <span className="truncate max-w-[200px]">{user?.email}</span>
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
