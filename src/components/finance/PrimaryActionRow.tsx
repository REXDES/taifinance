import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Classe base dos botões de ação principal (Nova Conta, Cobrar por, Novo Lançamento).
 * Formato mais "quadrado": altura maior, cantos pouco arredondados e largura mínima,
 * para dar destaque em relação às demais funções do cabeçalho.
 */
export const PRIMARY_ACTION_BUTTON =
  'h-14 w-full sm:w-auto sm:min-w-[300px] rounded-lg px-6 text-base font-semibold shadow-sm';

/**
 * Faixa centralizada que fica abaixo do cabeçalho, reunindo as ações principais da tela.
 */
export function PrimaryActionRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col sm:flex-row items-stretch justify-center gap-3', className)}>
      {children}
    </div>
  );
}
