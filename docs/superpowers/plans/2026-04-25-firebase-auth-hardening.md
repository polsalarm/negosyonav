# Firebase Auth Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing partial Firebase auth setup: centralize auth state in a single React context, add a route guard that gates every page except `/login`, wire `syncUser` once per sign-in, add Sign Out + Forgot Password UX, and flip every data tRPC procedure to `protectedProcedure`. Mobile-first throughout.

**Architecture:** A single `<AuthProvider>` at the app root subscribes to `onAuthStateChanged` exactly once and exposes `{ user, loading, isAuthenticated, logout }` via `useAuth()`. A `<RequireAuth>` wrapper reads the context, shows a spinner while loading, redirects to `/login` when no user, otherwise renders children. The legacy per-component hook at `client/src/_core/hooks/useAuth.ts` is replaced by the context-backed version (same return shape, so callers like `Profile.tsx` continue to work). On the server, every data procedure flips from `publicProcedure` to `protectedProcedure`; admin role is set manually in the Firestore console (no code path).

**Tech Stack:** React 19, wouter, Firebase Web SDK (`firebase/auth`), tRPC v11, vitest, React Testing Library (new dev dep).

**Spec:** `docs/superpowers/specs/2026-04-25-firebase-auth-hardening-design.md`

**Mobile-first + design-system constraints (CLAUDE.md, mandatory):**
- Tap targets ≥44 px — use `min-h-11` (or existing `h-11`/`py-3`/`py-4` patterns).
- Inputs `text-base` (16 px) min — prevents iOS zoom on focus.
- Default styles target mobile; only `sm:`/`md:`/`lg:` to enhance up. Never the reverse.
- No hover-only affordances; pair `hover:` with `active:` / `focus:` states.
- Use shadcn primitives in `client/src/components/ui/` (`Button`, etc.) — don't roll your own.
- Brand palette is allowed (`bg-teal`, `bg-warm-cream`, `text-earth-brown`, `bg-mango`, `bg-jeepney-red`) since it's part of the documented system; semantic tokens (`bg-background`, `bg-primary`, `text-foreground`, `border-border`) are preferred where they read naturally. No raw hex, no ad-hoc colors.
- Fonts via existing `font-[var(--font-display)]` / `font-[var(--font-body)]` / `font-[var(--font-mono)]` patterns.
- Radius via `rounded-sm|md|lg|xl` (or `rounded-2xl` where existing pages use it). No `rounded-[...]` literals.
- Use `cn` from `@/lib/utils` when merging conditional classes.
- Spinners: `Loader2` from `lucide-react` + `animate-spin` (existing `Profile.tsx:221` pattern).
- Full-width buttons inside container max-widths — never fixed-width.
- Avoid layout shift: reserve spinner box same size as content it replaces.
- Dark-mode: keep classes token-based so the `.dark` variant keeps working.

---

## File Structure

### New files
- `client/src/contexts/AuthContext.tsx` — provider + `useAuth` hook (replaces legacy hook).
- `client/src/components/RequireAuth.tsx` — route guard wrapper.
- `client/src/contexts/AuthContext.test.tsx` — provider unit tests.
- `client/src/components/RequireAuth.test.tsx` — guard unit tests.
- `client/test/setup.ts` — vitest jsdom setup (RTL).

### Modified files
- `client/src/_core/hooks/useAuth.ts` — turn into a thin re-export of the context hook (back-compat for `Profile.tsx`).
- `client/src/App.tsx` — wrap with `<AuthProvider>`, split routes into public + protected.
- `client/src/pages/Login.tsx` — add Forgot Password link; redirect when already signed in.
- `client/src/pages/Profile.tsx` — remove inline "sign in to save" gate (now handled by `RequireAuth`); add Sign Out button.
- `server/routers.ts` — flip data procedures to `protectedProcedure`.
- `server/auth.logout.test.ts` — rewrite for `FirebaseContextUser` shape (current tests reference removed legacy fields).
- `server/features.test.ts` — same migration.
- `server/routers.test.ts` — same migration + cover protected/unauthorized paths.
- `vitest.config.ts` — add a second `projects` entry (or split file) for client tests under jsdom; keep server tests under node.
- `package.json` — add `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` as devDeps.

