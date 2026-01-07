import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RecentAccount {
  id: string;
  name: string;
  color: string;
}

interface RecentSubcategory {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  category_color: string;
  category_type: string;
}

export function useRecentSelections(companyId: string | null) {
  const { user } = useAuth();
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>([]);
  const [recentSubcategories, setRecentSubcategories] = useState<RecentSubcategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentSelections = useCallback(async () => {
    if (!companyId || !user?.id) {
      setRecentAccounts([]);
      setRecentSubcategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fetch recent transactions to get account and subcategory usage
      const { data: transactions } = await supabase
        .from('transactions')
        .select('account_id, subcategory_id, category_id, type, created_at')
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

        // Get unique subcategory IDs for expenses (most recent first)
        const seenSubcategoryIds = new Set<string>();
        const uniqueSubcategoryIds: string[] = [];
        for (const t of transactions) {
          if (t.subcategory_id && !seenSubcategoryIds.has(t.subcategory_id) && t.type === 'expense') {
            seenSubcategoryIds.add(t.subcategory_id);
            uniqueSubcategoryIds.push(t.subcategory_id);
            if (uniqueSubcategoryIds.length >= 4) break;
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
            const sortedAccounts = uniqueAccountIds
              .map(id => accounts.find(a => a.id === id))
              .filter((a): a is RecentAccount => a !== undefined);
            setRecentAccounts(sortedAccounts);
          }
        } else {
          setRecentAccounts([]);
        }

        // Fetch subcategory details with their categories
        if (uniqueSubcategoryIds.length > 0) {
          const { data: subcategories } = await supabase
            .from('transaction_subcategories')
            .select('id, name, category_id')
            .in('id', uniqueSubcategoryIds);

          if (subcategories && subcategories.length > 0) {
            const categoryIds = [...new Set(subcategories.map(s => s.category_id))];
            const { data: categories } = await supabase
              .from('transaction_categories')
              .select('id, name, color, type')
              .in('id', categoryIds);

            if (categories) {
              const sortedSubcategories: RecentSubcategory[] = uniqueSubcategoryIds
                .map(id => {
                  const sub = subcategories.find(s => s.id === id);
                  if (!sub) return undefined;
                  const cat = categories.find(c => c.id === sub.category_id);
                  if (!cat || cat.type !== 'expense') return undefined;
                  return {
                    id: sub.id,
                    name: sub.name,
                    category_id: sub.category_id,
                    category_name: cat.name,
                    category_color: cat.color,
                    category_type: cat.type,
                  };
                })
                .filter((s): s is RecentSubcategory => s !== undefined);
              setRecentSubcategories(sortedSubcategories);
            }
          } else {
            setRecentSubcategories([]);
          }
        } else {
          setRecentSubcategories([]);
        }
      } else {
        setRecentAccounts([]);
        setRecentSubcategories([]);
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
    recentSubcategories,
    loading,
    refetch: fetchRecentSelections,
  };
}
