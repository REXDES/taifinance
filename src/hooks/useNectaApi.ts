import { supabase } from '@/integrations/supabase/client';

export type NectaMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Chama a API Necta Multi-Pay através da edge function proxy (credenciais ficam no backend). */
export async function nectaCall<T = any>(
  path: string,
  method: NectaMethod = 'GET',
  body?: unknown,
  query?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('necta-api', {
    body: { path, method, body, query },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any)?.data as T;
}

/**
 * Ações do proxy que não são chamadas cruas da API:
 * - provision_seller_token: cria o token de API vinculado ao seller (necessário
 *   para emitir cobrança quando a credencial do projeto é de marketplace).
 * - import_sellers: importa os estabelecimentos já cadastrados na Necta.
 */
export async function nectaAction<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('necta-api', { body: { action, ...params } });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}


/** Valores monetários da Necta são em centavos inteiros. */
export const centsToBRL = (v: unknown) => Number(v ?? 0) / 100;
export const brl = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
