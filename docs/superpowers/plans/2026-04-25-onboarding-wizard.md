# Onboarding Wizard Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auto-firing, full-screen onboarding wizard that captures the 6 required profile fields one at a time, offers a grouped polish step for the rest, persists per-step to Firestore so users resume on any device, and gates the rest of the app until completed or skipped.

**Spec:** `docs/superpowers/specs/2026-04-25-onboarding-wizard-design.md`

**Tech stack:** React 19, wouter, framer-motion (already in deps), shadcn/ui, tRPC v11, Firestore Admin SDK.

**Mobile-first + design-system constraints (CLAUDE.md, mandatory):**
- 360×640 baseline. Tap targets ≥44px (`min-h-11`/`h-12`). Inputs `text-base` (no iOS zoom).
- Sticky bottom CTAs use `pb-[env(safe-area-inset-bottom)]`.
- Tokens only: `bg-warm-cream`, `bg-card`, `text-earth-brown`, `bg-teal`, `bg-mango`, `border-border`. No hex.
- Reuse shadcn `Button`, `Input`, `Label`, `Card`. No new lib.
- Fonts: `font-[var(--font-display)]`, `font-[var(--font-body)]`, `font-[var(--font-mono)]`.
- Animations via Framer Motion + `useReducedMotion()` fallback.

---

## File Structure

### New files
- `client/src/pages/Onboarding.tsx` — wizard page (state machine + steps).
- `client/src/components/OnboardingGate.tsx` — gate wrapper that redirects new users.

### Modified files
- `server/db.ts` — extend `FirestoreUser`, add helpers, prefill onboarding fields in `upsertUser`.
- `server/routers.ts` — extend `auth.me` payload, add `auth.setOnboardingStep` + `auth.completeOnboarding`.
- `client/src/App.tsx` — register `/onboarding` route, mount `<OnboardingGate>` inside `<RequireAuth>`, add to `BottomNav.hideOn`.

---

## Steps

### 1. Server: extend `FirestoreUser` + helpers
- [ ] In `server/db.ts`, extend `FirestoreUser` type with `onboardingCompletedAt: Date | null` and `onboardingStep: number | null`.
- [ ] Update `upsertUser`: when creating a new doc, set `onboardingCompletedAt: null, onboardingStep: 0`. Do not overwrite when updating.
- [ ] Update `getUserByUid` to include the two new fields, with `null` fallbacks (Firestore Timestamp → Date for completedAt, raw number for step).
- [ ] Add `setOnboardingStep(uid: string, step: number): Promise<void>` — `users/{uid}.update({ onboardingStep: step, updatedAt: serverTimestamp() })`.
- [ ] Add `markOnboardingComplete(uid: string): Promise<void>` — sets `onboardingCompletedAt: serverTimestamp()` and `updatedAt`.

### 2. Server: tRPC procs
- [ ] In `server/routers.ts`, replace `auth.me` query body so the response is `{ ...ctx.user, onboardingCompletedAt: number | null, onboardingStep: number | null }`. Read from `getUserByUid(ctx.user.uid)` when `ctx.user` is present; convert `Date` → epoch ms for client serialization. Return `null` when `ctx.user == null`.
- [ ] Add `auth.setOnboardingStep` — `protectedProcedure`, input `z.object({ step: z.number().int().min(0).max(20) })`, calls `setOnboardingStep(ctx.user.uid, input.step)`, returns `{ success: true }`.
- [ ] Add `auth.completeOnboarding` — `protectedProcedure`, no input, calls `markOnboardingComplete(ctx.user.uid)`, returns `{ success: true }`.
- [ ] Import `setOnboardingStep`, `markOnboardingComplete`, `getUserByUid` from `./db`.

### 3. Client: gate component
- [ ] Create `client/src/components/OnboardingGate.tsx`. Reads `trpc.auth.me.useQuery()`. While loading → render same spinner UI as `RequireAuth`. If `me?.onboardingCompletedAt == null && location !== "/onboarding"` → `navigate("/onboarding", { replace: true })`. If `me?.onboardingCompletedAt != null && location === "/onboarding"` → `navigate("/", { replace: true })`. Render `children` once any redirect settles.
- [ ] Login page is already outside `<RequireAuth>`, so it is automatically exempt.

### 4. Client: register route + nav hiding
- [ ] In `App.tsx`, import `Onboarding` page and `OnboardingGate`.
- [ ] Wrap the protected `<Switch>` body inside `<OnboardingGate>` (between `<RequireAuth>` and the inner `<Switch>`).
- [ ] Add `<Route path="/onboarding" component={Onboarding} />` as the first inner route.
- [ ] Add `/onboarding` to `BottomNav.hideOn`.

