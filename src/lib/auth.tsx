import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  guest: boolean;
  loading: boolean;
  isRecovery: boolean;
  setGuest: (v: boolean) => void;
  setIsRecovery: (v: boolean) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  guest: true,
  loading: true,
  isRecovery: false,
  setGuest: () => {},
  setIsRecovery: () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setGuest(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn("[AuthProvider] getSession error:", error);
        setSession(null);
        setUser(null);
        setGuest(true);
        return;
      }

      const sess = data.session;
      if (sess?.user) {
        setSession(sess);
        setUser(sess.user);
        setGuest(false);
      } else {
        setSession(null);
        setUser(null);
        setGuest(true);
      }
    } catch (err) {
      console.warn("[AuthProvider] refresh error:", err);
      setSession(null);
      setUser(null);
      setGuest(true);
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

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (cancelled) return;

      if (sess?.user) {
        setSession(sess);
        setUser(sess.user);
        setGuest(false);
        setIsRecovery(event === "RECOVERY");
      } else {
        setSession(null);
        setUser(null);
        setGuest(true);
        setIsRecovery(false);
      }
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      session,
      user,
      guest,
      loading,
      isRecovery,
      setGuest,
      setIsRecovery,
      logout,
      refresh,
    }),
    [session, user, guest, loading, isRecovery, logout, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

export function useAuthUser() {
  const { user, session } = useAuth();
  return { user, session };
}

export function useIsAuthenticated() {
  const { user, loading } = useAuth();
  return { isAuthenticated: Boolean(user && !loading), loading };
}
