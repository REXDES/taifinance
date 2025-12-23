import { useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Paperclip, Upload, Trash2, FileText, Image, File, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTaskAttachments, TaskAttachment } from '@/hooks/useTaskAttachments';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface TaskAttachmentsProps {
  taskId: string;
  compact?: boolean;
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="w-4 h-4" />;
  if (fileType.startsWith('image/')) return <Image className="w-4 h-4" />;
  if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('word')) 
    return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function TaskAttachments({ taskId, compact = false }: TaskAttachmentsProps) {
  const { attachments, loading, uploading, uploadAttachment, deleteAttachment } = useTaskAttachments(taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAttachment(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenFile = (url: string) => {
    window.open(url, '_blank');
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Paperclip className="w-3 h-3" />
          )}
          {attachments.length > 0 && <span>({attachments.length})</span>}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          Anexos ({attachments.length})
        </h4>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Anexar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Nenhum anexo
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              onOpen={() => handleOpenFile(attachment.file_url)}
              onDelete={() => deleteAttachment(attachment.id, attachment.file_url)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AttachmentItemProps {
  attachment: TaskAttachment;
  onOpen: () => void;
  onDelete: () => void;
}

function AttachmentItem({ attachment, onOpen, onDelete }: AttachmentItemProps) {
  const isImage = attachment.file_type?.startsWith('image/');

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
      {/* Preview or Icon */}
      <div className="flex-shrink-0">
        {isImage ? (
          <img
            src={attachment.file_url}
            alt={attachment.file_name}
            className="w-10 h-10 rounded object-cover cursor-pointer"
            onClick={onOpen}
          />
        ) : (
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
            {getFileIcon(attachment.file_type)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <button
          onClick={onOpen}
          className="text-sm font-medium truncate block hover:underline text-left w-full"
        >
          {attachment.file_name}
        </button>
        <div className="text-xs text-muted-foreground">
          {attachment.uploader_name} • {format(new Date(attachment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={onOpen}
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir anexo</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir "{attachment.file_name}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