### Untouched
- `server/_core/firebaseAdmin.ts` — already correct.
- `server/_core/context.ts` — already correct.
- `server/_core/trpc.ts` — already correct.
- `client/src/main.tsx` — tRPC link already pulls a fresh ID token per request.
- `client/src/lib/firebase.ts` — already correct.

### Heads-up about pre-existing test rot
`server/auth.logout.test.ts`, `server/features.test.ts`, and `server/routers.test.ts` were written against the pre-Firebase `TrpcContext.user` shape (`id`, `openId`, `loginMethod`, …). They will not typecheck right now. CLAUDE.md already calls this out. Tasks 8–10 fix them as part of this plan.

---

## Chunk 1: Test plumbing + AuthContext

### Task 1: Add client testing dependencies and split vitest config

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Create: `client/test/setup.ts`

- [ ] **Step 1: Add devDependencies**

Run:
```bash
pnpm add -D @testing-library/react @testing-library/jest-dom jsdom
```

Expected: pnpm prints "Done in …", lockfile updated, three packages added under `devDependencies` in `package.json`.

- [ ] **Step 2: Create the jsdom setup file**

Create `client/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Update `vitest.config.ts` to run server (node) and client (jsdom) tests in one run**

Replace the file with:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

const alias = {
  "@": path.resolve(templateRoot, "client", "src"),
  "@shared": path.resolve(templateRoot, "shared"),
  "@assets": path.resolve(templateRoot, "attached_assets"),
};

export default defineConfig({
  root: templateRoot,
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "client",
          environment: "jsdom",
          include: ["client/**/*.test.ts", "client/**/*.test.tsx"],
          setupFiles: ["client/test/setup.ts"],
          globals: false,
        },
      },
    ],
  },
});
```

- [ ] **Step 4: Confirm both projects discover zero (or only existing) tests cleanly**

Run: `pnpm test`
Expected: vitest prints two project rows (`server`, `client`); existing server tests run as before; client project finds 0 tests; overall exit code is whatever the server tests already produce. (Existing server tests may still fail to typecheck — fine, fixed in Chunk 4.)

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts client/test/setup.ts
git commit -m "test: split vitest into server (node) + client (jsdom) projects"
```

---

### Task 2: Write failing AuthContext tests

**Files:**
- Create: `client/src/contexts/AuthContext.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User as FirebaseUser } from "firebase/auth";

type AuthCallback = (u: FirebaseUser | null) => void;
let lastCallback: AuthCallback | null = null;
const unsubscribe = vi.fn();
const signOutMock = vi.fn(async () => {});

vi.mock("firebase/auth", async () => {
  const actual = await vi.importActual<typeof import("firebase/auth")>("firebase/auth");
  return {
    ...actual,
    onAuthStateChanged: (_auth: unknown, cb: AuthCallback) => {
      lastCallback = cb;
      return unsubscribe;
    },
    signOut: signOutMock,
  };
});

vi.mock("@/lib/firebase", () => ({
  auth: { __mock: true },
  db: {},
  firebaseApp: {},
}));

