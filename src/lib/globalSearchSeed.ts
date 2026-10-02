import { useEffect, useRef } from 'react';

// Ponte entre a busca global e as telas de lista: a busca global grava o termo
// aqui e a tela de destino (ao montar, ou se já estiver aberta) o aplica no
// próprio campo de busca. Expira em poucos segundos para um termo antigo nunca
// aparecer "do nada" numa visita posterior.

const KEY = 'tai-global-search-seed';
const EVENT = 'tai:global-search-seed';
const MAX_AGE_MS = 10_000;

export type SeedScope = 'clients-suppliers';

export function seedGlobalSearch(scope: SeedScope, term: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ scope, term, at: Date.now() }));
  } catch { /* sessionStorage indisponível: a navegação ainda funciona, só sem o termo */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useGlobalSearchSeed(scope: SeedScope, apply: (term: string) => void) {
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    const consume = () => {
      try {
        const raw = sessionStorage.getItem(KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { scope?: string; term?: string; at?: number };
        if (parsed.scope !== scope) return;
        sessionStorage.removeItem(KEY);
        if (typeof parsed.term !== 'string' || Date.now() - (parsed.at ?? 0) > MAX_AGE_MS) return;
        applyRef.current(parsed.term);
      } catch { /* valor corrompido: ignora */ }
    };
    consume();
    window.addEventListener(EVENT, consume);
    return () => window.removeEventListener(EVENT, consume);
  }, [scope]);
}
