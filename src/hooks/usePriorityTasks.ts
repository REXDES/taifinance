import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PriorityTask {
  id: string;
  name: string;
  color: string;
  elementId: string;
  elementName: string;
  projectId: string;
  projectName: string;
  companyId: string;
  type: 'responsible' | 'workgroup';
}

export function usePriorityTasks(userId: string | null) {
  const [tasks, setTasks] = useState<PriorityTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPriorityTasks = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      // Get elements where user is in work group
      const { data: workGroupElements } = await supabase
        .from('element_work_groups')
        .select('element_id')
        .eq('user_id', userId);

      const workGroupElementIds = workGroupElements?.map(wg => wg.element_id) || [];

      // Get tasks with priority 2 and "A fazer" status (status priority 0)
      // where user is responsible OR in work group
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          id,
          name,
          color,
          element_id,
          responsible_id,
          status_id,
          status_configs!tasks_status_id_fkey (
            name,
            priority
          ),
          elements (
            id,
            name,
            project_id,
            projects (
              id,
              name,
              company_id
            )
          )
        `)
        .eq('priority', 2)
        .is('parent_task_id', null);

      const priorityTasks: PriorityTask[] = [];

      tasksData?.forEach(task => {
        const status = task.status_configs as any;
        const el = task.elements as any;
        
        // Check if status is "A fazer" (priority 0)
        if (status?.priority !== 0) return;
        if (!el?.projects) return;

        // Check if user is responsible or in work group
        const isResponsible = task.responsible_id === userId;
        const isInWorkGroup = workGroupElementIds.includes(task.element_id);

        if (isResponsible || isInWorkGroup) {
          priorityTasks.push({
            id: task.id,
            name: task.name,
            color: task.color,
            elementId: el.id,
            elementName: el.name,
            projectId: el.project_id,
            projectName: el.projects.name,
            companyId: el.projects.company_id,
            type: isResponsible ? 'responsible' : 'workgroup',
          });
        }
      });

      setTasks(priorityTasks);
    } catch (error) {
      console.error('Error fetching priority tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPriorityTasks();
  }, [fetchPriorityTasks]);

  return {
    tasks,
    loading,
    refetch: fetchPriorityTasks,
  };
}
