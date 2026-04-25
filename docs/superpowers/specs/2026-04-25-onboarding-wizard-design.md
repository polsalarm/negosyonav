# Onboarding Wizard — Design Spec

**Date:** 2026-04-25
**Status:** Approved (brainstorming)
**Owner:** rodney@bscalelabs.com

## Problem

New users land on the empty `Profile` page (one large flat form, ~32 fields) with no guidance. Profile completion is the retention hook — saved profile = auto-fill for DTI, Barangay, BIR forms — but the all-at-once form invites abandonment. We need a guided onboarding wizard that fires automatically on first login, captures the minimum-viable profile fast, and offers an optional "polish" step to fill the rest.

## Goals

- Auto-fire on first login; gate the rest of the app until completed or explicitly skipped via the polish flow.
- Mobile-first (PWA target = phones), 360×640 baseline.
- Per-step server save → resume on any device.
- Premium feel: smooth liquid step transitions (Framer Motion), persistent loading/saving/error feedback, no jank.
- Zero new component libs. Reuse shadcn primitives + design tokens (no hex, no ad-hoc colors).

## Non-Goals

- AI/chat-based extraction inside the wizard. Existing `ai.extractProfile` on the flat Profile page stays untouched.
- Multi-LGU support. Manila City defaults remain hardcoded.
- Replacing the flat Profile page. Wizard complements it; flat page is the post-onboarding editor.

## Decisions Locked

| Topic | Choice |
|-------|--------|
| Trigger | Auto on first login (strict gate) |
| Scope | Tiered — required core (6 fields) + optional polish step |
| AI integration | None inside wizard (pure form steps) |
| Persistence | Save per step → server source of truth |
| Granularity | Hybrid — micro-step per required field, grouped polish step for optional |
| Gate | Strict — no exit from `/onboarding` until completed; skip exists only on polish step |

## Architecture

### Routing

- New route: `/onboarding` registered in `client/src/App.tsx` `Router`.
- Added to `BottomNav.hideOn` list so the bottom nav does not render.
- Full-viewport, no app header — wizard owns the screen.

### Gate

- New hook `useOnboardingGate()` (or extend `useAuth`) reads `auth.me` payload.
- If `isAuthenticated && me.onboardingCompletedAt == null && location !== "/onboarding"` → `navigate("/onboarding", { replace: true })`.
- If `me.onboardingCompletedAt != null && location === "/onboarding"` → `navigate("/", { replace: true })`.
- Gate must wait for `auth.me` to resolve before deciding (prevents flicker-redirect on hard refresh).
- Login page (`/login`) is exempt from the gate.

### Server changes

`server/db.ts` — extend `FirestoreUser`:

