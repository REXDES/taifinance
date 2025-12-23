import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MyWorkElement {
  id: string;
  name: string;
  color: string;
  projectId: string;
  projectName: string;
  companyId: string;
  type: 'responsible' | 'workgroup';
}

export function useMyWork(userId: string | null) {
  const [elements, setElements] = useState<MyWorkElement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyWork = useCallback(async () => {
    if (!userId) {
      setElements([]);
      setLoading(false);
      return;
    }

    try {
      // Get elements where user is in work group
      const { data: workGroupElements } = await supabase
        .from('element_work_groups')
        .select(`
          element_id,
          elements (
            id,
            name,
            color,
            project_id,
            projects (
              id,
              name,
              company_id
            )
          )
        `)
        .eq('user_id', userId);

      // Get elements where user is responsible for tasks
      const { data: responsibleTasks } = await supabase
        .from('tasks')
        .select(`
          element_id,
          elements (
            id,
            name,
            color,
            project_id,
            projects (
              id,
              name,
              company_id
            )
          )
        `)
        .eq('responsible_id', userId);

      const elementsMap = new Map<string, MyWorkElement>();

      // Add work group elements
      workGroupElements?.forEach(wg => {
        const el = wg.elements as any;
        if (el && el.projects) {
          elementsMap.set(el.id, {
            id: el.id,
            name: el.name,
            color: el.color,
            projectId: el.project_id,
            projectName: el.projects.name,
            companyId: el.projects.company_id,
            type: 'workgroup',
          });
        }
      });

      // Add responsible elements (may override workgroup type)
      responsibleTasks?.forEach(task => {
        const el = task.elements as any;
        if (el && el.projects) {
          const existing = elementsMap.get(el.id);
          if (!existing || existing.type === 'workgroup') {
            elementsMap.set(el.id, {
              id: el.id,
              name: el.name,
              color: el.color,
              projectId: el.project_id,
              projectName: el.projects.name,
              companyId: el.projects.company_id,
              type: 'responsible',
            });
          }
        }
      });

      setElements(Array.from(elementsMap.values()));
    } catch (error) {
      console.error('Error fetching my work:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMyWork();
  }, [fetchMyWork]);

  return {
    elements,
    loading,
    refetch: fetchMyWork,
  };
}