const syncUserMutate = vi.fn();
vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      syncUser: {
        useMutation: () => ({ mutate: syncUserMutate }),
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
  lastCallback = null;
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

    await act(async () => { lastCallback?.(null); });

    expect(screen.getByTestId("loading").textContent).toBe("no");
    expect(screen.getByTestId("auth").textContent).toBe("no");
    expect(syncUserMutate).not.toHaveBeenCalled();
  });

  it("resolves to authenticated when a user is present and calls syncUser exactly once", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);

    await act(async () => {
      lastCallback?.({
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
    await act(async () => { lastCallback?.(u); });
    await act(async () => { lastCallback?.(u); });
    expect(syncUserMutate).toHaveBeenCalledTimes(1);
  });

  it("falls back to unauthenticated after a 5s safety timeout if onAuthStateChanged never fires", async () => {
    vi.useFakeTimers();
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId("loading").textContent).toBe("yes");

    await act(async () => { vi.advanceTimersByTime(5000); });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("no");
      expect(screen.getByTestId("auth").textContent).toBe("no");
    });
  });

  it("logout calls firebase signOut", async () => {
    let captured: ReturnType<typeof useAuth> | null = null;
    function Capture() {
      captured = useAuth();
      return null;
    }
    render(<AuthProvider><Capture /></AuthProvider>);
    await act(async () => { lastCallback?.(null); });
    await act(async () => { await captured!.logout(); });
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (file does not exist yet)**

Run: `pnpm vitest run client/src/contexts/AuthContext.test.tsx`
Expected: FAIL — "Cannot find module './AuthContext'" (or equivalent).

- [ ] **Step 3: Commit the failing test**

```bash
git add client/src/contexts/AuthContext.test.tsx
git commit -m "test(auth): add failing AuthProvider context tests"
```

---

### Task 3: Implement AuthContext

**Files:**
- Create: `client/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Write the provider**

```tsx
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
```

- [ ] **Step 2: Run the tests to confirm they pass**

Run: `pnpm vitest run client/src/contexts/AuthContext.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: No errors related to `AuthContext.tsx`. (Pre-existing server test errors may remain — addressed in Chunk 4.)

- [ ] **Step 4: Commit**

```bash
git add client/src/contexts/AuthContext.tsx
git commit -m "feat(auth): add AuthProvider with single onAuthStateChanged subscription"
```

---

## Chunk 2: RequireAuth + App wiring

### Task 4: Write failing RequireAuth tests

**Files:**
- Create: `client/src/components/RequireAuth.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/profile", navigateMock],
  };
});

const useAuthMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

import RequireAuth from "./RequireAuth";

describe("RequireAuth", () => {
  it("renders a spinner while loading", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true, isAuthenticated: false });
    render(<RequireAuth><div>secret</div></RequireAuth>);
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    navigateMock.mockClear();
    useAuthMock.mockReturnValue({ user: null, loading: false, isAuthenticated: false });
    render(<RequireAuth><div>secret</div></RequireAuth>);
    expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    useAuthMock.mockReturnValue({
      user: { uid: "u1" },
      loading: false,
      isAuthenticated: true,
    });
    render(<RequireAuth><div>secret</div></RequireAuth>);
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run client/src/components/RequireAuth.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Commit failing test**

```bash
git add client/src/components/RequireAuth.test.tsx
git commit -m "test(auth): add failing RequireAuth tests"
```

---

### Task 5: Implement RequireAuth

**Files:**
- Create: `client/src/components/RequireAuth.tsx`

- [ ] **Step 1: Write the component**

Mobile-first: full-screen spinner uses the same `bg-warm-cream` + centered `Loader2` pattern as `Profile.tsx:218-223`. Tap targets unaffected (no buttons here).

```tsx
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="min-h-screen bg-warm-cream flex items-center justify-center"
      >
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

- [ ] **Step 2: Run the tests**

Run: `pnpm vitest run client/src/components/RequireAuth.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RequireAuth.tsx
git commit -m "feat(auth): add RequireAuth route guard with spinner + redirect"
```

---

### Task 6: Replace legacy useAuth hook with re-export, wire AuthProvider into App

**Files:**
- Modify: `client/src/_core/hooks/useAuth.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Replace the legacy hook contents with a re-export**

This keeps existing imports in `Profile.tsx` working (`@/_core/hooks/useAuth`) without churning callers. Overwrite `client/src/_core/hooks/useAuth.ts` with:

```ts
export { useAuth } from "@/contexts/AuthContext";
```

- [ ] **Step 2: Wrap the app in `<AuthProvider>` and gate all routes except `/login` and `/404`**

Edit `client/src/App.tsx`. Change the imports block to add:

```tsx
import { AuthProvider } from "./contexts/AuthContext";
import RequireAuth from "./components/RequireAuth";
```

Replace the `Router()` function with:

```tsx
function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/404" component={NotFound} />
      <Route>
        <RequireAuth>
          <Switch>
            <Route path={"/"} component={Home} />
            <Route path={"/roadmap"} component={Roadmap} />
            <Route path={"/hub"} component={Hub} />
            <Route path={"/profile"} component={Profile} />
            <Route path={"/forms"} component={Forms} />
            <Route path={"/grants"} component={Grants} />
            <Route path={"/places"} component={Places} />
            <Route path={"/calendar"} component={Calendar} />
            <Route path={"/planner"} component={Planner} />
            <Route component={NotFound} />
          </Switch>
        </RequireAuth>
      </Route>
    </Switch>
  );
}
```

Wrap the app body in `<AuthProvider>` (inside `ThemeProvider`):

```tsx
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <BottomNav />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: no errors related to `App.tsx` / `useAuth.ts` / `Profile.tsx`. (Pre-existing server test errors still allowed.)

