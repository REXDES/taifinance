import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TransactionCategory {
  id: string;
  company_id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  color: string;
  monthly_budget?: number | null;
  created_at: string;
  subcategories?: TransactionSubcategory[];
}

export interface TransactionSubcategory {
  id: string;
  category_id: string;
  name: string;
  created_at: string;
}

export function useTransactionCategories(companyId: string | null) {
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    if (!companyId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    try {
      const { data: categoriesData, error: catError } = await supabase
        .from('transaction_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (catError) throw catError;

      const categoryIds = (categoriesData || []).map(c => c.id);
      
      let subcategoriesData: TransactionSubcategory[] = [];
      if (categoryIds.length > 0) {
        const { data, error } = await supabase
          .from('transaction_subcategories')
          .select('*')
          .in('category_id', categoryIds)
          .order('name');
        
        if (error) throw error;
        subcategoriesData = data || [];
      }

      const categoriesWithSubs = (categoriesData || []).map(cat => ({
        ...cat,
        type: cat.type as 'income' | 'expense' | 'both',
        subcategories: subcategoriesData.filter(sub => sub.category_id === cat.id),
      }));

      setCategories(categoriesWithSubs);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      toast({ title: 'Erro ao carregar categorias', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(async (data: {
    name: string;
    type: 'income' | 'expense' | 'both';
    color?: string;
    monthly_budget?: number | null;
  }) => {
    if (!companyId) return null;

    try {
      const { data: category, error } = await supabase
        .from('transaction_categories')
        .insert({
          company_id: companyId,
          name: data.name,
          type: data.type,
          color: data.color || '#8B5CF6',
          monthly_budget: data.monthly_budget || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchCategories();
      toast({ title: 'Categoria criada com sucesso' });
      return category;
    } catch (error: any) {
      toast({ title: 'Erro ao criar categoria', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [companyId, fetchCategories, toast]);

  const updateCategory = useCallback(async (id: string, data: Partial<TransactionCategory>) => {
    try {
      const { error } = await supabase
        .from('transaction_categories')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      await fetchCategories();
      toast({ title: 'Categoria atualizada com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar categoria', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchCategories, toast]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('transaction_categories')
        .delete()
        .eq('id', id);

      if (error) {
        // Check for foreign key constraint violation
        if (error.code === '23503') {
          toast({ 
            title: 'Não é possível excluir esta categoria', 
            description: 'Esta categoria está sendo usada em lançamentos ou contas a pagar/receber. Remova os vínculos primeiro.', 
            variant: 'destructive' 
          });
          return false;
        }
        throw error;
      }
      
      await fetchCategories();
      toast({ title: 'Categoria excluída com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao excluir categoria', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchCategories, toast]);

  const createSubcategory = useCallback(async (categoryId: string, name: string) => {
    try {
      const { data: subcategory, error } = await supabase
        .from('transaction_subcategories')
        .insert({
          category_id: categoryId,
          name,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchCategories();
      toast({ title: 'Subcategoria criada com sucesso' });
      return subcategory;
    } catch (error: any) {
      toast({ title: 'Erro ao criar subcategoria', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [fetchCategories, toast]);

  const updateSubcategory = useCallback(async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('transaction_subcategories')
        .update({ name })
        .eq('id', id);

      if (error) throw error;
      
      await fetchCategories();
      toast({ title: 'Subcategoria atualizada com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar subcategoria', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchCategories, toast]);

  const moveSubcategory = useCallback(async (subcategoryId: string, newCategoryId: string) => {
    try {
      // Update the subcategory's parent category
      const { error: subError } = await supabase
        .from('transaction_subcategories')
        .update({ category_id: newCategoryId })
        .eq('id', subcategoryId);

      if (subError) throw subError;

      // Update all transactions that use this subcategory to the new category
      const { error: txError } = await supabase
        .from('transactions')
        .update({ category_id: newCategoryId })
        .eq('subcategory_id', subcategoryId);

      if (txError) throw txError;

      // Update all payables/receivables that use this subcategory to the new category
      const { error: prError } = await supabase
        .from('payables_receivables')
        .update({ category_id: newCategoryId })
        .eq('subcategory_id', subcategoryId);

      if (prError) throw prError;
      
      await fetchCategories();
      toast({ title: 'Subcategoria movida com sucesso', description: 'Todos os registros foram atualizados para a nova categoria.' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao mover subcategoria', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchCategories, toast]);

  const deleteSubcategory = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('transaction_subcategories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchCategories();
      toast({ title: 'Subcategoria excluída com sucesso' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao excluir subcategoria', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [fetchCategories, toast]);

  return {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    moveSubcategory,
    deleteSubcategory,
    refetch: fetchCategories,
  };
}
