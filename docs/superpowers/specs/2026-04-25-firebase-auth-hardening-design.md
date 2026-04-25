# Firebase Auth Hardening — Design

**Date:** 2026-04-25
**Status:** Approved
**Scope:** Full client + server hardening of existing Firebase auth.

## Context

Firebase auth and middleware are already wired:

- **Server:** `server/_core/firebaseAdmin.ts` (Admin SDK init), `server/_core/context.ts` (Bearer token → `ctx.user` w/ role from `users/{uid}`), `server/_core/trpc.ts` (`publicProcedure`, `protectedProcedure`, `adminProcedure`), `server/routers.ts:107` (`auth.me`, `auth.logout`, `auth.syncUser`).
- **Client:** `client/src/lib/firebase.ts` (`auth`, `db`, `firebaseApp`), `client/src/main.tsx:30-37` (tRPC link attaches Bearer token), `client/src/pages/Login.tsx` (email/pw sign-in/sign-up).

Gaps:

1. No client auth-state provider / `useAuth` hook.
2. No client-side route guards — all 11 routes accessible without login.
3. `Login.tsx` never calls `auth.syncUser` → `users/{uid}` never created → `role` never set.
4. No logout UI.
5. Most data procedures still `publicProcedure`.
6. No password reset.

## Decisions

| ID | Decision |
|----|----------|
| A1 | All routes require login except `/login` |
| B1 | Flip ALL procs to `protectedProcedure` except `auth.me`, `auth.logout`, `system.*` |
| C1 | Manual admin bootstrap — edit Firestore doc in console |
| D1 | Call `syncUser` once after every sign-in (idempotent upsert) |
| E1 | Logout button on Profile page only |
| F1 | "Forgot password?" link on Login → `sendPasswordResetEmail` |
| G2 | No email verification gate |

## Architecture

`AuthProvider` at app root owns Firebase auth state. `useAuth()` exposes `{ user, loading, signOut }`. `<RequireAuth>` wrapper redirects to `/login` when no user. Server procs flip to `protectedProcedure` per B1.

## Components

### 1. `client/src/contexts/AuthContext.tsx` (new)

- Subscribe `onAuthStateChanged(auth, ...)` once on mount.
- State: `user: User | null`, `loading: boolean` (true until first callback fires).
- On sign-in transition (null → User): call `trpc.auth.syncUser.mutate({ name, email })` (idempotent).
- Expose `signOut()` wrapping `firebaseSignOut(auth)`.
- Export `useAuth()` hook.
- 5s safety timeout: if `onAuthStateChanged` never fires, set `loading=false`, `user=null`.

### 2. `client/src/components/RequireAuth.tsx` (new)

- Reads `useAuth()`.
- `loading` → spinner.
- No user → `navigate("/login")` (wouter `useLocation`).
- Else render children.

### 3. `client/src/App.tsx` (edit)

- Wrap `<Router/>` in `<AuthProvider>`.
- Split routes: `/login` and `/404` outside `<RequireAuth>`. All others inside.
  ```
  <Switch>
    <Route path="/login" component={Login} />
    <Route path="/404" component={NotFound} />
    <Route>
      <RequireAuth>
        <Switch>
          <Route path="/" component={Home} />
          ...rest
        </Switch>
      </RequireAuth>
    </Route>
  </Switch>
  ```

### 4. `client/src/main.tsx` (no change)

Existing tRPC link already pulls fresh `getIdToken()` per call. Untouched.

### 5. `client/src/pages/Login.tsx` (edit)

- Add "Forgot password?" link → `sendPasswordResetEmail(auth, email)`, toast result.
- Add `useEffect`: `if (user) navigate("/")` (already-signed-in users redirected).
- Drop manual `navigate("/")` post sign-in — `RequireAuth` + effect handles it.
- Drop `syncUser` concern — `AuthProvider` handles.

### 6. `client/src/pages/Profile.tsx` (edit)

- Add "Sign out" button → `useAuth().signOut()` → `navigate("/login")`.

### 7. `server/routers.ts` (edit)

Flip to `protectedProcedure`:

- `ai.chat`, `ai.extractProfile`, `ai.formHelp`
- `profile.get`, `profile.save` (verify current state)
- `grants.check`
- `community.list`, `community.create`, `community.vote`, `community.myVotes`
- `forms.generatePdf`
- `feedback.submit`

Keep public: `auth.me`, `auth.logout`, `system.*`.

## Data flow

1. App mount → `AuthProvider` → `onAuthStateChanged` fires.
2. `loading=false` → `RequireAuth` decides render-or-redirect.
3. tRPC requests grab fresh `getIdToken()` per call (Firebase caches, refreshes ~1h).
4. Server `createContext` verifies token → hydrates `ctx.user` → `protectedProcedure` enforces.

## Error handling

- `verifyIdToken` fail → `ctx.user = null` → `protectedProcedure` throws `UNAUTHORIZED` → existing client error UI.
- `onAuthStateChanged` never fires → 5s timeout → bounce to login.
- Sign-in network fail → existing `Login.tsx` error map.
- `syncUser` post-signin fail → silent retry once, swallow second fail (don't block app).

## Testing

- **Unit (vitest + RTL):**
  - `RequireAuth` — children when user, redirect when null, spinner when loading.
  - `AuthProvider` — fires `syncUser` on null → User transition.
- **Server (existing pattern):**
  - `appRouter.createCaller({ user: null, ... }).profile.get()` → expect `UNAUTHORIZED` throw.
  - Repeat for one proc per flipped sub-router.

## Out of scope

- Email verification gate
- Admin promotion code (manual Firestore edit per C1)
- OAuth providers (Google/Facebook sign-in)
- Multi-device session revoke
