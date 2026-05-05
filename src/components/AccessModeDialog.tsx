import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, User } from 'lucide-react';
import { useAccessMode, type AccessMode } from '@/contexts/AccessModeContext';

interface AccessModeDialogProps {
  open: boolean;
}

export function AccessModeDialog({ open }: AccessModeDialogProps) {
  const { setMode } = useAccessMode();

  const choose = (m: AccessMode) => setMode(m);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Como deseja acessar o sistema?</DialogTitle>
          <DialogDescription>
            Escolha o modo de acesso. Você pode trocar a qualquer momento pelo menu superior.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-6 hover:border-primary hover:bg-accent"
            onClick={() => choose('admin')}
          >
            <Shield className="h-8 w-8 text-primary" />
            <span className="font-semibold">Modo Administrativo</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-6 hover:border-primary hover:bg-accent"
            onClick={() => choose('normal')}
          >
            <User className="h-8 w-8 text-primary" />
            <span className="font-semibold">Modo Normal</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