- [ ] **Step 4: Run client tests**

Run: `pnpm vitest run client/`
Expected: all passing (8 total: 5 AuthContext + 3 RequireAuth).

- [ ] **Step 5: Manual smoke test (mobile viewport)**

Run `pnpm dev`. In the browser devtools, switch to a mobile viewport (e.g. iPhone 12, 390×844). Verify:
- Logged out → visiting `/`, `/profile`, `/roadmap` etc. all redirect to `/login`.
- `/login` itself renders.
- After signing in, the original target URL is not preserved (acceptable — out of scope), but app lands on `/` or wherever wouter sends you.
- BottomNav stays visible only on its existing routes.

- [ ] **Step 6: Commit**

```bash
git add client/src/_core/hooks/useAuth.ts client/src/App.tsx
git commit -m "feat(auth): wrap app in AuthProvider and gate routes with RequireAuth"
```

---

## Chunk 3: Login UX + Profile sign-out

### Task 7: Login — Forgot Password + redirect-when-signed-in

**Files:**
- Modify: `client/src/pages/Login.tsx`

- [ ] **Step 1: Add the imports and forgot-password handler**

At the top of `client/src/pages/Login.tsx`, replace the firebase/auth import with one that includes `sendPasswordResetEmail`:

```tsx
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
```

Add this import alongside the others:

```tsx
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
```

(Move `useEffect` into the existing `react` import if you prefer.)

- [ ] **Step 2: Inside the `Login` component, redirect signed-in users away from `/login`**

Right after `const [loading, setLoading] = useState(false);`, add:

```tsx
const { isAuthenticated, loading: authLoading } = useAuth();

useEffect(() => {
  if (!authLoading && isAuthenticated) {
    navigate("/", { replace: true });
  }
}, [authLoading, isAuthenticated, navigate]);
```

Remove the existing `navigate("/")` call inside `handleSubmit` (the one that fires after sign-in/sign-up succeeds) — the effect above handles redirect now.

- [ ] **Step 3: Add Forgot Password handler**

Above `handleSubmit`, add:

```tsx
const handleForgotPassword = async () => {
  if (!email) {
    toast.error("Mag-type muna ng email para makapag-reset.");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    toast.success("Reset link sent! Check your email.");
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    const messages: Record<string, string> = {
      "auth/invalid-email": "Invalid ang email format.",
      "auth/user-not-found": "Walang account sa email na 'yan.",
      "auth/too-many-requests": "Too many attempts. Subukan ulit mamaya.",
    };
    toast.error(messages[code] ?? "May error. Subukan ulit.");
  }
};
```

