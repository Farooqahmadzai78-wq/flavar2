import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./client";
import type { User, Session } from "@supabase/supabase-js";

type AuthSessionContext = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const AuthSessionCtx = createContext<AuthSessionContext>({
  session: null,
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const { data, error: err } = await supabase.auth.getSession();
      if (err) {
        setError(err);
        setSession(null);
        setUser(null);
        return;
      }

      const sess = data.session;
      setSession(sess ?? null);
      setUser(sess?.user ?? null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setSession(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await refresh();
      if (!cancelled) {
        setLoading(false);
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, sess) => {
      if (cancelled) return;
      setSession(sess ?? null);
      setUser(sess?.user ?? null);
      setError(null);
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ session, user, loading, error, refresh }),
    [session, user, loading, error, refresh],
  );

  return <AuthSessionCtx.Provider value={value}>{children}</AuthSessionCtx.Provider>;
}

export function useAuthSession() {
  return useContext(AuthSessionCtx);
}

export function useIsAuthenticated() {
  const { user, loading } = useAuthSession();
  return { isAuthenticated: Boolean(user), loading };
}

export function useUserId() {
  const { user } = useAuthSession();
  return user?.id ?? null;
}

export async function getCurrentUserOrThrow(): Promise<User> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("User not authenticated");
  }
  return data.user;
}
