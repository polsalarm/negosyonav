# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager: **pnpm** (v10.4.1, pinned via `packageManager`). Use `pnpm <script>`.

- `pnpm dev` — `tsx watch server/_core/index.ts`. Express + Vite middleware, port 3000 (auto-bumps up to +20 if busy). Override with `PORT=`.
- `pnpm build` — `vite build` (client → `dist/public`) + `esbuild` server bundle → `dist/index.js` (ESM, `--packages=external`).
- `pnpm start` — production server from `dist/`.
- `pnpm check` — `tsc --noEmit` (no separate lint).
- `pnpm test` — `vitest run`. Single file: `pnpm test -- server/features.test.ts`. Single test: `pnpm vitest run -t "test name"`.
- `pnpm format` — prettier write all.
- `pnpm db:push` — `drizzle-kit generate && drizzle-kit migrate`. **Legacy** — see Database section.

### Required env

Active runtime env (`server/_core/env.ts`):
- `GEMINI_API_KEY` — LLM
- `FIREBASE_PROJECT_ID` — Firebase Admin
- `NODE_ENV`

Server also reads `serviceAccount.json` from CWD for Firebase Admin (`server/_core/firebaseAdmin.ts`). Without it, `adminDb`/`adminAuth` stay `null` and any DB/auth-touching procedure throws "Firestore not initialized".

