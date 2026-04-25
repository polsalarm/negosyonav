import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { trpc } from "@/lib/trpc";

type AuthValue = {
  user: FirebaseUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const SAFETY_TIMEOUT_MS = 5000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUserMutation = trpc.auth.syncUser.useMutation();
  const lastSyncedUid = useRef<string | null>(null);

  useEffect(() => {
    const safety = setTimeout(() => setLoading(false), SAFETY_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(safety);
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser && lastSyncedUid.current !== firebaseUser.uid) {
        lastSyncedUid.current = firebaseUser.uid;
        syncUserMutation.mutate({
          name: firebaseUser.displayName ?? undefined,
          email: firebaseUser.email ?? undefined,
        });
      }
      if (!firebaseUser) {
        lastSyncedUid.current = null;
      }
    });

    return () => {
      clearTimeout(safety);
      unsubscribe();
    };
    // syncUserMutation is stable per provider mount; intentional single subscription
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value: AuthValue = {
    user,
    loading,
    isAuthenticated: !!user,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
