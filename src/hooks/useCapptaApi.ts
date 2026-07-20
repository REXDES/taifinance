import { supabase } from '@/integrations/supabase/client';

export type CapptaMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function capptaCall<T = any>(path: string, method: CapptaMethod = 'GET', body?: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cappta-api', {
    body: { path, method, body },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}