- [ ] **Step 4: Render the Forgot Password link below the password field, only in sign-in mode**

Mobile-first: full-width text button with `py-2` (≥40 px tap height inside parent `space-y-4`), placed right under the password input, before the submit button.

Inside the form, between the password `<div>` and the `<Button type="submit">`, insert:

```tsx
{mode === "signin" && (
  <button
    type="button"
    onClick={handleForgotPassword}
    className="block w-full text-right text-xs text-teal hover:text-teal/80 active:text-teal/70 min-h-11 px-2 font-[var(--font-mono)]"
  >
    Forgot password?
  </button>
)}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm check`
Expected: no errors in `Login.tsx`.

- [ ] **Step 6: Manual mobile smoke**

Run `pnpm dev` in mobile viewport:
- Type a valid email, tap "Forgot password?" → toast "Reset link sent!".
- Type an invalid email, tap → toast "Invalid ang email format."
- Sign in → app redirects off `/login`.
- Visit `/login` while signed in → instantly redirects to `/`.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Login.tsx
git commit -m "feat(login): add forgot-password link and redirect signed-in users"
```

---

### Task 8: Profile — remove inline gate, add Sign Out

**Files:**
- Modify: `client/src/pages/Profile.tsx`

Note: `RequireAuth` now guards `/profile`, so the inline "Sign in to save your profile" block at lines 226-236 is dead code. Remove it. Also drop the `getLoginUrl` import.

- [ ] **Step 1: Drop the dead sign-in block and unused imports**

In `client/src/pages/Profile.tsx`:
- Remove the import `import { getLoginUrl } from "@/const";` (line 11).
- Remove the entire `if (!isAuthenticated) { ... }` block (lines 226-236).
- Keep the `if (authLoading) { ... }` spinner block — it still serves the brief moment before context resolves.

- [ ] **Step 2: Pull `logout` from `useAuth` and add the Sign Out button**

Change the destructure on line 93 from:
```tsx
const { isAuthenticated, loading: authLoading } = useAuth();
```
to:
```tsx
const { isAuthenticated, loading: authLoading, logout } = useAuth();
```

Add a handler near the other handlers (e.g. just above `handleSave`):

```tsx
const handleSignOut = async () => {
  await logout();
  navigate("/login", { replace: true });
};
```

Add `LogOut` to the existing `lucide-react` import on line 13-15:
```tsx
import {
  ArrowLeft, User, Building2, MapPin, FileText, Save, CheckCircle2, Loader2, Sparkles, MessageCircle, LogOut,
} from "lucide-react";
```

- [ ] **Step 3: Place the Sign Out button**

Mobile-first: full-width muted-outline button at the very bottom of the page, after the existing Save button motion block. Tap target ≥44 px via `min-h-11`. Place before the closing `</div>` of `container max-w-2xl`:

```tsx
        {/* Sign out */}
        <div className="pt-2 pb-12">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full rounded-xl min-h-11 font-[var(--font-display)] text-sm border-border text-earth-brown hover:bg-muted active:bg-muted"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: no errors in `Profile.tsx`.

- [ ] **Step 5: Manual mobile smoke**

