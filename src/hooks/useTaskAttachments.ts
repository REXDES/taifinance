import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_type: string | null;
  file_url: string;
  uploaded_by: string | null;
  created_at: string;
  uploader_name?: string;
}

export function useTaskAttachments(taskId: string | null) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchAttachments = useCallback(async () => {
    if (!taskId) {
      setAttachments([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
    } else {
      // Fetch uploader names
      const uploaderIds = [...new Set((data || []).map(a => a.uploaded_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (uploaderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', uploaderIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.full_name || 'Usuário';
          return acc;
        }, {} as Record<string, string>);
      }

      // Generate signed URLs for each attachment
      const attachmentsWithSignedUrls = await Promise.all(
        (data || []).map(async (a) => {
          // If file_url is a full URL (old data), extract the path
          let filePath = a.file_url;
          if (a.file_url.includes('/task-attachments/')) {
            filePath = a.file_url.split('/task-attachments/')[1];
          }
          
          // Generate a signed URL (expires in 1 hour)
          const { data: signedUrlData } = await supabase.storage
            .from('task-attachments')
            .createSignedUrl(filePath, 3600);
          
          return {
            ...a,
            file_url: signedUrlData?.signedUrl || a.file_url,
            uploader_name: a.uploaded_by ? profilesMap[a.uploaded_by] || 'Usuário' : 'Desconhecido'
          };
        })
      );

      setAttachments(attachmentsWithSignedUrls);
    }
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const uploadAttachment = useCallback(async (file: File) => {
    if (!taskId) return null;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar logado para anexar arquivos',
          variant: 'destructive',
        });
        return null;
      }

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${taskId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get signed URL (expires in 1 hour)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(fileName, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw signedUrlError || new Error('Failed to create signed URL');
      }

      // Save to database (store the path, not the signed URL - we'll regenerate signed URLs when fetching)
      const { data, error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          file_name: file.name,
          file_type: file.type,
          file_url: fileName, // Store the path, not the full URL
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      toast({ title: 'Arquivo anexado com sucesso' });
      await fetchAttachments();
      return data;
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      toast({
        title: 'Erro ao anexar arquivo',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  }, [taskId, toast, fetchAttachments]);

  const deleteAttachment = useCallback(async (attachmentId: string, fileUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/task-attachments/');
      const filePath = urlParts[1];

      // Delete from storage
      if (filePath) {
        await supabase.storage
          .from('task-attachments')
          .remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) {
        throw error;
      }

      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      toast({ title: 'Anexo excluído com sucesso' });
      return true;
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      toast({
        title: 'Erro ao excluir anexo',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    attachments,
    loading,
    uploading,
    uploadAttachment,
    deleteAttachment,
    refetch: fetchAttachments,
  };
}
