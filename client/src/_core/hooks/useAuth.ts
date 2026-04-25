import { auth } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type AuthState = {
  user: FirebaseUser | null;
  loading: boolean;
  isAuthenticated: boolean;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  });

  const syncUserMutation = trpc.auth.syncUser.useMutation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Sync user to Firestore on every sign-in
        syncUserMutation.mutate({
          name: firebaseUser.displayName ?? undefined,
          email: firebaseUser.email ?? undefined,
        });
        setState({ user: firebaseUser, loading: false, isAuthenticated: true });
      } else {
        setState({ user: null, loading: false, isAuthenticated: false });
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setState({ user: null, loading: false, isAuthenticated: false });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    logout,
    refresh: () => {},
  };
}
