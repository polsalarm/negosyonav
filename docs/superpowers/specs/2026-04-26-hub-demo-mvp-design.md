# Hub Demo MVP — Design

**Date:** 2026-04-26
**Owner files:** `server/db.ts`, `server/routers.ts`, `server/scripts/seedHubPosts.ts` (new), `client/src/pages/Hub.tsx`, `client/src/pages/PostDetail.tsx` (new), `client/src/components/RoadmapTipsForStep.tsx` (new), `client/src/pages/Roadmap.tsx`, `client/src/App.tsx`, `package.json` (script).
**Tracks closed:** P (full), E (E.1–E.5), O.4 (`stepNumber` filter on `community.list` — coordinate with Track O for the rest).

## Goal

Make the Hub feel real and complete enough to demo without any tap landing on a broken state, and stitch peer tips into Roadmap steps so the brief's central retention claim is visible to judges.

## Non-goals (explicit)

- Moderation / flag / profanity guard
- Nested replies
- Sort by new / top / controversial (default `createdAt desc`)
- Push notifications on new comments
- Edit / delete post or comment
- Real avatars (keep initial-letter circle)
- Per-comment voting
- Anti-spam rate limiting

If judge asks → "Phase 2."

## Architecture

### Data model — Firestore

Extend `FirestorePost` in `server/db.ts`:

```ts
export type FirestorePost = {
  // existing fields...
  stepNumber?: number;       // 1..5, optional. Tags post to a roadmap step.
  commentCount: number;      // denormalized; bumped in addComment txn.
  seed?: boolean;            // marks idempotent demo seeds.
};
```

New subcollection `community_posts/{postId}/comments/{cid}`:

```ts
export type FirestoreComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  body: string;          // ≤500 chars
  createdAt: Date;
};
```

`post_votes/{uid_postId}` — unchanged.

### Helpers (`server/db.ts`)

- `getCommunityPosts(opts: { lguTag?, stepNumber?, limit? })` — extend existing.
- `getCommentsForPost(postId): Promise<FirestoreComment[]>` — new. Sort `createdAt asc`.
- `addCommentToPost(postId, userId, authorName, body): Promise<FirestoreComment>` — new. Firestore transaction: write comment doc + `FieldValue.increment(1)` on `commentCount`.

### tRPC procedures (`server/routers.ts community`)

| Procedure | Type | Change |
|---|---|---|
| `list` | query | Input gains `stepNumber?: number`. Returns `commentCount`. |
| `create` | protected mut | Input gains `stepNumber?: number`. |
| `vote` | protected mut | No change (works once seeds are real docs). |
| `myVotes` | protected query | No change — already exists, just gets called on Hub mount. |
| `comments` | query | New. `{ postId } → FirestoreComment[]`. |
| `addComment` | protected mut | New. `{ postId, body }` (body min 1, max 500). Transaction. |

### Seed script

`server/scripts/seedHubPosts.ts`:
- Idempotent — query `where("seed", "==", true)`, abort if any exist.
- Inserts the four current `SEED_POSTS` as real Firestore docs with `seed: true`, real `userId: "demo-aling-rosa"` etc., `createdAt` from the existing fixed dates.
- Two seeded comments on the top-voted post (Kuya Ben's fixer warning) so the demo opens a non-empty thread.
- Wired via `pnpm seed:hub` in `package.json`.

## UI

### `Hub.tsx` (edit)

- Drop `SEED_POSTS` constant + `dbPosts.length === 0 ? SEED_POSTS` fallback.
- Call `community.myVotes` on mount; map post.id → vote direction; color thumb buttons accordingly.
- Each post card gains comment count next to vote buttons (`MessageSquare` icon).
- Tap on card body navigates to `/hub/:postId`.
- Create-post sheet gains optional "Tag sa step" select (1..5 + blank). Sends `stepNumber` if set.

### `PostDetail.tsx` (new, route `/hub/:postId`)

- Top: same post card visual as Hub.
- Below: comment list (oldest first) + composer textarea (auth-gated, redirects to login if not signed in).
- Back arrow returns to `/hub`.
- Register `<Route path="/hub/:postId" component={PostDetail} />` in `App.tsx`. `BottomNav` already hides on `/login` etc.; verify `/hub/:postId` keeps BottomNav visible (it should, since `hideOn` is exact-match).

### `RoadmapTipsForStep.tsx` (new)

- Props: `{ stepNumber: number, lguTag: string }`.
- Calls `community.list({ stepNumber, lguTag })`, takes top 3 by `upvotes`.
- Renders compact rows: author initial circle, title (truncate), upvote count, "Basahin →" → `/hub/:id`.
- Empty state: "Wala pang tips sa step na ito. Maging una!" → button opens Hub create form pre-tagged with this step (deep-link `/hub?compose=1&step=2`, Hub.tsx reads query string).
- Mounted in `Roadmap.tsx` inside the expanded step view, below `StepOfficeCard`.

## Demo flow (the script this enables)

1. `/roadmap` → expand Step 2 (Barangay). Aling Rosa's tip surfaces inline.
2. Tap "Basahin →" → `/hub/<postId>`. Post + 2 seed comments load.
3. Tap thumbs-up. Count increments. Refresh — color persists (myVotes rehydrate).
4. Tap composer, type comment, submit. Appears at bottom; `commentCount` on Hub list ticks up.
5. Back to `/hub`. Filter "Babala" → Kuya Ben's fixer warning. Story closes.

## Tests (`server/routers.test.ts`)

- `community.addComment` — writes comment doc AND increments `commentCount` in same txn.
- `community.comments` — returns rows sorted `createdAt asc`.
- `community.list({ stepNumber: 2 })` — filters correctly, ignores untagged posts.
- `community.list` — `commentCount` field present and accurate after `addComment`.
- `community.vote` against a real Firestore post — upvote count increments by 1.
- `community.myVotes` — returns user's prior vote map after a vote.

DB-touching tests: skip when `serviceAccount.json` absent (`describe.skipIf`).

## Out-of-band

- Restrict the seed script to `NODE_ENV !== "production"` to avoid clobbering real prod data.
- The hardcoded `lguTag: "manila_city"` in Hub.tsx and the new tips component is fine while Track C (multi-LGU) hasn't landed — when it does, both read from `profile.lguId`.

## Definition of done

- `pnpm check` clean.
- `pnpm test` green (skips noted).
- Manual smoke at 360×640: Hub list, tap card → detail, vote (refresh persists), comment, back, roadmap step tip surfaces, "Basahin" deep-link works.
- No `SEED_POSTS` constant left in `Hub.tsx`.
- `pnpm seed:hub` is idempotent (run twice → second run is a no-op).
- Token-only colors, no new hex.
