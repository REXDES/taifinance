-- Fix function search path warnings
ALTER FUNCTION public.update_account_balance_on_transaction() SET search_path = public;
ALTER FUNCTION public.update_account_balance_on_transfer() SET search_path = public;