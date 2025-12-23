import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Comment } from '@/types';

export function useComments(taskIds: string[]) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    if (taskIds.length === 0) {
      setComments([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedComments: Comment[] = (data || []).map(c => ({
        id: c.id,
        taskId: c.task_id,
        userId: c.user_id,
        content: c.content,
        createdAt: c.created_at,
      }));

      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [taskIds]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = useCallback(async (
    taskId: string, 
    content: string, 
    userId: string,
    mentionedUserIds?: string[]
  ) => {
    try {
      // Get task details including element_id for the notification
      const { data: taskData } = await supabase
        .from('tasks')
        .select('name, element_id')
        .eq('id', taskId)
        .single();

      // Get commenter's profile for notification message
      const { data: commenterProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .single();

      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          content,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;

      const newComment: Comment = {
        id: data.id,
        taskId: data.task_id,
        userId: data.user_id,
        content: data.content,
        createdAt: data.created_at,
      };

      setComments(prev => [...prev, newComment]);

      const commenterName = commenterProfile?.full_name || 'Alguém';
      const taskName = taskData?.name || 'uma tarefa';
      const elementId = taskData?.element_id;

      // Get all work group members for the element
      let workGroupUserIds: string[] = [];
      if (elementId) {
        const { data: workGroupMembers } = await supabase
          .from('element_work_groups')
          .select('user_id')
          .eq('element_id', elementId);

        if (workGroupMembers) {
          workGroupUserIds = workGroupMembers.map(m => m.user_id);
        }
      }

      // Combine work group members with mentioned users (removing duplicates and the commenter)
      const allUsersToNotify = new Set<string>([
        ...workGroupUserIds,
        ...(mentionedUserIds || [])
      ]);
      // Remove the commenter from the notification list
      allUsersToNotify.delete(userId);

      // Use the secure RPC function to create notifications
      if (allUsersToNotify.size > 0) {
        for (const notifyUserId of allUsersToNotify) {
          const isMentioned = mentionedUserIds?.includes(notifyUserId);
          try {
            await (supabase.rpc as any)('create_notification', {
              _user_id: notifyUserId,
              _title: isMentioned 
                ? 'Você foi mencionado em um comentário' 
                : 'Novo comentário na tarefa',
              _message: isMentioned
                ? `${commenterName} mencionou você em um comentário na tarefa "${taskName}"`
                : `${commenterName} comentou na tarefa "${taskName}"`,
              _type: isMentioned ? 'mention' : 'comment',
              _reference_id: taskId,
              _reference_type: 'task_comment',
            });
          } catch (notifError) {
            console.error('Error creating notification:', notifError);
          }
        }
      }

      return newComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }, []);

  return {
    comments,
    loading,
    addComment,
    refetch: fetchComments,
  };
}