Client env (Vite, `client/src/lib/firebase.ts`): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`.

The fields in `env.ts` named `forgeApiUrl`/`forgeApiKey`/`cookieSecret`/`oAuthServerUrl`/`appId`/`ownerOpenId` are **legacy stubs** kept so leftover Forge/Manus files compile. They are empty strings — do not rely on them.

## Architecture

Single-process Express app. `server/_core/index.ts`:
1. Imports `./firebaseAdmin` for side-effect init.
2. Mounts tRPC at `/api/trpc` (router from `server/routers.ts`, context from `server/_core/context.ts`).
3. In dev: Vite middleware (`./vite.ts setupVite`); in prod: static `dist/public` (`serveStatic`).

There is **no OAuth route, no storage proxy route, no REST endpoint**. tRPC is the entire API surface. Several files in `server/_core/` (`storageProxy.ts`, `oauth.ts`, `dataApi.ts`, `sdk.ts`, `imageGeneration.ts`, `voiceTranscription.ts`, `notification.ts`) and `server/storage.ts` are **legacy Manus/Forge scaffolding** — not wired into the running server. Don't extend them; if you need new functionality, add a new tRPC procedure.

### Auth

Firebase Auth (client SDK). Login flow in `client/src/pages/Login.tsx` uses `signInWithEmailAndPassword`/`createUserWithEmailAndPassword`. Client must send `Authorization: Bearer <idToken>` on tRPC requests.

`server/_core/context.ts createContext`:
- Reads `Authorization: Bearer <token>`.
- `adminAuth.verifyIdToken(token)` → resolves `uid`, `email`, `name`.
- Looks up `users/{uid}` Firestore doc to derive `role` (`"user" | "admin"`).
- On any failure, `ctx.user = null` (no throw at context layer).

Procedure tiers (`server/_core/trpc.ts`): `publicProcedure`, `protectedProcedure` (requires `ctx.user`), `adminProcedure` (`ctx.user.role === "admin"`). Error messages from `@shared/const` (`UNAUTHED_ERR_MSG`, `NOT_ADMIN_ERR_MSG`).

`auth.logout` is a no-op — actual sign-out is `firebase/auth signOut()` on the client. After sign-in, the client should call `auth.syncUser` to upsert the `users/{uid}` Firestore doc.

### Database — Firestore

`server/db.ts` is the **only** allowed DB access path. All helpers call `adminDb` from `firebaseAdmin.ts` via `db()`, which throws if Firestore isn't initialized.

Collections: `users/{uid}`, `profiles/{uid}`, `posts/{id}` (with `votes` subcollection), `feedback/{auto}`. Types: `FirestoreUser`, `FirestoreProfile`, `FirestorePost`, `FirestoreFeedback` exported from `server/db.ts`. Use `FieldValue.serverTimestamp()` for write timestamps; the `toDate(v)` helper normalizes Firestore Timestamps on read.

**Drizzle/MySQL is legacy.** `drizzle/schema.ts`, `drizzle/*.sql`, `drizzle.config.ts`, `pnpm db:push`, the `mysql2` and `drizzle-orm` deps remain in the repo but no runtime code imports them. Don't add new tables to `drizzle/schema.ts` — add Firestore collections in `server/db.ts` instead.

### LLM

`server/_core/llm.ts invokeLLM()` posts to Gemini's OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`) using `GEMINI_API_KEY`. Don't introduce another LLM client — reuse `invokeLLM`. The OpenAI-style `Message`/`Tool`/`ToolChoice` types are exported from the same file.

### Routers

All sub-routers live in **one file**, `server/routers.ts` (~440 lines), composed into `appRouter`:
- `system` (from `_core/systemRouter.ts`)
- `auth` — `me`, `logout`, `syncUser`
- `ai` — `chat`, `extractProfile`, `formHelp`
- `profile` — `get`, `save`
- `grants` — `check` (pure logic, no DB)
- `community` — `list`, `create`, `vote`, `myVotes`
- `forms` — `generatePdf`
- `feedback` — `submit`

`MANILA_SYSTEM_PROMPT` and `PROFILE_EXTRACTION_PROMPT` are constants at the top of `routers.ts` — edit there to change LLM behavior. Manila-specific business data (registration steps, costs, RDOs, grant programs) is hardcoded in those prompts and in `grants.check`. App is single-LGU (Manila City).

### Client

`client/src/`: React 19 + wouter routing + shadcn/ui (Radix + tailwindcss-animate) + Tailwind v4. tRPC via `@trpc/react-query` typed against `AppRouter` (`client/src/lib/trpc.ts`). Firebase client in `client/src/lib/firebase.ts` exports `auth`, `db`, `firebaseApp`.

Pages in `client/src/pages/` registered in `App.tsx Router`: `/`, `/roadmap`, `/hub`, `/profile`, `/forms`, `/grants`, `/places`, `/calendar`, `/planner`, `/login`, `/404`.

`BottomNav` in `App.tsx` is hardcoded with 5 items (Chat, Roadmap, Forms, Hub, Profile) and a `hideOn` list (`/places`, `/calendar`, `/grants`, `/planner`, `/login`). **Adding a new top-level route requires updating both `Router` and either `navItems` or `hideOn`.**

PWA via `vite-plugin-pwa` (manifest + Workbox runtimeCaching for `/api/`). Configured in `vite.config.ts`.

### Design system (mandatory)

All UI work MUST follow the established system. Do not introduce new component libs, ad-hoc colors, or hex values.

- **Primitives**: shadcn/ui (new-york) in `client/src/components/ui/`. Reuse existing — `button`, `card`, `dialog`, `sheet`, `form`, `input`, `tabs`, `sidebar`, etc. Add new shadcn parts via `npx shadcn@latest add <name>` only if missing.
- **Tokens**: defined in `client/src/index.css` `@theme inline`. Use semantic classes (`bg-background`, `bg-card`, `text-foreground`, `bg-primary`, `bg-accent`, `bg-destructive`, `border-border`, `ring-ring`) — not raw colors.
- **Brand palette** (oklch, do not hex-substitute): `mango`, `mango-light`, `teal`, `teal-light`, `jeepney-red`, `warm-cream`, `earth-brown`, `success`. Map: `primary` = teal, `accent` = mango, `destructive` = jeepney-red, `background` = warm-cream.
- **Fonts**: `font-display` (Archivo Black) for headings/hero, `font-body` (DM Sans) default, `font-mono` (JetBrains Mono) for code.
- **Radius**: use `rounded-sm|md|lg|xl` (driven by `--radius: 0.75rem`). No hardcoded `rounded-[...]`.
- **Dark mode**: `.dark` variant is wired — keep classes token-based so dark mode keeps working.
- **Animations**: prefer `tw-animate-css` / `tailwindcss-animate` utilities over custom keyframes.
- **cn helper**: merge classes via `cn` from `@/lib/utils`.

### Mobile-first (mandatory)

App is a PWA targeting Filipino micro-entrepreneurs on phones. Design and implement mobile-first, then layer up.

- Default styles target mobile. Use `sm: md: lg:` only to enhance for larger viewports — never the reverse.
- Min tap target 44px (`h-11` / `min-h-11`). Inputs `text-base` (16px) min to avoid iOS zoom.
- Layouts: single column by default, fluid widths, `px-4` gutters, `max-w-screen-sm` content where applicable. No fixed pixel widths that overflow ≤360px.
- Respect `BottomNav` — pages on routes that show it need `pb-20` (or equivalent) so content isn't hidden.
- Safe areas: use `env(safe-area-inset-*)` / Tailwind `pb-[env(safe-area-inset-bottom)]` for fixed/bottom UI.
- Test at 360×640 first. Verify scrollability, no horizontal overflow, sticky/fixed elements don't cover CTAs.
- Touch over hover: don't rely on `:hover` for critical affordances; pair with `:active` / focus-visible.
- Forms: native inputs, correct `inputMode`/`autocomplete`/`type` (`tel`, `email`, `numeric`), large submit buttons.
- Images/media: `loading="lazy"`, responsive sizes, no layout shift.

### Path aliases (vite.config.ts + tsconfig)

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

`shared/const.ts` (e.g. `UNAUTHED_ERR_MSG`) and `shared/types.ts` import from both client and server.

## Testing

Vitest. Tests next to source (`server/*.test.ts`). Pattern: build a `TrpcContext` manually and call `appRouter.createCaller(ctx).<router>.<proc>(...)` directly — no HTTP. DB-touching tests will throw unless `serviceAccount.json` is present, so guard or skip them.

**Heads-up:** `server/features.test.ts` and `server/routers.test.ts` were written against the pre-Firebase `TrpcContext.user` shape (`id`, `openId`, `loginMethod`, `createdAt`, `updatedAt`). Current `FirebaseContextUser` is `{ uid, email, name, role }`. New tests should match the Firebase shape; touch the legacy fixtures if you change the same files.

## Conventions

- Don't split `server/routers.ts` per feature — one file with sub-routers is the convention.
- New tRPC inputs use inline `zod` schemas. Mutations that write to Firestore should be `protectedProcedure`.
- New collection: define type in `server/db.ts`, add helpers using the `db()` guard, then wire into a sub-router.
- New page: create in `client/src/pages/`, register `<Route>` in `App.tsx`, add to `navItems` or `hideOn`.
- Patched dep: `wouter@3.7.1` (see `patches/`). `pnpm.overrides` pins `tailwindcss > nanoid` to `3.3.7`.
- The `NegosyoNav/` subdirectory contains a single `Welcome.md` — ignore unless asked.