Run `pnpm dev`:
- Sign in, navigate to `/profile`. Scroll to the bottom — Sign Out button is visible above the bottom nav (`pb-12` clears the 64 px nav).
- Tap Sign Out → redirected to `/login`.
- Try to navigate back to `/profile` directly → redirected to `/login`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Profile.tsx
git commit -m "feat(profile): replace inline gate with Sign Out button"
```

---

## Chunk 4: Server hardening + test migration

### Task 9: Flip data procedures to `protectedProcedure`

**Files:**
- Modify: `server/routers.ts`

Decision per spec B1: keep `auth.me`, `auth.logout`, `system.*` public; everything else `protectedProcedure`.

- [ ] **Step 1: Audit current `publicProcedure` usage in `server/routers.ts`**

Run: `grep -n "publicProcedure" server/routers.ts`
Expected output (line numbers approximate):
```
108:    me: publicProcedure.query(...)
110:    logout: publicProcedure.mutation(...)
135:    chat: publicProcedure
153:    extractProfile: publicProcedure
179:    formHelp: publicProcedure
276:    check: publicProcedure
343:    list: publicProcedure
417:    submit: publicProcedure
```

Keep `auth.me` and `auth.logout` public. Flip the other 6.

- [ ] **Step 2: Edit `ai.chat`, `ai.extractProfile`, `ai.formHelp`**

Change `publicProcedure` → `protectedProcedure` on each. No other change needed; their bodies don't use `ctx.user` but the gate still applies.

- [ ] **Step 3: Edit `grants.check`, `community.list`, `feedback.submit`**

Same swap. For `feedback.submit` specifically, change:
```ts
userId: ctx.user?.uid,
```
to:
```ts
userId: ctx.user.uid,
```
(the `?.` was needed for the public version; under `protectedProcedure`, `ctx.user` is guaranteed non-null).

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: no `server/routers.ts` errors.

- [ ] **Step 5: Don't commit yet** — server tests need to be updated in the next two tasks first to avoid leaving the tree red. Continue to Task 10.

---

### Task 10: Rewrite `server/auth.logout.test.ts` for the Firebase context shape

**Files:**
- Modify: `server/auth.logout.test.ts`

The current file builds a context with the legacy `id/openId/loginMethod/...` shape and asserts on `clearedCookies` — but `auth.logout` no longer touches cookies (the comment in `routers.ts:111-113` says so). Rewrite to assert the documented behavior.

- [ ] **Step 1: Replace the file contents**

```ts
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeCtx(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("returns success without touching cookies (Firebase signOut is client-side)", async () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(await caller.auth.logout()).toEqual({ success: true });
  });

  it("returns success even when authenticated", async () => {
    const caller = appRouter.createCaller(makeCtx({
      uid: "u1",
      email: "a@b.com",
      name: "A",
      role: "user",
    }));
    expect(await caller.auth.logout()).toEqual({ success: true });
  });
});
```

- [ ] **Step 2: Run the file**

Run: `pnpm vitest run server/auth.logout.test.ts`
Expected: 2 tests pass.

---

### Task 11: Migrate `server/features.test.ts` and `server/routers.test.ts`

Both files use the legacy `TrpcContext.user` shape and treat data procs as public. After Task 9, the public-context calls into flipped procs will throw `UNAUTHORIZED`. Update fixtures to the Firebase shape and add `UNAUTHORIZED` assertions for representative procs.

**Files:**
- Modify: `server/features.test.ts`
- Modify: `server/routers.test.ts`

- [ ] **Step 1: Replace the `createAuthContext` / `createPublicContext` helpers in both files with the Firebase shape**

In both files, replace the helper definitions with:

```ts
function createAuthContext(): TrpcContext {
  return {
    user: { uid: "test-user-001", email: "test@example.com", name: "Test Negosyante", role: "user" },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: { uid: "admin-001", email: "admin@example.com", name: "Admin", role: "admin" },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}
```

(`createAdminContext` only needed if you reference admin procedures — none currently exist beyond defining `adminProcedure`, so feel free to omit if unused.)

- [ ] **Step 2: Update existing test bodies that called procs with `createPublicContext()`**

Anywhere a previously-public proc (`grants.check`, `ai.chat`, `community.list`, `feedback.submit`, `ai.extractProfile`, `ai.formHelp`) is called, swap `createPublicContext()` for `createAuthContext()`. Existing assertions stay.

- [ ] **Step 3: Add explicit unauthorized-rejection tests**

In `server/routers.test.ts`, add a new `describe`:

```ts
import { TRPCError } from "@trpc/server";
import { UNAUTHED_ERR_MSG } from "@shared/const";

describe("Procedure auth gates", () => {
  it.each([
    ["ai.chat", (c: ReturnType<typeof appRouter.createCaller>) =>
      c.ai.chat({ messages: [{ role: "user", content: "hi" }] })],
    ["grants.check", (c: ReturnType<typeof appRouter.createCaller>) =>
      c.grants.check({ capitalization: 1000 })],
    ["community.list", (c: ReturnType<typeof appRouter.createCaller>) =>
      c.community.list()],
    ["feedback.submit", (c: ReturnType<typeof appRouter.createCaller>) =>
      c.feedback.submit({ feedbackType: "general", message: "hello world" })],
  ])("%s rejects unauthenticated callers", async (_name, call) => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(call(caller)).rejects.toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG } as Partial<TRPCError>),
    );
  });

  it("auth.me stays public", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.auth.me()).resolves.toBeNull();
  });
});
```

- [ ] **Step 4: Run all server tests**

Run: `pnpm vitest run server/`
Expected: all server tests pass. If any pre-existing test relied on `loginMethod` / `openId` literals in assertions, fix them to use `uid` / `email` / `name` / `role`.

- [ ] **Step 5: Run the entire test suite (server + client)**

Run: `pnpm test`
Expected: green across both projects.

- [ ] **Step 6: Typecheck**

Run: `pnpm check`
Expected: clean.

- [ ] **Step 7: Commit Tasks 9–11 together** (server changes plus test migration are one logical unit)

```bash
git add server/routers.ts server/auth.logout.test.ts server/features.test.ts server/routers.test.ts
git commit -m "feat(server): require auth on all data procedures + migrate tests to Firebase context"
```

---

## Chunk 5: End-to-end verification

### Task 12: Manual full-flow test on a mobile viewport

**Files:** none (manual)

- [ ] **Step 1: Boot the dev server**

Run: `pnpm dev`
Expected: server listens on `http://localhost:3000` (or +N if busy).

