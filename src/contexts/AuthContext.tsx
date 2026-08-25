import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; data: { user: User | null; session: Session | null } | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const initialSessionResolved = useRef(false);
  const explicitSignOut = useRef(false);
  const sessionRecoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'SIGNED_OUT' && !explicitSignOut.current && initialSessionResolved.current) {
          setLoading(true);
          if (sessionRecoveryTimer.current) clearTimeout(sessionRecoveryTimer.current);
          sessionRecoveryTimer.current = setTimeout(async () => {
            const { data: { session: recoveredSession } } = await supabase.auth.getSession();
            setSession(recoveredSession);
            setUser(recoveredSession?.user ?? null);
            setLoading(false);
          }, 1200);
          return;
        }

        if (sessionRecoveryTimer.current) {
          clearTimeout(sessionRecoveryTimer.current);
          sessionRecoveryTimer.current = null;
        }
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (initialSessionResolved.current) {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      initialSessionResolved.current = true;
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (sessionRecoveryTimer.current) clearTimeout(sessionRecoveryTimer.current);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error, data };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    explicitSignOut.current = true;
    try {
      await supabase.auth.signOut();
    } finally {
      explicitSignOut.current = false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
