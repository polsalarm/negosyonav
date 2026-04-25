# NegosyoNav — Dev Task Plan

Reference: `negosyonav_pitch_brief.html` (8 pillars) + `negosyonav_updatedfeatures.html` (9 features + retention).

Goal: split remaining work so multiple devs ship in parallel with minimal merge conflict.

---

## 0. Latest priority directives (2026-04-25)

User-flagged items folded into the tracks below. Priority overrides Section 5's phase order — start HIGH items immediately after Track 0 ships.

**HIGH**
- Chatbot integration verified end-to-end → **Track L** (new).
- First-visit must land on signup, post-signup must route to Profile → **Track M** (new).
- PDF downloader + form templates broken → **Track A** (already in plan, raised to top of HIGH).
- Map integrated *inside* roadmap steps (not standalone /places only) → **Track N** (new).
- Per-step report/feedback that also posts to Negosyante Hub → **Track O** (new).

**LOW**
- Hub comments → **Track E** (already in plan, retagged LOW).
- Hub like button broken → **Track P** (new bugfix; root cause: seed posts have non-Firestore IDs so `community.vote` 404s).

---

## 1. Current state — what's implemented

| # | Feature (brief / updated) | Status | Where |
|---|---|---|---|
| 01 | Taglish chat intake | Working | `client/src/pages/Home.tsx`, `components/AIChatBox.tsx`, `server/routers.ts ai.chat` |
| 02 | Lakad Roadmap (location-aware) | Manila City only — hardcoded | `pages/Roadmap.tsx`, `client/src/data/manilaData.ts` |
| 03 | Form auto-fill + "PDF" download (MVP anchor) | Partial 2026-04-26 — Barangay Clearance fills real AcroForm template (`server/pdf/barangayClearance.ts` + `server/templates/business_clearance.pdf`); DTI + BIR use a real PDF text-fallback (`server/pdf/textFallback.ts`) until official templates land | `pages/Forms.tsx`, `routers.ts forms.generatePdf`, `server/pdf/`, `server/templates/` |
| 04 | Grant matching (BMBE / DOLE / SB Corp) | Working — pure logic, no DB | `pages/Grants.tsx`, `routers.ts grants.check` |
| 05 | Negosyante Hub (posts + votes) | Working — no comments, no contextual surfacing in roadmap | `pages/Hub.tsx`, `routers.ts community.*`, `db.ts` |
| 06 | Time-based planner | Working — static logic | `pages/Planner.tsx` |
| 07 | Place finder (Maps) | Working — static office list, `Map.tsx` component, no geolocation / directions | `pages/Places.tsx`, `components/Map.tsx` |
| 08 | Cost estimator | Working — inline in roadmap | `pages/Roadmap.tsx` + `manilaData.ts` |
| 09 | Renewal & deadline calendar | Partial — countdowns render, no push notif, no per-user persisted dates | `pages/Calendar.tsx` |
| — | Profile (Negosyante onboarding) | Working — UX refactored 2026-04-25 (Track Q): sticky-nav single-scroll, autosave, same-as-home, masked inputs, Taglish microcopy, Sign Out → 3-dot menu | `pages/Profile.tsx`, `routers.ts profile.*` |
| — | Auth (Firebase email/pw) | Working | `pages/Login.tsx`, `_core/context.ts`, `_core/firebaseAdmin.ts` |
| — | Form-help drawer (Taglish field-level Q&A) | Working | `components/FormHelpDrawer.tsx`, `routers.ts ai.formHelp` |
| — | Feedback submission | Working | `routers.ts feedback.submit` |
| — | PWA shell + offline cache | Wired via `vite-plugin-pwa` | `vite.config.ts` |

### Functional gaps (correctness, not new features)