### 5. Client: Onboarding page
- [ ] Create `client/src/pages/Onboarding.tsx`.
- [ ] State: `currentStep: number` (0=welcome, 1–6=required micro-steps, 7=polish, 8=done), `formData: ProfileData` (reuse the shape from `Profile.tsx`'s `ProfileData` interface — extract to shared local type or inline).
- [ ] On mount: call `trpc.auth.me`, `trpc.profile.get`. When both resolve: prefill `formData`, set `currentStep` from `me.onboardingStep ?? 0`. If step 0 but profile already has core fields filled (resume after failed step write), derive max-reached step from filled-fields heuristic (`firstName→1, lastName→2, mobileNumber→3, businessName→4, businessType→5, bizBarangay→6, then 7`).
- [ ] Show "Welcome back! Continuing from Step N." top banner via Framer Motion (fade-in, auto-dismiss after 3s) only when initial step > 0.
- [ ] Render layout: `min-h-dvh bg-warm-cream`, single column, `max-w-screen-sm mx-auto px-6`.
- [ ] Top progress strip: `h-1 bg-muted rounded-full` with `motion.div` fill (`bg-mango`) animating width by `((currentStep - 1) / 6) * 100%` for steps 1–6 (welcome=0%, polish=100%); spring transition.
- [ ] Step counter: `font-mono text-[10px] text-muted-foreground` "Step N of 6" (hidden on welcome/done).
- [ ] Body wrapped in `<AnimatePresence mode="wait">` keyed on `currentStep`. Each step body uses `motion.div` with the spec's enter/exit (opacity, y-shift, blur). Wrap `useReducedMotion()` to swap to plain opacity transitions.
- [ ] Sticky bottom action bar (`fixed bottom-0 inset-x-0 bg-warm-cream/90 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)] pt-3 px-6`): `Back` (ghost, hidden on welcome) + `Next` (`bg-teal`, `min-h-12 rounded-xl font-display`).
- [ ] `Next` handler runs per-step `profile.save` mutation (with just the changed field for required steps) → on success, fire-and-forget `auth.setOnboardingStep` with the new step idx → advance `currentStep`. On error, Sonner toast `"Hindi na-save. Try ulit."` and DO NOT advance.
- [ ] Inline validation: required text empty → show inline error below input on Next; `mobileNumber` regex `/^09\d{9}$/` (strip spaces before validate).
- [ ] Step contents:
  - **0 Welcome:** big `font-display` "Set up sa 2 minutes" headline + sub-copy + "Start" CTA. No back button.
  - **1 First name:** `<Input autoFocus type="text" inputMode="text" autoComplete="given-name">`.
  - **2 Last name:** `<Input type="text" autoComplete="family-name">`.
  - **3 Mobile:** `<Input type="tel" inputMode="tel" autoComplete="tel" placeholder="09XX XXX XXXX">` + helper.
  - **4 Business name:** `<Input type="text">` + helper "Pwedeng palitan later".
  - **5 Business type:** 3 tap-cards (sole_proprietorship / partnership / corporation). `motion.button whileTap={{ scale: 0.97 }}`. Selected card has `ring-2 ring-teal/40 bg-teal/5`. Big ≥44px tap targets, `font-display` label + small description.
  - **6 Business barangay:** `<Input>` + "Manila City lang muna" hint.
  - **7 Polish:** scrollable, accordion sections (use shadcn `Accordion` if present, else `<details>`):
    - "Personal extras": middleName, suffix, dateOfBirth, civilStatus (select), citizenship, tin, philsysId, emailAddress.
    - "Home address": homeBuilding, homeStreet, homeBarangay, homeCity, homeProvince, homeZipCode (Manila/Metro Manila prefilled).
    - "Business details": businessNameOption2, businessNameOption3, businessActivity, bizBuilding, bizStreet, bizCity (default Manila), bizProvince, bizZipCode, territorialScope, capitalization, expectedAnnualSales, numberOfEmployees.
    - "Tax preference": preferTaxOption.
    - All fields optional. Two CTAs: "Skip rest" (ghost) + "Save & finish" (`bg-teal`). Both call full `profile.save` with the polish-step diff, then `auth.completeOnboarding`, then advance to step 8.
  - **8 Done:** big check icon (mango), `font-display` "Tara, simulan na!" headline, brief summary list of saved fields (staggered fade-up via `motion.ul`), CTA "Go to Roadmap" → `navigate("/roadmap")`. Trigger `navigator.vibrate?.(20)`.
- [ ] Reuse the existing `ProfileData` type by extracting to a small inline type (no shared module needed).
- [ ] Buttons show `Loader2` spinner + label "Saving…" while mutation pending; flash check icon (180ms) on success before transition.

### 6. Verify
- [ ] `pnpm check` — typecheck passes (no `any` regressions).
- [ ] `pnpm test` — existing tests still pass. (Onboarding paths covered by manual smoke; no new automated coverage required for v1.)
- [ ] Manual smoke (dev): brand-new account → lands on `/onboarding` → cannot navigate to `/` → step-by-step save persists → close + reopen resumes at correct step → completion redirects to `/` and never re-fires. Verify 360×640 viewport: no horizontal overflow, sticky CTAs do not cover input, animations smooth.

---

## Risks & rollback

- **`auth.me` payload change** — every existing caller relied on `ctx.user` shape; new shape is a superset, callers that destructure unknown fields are unaffected. If any breakage, revert `routers.ts auth.me` body.
- **Gate flicker** — handled by waiting for `me` query to resolve before redirecting.
- **`setOnboardingStep` write failures** — non-blocking; profile fields are the source of truth. Heuristic resume covers it.
- Rollback = `git revert` of the implementing commit; no data migration (new fields default to null).
