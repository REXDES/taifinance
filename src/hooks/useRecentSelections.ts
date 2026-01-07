import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RecentAccount {
  id: string;
  name: string;
  color: string;
}

interface RecentCategory {
  id: string;
  name: string;
  color: string;
  type: string;
}

export function useRecentSelections(companyId: string | null) {
  const { user } = useAuth();
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>([]);
  const [recentCategories, setRecentCategories] = useState<RecentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentSelections = useCallback(async () => {
    if (!companyId || !user?.id) {
      setRecentAccounts([]);
      setRecentCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fetch recent transactions to get account and category usage
      const { data: transactions } = await supabase
        .from('transactions')
        .select('account_id, category_id, created_at')
        .eq('company_id', companyId)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (transactions && transactions.length > 0) {
        // Get unique account IDs (most recent first)
        const seenAccountIds = new Set<string>();
        const uniqueAccountIds: string[] = [];
        for (const t of transactions) {
          if (t.account_id && !seenAccountIds.has(t.account_id)) {
            seenAccountIds.add(t.account_id);
            uniqueAccountIds.push(t.account_id);
            if (uniqueAccountIds.length >= 4) break;
          }
        }

        // Get unique category IDs (most recent first, only expenses)
        const seenCategoryIds = new Set<string>();
        const uniqueCategoryIds: string[] = [];
        for (const t of transactions) {
          if (t.category_id && !seenCategoryIds.has(t.category_id)) {
            seenCategoryIds.add(t.category_id);
            uniqueCategoryIds.push(t.category_id);
            if (uniqueCategoryIds.length >= 8) break; // Get more to filter by expense later
          }
        }

        // Fetch account details
        if (uniqueAccountIds.length > 0) {
          const { data: accounts } = await supabase
            .from('accounts')
            .select('id, name, color')
            .in('id', uniqueAccountIds)
            .eq('is_active', true);

          if (accounts) {
            // Sort by the order they appeared in transactions
            const sortedAccounts = uniqueAccountIds
              .map(id => accounts.find(a => a.id === id))
              .filter((a): a is RecentAccount => a !== undefined);
            setRecentAccounts(sortedAccounts);
          }
        } else {
          setRecentAccounts([]);
        }

        // Fetch category details (only expenses)
        if (uniqueCategoryIds.length > 0) {
          const { data: categories } = await supabase
            .from('transaction_categories')
            .select('id, name, color, type')
            .in('id', uniqueCategoryIds)
            .eq('type', 'expense');

          if (categories) {
            // Sort by the order they appeared in transactions
            const sortedCategories = uniqueCategoryIds
              .map(id => categories.find(c => c.id === id))
              .filter((c): c is RecentCategory => c !== undefined)
              .slice(0, 4);
            setRecentCategories(sortedCategories);
          }
        } else {
          setRecentCategories([]);
        }
      } else {
        setRecentAccounts([]);
        setRecentCategories([]);
      }
    } catch (error) {
      console.error('Error fetching recent selections:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    fetchRecentSelections();
  }, [fetchRecentSelections]);

  return {
    recentAccounts,
    recentCategories,
    loading,
    refetch: fetchRecentSelections,
  };
}
