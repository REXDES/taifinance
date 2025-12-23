import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FavoriteElementDetails {
  id: string;
  name: string;
  color: string;
  projectId: string;
  projectName: string;
  companyId: string;
}

export function useFavoriteElements(userId: string | null, favoriteIds: string[]) {
  const [elements, setElements] = useState<FavoriteElementDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchElements = useCallback(async () => {
    if (!userId || favoriteIds.length === 0) {
      setElements([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('elements')
        .select(`
          id,
          name,
          color,
          project_id,
          projects (
            id,
            name,
            company_id
          )
        `)
        .in('id', favoriteIds);

      if (error) throw error;

      const mapped: FavoriteElementDetails[] = (data || []).map(el => ({
        id: el.id,
        name: el.name,
        color: el.color,
        projectId: el.project_id,
        projectName: (el.projects as any)?.name || '',
        companyId: (el.projects as any)?.company_id || '',
      }));

      setElements(mapped);
    } catch (error) {
      console.error('Error fetching favorite elements:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, favoriteIds]);

  useEffect(() => {
    fetchElements();
  }, [fetchElements]);

  return {
    elements,
    loading,
    refetch: fetchElements,
  };
}
