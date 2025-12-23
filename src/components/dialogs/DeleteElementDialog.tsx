import { useState } from 'react';
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

interface DeleteElementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<boolean>;
  element: { id: string; name: string } | null;
}

export function DeleteElementDialog({ open, onOpenChange, onConfirm, element }: DeleteElementDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!element) return;
    
    setLoading(true);
    const success = await onConfirm(element.id);
    setLoading(false);

    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Elemento</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o elemento "{element?.name}"? Esta ação não pode ser desfeita e todas as tarefas serão removidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