- **`forms.generatePdf` is not a real PDF** — server returns base64 of plain text; `Forms.tsx` saves it as `.pdf`. Reader will fail. Highest-priority fix since this is the MVP anchor.
- **Roadmap progress is local state only** — checked requirements / completed steps live in component state, not Firestore. Brief calls saved progress "the first retention hook"; not implemented.
- **Calendar dates are derived from `new Date()`**, not from the user's actual registration completion date — so countdowns are wrong for everyone except a hypothetical user who registered today.
- **Hub posts don't surface in roadmap** by step + LGU tag (claim from updatedfeatures.html).
- **Legacy tests** (`server/features.test.ts`, `routers.test.ts`) reference pre-Firebase context shape and will fail when DB-touching tests run without `serviceAccount.json`.
- **Dead Manus / Drizzle scaffolding** still in repo (`drizzle/`, `server/_core/storageProxy.ts`, `oauth.ts`, `dataApi.ts`, `sdk.ts`, `imageGeneration.ts`, `voiceTranscription.ts`, `notification.ts`, `server/storage.ts`).

### Nice-to-have (from briefs, not started)

- **Multi-LGU**: brief lists Taguig, Cavite, Sampaloc; only Manila City data exists.
- **Post-registration roadmaps** (retention engine): bank account, SSS/PhilHealth/Pag-IBIG employer, BIR quarterly filing, OR printing / ATP, DTI trademark.
- **Push notifications** (FCM): renewal reminders 2 weeks ahead, step-failed inactivity nudge, new grant alert.
- **Hub comments / replies** (retention via reciprocity).
- **Real geolocation + directions** in Place Finder (`navigator.geolocation`, Maps Directions API).
- **Voice input** for chat (low-literacy user accommodation, mentioned indirectly in pitch).
- **Onboarding tour** for first-time users.
- **Accessibility audit** (WCAG, Tagalog screen-reader, contrast).

---

## 2. Conflict-zone map

Files multiple tracks would otherwise edit. Treat these as serialization points.

| File | Why it's a hot spot |
|---|---|
| `server/routers.ts` (~440 LOC, all sub-routers in one file) | Almost every backend track touches it. **Track 0 splits it first.** |
| `server/db.ts` | Schema additions for progress, comments, push tokens. Append-only, low risk if devs add separate sections. |
| `client/src/App.tsx` | Adding new routes / nav items. Append-only, low risk if each track adds in distinct sections. |
| `client/src/data/manilaData.ts` | Multi-LGU rename. **Track 0 also restructures this.** |
| `vite.config.ts`, `package.json` | Dep bumps; coordinate. |

---

## 3. Track 0 — Prep refactor (do FIRST, single dev, ~half day, blocks parallel work)

Single PR, fast. Everything below assumes this is merged.

- **0.1** Split `server/routers.ts` into `server/routers/{auth,ai,profile,grants,community,forms,feedback,progress}.ts`; keep `server/routers.ts` as the composer (`router({ system, auth, ai, ... })`). Move `MANILA_SYSTEM_PROMPT` and `PROFILE_EXTRACTION_PROMPT` into `server/prompts/manila.ts`.
- **0.2** Rename `client/src/data/manilaData.ts` → `client/src/data/lgu/manila.ts`; export shape `{ lguId, lguName, steps, offices, costs }`. Add `client/src/data/lgu/index.ts` with `lguRegistry: Record<lguId, LguData>`.
- **0.3** Remove dead Manus/Drizzle scaffolding in one go: `drizzle/`, `drizzle.config.ts`, `pnpm db:push` script, `mysql2`/`drizzle-orm` deps, `server/_core/{storageProxy,oauth,dataApi,sdk,imageGeneration,voiceTranscription,notification}.ts`, `server/storage.ts`, `forgeApiUrl`/`forgeApiKey`/`cookieSecret`/`oAuthServerUrl`/`appId`/`ownerOpenId` stubs in `env.ts`.
- **0.4** Update `CLAUDE.md` Architecture section to reflect new router layout.

After 0 merges, every track below edits its own files only.

---

## 4. Parallel tracks (post-Track-0)

Each track lists owned files. Two devs on different tracks should not collide.

### Track A — Real PDF generation (MVP anchor fix) — **HIGH**
**Owner files:** `server/routers/forms.ts`, `server/pdf/` (new), `client/src/pages/Forms.tsx`, `package.json` (add `pdf-lib`).

