import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ModuleKey = 'finance' | 'bank_digital' | 'machines' | 'credit' | 'payments';

export const MODULE_DEFAULTS: Record<ModuleKey, { name: string; description: string }> = {
  finance: { name: 'Gestão Financeira', description: 'Contas, lançamentos, relatórios e cadastros' },
  bank_digital: { name: 'Banco Digital', description: 'Integração bancária' },
  machines: { name: 'Máquinas & Locação', description: 'Inventário, manutenção e locações' },
  credit: { name: 'Gestão de Crédito', description: 'Propostas e análise de crédito' },
  payments: { name: 'Pagando.net', description: 'Gateway de vendas e recebimentos' },
};

export interface ModuleBrand { name: string; logo: string | null; color: string | null }

interface Ctx {
  brand: (key: ModuleKey) => ModuleBrand;
  refetch: () => Promise<void>;
}

const BrandingContext = createContext<Ctx>({
  brand: (key) => ({ name: MODULE_DEFAULTS[key].name, logo: null, color: null }),
  refetch: async () => {},
});

let paymentsNameCache = MODULE_DEFAULTS.payments.name;
/** Nome atual do gateway para textos fora do React (toasts etc.). */
export const paymentsBrandName = () => paymentsNameCache;

/** Renderiza o nome configurado do gateway de pagamentos. */
export function PaymentsBrandName() {
  return <>{useModuleBranding().brand('payments').name}</>;
}

export function ModuleBrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, { display_name: string | null; logo_url: string | null; color: string | null }>>({});

  const refetch = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('module_branding').select('module_key, display_name, logo_url, color');
    const map: typeof rows = {};
    (data ?? []).forEach((r) => { map[r.module_key] = r; });
    setRows(map);
    paymentsNameCache = map.payments?.display_name?.trim() || MODULE_DEFAULTS.payments.name;
  }, [user?.id]);

  useEffect(() => { refetch(); }, [refetch]);

  const brand = useCallback((key: ModuleKey): ModuleBrand => {
    const r = rows[key];
    return {
      name: r?.display_name?.trim() || MODULE_DEFAULTS[key].name,
      logo: r?.logo_url || null,
      color: r?.color || null,
    };
  }, [rows]);

  return <BrandingContext.Provider value={{ brand, refetch }}>{children}</BrandingContext.Provider>;
}

export const useModuleBranding = () => useContext(BrandingContext);

/** Nome visível do gateway de pagamentos (antes "Necta"). */
export function usePaymentsBrand() {
  return useModuleBranding().brand('payments');
}
