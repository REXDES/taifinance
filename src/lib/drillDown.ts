import { useEffect, useRef } from 'react';

// Drill-down: de um número (card do dashboard, linha do sino de pendências) para a
// tela de detalhe JÁ filtrada, levando junto "o que a pessoa viu" (valor e contagem)
// para que a tela de destino confirme que o total confere com o número clicado.
// Mesma ponte da busca global: sessionStorage + evento, com validade curta.

export type DrillScope = 'transactions' | 'payables-receivables';

/** Qual número a pessoa clicou — a tela de destino sabe como recalculá-lo. */
export type DrillMetric = 'income' | 'expense' | 'balance' | 'receivable-open' | 'payable-open';

export interface DrillOrigin {
  /** Nome do número como aparece na tela de origem, ex.: "Despesas do Mês". */
  label: string;
  metric: DrillMetric;
  /** Valor e quantidade exatamente como estavam na tela de origem. */
  value: number;
  count: number;
}

export interface TransactionsDrillFilters {
  startDate: string;
  endDate: string;
  type?: 'income' | 'expense';
  /** Só lançamentos desta categoria (ex.: vindo da participação por categoria). */
  categoryId?: string;
}

export interface PayablesDrillFilters {
  /** Vazio = sem data inicial (ex.: "vencidas até ontem"). */
  startDate: string;
  endDate: string;
  type: 'payable' | 'receivable';
  status: 'pending'[];
}

interface DrillFiltersByScope {
  transactions: TransactionsDrillFilters;
  'payables-receivables': PayablesDrillFilters;
}

export interface DrillRequest<S extends DrillScope = DrillScope> {
  scope: S;
  filters: DrillFiltersByScope[S];
  /** Frase pronta para o banner, ex.: "Despesas · outubro de 2026". */
  description: string;
  origin: DrillOrigin;
}

const KEY = 'tai-drill-down';
const EVENT = 'tai:drill-down';
const MAX_AGE_MS = 10_000;

export function startDrillDown(request: DrillRequest) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ request, at: Date.now() }));
  } catch { /* sem sessionStorage: a navegação ainda funciona, só sem filtro */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useDrillDown<S extends DrillScope>(scope: S, apply: (request: DrillRequest<S>) => void) {
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    const consume = () => {
      try {
        const raw = sessionStorage.getItem(KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { request?: DrillRequest; at?: number };
        if (!parsed.request || parsed.request.scope !== scope) return;
        sessionStorage.removeItem(KEY);
        if (Date.now() - (parsed.at ?? 0) > MAX_AGE_MS) return;
        applyRef.current(parsed.request as DrillRequest<S>);
      } catch { /* valor corrompido: ignora */ }
    };
    consume();
    window.addEventListener(EVENT, consume);
    return () => window.removeEventListener(EVENT, consume);
  }, [scope]);
}

/** Compara dinheiro ao centavo (evita 0.1 + 0.2 !== 0.3). */
export const sameMoney = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);