- A.1 Add `pdf-lib` dependency. — ✅ done 2026-04-26
- A.2 Build `server/pdf/dtiForm.ts`, `barangayClearance.ts`, `bir1901.ts`. Each exports `render(fields): Promise<Uint8Array>` that draws onto a real form template (start with from-scratch layout matching the official field labels; later swap to overlay on scanned official PDF). — 🟡 partial 2026-04-26: shipped `server/pdf/barangayClearance.ts` filling the official AcroForm at `server/templates/business_clearance.pdf` (text + checkbox widgets) and `server/pdf/textFallback.ts` covering DTI + BIR until their templates land.
  > Revised 2026-04-26: when an official AcroForm exists (as for Barangay Clearance), we fill the template directly via pdf-lib instead of redrawing from scratch — exposes the schema (field name + type + group + required) to the client so the form UI matches the PDF exactly.
- A.3 Rewrite `forms.generatePdf` to dispatch on `formId` and return `{ pdfContent: base64, contentType: "application/pdf" }`. — ✅ done 2026-04-26
- A.4 `Forms.tsx`: drop the byte-array dance, just `atob` → `Blob({ type: "application/pdf" })`. Verify download opens in a real PDF viewer. — 🟡 partial 2026-04-26: all three forms now render through a generic `client/src/components/FormWizard.tsx` with shared styling — progress bar, sticky Back/Next, per-step validation, profile prefill, "Edit →" review screen. Step kinds: `radio` (Barangay Application Type / Form of Ownership), `fields` (text inputs with `inputMode`/`autocomplete`), `chips` (searchable chip picker for Barangay's 50+ Nature-of-Business checkboxes with conditional Services/Others specify boxes), `review`. Steps: Barangay 7, DTI 7, BIR 6. Byte-array decode kept for now (works fine with the real PDF).
- A.5 Add Vitest unit tests in `server/pdf/*.test.ts` asserting valid PDF magic bytes (`%PDF-`). — 🟡 partial 2026-04-26: magic-byte assertions added to `server/features.test.ts forms.generatePdf` (DTI fallback, BIR fallback, Barangay AcroForm fill, plus required-fields rejection). Dedicated `server/pdf/*.test.ts` files not yet created — Track K can move them when it reorganizes.
- A.6 Confirm a downloaded PDF opens in Chrome PDF viewer + Adobe Reader on a real device (current `.pdf` is plain text and fails — this is the user-reported "not working"). — 🟡 partial 2026-04-26: smoke test confirms `%PDF-1.7` magic + 761 KB filled output for Barangay Clearance; still needs a real-device viewer check.
- A.7 Add AcroForm templates + renderers for DTI (FM-BN-01) and BIR 1901 once the official PDFs are sourced; mirror the Barangay pattern (template under `server/templates/`, schema array exported, generic dispatch). — 🆕 2026-04-26

### Track B — Roadmap progress persistence + step-failed nudge
**Owner files:** `server/routers/progress.ts` (new in Track 0), `server/db.ts` (append `roadmapProgress` collection helpers), `client/src/pages/Roadmap.tsx`, `client/src/hooks/useRoadmapProgress.ts` (new).

- B.1 Firestore `roadmapProgress/{uid}` doc: `{ lguId, completedSteps: number[], checkedReqs: string[], registrationCompletedAt?, lastTouchedAt }`.
- B.2 tRPC `progress.get` (protected query), `progress.update` (protected mutation, debounced from client).
- B.3 `useRoadmapProgress` hook: replaces local `useState` in `Roadmap.tsx`, syncs to server with optimistic update.
- B.4 Server-side: when `progress.get` runs and `lastTouchedAt` > 3 days ago and not all steps complete, return `{ shouldNudge: true, lastStep }`. Client renders inactivity banner. (Push notification version is Track G — keep banner here so this track ships standalone.)
- B.5 Backfill migration: none needed; new collection.

### Track C — Multi-LGU support (Taguig, Cavite, Sampaloc)
**Owner files:** `client/src/data/lgu/{taguig,cavite,sampaloc}.ts` (new), `client/src/data/lgu/index.ts`, `client/src/pages/Roadmap.tsx`, `client/src/pages/Profile.tsx` (LGU selector), `server/prompts/manila.ts` → `server/prompts/lgu/{manila,taguig,cavite,sampaloc}.ts`, `server/routers/ai.ts` (pick prompt by `profile.bizCity`).

- C.1 Research + author each LGU's data file: 5 step structure, costs, offices, RDO mapping. Sampaloc shares Manila City Hall but RDO-032 specific.
- C.2 Profile gains an `lguId` field (derived from `bizCity` if absent). Server `profile.save` zod allows it.
- C.3 `ai.chat` reads `ctx.user` profile to pick LGU prompt; falls back to Manila if no profile.
- C.4 Roadmap page reads `profile.lguId` and renders the matching LGU dataset.
- C.5 Hub `lguTag` filter dropdown gains the new LGUs (Hub.tsx — small, one-line addition; coordinate with Track E if landing same week).

### Track D — Post-registration roadmaps (retention engine)
**Owner files:** `client/src/data/postReg/{bankAccount,sssEmployer,birQuarterly,orPrinting,trademark}.ts` (new), `client/src/pages/PostRegRoadmap.tsx` (new, generic renderer reusing roadmap card pattern), `client/src/App.tsx` (add `/next/:slug` route), nav entry on `Roadmap.tsx`.

- D.1 Generic `PostRegRoadmap` component takes a roadmap data file and renders the same step-card UI.
- D.2 Five data files, one per follow-up flow. Same `RegistrationStep` shape Track 0 standardized.
- D.3 Roadmap.tsx — after all 5 main steps complete, surface the "Ano ang susunod?" panel linking to each.
- D.4 If pre-filled forms are needed (BIR quarterly, OR ATP), define new `formId`s and let Track A's PDF dispatcher add renderers later — Track D ships the roadmaps without forms first.

### Track E — Hub: comments + contextual surfacing in roadmap — **LOW** (per user directive)
**Owner files:** `server/routers/community.ts`, `server/db.ts` (append comments helpers), `client/src/pages/Hub.tsx`, `client/src/components/RoadmapTipsForStep.tsx` (new), `client/src/pages/Roadmap.tsx` (mount component per step).

- E.1 Firestore `community_posts/{id}/comments/{cid}` subcollection. Helpers: `getComments(postId)`, `addComment(postId, userId, name, body)`.
- E.2 tRPC `community.comments` (query) and `community.addComment` (protected mutation).
- E.3 Hub post detail: collapsible comment thread.
- E.4 Tag schema extension: posts gain optional `stepNumber` on create (Hub.tsx form). `community.list` accepts `{ stepNumber?, lguTag? }`.
- E.5 `RoadmapTipsForStep` queries `community.list({ stepNumber, lguTag })` and renders top-3 upvoted tips inside the step card. Wire into Roadmap.tsx.

### Track F — Push notifications (FCM)
**Owner files:** `client/src/lib/fcm.ts` (new), `client/public/firebase-messaging-sw.js` (new), `client/src/pages/Profile.tsx` (notification opt-in), `server/routers/notifications.ts` (new), `server/db.ts` (append `pushTokens` helpers), `server/jobs/sendReminders.ts` (new), `package.json` (`firebase-admin` already present).

- F.1 Client: register service worker, request permission, store token via `notifications.registerToken` mutation.
- F.2 Server: store `pushTokens/{uid}/{token}` with `topics: ["renewal","grant","inactivity"]`.
- F.3 `sendReminders.ts` script (runnable via cron or `tsx server/jobs/sendReminders.ts`): scans `roadmapProgress` (depends on Track B for inactivity) and renewal dates, sends FCM payloads.
- F.4 Calendar.tsx: replaces "Bell" placeholder with a live "Reminders on" toggle bound to the topic.
- F.5 Stretch: use Firebase Cloud Functions instead of a long-lived server cron — out of scope for hackathon if no GCP budget.

### Track G — Place Finder upgrade (geolocation + directions)
**Owner files:** `client/src/pages/Places.tsx`, `client/src/components/Map.tsx`, `client/src/lib/geolocation.ts` (new). No server changes.

- G.1 `navigator.geolocation.getCurrentPosition` with permission gate; sort offices by distance.
- G.2 Google Maps Directions API link (`https://www.google.com/maps/dir/?api=1&destination=…`) on each office card.
- G.3 Live "open now / closed" badge derived from `hours`.
- G.4 Per-LGU office filter (depends on Track C's `lguId` shape; if Track C not merged, hardcode Manila — adapter is one line).

### Track H — Calendar tied to actual registration date
**Owner files:** `client/src/pages/Calendar.tsx`, `client/src/hooks/useRoadmapProgress.ts` (read-only), `server/routers/progress.ts` (add `setRegistrationCompletedAt`).

Depends on Track B for the source-of-truth date. If B ships first this is a one-day task: read `progress.registrationCompletedAt`, derive next quarterly BIR filing (`+90 days`, then `+90` rolling) and Mayor's Permit (next Jan 20 after that date), persist nothing. Push notification wiring is Track F.

### Track I — Voice input for chat
**Owner files:** `client/src/components/AIChatBox.tsx` only.

Web Speech API (`SpeechRecognition`, `lang="fil-PH"` with `en-PH` fallback). Mic button toggle. Single-file; will not collide with anything.

### Track J — Onboarding + accessibility pass
**Owner files:** `client/src/components/Onboarding.tsx` (new), `client/src/pages/Home.tsx`, ARIA pass across all pages.

- J.1 First-run modal: 3 slides explaining chat → roadmap → forms. Stored in `localStorage`.
- J.2 ARIA labels on all icon-only buttons (`BottomNav`, `Forms.tsx` edit/expand toggles, etc).
- J.3 Verify color tokens hit WCAG AA for `text-muted-foreground` on `bg-warm-cream`. Adjust in `client/src/index.css` if not.
- J.4 Manual screen-reader pass with VoiceOver/TalkBack — capture issues in this doc as follow-ups.

This track edits *many* files but only ARIA attributes / labels — diff lines tend not to overlap with feature-track logic edits. Schedule against weeks where Tracks B/C/E are not actively rewriting the same components.

### Track K — Test rewrite to Firebase context shape
**Owner files:** `server/auth.logout.test.ts`, `server/features.test.ts`, `server/routers.test.ts`, plus new `server/pdf/*.test.ts` (Track A) and `server/routers/progress.test.ts` (Track B).

Update fixtures from `{ id, openId, loginMethod }` to `{ uid, email, name, role }`. Skip DB-touching tests when `serviceAccount.json` absent (use `describe.skipIf`). Independent of every other track — schedule continuously.

### Track L — Chatbot integration verified end-to-end — **HIGH**
**Owner files:** `client/src/pages/Home.tsx`, `client/src/components/AIChatBox.tsx`, `client/src/components/FormHelpDrawer.tsx`, `server/routers/ai.ts` (post Track 0).

Today the chat exists on `/` but suggestion buttons, profile-extraction round-trip, and the form-help drawer have not been smoke-tested as one flow. Per user report it isn't reliably working.

- L.1 End-to-end smoke at `/`: send "Sari-sari store sa Tondo" → assistant replies in Taglish → "Build my Roadmap" CTA navigates to `/roadmap` with profile auto-extracted (already wired via `sessionStorage.negosyonav_chat_history` + `ai.extractProfile`). Fix any broken link in that chain.
- L.2 Verify `chatMutation` error path renders a visible toast — currently a silent failure if `GEMINI_API_KEY` is missing. Add a typed error from `invokeLLM` and a user-visible "Bumalik mamaya — busy ang AI" toast.
- L.3 Verify `FormHelpDrawer` (`ai.formHelp`) opens from each `Forms.tsx` field's "?" affordance and returns a Taglish answer. If `userProfile` is undefined the prompt currently still works — keep that behavior.
- L.4 Add a floating chat launcher (`<ChatFab />`) visible on `/roadmap`, `/forms`, `/grants` so the assistant is reachable mid-task. Single new component; routes only mount it. No conflict with other tracks.
- L.5 Add a Vitest integration test that calls `appRouter.createCaller(ctx).ai.chat({ messages: [...] })` against a mocked `invokeLLM` and asserts non-empty `content`.

### Track M — Auth gate + post-signup → Profile flow — **HIGH**
**Owner files:** `client/src/App.tsx`, `client/src/pages/Login.tsx`, `client/src/_core/hooks/useAuth.ts`, `client/src/pages/Profile.tsx` (first-time banner only).

User report: "not asking me to register" + "after signing up, direct to profile page". Current `Login.tsx` already supports both modes; the bug is that nothing forces unauthenticated users to it.

- M.1 In `App.tsx`, wrap `Router` in an `<AuthGate>` that, when `useAuth()` resolves to `isAuthenticated === false`, redirects to `/login` for any path except `/login` and `/404`. Loading state shows `DashboardLayoutSkeleton`.
- M.2 `Login.tsx`: default `mode` to `"signup"` instead of `"signin"` (signup is the friction point we want to remove). Read `?mode=signin` query string to override.
- M.3 On successful **signup**, call `auth.syncUser` then `navigate("/profile?onboarding=1")`. On successful **signin**, keep current `navigate("/")`.
- M.4 `Profile.tsx`: if `?onboarding=1`, render a top banner ("Punan natin ang profile mo para ma-pre-fill ang DTI/BIR forms") and scroll to the first empty required field. Banner dismissible; flag stored in `localStorage`.
- M.5 Sanity: `BottomNav` already hides on `/login` — leave alone. Verify after M.1 that no auth-gated tRPC call fires before login.

### Track N — Map embedded inside roadmap steps — ✅ done 2026-04-25
**Owner files:** `client/src/pages/Roadmap.tsx`, `client/src/components/StepOfficeCard.tsx` (new), `client/src/data/lgu/manila.ts` (post-Track-0; add `step.offices: OfficeRef[]`), `client/src/components/Map.tsx` (reused, no edits needed).

Currently office data lives only in `pages/Places.tsx`. User wants the relevant office card + mini-map *inside* each roadmap step so the user doesn't have to leave the flow.

- N.1 Lift the `manilaOffices` array out of `Places.tsx` into `client/src/data/lgu/manila.ts` (Track 0 already moves data there). Each step in `lguData.steps` references one or more `officeId`s. — ✅ done 2026-04-25
- N.2 New `StepOfficeCard` component renders office name, hours, queue tip, "Open in Maps" link, and a small `<Map />` preview centered on the office's `lat/lng`. Reuse the existing `components/Map.tsx`. — ✅ done 2026-04-25
- N.3 In `Roadmap.tsx`'s expanded step view, render `StepOfficeCard` for each office tied to that step. Steps that are online-only (DTI online path) render a "Pwedeng online" pill instead of a map. — ✅ done 2026-04-25
- N.4 Make sure mini-map height is capped (~180px) and lazy-loaded so 5 maps don't render simultaneously — only the expanded step's map mounts. — ✅ done 2026-04-25
- N.5 `/places` page stays as the directory; remove the duplicated office array from there and import from the LGU data file. — ✅ done 2026-04-25

> Deviations from spec:
> - Track 0 deferred — landed against flat `client/src/data/manilaData.ts` instead of `lgu/manila.ts`. Future Track 0 commit handles the rename.
> - `components/Map.tsx` was rewritten (not "reused") because the prior implementation pointed at the dead Forge proxy.
> - Added `RdoPicker` (not in original spec) for the `bizBarangay` missing case; choice persists to `localStorage`.
> - Added `findDistrict()` + `BARANGAY_RANGES` table to `manilaData.ts`. Track C should refactor into a per-LGU adapter when adding Taguig/Cavite/Sampaloc.
> - `bestTime` / `queueTip` lifted into the `Office` / `BirRdo` interfaces (single source of truth for `/places` and the in-step office card).
> - Out-of-band: API key restricted in Google Cloud Console (HTTP referrer + API allowlist).

### Track O — Per-step report/feedback that posts to Hub — **HIGH**
**Owner files:** `client/src/components/StepFeedbackButton.tsx` (new), `client/src/pages/Roadmap.tsx`, `server/routers/feedback.ts` (post Track 0), `server/db.ts` (feedback helpers), optional cross-call to `community.create`.

Bridges existing `feedback.submit` (private to admins) with `community.create` (public). User wants both: a quick "Mali ang info dito" inside the step that simultaneously files internal feedback AND surfaces a public Hub post tagged to the step + LGU.

- O.1 New `StepFeedbackButton` opens a small sheet with: feedback type (`outdated_info` / `incorrect_data` / `experience` / `tip`), message, and a checkbox "I-share din sa Negosyante Hub". Defaults to checked for `experience`/`tip`, unchecked for `outdated_info`/`incorrect_data`.
- O.2 Server: extend `feedback.submit` zod input with `{ shareToHub: boolean, hubCategory?: "tip"|"warning"|"experience"|"question" }`. When `shareToHub === true && ctx.user`, also call `createCommunityPost({ stepNumber, lguTag, category: hubCategory ?? "experience", title, content })`. Anonymous reports cannot share to hub (need a `userId`).
- O.3 Mount `StepFeedbackButton` in each step card in `Roadmap.tsx`, passing `stepNumber` + `lguId`.
- O.4 Hub list/feed already filters by `lguTag`; add `stepNumber` filter to `community.list` so step-tagged posts surface contextually (also covered by Track E.4 — coordinate; if Track O lands first, leave Track E to add the in-roadmap rendering only).
- O.5 Tests: assert that `feedback.submit({ shareToHub: true })` creates *both* a `feedback` doc and a `community_posts` doc.

### Track Q — Profile editor UX refactor — ✅ done 2026-04-25
**Owner files:** `client/src/pages/Profile.tsx` (single file). Backend untouched.

Returning-user edit/review surface; complements Onboarding.tsx (which owns first-fill). Spec was originally a 4-step wizard; revised mid-implementation to **single-scroll + sticky section nav** because wizard hides siblings and breaks "glance all info" review use case.

> Revised 2026-04-25 (a): dropped wizard steps in favor of sticky pill nav over single-scroll layout. Wizard friction wrong tool for editing existing data; Onboarding.tsx already covers first-fill wizard.
> Revised 2026-04-25 (b): pivoted from sticky-nav single-scroll to **shadcn `Tabs`** per user override. Glanceability tradeoff acknowledged — tabs hide non-active sections, but tab labels + per-tab required-fill dot still expose progress at a glance.

- Q.1 4-tab section layout (shadcn `Tabs` — Personal/Address/Business/Tax) with sticky `TabsList` + per-tab required-fill dot — ✅ done 2026-04-25
- Q.2 localStorage draft autosave on blur (`negosyonav_profile_draft_<uid>`); final CTA persists to Firestore via existing `profile.save` and clears draft — ✅ done 2026-04-25
- Q.3 "Pareho sa home address ko" toggle copies + locks biz address fields, auto-detected on hydrate — ✅ done 2026-04-25
- Q.4 Field upgrades: TIN mask `000-000-000-00`, PhilSys mask `0000-0000-0000-0000`, Mobile +63 prefix, Suffix → dropdown, biz placeholders, ZIP digit-only mask — ✅ done 2026-04-25
- Q.5 Required `*` on firstName, lastName, mobileNumber, businessName, bizBarangay (mirrors Onboarding's 5 required) — ✅ done 2026-04-25
- Q.6 Taglish microcopy on PhilSys/Capitalization/Annual Sales; Tax "Learn more" bottom sheet (shadcn `Sheet`) — ✅ done 2026-04-25
- Q.7 Sign Out moved from form footer into header 3-dot menu (shadcn `DropdownMenu`) — ✅ done 2026-04-25
- Q.8 Auto-Extract banner shown only when profile empty; demoted to Sparkles icon button in header otherwise — ✅ done 2026-04-25
- Q.9 Mobile-first audit: inputs upgraded to `text-base` (iOS no-zoom), tap targets ≥44px, single-column default with 2-col exceptions only for First+Middle and Province+ZIP — ✅ done 2026-04-25
- Q.10 🆕 2026-04-25 — TIN spec mask is 11 digits; if Forms team needs 12-digit BIR format (`XXX-XXX-XXX-XXX`), update `formatTin` slice to `0,12` and adjust `parts` slicing.
- Q.11 Premium motion polish via framer-motion: sliding active-tab pill (`layoutId`), tab content enter w/ blur+y spring, AnimatePresence on autosave status + Save button label, spring scale-pop on save success, scale-in completion dots, `useReducedMotion` respected throughout — ✅ done 2026-04-25
- Q.12 CTA simplified: label `Save Profile & Enable Auto-fill` → `Save Profile` (autofill is the saved profile's effect, not a separate toggle). Dirty-state gating via `serverSnapshot` JSON-diff — button disabled w/ `No changes` label when profile matches server; flips to `Save Profile` on first edit; resets to clean after save success. — ✅ done 2026-04-25

### Track P — Hub like-button bugfix — **LOW**
**Owner files:** `client/src/pages/Hub.tsx`, optionally `server/routers/community.ts` + a one-time `server/scripts/seedHubPosts.ts`.

Root cause: `Hub.tsx` ships with `SEED_POSTS` whose IDs are `seed-1`, `seed-2`, … — not real Firestore docs. `community.vote` calls `db().collection("community_posts").doc("seed-1").update(...)`, which 404s. Two fix paths:

- P.1 (preferred) Write a one-shot seed script `server/scripts/seedHubPosts.ts` that inserts the four demo posts as real Firestore docs (idempotent: skip if a `seed: true` flag exists). Add `pnpm seed:hub` script. Then drop `SEED_POSTS` from `Hub.tsx` — list comes from `community.list`.
- P.2 (alternative if no DB seed allowed) In `Hub.tsx`, treat any post whose id starts with `seed-` as read-only: disable vote buttons + tooltip "Demo post — log in para mag-vote sa real posts". Less satisfying but ships in 30 minutes.
- P.3 Either path: verify `community.myVotes` rehydrates on page load so the user's previous up/down state colors the button correctly (currently the optimistic state is lost on refresh).
- P.4 Add a Vitest test that calls `community.vote` against a fresh post and asserts upvote count increments.

---

## 5. Suggested order + parallelism

Two-dev pairing example, reordered so HIGH directives ship first:

| Phase | Dev 1 | Dev 2 |
|---|---|---|
| 0 | Track 0 (refactor) | Track I (voice input) or Track K (test rewrite) — both isolated, safe to start before 0 lands |
| 1 (HIGH) | Track M (auth gate + signup→profile) | Track A (real PDF) |
| 2 (HIGH) | Track L (chatbot E2E) | Track N (map in steps) — ✅ done |
| 3 (HIGH) | Track O (per-step feedback → hub) | Track B (progress persistence) |
| 4 | Track C (multi-LGU) | Track D (post-reg roadmaps) |
| 5 | Track F (push notifs) | Track G (geolocation) + Track H (calendar fix) |
| 6 (LOW) | Track E (Hub comments) | Track P (like-button fix) |
| 7 | Track J (onboarding + a11y) | — |

Track K runs continuously alongside whoever owns server changes that week.

**Cross-track coordination:**
- Tracks N and O both add UI inside `Roadmap.tsx` step cards. Land them on consecutive PRs, not simultaneously, OR have one dev own both.
- Track O's `community.list({ stepNumber })` filter overlaps with Track E.4 — whichever lands first owns the schema change; the other rebases.
- Track M (auth gate) blocks any track whose flow assumes the user is logged in (B, F, O). Land M before those reach QA.

---

## 6. Definition of done (per track)

- `pnpm check` passes.
- `pnpm test` passes (no skipped tests except the documented DB-requires-serviceAccount ones).
- Manual smoke at 360×640 viewport — no horizontal overflow, `BottomNav` clear of CTAs (`pb-20`), tap targets ≥44px.
- Tokens-only colors (`bg-primary`, `text-foreground`, etc.) — no new hex.
- New tRPC mutation that writes to Firestore is `protectedProcedure`.
