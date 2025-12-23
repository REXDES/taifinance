import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Task {
  id: string;
  element_id: string;
  name: string;
  description?: string | null;
  estimated_value?: number | null;
  observation?: string | null;
  status_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  color: string;
  position: number;
  responsible_id?: string | null;
  created_at: string;
  priority?: number | null;
  is_hidden?: boolean;
  parent_task_id?: string | null;
}

export function useTasks(elementIds: string[]) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Use ref to track previous elementIds and avoid unnecessary refetches
  const prevElementIdsRef = useRef<string>('');
  const currentElementIdsKey = [...elementIds].sort().join(',');

  const fetchTasks = useCallback(async () => {
    if (elementIds.length === 0) {
      setTasks([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .in('element_id', elementIds)
      .order('position', { ascending: true });

    if (error) {
      toast({
        title: 'Erro ao carregar tarefas',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  }, [elementIds, toast]);

  // Only refetch when elementIds actually change (by content, not reference)
  useEffect(() => {
    if (prevElementIdsRef.current !== currentElementIdsKey) {
      prevElementIdsRef.current = currentElementIdsKey;
      fetchTasks();
    }
  }, [currentElementIdsKey, fetchTasks]);

  const createTask = useCallback(async (elementId: string, name: string, color: string) => {
    const currentTasks = tasks.filter(t => t.element_id === elementId && !t.parent_task_id);
    const position = currentTasks.length;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        element_id: elementId,
        name,
        color,
        position,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao criar tarefa',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }

    setTasks(prev => [...prev, data]);
    toast({ title: 'Tarefa criada com sucesso' });
    return data;
  }, [tasks, toast]);

  const createSubtask = useCallback(async (parentTaskId: string, name: string, color: string) => {
    const parentTask = tasks.find(t => t.id === parentTaskId);
    if (!parentTask) return null;

    const siblingSubtasks = tasks.filter(t => t.parent_task_id === parentTaskId);
    const position = siblingSubtasks.length;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        element_id: parentTask.element_id,
        parent_task_id: parentTaskId,
        name,
        color,
        position,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao criar sub-tarefa',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }

    setTasks(prev => [...prev, data]);
    toast({ title: 'Sub-tarefa criada com sucesso' });
    return data;
  }, [tasks, toast]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    // Prevent accidentally clearing fields when callers pass { some_field: undefined }
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<Task>;

    const dbUpdates: Record<string, unknown> = {};

    if ('observation' in cleanUpdates) dbUpdates.observation = cleanUpdates.observation;
    if ('estimated_value' in cleanUpdates) dbUpdates.estimated_value = cleanUpdates.estimated_value;
    if ('start_date' in cleanUpdates) dbUpdates.start_date = cleanUpdates.start_date;
    if ('end_date' in cleanUpdates) dbUpdates.end_date = cleanUpdates.end_date;
    if ('responsible_id' in cleanUpdates) dbUpdates.responsible_id = cleanUpdates.responsible_id;
    if ('status_id' in cleanUpdates) dbUpdates.status_id = cleanUpdates.status_id;
    if ('name' in cleanUpdates) dbUpdates.name = cleanUpdates.name;
    if ('description' in cleanUpdates) dbUpdates.description = cleanUpdates.description;
    if ('color' in cleanUpdates) dbUpdates.color = cleanUpdates.color;
    if ('position' in cleanUpdates) dbUpdates.position = cleanUpdates.position;
    if ('priority' in cleanUpdates) dbUpdates.priority = cleanUpdates.priority;
    if ('is_hidden' in cleanUpdates) dbUpdates.is_hidden = cleanUpdates.is_hidden;
    if ('parent_task_id' in cleanUpdates) dbUpdates.parent_task_id = cleanUpdates.parent_task_id;

    // Nothing to update
    if (Object.keys(dbUpdates).length === 0) return true;

    const { error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao atualizar tarefa',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, ...cleanUpdates } : t
    ));
    return true;
  }, [toast]);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir tarefa',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    // Remove task and all its subtasks
    setTasks(prev => prev.filter(t => t.id !== id && t.parent_task_id !== id));
    toast({ title: 'Tarefa excluída com sucesso' });
    return true;
  }, [toast]);

  const bulkUpdateTasks = useCallback(async (ids: string[], updates: Partial<Task>) => {
    const dbUpdates: Record<string, unknown> = {};
    if ('is_hidden' in updates) dbUpdates.is_hidden = updates.is_hidden;
    if ('responsible_id' in updates) dbUpdates.responsible_id = updates.responsible_id;

    const { error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .in('id', ids);

    if (error) {
      toast({
        title: 'Erro ao atualizar tarefas',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    setTasks(prev => prev.map(t => 
      ids.includes(t.id) ? { ...t, ...updates } : t
    ));
    return true;
  }, [toast]);

  const bulkDeleteTasks = useCallback(async (ids: string[]) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', ids);

    if (error) {
      toast({
        title: 'Erro ao excluir tarefas',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    toast({ title: 'Tarefas excluídas com sucesso' });
    return true;
  }, [toast]);

  const reorderTasks = useCallback(async (activeId: string, overId: string, newElementId?: string) => {
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    const targetElementId = newElementId || activeTask.element_id;
    const elementTasks = tasks.filter(t => 
      t.element_id === targetElementId && 
      t.parent_task_id === activeTask.parent_task_id
    );
    
    if (newElementId && newElementId !== activeTask.element_id) {
      // Get all subtasks of the task being moved
      const subtaskIds = tasks
        .filter(t => t.parent_task_id === activeId)
        .map(t => t.id);
      
      const newPosition = elementTasks.length;
      
      // Update local state: move parent task and all subtasks to new element
      setTasks(prev => prev.map(t => {
        if (t.id === activeId) {
          return { ...t, element_id: newElementId, position: newPosition };
        }
        if (subtaskIds.includes(t.id)) {
          return { ...t, element_id: newElementId };
        }
        return t;
      }));

      // Update database: parent task
      await supabase
        .from('tasks')
        .update({ element_id: newElementId, position: newPosition })
        .eq('id', activeId);
      
      // Update database: subtasks
      if (subtaskIds.length > 0) {
        await supabase
          .from('tasks')
          .update({ element_id: newElementId })
          .in('id', subtaskIds);
      }
    } else {
      const activeIndex = elementTasks.findIndex(t => t.id === activeId);
      const overIndex = elementTasks.findIndex(t => t.id === overId);
      
      if (activeIndex === -1 || overIndex === -1) return;

      const newTasks = [...elementTasks];
      const [removed] = newTasks.splice(activeIndex, 1);
      newTasks.splice(overIndex, 0, removed);

      const updatedTasks = newTasks.map((t, index) => ({
        ...t,
        position: index,
      }));

      // Find only tasks whose position actually changed
      const changedTasks = updatedTasks.filter((t, index) => 
        elementTasks[index]?.id !== t.id
      );

      setTasks(prev => {
        const otherTasks = prev.filter(t => 
          t.element_id !== targetElementId || 
          t.parent_task_id !== activeTask.parent_task_id
        );
        return [...otherTasks, ...updatedTasks];
      });

      // Only update tasks whose position changed
      if (changedTasks.length > 0) {
        await Promise.all(
          changedTasks.map(task =>
            supabase
              .from('tasks')
              .update({ position: task.position })
              .eq('id', task.id)
          )
        );
      }
    }
  }, [tasks]);

  // Helper functions to get tasks by hierarchy
  const getRootTasks = useCallback((elementId: string) => {
    return tasks
      .filter(t => t.element_id === elementId && !t.parent_task_id)
      .sort((a, b) => a.position - b.position);
  }, [tasks]);

  const getSubtasks = useCallback((parentTaskId: string) => {
    return tasks
      .filter(t => t.parent_task_id === parentTaskId)
      .sort((a, b) => a.position - b.position);
  }, [tasks]);

  return {
    tasks,
    loading,
    createTask,
    createSubtask,
    updateTask,
    deleteTask,
    bulkUpdateTasks,
    bulkDeleteTasks,
    reorderTasks,
    getRootTasks,
    getSubtasks,
    refetch: fetchTasks,
  };
}