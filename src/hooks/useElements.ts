import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Element {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  description?: string | null;
  is_expanded?: boolean;
}

export function useElements(projectId: string | null) {
  const [elements, setElements] = useState<Element[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchElements = useCallback(async () => {
    if (!projectId) {
      setElements([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('elements')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) {
      toast({
        title: 'Erro ao carregar elementos',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setElements((data || []).map(el => ({ ...el, is_expanded: false })));
    }
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => {
    fetchElements();
  }, [fetchElements]);

  const createElement = useCallback(async (name: string, color: string) => {
    if (!projectId) return null;

    const position = elements.length;
    const { data, error } = await supabase
      .from('elements')
      .insert({
        project_id: projectId,
        name,
        color,
        position,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao criar elemento',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }

    setElements(prev => [...prev, { ...data, is_expanded: true }]);
    toast({ title: 'Elemento criado com sucesso' });
    return data;
  }, [projectId, elements.length, toast]);

  const updateElement = useCallback(async (id: string, updates: Partial<Element>) => {
    const { error } = await supabase
      .from('elements')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao atualizar elemento',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ));
    return true;
  }, [toast]);

  const toggleExpand = useCallback((elementId: string) => {
    setElements(prev => prev.map(el => 
      el.id === elementId ? { ...el, is_expanded: !el.is_expanded } : el
    ));
  }, []);

  const deleteElement = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('elements')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir elemento',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    setElements(prev => prev.filter(el => el.id !== id));
    toast({ title: 'Elemento excluído com sucesso' });
    return true;
  }, [toast]);

  const duplicateElement = useCallback(async (id: string) => {
    if (!projectId) return null;

    const elementToDuplicate = elements.find(el => el.id === id);
    if (!elementToDuplicate) return null;

    const position = elements.length;
    const { data, error } = await supabase
      .from('elements')
      .insert({
        project_id: projectId,
        name: `${elementToDuplicate.name} (cópia)`,
        color: elementToDuplicate.color,
        position,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao duplicar elemento',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }

    setElements(prev => [...prev, { ...data, is_expanded: true }]);
    toast({ title: 'Elemento duplicado com sucesso' });
    return data;
  }, [projectId, elements, toast]);

  const reorderElements = useCallback(async (activeId: string, overId: string) => {
    const activeIndex = elements.findIndex(e => e.id === activeId);
    const overIndex = elements.findIndex(e => e.id === overId);
    
    if (activeIndex === -1 || overIndex === -1) return;

    // Optimistic update
    const newElements = [...elements];
    const [removed] = newElements.splice(activeIndex, 1);
    newElements.splice(overIndex, 0, removed);
    
    // Update positions and find which ones changed
    const updatedElements = newElements.map((el, index) => ({
      ...el,
      position: index,
    }));
    setElements(updatedElements);

    // Only update elements whose position actually changed
    const changedElements = updatedElements.filter((el, index) => 
      elements[index]?.id !== el.id
    );

    if (changedElements.length > 0) {
      await Promise.all(
        changedElements.map(el =>
          supabase
            .from('elements')
            .update({ position: el.position })
            .eq('id', el.id)
        )
      );
    }
  }, [elements]);

  return {
    elements,
    loading,
    createElement,
    updateElement,
    deleteElement,
    duplicateElement,
    toggleExpand,
    reorderElements,
    refetch: fetchElements,
  };
}