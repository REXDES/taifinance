import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

export type AccessMode = 'admin' | 'normal';

interface AccessModeContextType {
  mode: AccessMode | null;
  setMode: (mode: AccessMode) => void;
  resetMode: () => void;
}

const STORAGE_KEY = 'tai.accessMode';

const AccessModeContext = createContext<AccessModeContextType | undefined>(undefined);

export function AccessModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AccessMode | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'admin' || stored === 'normal') return stored;
    return null;
  });

  useEffect(() => {
    if (mode) {
      localStorage.setItem(STORAGE_KEY, mode);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [mode]);

  const setMode = useCallback((m: AccessMode) => setModeState(m), []);
  const resetMode = useCallback(() => setModeState(null), []);

  return (
    <AccessModeContext.Provider value={{ mode, setMode, resetMode }}>
      {children}
    </AccessModeContext.Provider>
  );
}

export function useAccessMode() {
  const ctx = useContext(AccessModeContext);
  if (!ctx) throw new Error('useAccessMode must be used within AccessModeProvider');
  return ctx;
}
