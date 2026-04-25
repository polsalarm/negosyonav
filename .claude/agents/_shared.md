# Shared repo invariants for negosyonav subagents

This file is included by every agent in `.claude/agents/`. It captures
project-wide rules that every agent must respect. Source of truth for code
conventions remains `CLAUDE.md` at the repo root.

## API surface

- The ONLY API surface is tRPC at `/api/trpc`. Routers live in
  `server/routers.ts`. Do not add REST endpoints, OAuth routes, or storage
  proxies.
- New procedures default to `protectedProcedure` from `server/_core/trpc.ts`.
  Use `adminProcedure` only when the caller is required to be an admin.
- Error messages come from `@shared/const` (`UNAUTHED_ERR_MSG`,
  `NOT_ADMIN_ERR_MSG`).

## Database

- The ONLY allowed DB access path is `server/db.ts`. All helpers go through
  `db()`, which guards against an uninitialised Firestore.
- Firestore collections only: `users/{uid}`, `profiles/{uid}`, `posts/{id}`
  (with `votes` subcollection), `feedback/{auto}`.
- Writes use `FieldValue.serverTimestamp()`. Reads normalise via `toDate()`.
- Drizzle / MySQL is legacy. Do NOT add tables to `drizzle/schema.ts`.

## Legacy files — do not modify or extend

- `server/_core/storageProxy.ts`
- `server/_core/oauth.ts`
- `server/_core/dataApi.ts`
- `server/_core/sdk.ts`
- `server/_core/imageGeneration.ts`
- `server/_core/voiceTranscription.ts`
- `server/_core/notification.ts`
- `server/storage.ts`
- `drizzle/**`
- `NegosyoNav/**`

The legacy `forgeApiUrl` / `forgeApiKey` / `cookieSecret` / `oAuthServerUrl`
/ `appId` / `ownerOpenId` fields in `server/_core/env.ts` are stubs. They
return empty strings. Do not rely on them.

## Design system

- Component primitives: shadcn/ui (new-york) only, in
  `client/src/components/ui/`. Do not introduce new component libraries.
- Tokens: defined in `client/src/index.css` `@theme inline`. Use semantic
  classes (`bg-background`, `bg-card`, `text-foreground`, `bg-primary`,
  `bg-accent`, `bg-destructive`, `border-border`, `ring-ring`).
- Brand palette (oklch, do not hex-substitute): `mango`, `mango-light`,
  `teal`, `teal-light`, `jeepney-red`, `warm-cream`, `earth-brown`,
  `success`. Mapping: `primary` = teal, `accent` = mango, `destructive` =
  jeepney-red, `background` = warm-cream.
- Fonts: `font-display` (Archivo Black) for headings, `font-body` (DM Sans)
  default, `font-mono` (JetBrains Mono) for code.
- Radius: `rounded-sm|md|lg|xl` only. No `rounded-[...]` arbitrary values.
- Merge classes via `cn` from `@/lib/utils`.

## Mobile-first

App is a PWA targeting Filipino micro-entrepreneurs on phones.

- Default styles target mobile. Use `sm: md: lg:` only to enhance for
  larger viewports.
- Min tap target 44px (`h-11` / `min-h-11`). Inputs `text-base` (16px) min
  to avoid iOS zoom.
- Pages on routes that show `BottomNav` need `pb-20` (or equivalent) so
  content isn't hidden.
- Test at 360×640 first.

## Path aliases

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`