```ts
type FirestoreUser = {
  uid: string;
  email: string | null;
  name: string | null;
  role: "user" | "admin";
  onboardingCompletedAt: Timestamp | null;  // NEW
  onboardingStep: number | null;            // NEW (last reached step index, 0-based)
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

Helper additions:

- `setOnboardingStep(uid, step: number): Promise<void>`
- `markOnboardingComplete(uid): Promise<void>`

Both upsert the `users/{uid}` doc and `serverTimestamp()` `updatedAt`.

`server/routers.ts` — extend the `auth` sub-router:

- `auth.me` → response now includes `onboardingCompletedAt: number | null` (epoch ms) and `onboardingStep: number | null`.
- `auth.setOnboardingStep` — `protectedProcedure`, input `z.object({ step: z.number().int().min(0).max(20) })`.
- `auth.completeOnboarding` — `protectedProcedure`, no input. Calls `markOnboardingComplete(ctx.user.uid)`.

`auth.syncUser` (existing) initializes new docs with `onboardingCompletedAt: null, onboardingStep: 0`.

### Client page

`client/src/pages/Onboarding.tsx` — owns the wizard state machine. Reads:

- `profile.get` (existing) — to prefill on resume.
- `auth.me` (existing) — to read `onboardingStep` for resume cursor.

Mutations called per step:

- `profile.save` — partial input, the just-edited field(s).
- `auth.setOnboardingStep` — fire-and-forget after `profile.save` resolves.
- `auth.completeOnboarding` — only on the final "Done" CTA.

## Wizard Flow

7 screens of content + 1 done screen:

| Idx | Screen | Field(s) | Input type |
|-----|--------|----------|-----------|
| 0 | Welcome | — | "Set up sa 2 minutes" + Start CTA |
| 1 | First name | `firstName` | text, autoFocus |
| 2 | Last name | `lastName` | text |
| 3 | Mobile | `mobileNumber` | `type="tel" inputMode="tel"`, regex `/^09\d{9}$/`, hint `09XX XXX XXXX` |
| 4 | Business name | `businessName` | text + helper "Pwedeng palitan later" |
| 5 | Business type | `businessType` | 3 tap-cards: Sole Prop / Partnership / Corp |
| 6 | Business barangay | `bizBarangay` | text + "Manila City lang muna" hint |
| 7 | Polish (optional) | rest, grouped accordions: Personal extras · Home address · Biz details · Tax | collapsible; "Skip rest" + "Save & finish" both end the wizard |
| 8 | Done | — | summary + "Go to Roadmap" CTA |

### Validation

- Required text fields cannot advance while empty.
- `mobileNumber` must match `/^09\d{9}$/` (digits only, ignore spaces on input).
- `businessType` defaults to `sole_proprietorship` (already valid).
- Inline error renders below the input; `Next` stays enabled but reveals the error on tap until input is corrected.

### Resume

On mount:

1. Wait for `me` and `profile.get`.
2. Compute starting step:
   - If `onboardingCompletedAt != null` → gate already redirected, never get here.
   - Else use `me.onboardingStep ?? 0`.
   - Fallback: if `onboardingStep` write failed previously, derive from filled fields in `profile` (e.g., `firstName && lastName && mobileNumber && businessName && businessType && bizBarangay` → step 7).
3. Prefill all inputs from existing `profile` data.
4. Show "Welcome back! Continuing from Step N." banner that auto-dismisses after 3s if `onboardingStep > 0`.

### Skip behavior

- Required steps (1–6): **no skip**, only Back + Next.
- Polish step (7): "Skip rest" button completes wizard with whatever has been entered → calls `auth.completeOnboarding` → routes to `/`.
- Closing the tab mid-wizard: state is server-side; resumes on next login.

## UI / Visual Design

### Layout

- `min-h-dvh bg-warm-cream`, single column, `px-6` gutters, `max-w-screen-sm mx-auto`.
- Top: thin progress strip (`h-1 bg-muted`) with animated `bg-mango` fill, `font-mono text-[10px]` "Step N of 6" beside it.
- Center: large `font-display text-2xl text-earth-brown` question, helper `text-xs text-muted-foreground`, one input `h-12 text-base`.
- Bottom (sticky, `pb-[env(safe-area-inset-bottom)]`): paired `Back` (ghost) + `Next` (`bg-teal`) buttons, `min-h-12`, `rounded-xl`, `font-display`.
- 360×640 baseline. Verify no horizontal overflow, sticky CTAs do not cover the input on small viewports.

### Animations (Framer Motion)

- **Step transition:** `AnimatePresence mode="wait"` around the active step body.
  - Exit: `{ opacity: 0, y: -12, filter: "blur(4px)" }` over 220ms `ease-out`.
  - Enter: `{ opacity: 0→1, y: 12→0, filter: "blur(4px)→blur(0)" }` over 280ms `ease-out`, 60ms delay.
- **Progress bar:** `motion.div` width with spring `{ stiffness: 120, damping: 20 }`. Optional: tween color from mango → teal as you approach completion.
- **Tap-cards (business type):** `whileTap={{ scale: 0.97 }}`; selected state has `ring-2 ring-teal/40` + spring scale-in.
- **Done screen:** staggered fade-up of summary rows (`stagger: 0.05`), CTA single pulse on mount.
- **Reduced motion:** `useReducedMotion()` collapses transitions to instant opacity fades only.

### Per-step feedback

| Event | UI |
|-------|----|
| Tap Next, mutation pending | `Next` button → spinner + label "Saving…", disabled |
| Mutation success | Brief check flash on `Next` button (180ms), then step transition |
| Mutation error | Sonner toast `"Hindi na-save. Try ulit."`; step does NOT advance; input retains value |
| Resume detected | Top banner fades in/out: "Welcome back! Continuing from Step N." (3s) |
| Done | Sonner success toast + check icon + `navigator.vibrate?.(20)` haptic stub |

Per-step success toasts are intentionally suppressed — too noisy across 6 steps. The button check-flash is the success cue.

### Tokens & primitives

- Reuse shadcn `Button`, `Input`, `Label`, `Card`. No new lib.
- Colors via tokens only: `bg-warm-cream`, `bg-card`, `text-earth-brown`, `bg-teal`, `bg-mango`, `border-border`, `ring-ring`. No hex.
- Fonts: `font-display` for question + CTAs, `font-body` for inputs/helpers, `font-mono` for step counter.

## Edge Cases

- **`profile.save` succeeds, `setOnboardingStep` fails:** acceptable. On next mount, compute step from filled-fields heuristic.
- **Different device mid-wizard:** server-side state → resumes correctly.
- **User lands on `/onboarding` after completing:** gate redirects to `/`.
- **First sign-in race:** `auth.syncUser` must run before gate evaluates (existing pattern in `useAuth`); show splash spinner while `me` is loading.
- **`profile.get` null:** use `emptyProfile` defaults (Manila / Metro Manila prefilled), same as current Profile page.
- **Adversarial input** (e.g., 100-char first name): rely on existing `profile.save` Zod schema to bound input.

## Files Touched

| Path | Change |
|------|--------|
| `server/db.ts` | Extend `FirestoreUser`; add `setOnboardingStep`, `markOnboardingComplete` helpers |
| `server/routers.ts` | Extend `auth.me` payload; add `auth.setOnboardingStep`, `auth.completeOnboarding` |
| `client/src/App.tsx` | Register `/onboarding` route; add to `BottomNav.hideOn`; mount gate wrapper |
| `client/src/_core/hooks/useAuth.ts` (or new `useOnboardingGate.ts`) | Gate logic |
| `client/src/pages/Onboarding.tsx` | NEW — wizard page |
| `server/routers.test.ts` (or new test) | Cover `auth.setOnboardingStep` + `auth.completeOnboarding` |

## Test Plan

- Server unit: `auth.setOnboardingStep` writes to `users/{uid}`; `auth.completeOnboarding` sets `onboardingCompletedAt`. Use existing Firebase test context pattern.
- Client smoke (manual / Playwright): new user → lands on `/onboarding` → cannot navigate to `/` until complete → step-by-step save persists → close + reopen resumes at correct step → completion redirects to `/` and never re-fires.
- Mobile: verify 360×640 layout, sticky CTAs not covering inputs, no horizontal overflow, iOS no-zoom on inputs.

## Open Questions

None — all locked during brainstorming.