- [ ] **Step 2: In a clean browser profile (or incognito) at iPhone-12 viewport (390×844), exercise this flow**

Tick each as you go:

- [ ] Visit `/` — redirects to `/login`.
- [ ] Visit `/profile` — redirects to `/login`.
- [ ] Sign up with a fresh email; confirm toast "Account created!"; lands on `/`.
- [ ] Open Firestore console → `users/{uid}` doc exists with `name`, `email`, `loginMethod: "email"`, `role: "user"`.
- [ ] Navigate `/profile` via bottom nav — page renders, no inline sign-in block visible.
- [ ] Save the profile — toast "Profile saved!" — `profiles/{uid}` doc appears in Firestore.
- [ ] Tap Sign Out at the bottom of `/profile` — redirected to `/login`.
- [ ] Try to navigate back via browser back — redirected to `/login` again.
- [ ] Sign in again with same credentials → returns to `/`. Confirm in DevTools Network tab that exactly one `auth.syncUser` request is sent (not multiple).
- [ ] At `/login`, type a registered email and tap "Forgot password?" — toast "Reset link sent!" and an email arrives.
- [ ] Sign out, then directly call `/api/trpc/grants.check` from the browser console (`fetch("/api/trpc/grants.check?...")`) without an Authorization header — expect HTTP 401-equivalent / `UNAUTHORIZED` JSON error.

If any step fails, file follow-up tasks; otherwise proceed.

- [ ] **Step 3: Final repo health**

```bash
pnpm check && pnpm test
```
Expected: both green.

- [ ] **Step 4: Final commit (only if any cosmetic fixes were needed during smoke)**

If everything was clean above, no commit. Otherwise:

```bash
git add -A
git commit -m "chore: post-smoke fixups"
```

---

## Out of scope (per spec)

- Email verification gate
- Admin promotion code path (manual Firestore edit)
- OAuth providers (Google / Facebook sign-in)
- Multi-device session revoke
- Preserving the originally-requested URL across the login redirect

These are explicitly deferred and should not be added without a new spec round.
