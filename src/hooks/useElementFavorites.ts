import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FavoriteElement {
  id: string;
  element_id: string;
  created_at: string;
}

export function useElementFavorites(userId: string | null) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('element_favorites')
        .select('element_id')
        .eq('user_id', userId);

      if (error) throw error;
      setFavorites(data?.map(f => f.element_id) || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const toggleFavorite = useCallback(async (elementId: string) => {
    if (!userId) return;

    const isFavorited = favorites.includes(elementId);

    try {
      if (isFavorited) {
        const { error } = await supabase
          .from('element_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('element_id', elementId);

        if (error) throw error;
        setFavorites(prev => prev.filter(id => id !== elementId));
      } else {
        const { error } = await supabase
          .from('element_favorites')
          .insert({ user_id: userId, element_id: elementId });

        if (error) throw error;
        setFavorites(prev => [...prev, elementId]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }, [userId, favorites]);

  const isFavorite = useCallback((elementId: string) => {
    return favorites.includes(elementId);
  }, [favorites]);

  return {
    favorites,
    loading,
    toggleFavorite,
    isFavorite,
    refetch: fetchFavorites,
  };
}
