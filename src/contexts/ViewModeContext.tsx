import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_VIEW_MODE,
  atLeast as modeAtLeast,
  atMost as modeAtMost,
  readStoredViewMode,
  viewModeStorageKey,
  writeStoredViewMode,
  type ViewMode,
} from '@/lib/viewMode';

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  /** Este modo mostra pelo menos o nível `min`? */
  atLeast: (min: ViewMode) => boolean;
  /** Este modo mostra no máximo o nível `max`? */
  atMost: (max: ViewMode) => boolean;
}

// Sem provider (telas públicas, testes) o app se comporta como o Balanceado — a versão base.
const ViewModeContext = createContext<ViewModeContextValue>({
  mode: DEFAULT_VIEW_MODE,
  setMode: () => {},
  atLeast: (min) => modeAtLeast(DEFAULT_VIEW_MODE, min),
  atMost: (max) => modeAtMost(DEFAULT_VIEW_MODE, max),
});

export function ViewModeProvider({ userId, children }: { userId?: string | null; children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(() => readStoredViewMode(userId));

  // Trocou de usuário (login/logout): carrega a preferência dele.
  useEffect(() => {
    setModeState(readStoredViewMode(userId));
  }, [userId]);

  // Deixa o modo visível ao CSS (<html data-view-mode="visual">) para ajustes globais.
  useEffect(() => {
    document.documentElement.dataset.viewMode = mode;
    return () => {
      delete document.documentElement.dataset.viewMode;
    };
  }, [mode]);

  // Mudou em outra aba: acompanha.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === viewModeStorageKey(userId)) setModeState(readStoredViewMode(userId));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId]);

  const setMode = useCallback(
    (next: ViewMode) => {
      setModeState(next);
      writeStoredViewMode(userId, next);
    },
    [userId],
  );

  const value = useMemo<ViewModeContextValue>(
    () => ({
      mode,
      setMode,
      atLeast: (min) => modeAtLeast(mode, min),
      atMost: (max) => modeAtMost(mode, max),
    }),
    [mode, setMode],
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

/** Igual ao ViewModeProvider, mas descobre o usuário logado sozinho (usado no App). */
export function AuthViewModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <ViewModeProvider userId={user?.id ?? null}>{children}</ViewModeProvider>;
}

export const useViewMode = () => useContext(ViewModeContext);

/**
 * Mostra o conteúdo só nos modos pedidos: `min` = a partir de (inclusive), `max` = até (inclusive).
 *   <ViewModeOnly min="detailed">…só no Descritivo…</ViewModeOnly>
 *   <ViewModeOnly max="balanced">…Visual e Balanceado…</ViewModeOnly>
 */
export function ViewModeOnly({ min, max, children }: { min?: ViewMode; max?: ViewMode; children: ReactNode }) {
  const { atLeast, atMost } = useViewMode();
  if (min && !atLeast(min)) return null;
  if (max && !atMost(max)) return null;
  return <>{children}</>;
}
