import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User as FirebaseUser } from "firebase/auth";

type AuthCallback = (u: FirebaseUser | null) => void;
const hoisted = vi.hoisted(() => {
  return {
    state: { lastCallback: null as AuthCallback | null },
    unsubscribe: vi.fn(),
    signOutMock: vi.fn(async () => {}),
    syncUserMutate: vi.fn(),
  };
});
const { state, unsubscribe, signOutMock, syncUserMutate } = hoisted;

vi.mock("firebase/auth", async () => {
  const actual = await vi.importActual<typeof import("firebase/auth")>("firebase/auth");
  return {
    ...actual,
    onAuthStateChanged: (_auth: unknown, cb: AuthCallback) => {
      hoisted.state.lastCallback = cb;
      return hoisted.unsubscribe;
    },
    signOut: hoisted.signOutMock,
  };
});

vi.mock("@/lib/firebase", () => ({
  auth: { __mock: true },
  db: {},
  firebaseApp: {},
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      syncUser: {
        useMutation: () => ({ mutate: hoisted.syncUserMutate }),
      },
    },
  },
}));

import { AuthProvider, useAuth } from "./AuthContext";

function Probe() {
  const { user, loading, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? "yes" : "no"}</span>
      <span data-testid="auth">{isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="email">{user?.email ?? "none"}</span>
    </div>
  );
}

beforeEach(() => {
  state.lastCallback = null;
  unsubscribe.mockClear();
  signOutMock.mockClear();
  syncUserMutate.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AuthProvider", () => {
  it("starts in loading state, then resolves to unauthenticated when user is null", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId("loading").textContent).toBe("yes");

    await act(async () => { state.lastCallback?.(null); });

    expect(screen.getByTestId("loading").textContent).toBe("no");
    expect(screen.getByTestId("auth").textContent).toBe("no");
    expect(syncUserMutate).not.toHaveBeenCalled();
  });

  it("resolves to authenticated when a user is present and calls syncUser exactly once", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);

    await act(async () => {
      state.lastCallback?.({
        uid: "u1", email: "a@b.com", displayName: "Sample",
      } as unknown as FirebaseUser);
    });

    expect(screen.getByTestId("auth").textContent).toBe("yes");
    expect(screen.getByTestId("email").textContent).toBe("a@b.com");
    expect(syncUserMutate).toHaveBeenCalledTimes(1);
    expect(syncUserMutate).toHaveBeenCalledWith({ name: "Sample", email: "a@b.com" });
  });

  it("does not call syncUser again if the same user fires twice", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    const u = { uid: "u1", email: "a@b.com", displayName: "Sample" } as unknown as FirebaseUser;
    await act(async () => { state.lastCallback?.(u); });
    await act(async () => { state.lastCallback?.(u); });
    expect(syncUserMutate).toHaveBeenCalledTimes(1);
  });

  it("falls back to unauthenticated after a 5s safety timeout if onAuthStateChanged never fires", async () => {
    vi.useFakeTimers();
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId("loading").textContent).toBe("yes");

    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(screen.getByTestId("loading").textContent).toBe("no");
    expect(screen.getByTestId("auth").textContent).toBe("no");
  });

  it("logout calls firebase signOut", async () => {
    let captured: ReturnType<typeof useAuth> | null = null;
    function Capture() {
      captured = useAuth();
      return null;
    }
    render(<AuthProvider><Capture /></AuthProvider>);
    await act(async () => { state.lastCallback?.(null); });
    await act(async () => { await captured!.logout(); });
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
