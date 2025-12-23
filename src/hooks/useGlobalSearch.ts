import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  id: string;
  type: 'project' | 'element' | 'task' | 'subtask' | 'comment';
  name: string;
  description?: string;
  parentName?: string;
  projectId?: string;
  elementId?: string;
  taskId?: string;
}

export function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchTerm = `%${searchQuery.toLowerCase()}%`;
    const allResults: SearchResult[] = [];

    try {
      // Search projects
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, description')
        .ilike('name', searchTerm)
        .limit(5);

      if (projects) {
        allResults.push(...projects.map(p => ({
          id: p.id,
          type: 'project' as const,
          name: p.name,
          description: p.description || undefined,
        })));
      }

      // Search elements
      const { data: elements } = await supabase
        .from('elements')
        .select('id, name, description, project_id, projects(name)')
        .ilike('name', searchTerm)
        .limit(5);

      if (elements) {
        allResults.push(...elements.map(e => ({
          id: e.id,
          type: 'element' as const,
          name: e.name,
          description: e.description || undefined,
          parentName: (e.projects as any)?.name,
          projectId: e.project_id,
        })));
      }

      // Search tasks (parent tasks only)
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, name, description, element_id, parent_task_id, elements(name, project_id)')
        .ilike('name', searchTerm)
        .is('parent_task_id', null)
        .limit(5);

      if (tasks) {
        allResults.push(...tasks.map(t => ({
          id: t.id,
          type: 'task' as const,
          name: t.name,
          description: t.description || undefined,
          parentName: (t.elements as any)?.name,
          elementId: t.element_id,
          projectId: (t.elements as any)?.project_id,
        })));
      }

      // Search subtasks
      const { data: subtasks } = await supabase
        .from('tasks')
        .select('id, name, description, element_id, parent_task_id, elements(name, project_id)')
        .ilike('name', searchTerm)
        .not('parent_task_id', 'is', null)
        .limit(5);

      if (subtasks) {
        allResults.push(...subtasks.map(t => ({
          id: t.id,
          type: 'subtask' as const,
          name: t.name,
          description: t.description || undefined,
          parentName: (t.elements as any)?.name,
          elementId: t.element_id,
          taskId: t.parent_task_id || undefined,
          projectId: (t.elements as any)?.project_id,
        })));
      }

      // Search comments
      const { data: comments } = await supabase
        .from('task_comments')
        .select('id, content, task_id, tasks(name, element_id, elements(project_id))')
        .ilike('content', searchTerm)
        .limit(5);

      if (comments) {
        allResults.push(...comments.map(c => ({
          id: c.id,
          type: 'comment' as const,
          name: c.content.substring(0, 50) + (c.content.length > 50 ? '...' : ''),
          parentName: (c.tasks as any)?.name,
          taskId: c.task_id,
          elementId: (c.tasks as any)?.element_id,
          projectId: (c.tasks as any)?.elements?.project_id,
        })));
      }

      setResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, search]);

  return {
    query,
    setQuery,
    results,
    loading,
  };
}
