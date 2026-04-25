# Hub Demo MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Negosyante Hub demo-ready: kill broken seed posts, persist vote state across refresh, add one-level comments, and stitch peer tips into Roadmap steps so the brief's central retention claim is visible to judges.

**Architecture:** Three slices. (1) Backend: extend `community_posts` doc with `stepNumber` + `commentCount`, add `comments` subcollection, two new tRPC procedures (`comments`, `addComment`). (2) Seed script: convert hardcoded `SEED_POSTS` into idempotent real Firestore docs. (3) Client: drop seed fallback, wire `myVotes` rehydration, add `/hub/:postId` detail page with composer, add `RoadmapTipsForStep` mounted inside expanded roadmap step cards.

**Tech Stack:** Firestore (admin SDK + transactions), tRPC v11 + zod, React 19 + wouter, vitest.

**Spec:** `docs/superpowers/specs/2026-04-26-hub-demo-mvp-design.md`

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `server/db.ts` | modify | Extend `FirestorePost` type (`stepNumber?`, `commentCount`, `seed?`); add `FirestoreComment` type; extend `getCommunityPosts` with `stepNumber` filter + return `commentCount`; add `getCommentsForPost`, `addCommentToPost`. |
| `server/routers.ts` | modify | Extend `community.list` zod input with `stepNumber?`; extend `community.create` with `stepNumber?`; add `community.comments` query and `community.addComment` protected mutation. |
| `server/scripts/seedHubPosts.ts` | create | Idempotent script: insert four demo posts + two seeded comments on the warning post. |
| `package.json` | modify | Add `seed:hub` script. |
| `server/routers.test.ts` | modify | Add tests for new procedures + extended ones. |
| `client/src/pages/Hub.tsx` | modify | Drop `SEED_POSTS`; wire `myVotes` on mount; show comment count; tap card → detail; "Tag sa step" select in composer; read `?compose=1&step=N` query string. |
| `client/src/pages/PostDetail.tsx` | create | New route `/hub/:postId`. Post card + comment list + composer (auth-gated). |
| `client/src/App.tsx` | modify | Register `/hub/:postId` route. |
| `client/src/components/RoadmapTipsForStep.tsx` | create | Top-3 step-tagged posts for a step+lgu; deep-link "Basahin →" + empty-state CTA. |
| `client/src/pages/Roadmap.tsx` | modify | Mount `RoadmapTipsForStep` after `StepOfficeCard` inside the expanded step view. |

---

## Task 1: Extend `FirestorePost` type and add `FirestoreComment`

**Files:**
- Modify: `server/db.ts:62-75`

- [ ] **Step 1: Extend `FirestorePost` and add `FirestoreComment` type**

In `server/db.ts`, replace the existing `FirestorePost` block with:

```ts
export type FirestorePost = {
  id: string;
  userId: string;
  authorName: string;
  lguTag: string;
  category: "tip" | "warning" | "question" | "experience";
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  isFlagged: boolean;
  stepNumber?: number;
  commentCount: number;
  seed?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FirestoreComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: Date;
};
```

- [ ] **Step 2: Verify type-check still passes**

Run: `pnpm check`
Expected: PASS (call sites still compile because new fields are optional or have defaults below).

- [ ] **Step 3: Commit**

```bash
git add server/db.ts
git commit -m "feat(hub): extend FirestorePost with stepNumber + commentCount; add FirestoreComment"
```

---

## Task 2: Update `getCommunityPosts` to filter by stepNumber and return commentCount

**Files:**
- Modify: `server/db.ts:220-244`

- [ ] **Step 1: Replace `getCommunityPosts` signature and body**

```ts
export async function getCommunityPosts(
  opts: { lguTag?: string; stepNumber?: number; limit?: number } = {}
): Promise<FirestorePost[]> {
  const { lguTag, stepNumber, limit = 50 } = opts;
  let q: FirebaseFirestore.Query = db().collection("community_posts");
  if (lguTag) q = q.where("lguTag", "==", lguTag);
  if (typeof stepNumber === "number") q = q.where("stepNumber", "==", stepNumber);
  q = q.orderBy("createdAt", "desc").limit(limit);

  const snapshot = await q.get();
  return snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      userId: d.userId,
      authorName: d.authorName,
      lguTag: d.lguTag,
      category: d.category,
      title: d.title,
      content: d.content,
      upvotes: d.upvotes ?? 0,
      downvotes: d.downvotes ?? 0,
      isFlagged: d.isFlagged ?? false,
      stepNumber: typeof d.stepNumber === "number" ? d.stepNumber : undefined,
      commentCount: typeof d.commentCount === "number" ? d.commentCount : 0,
      seed: d.seed === true,
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
    };
  });
}
```

- [ ] **Step 2: Update existing call site in `server/routers.ts community.list`**

Find the line `return getCommunityPosts(input?.lguTag);` and replace with `return getCommunityPosts(input ?? {});`. (Schema input update happens in Task 6.)

- [ ] **Step 3: Verify type-check passes**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/db.ts server/routers.ts
git commit -m "feat(hub): getCommunityPosts accepts options object with stepNumber filter"
```

---

## Task 3: Update `createCommunityPost` to accept `stepNumber` and initialize `commentCount`

**Files:**
- Modify: `server/db.ts:246-262`

- [ ] **Step 1: Replace function**

```ts
export async function createCommunityPost(post: {
  userId: string;
  authorName: string;
  title: string;
  content: string;
  category: "tip" | "warning" | "question" | "experience";
  lguTag: string;
  stepNumber?: number;
}): Promise<{ id: string }> {
  const ref = await db().collection("community_posts").add({
    ...post,
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
    isFlagged: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}
```

- [ ] **Step 2: Verify type-check**

Run: `pnpm check`
Expected: PASS — existing `community.create` caller ignores the returned `{ id }`.

- [ ] **Step 3: Commit**

```bash
git add server/db.ts
git commit -m "feat(hub): createCommunityPost accepts stepNumber, initializes commentCount, returns id"
```

---

## Task 4: Add `getCommentsForPost` and `addCommentToPost` helpers

**Files:**
- Modify: `server/db.ts` — append after `getUserVotes` (line 311).

- [ ] **Step 1: Append helpers**

```ts
export async function getCommentsForPost(postId: string): Promise<FirestoreComment[]> {
  const snap = await db()
    .collection("community_posts").doc(postId)
    .collection("comments")
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      postId,
      userId: d.userId,
      authorName: d.authorName,
      body: String(d.body ?? ""),
      createdAt: toDate(d.createdAt),
    };
  });
}

export async function addCommentToPost(
  postId: string,
  userId: string,
  authorName: string,
  body: string
): Promise<FirestoreComment> {
  const postRef = db().collection("community_posts").doc(postId);
  const commentRef = postRef.collection("comments").doc();

  const now = new Date();
  await db().runTransaction(async tx => {
    const post = await tx.get(postRef);
    if (!post.exists) throw new Error("Post not found");
    tx.set(commentRef, {
      postId,
      userId,
      authorName,
      body,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(postRef, {
      commentCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { id: commentRef.id, postId, userId, authorName, body, createdAt: now };
}
```

- [ ] **Step 2: Verify type-check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/db.ts
git commit -m "feat(hub): add getCommentsForPost + addCommentToPost (transactional commentCount bump)"
```

---

## Task 5: Add `community.comments` query and `community.addComment` mutation

**Files:**
- Modify: `server/routers.ts` — `community` router (around line 507).
- Modify: `server/routers.ts` — top imports.

- [ ] **Step 1: Add new helpers to imports**

Find the existing `import { ... } from "./db"` line that brings in `createCommunityPost`. Add `getCommentsForPost`, `addCommentToPost` to that import list.

- [ ] **Step 2: Insert two new procedures inside the `community` router**

Insert AFTER the existing `myVotes` procedure (so the order is `list, create, vote, myVotes, comments, addComment`):

```ts
    comments: publicProcedure
      .input(z.object({ postId: z.string().min(1) }))
      .query(async ({ input }) => {
        return getCommentsForPost(input.postId);
      }),

    addComment: protectedProcedure
      .input(z.object({
        postId: z.string().min(1),
        body: z.string().trim().min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        return addCommentToPost(
          input.postId,
          ctx.user.uid,
          ctx.user.name || "Anonymous Negosyante",
          input.body,
        );
      }),
```

- [ ] **Step 3: Verify type-check passes**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routers.ts
git commit -m "feat(hub): add community.comments + community.addComment tRPC procedures"
```

---

## Task 6: Extend `community.list` and `community.create` zod inputs with `stepNumber`

**Files:**
- Modify: `server/routers.ts` — `community.list` and `community.create` definitions.

- [ ] **Step 1: Update `community.list` input**

Replace:

```ts
    list: protectedProcedure
      .input(z.object({ lguTag: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return getCommunityPosts(input ?? {});
      }),
```

with:

```ts
    list: protectedProcedure
      .input(z.object({
        lguTag: z.string().optional(),
        stepNumber: z.number().int().min(1).max(20).optional(),
      }).optional())
      .query(async ({ input }) => {
        return getCommunityPosts(input ?? {});
      }),
```

- [ ] **Step 2: Update `community.create` input + pass through `stepNumber`**

Replace the existing `create` block with:

```ts
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(5).max(500),
        content: z.string().min(10),
        category: z.enum(["tip", "warning", "question", "experience"]),
        lguTag: z.string().default("manila_city"),
        stepNumber: z.number().int().min(1).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id } = await createCommunityPost({
          userId: ctx.user.uid,
          authorName: ctx.user.name || "Anonymous Negosyante",
          title: input.title,
          content: input.content,
          category: input.category,
          lguTag: input.lguTag,
          stepNumber: input.stepNumber,
        });
        return { success: true, id };
      }),
```

- [ ] **Step 3: Verify type-check passes**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routers.ts
git commit -m "feat(hub): community.list/create accept stepNumber filter+tag"
```

---

## Task 7: Backend tests — comments + stepNumber filter

**Files:**
- Modify: `server/routers.test.ts`

> Existing tests in this file already use the legacy `TrpcContext.user` shape with stub mocks of `db.ts` helpers. Follow the existing pattern — do NOT introduce real Firestore. Mock the new helpers the same way.

- [ ] **Step 1: Locate the existing community-router test block**

Open `server/routers.test.ts`. Look for `describe("community"` (around line 280-340). Note how it mocks `getCommunityPosts`, `voteOnPost`, etc. via `vi.mock("./db", …)` at the top of the file.

- [ ] **Step 2: Add `getCommentsForPost` and `addCommentToPost` to the existing `vi.mock("./db", …)` factory**

Find the `vi.mock("./db"` block. Add to its return object (alongside `getCommunityPosts`, `createCommunityPost`, etc.):

```ts
  getCommentsForPost: vi.fn(),
  addCommentToPost: vi.fn(),
```

- [ ] **Step 3: Add four new tests inside `describe("community"`**

```ts
  it("comments returns rows from getCommentsForPost", async () => {
    const fake = [
      { id: "c1", postId: "p1", userId: "u1", authorName: "Aling Rosa", body: "Salamat!", createdAt: new Date("2026-04-25") },
    ];
    vi.mocked(getCommentsForPost).mockResolvedValueOnce(fake);
    const caller = appRouter.createCaller(buildCtx());
    const out = await caller.community.comments({ postId: "p1" });
    expect(out).toEqual(fake);
    expect(getCommentsForPost).toHaveBeenCalledWith("p1");
  });

  it("addComment calls helper with uid + name + body", async () => {
    const created = { id: "c2", postId: "p1", userId: "uid-1", authorName: "Test User", body: "Tapos na ako!", createdAt: new Date() };
    vi.mocked(addCommentToPost).mockResolvedValueOnce(created);
    const caller = appRouter.createCaller(buildCtx({ uid: "uid-1", name: "Test User" }));
    const out = await caller.community.addComment({ postId: "p1", body: "Tapos na ako!" });
    expect(out).toEqual(created);
    expect(addCommentToPost).toHaveBeenCalledWith("p1", "uid-1", "Test User", "Tapos na ako!");
  });

  it("addComment rejects body shorter than 1 char", async () => {
    const caller = appRouter.createCaller(buildCtx());
    await expect(caller.community.addComment({ postId: "p1", body: "   " })).rejects.toThrow();
  });

  it("list passes stepNumber through to getCommunityPosts", async () => {
    vi.mocked(getCommunityPosts).mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(buildCtx());
    await caller.community.list({ lguTag: "manila_city", stepNumber: 2 });
    expect(getCommunityPosts).toHaveBeenCalledWith({ lguTag: "manila_city", stepNumber: 2 });
  });
```

> If the existing helpers `buildCtx` are named differently in this file, adjust accordingly — the file already builds a TrpcContext fixture; reuse what's there.

- [ ] **Step 4: Run the new tests**

Run: `pnpm test -- server/routers.test.ts`
Expected: PASS for all four new tests; existing tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add server/routers.test.ts
git commit -m "test(hub): cover community.comments, addComment, stepNumber filter"
```

---

## Task 8: Idempotent seed script for demo posts + comments

**Files:**
- Create: `server/scripts/seedHubPosts.ts`
- Modify: `package.json` (add script)

- [ ] **Step 1: Create seed script**

```ts
// server/scripts/seedHubPosts.ts
// Seeds four demo Hub posts + 2 comments on the fixer-warning post.
// Idempotent: aborts if any doc with seed: true exists.
// Run: pnpm seed:hub  (requires serviceAccount.json + NODE_ENV != production)

import "../_core/firebaseAdmin";
import { adminDb } from "../_core/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed in production.");
  process.exit(1);
}
if (!adminDb) {
  console.error("Firestore not initialized — is serviceAccount.json present?");
  process.exit(1);
}

const POSTS = [
  {
    userId: "demo-aling-rosa",
    authorName: "Aling Rosa",
    lguTag: "manila_city",
    category: "tip" as const,
    stepNumber: 4, // Mayor's Permit
    title: "Mabilis lang kumuha ng permit sa E-BOSS Lounge!",
    content: "Kung pupunta kayo sa Manila City Hall para sa Mayor's Permit, diretso kayo sa E-BOSS Lounge sa Ground Floor. Hindi kayo kailangan pumila sa Room 110. Natapos ako in 2 hours lang! Bring complete documents ha.",
    upvotes: 24,
    downvotes: 1,
    createdAt: new Date("2026-04-20T08:00:00Z"),
  },
  {
    userId: "demo-kuya-ben",
    authorName: "Kuya Ben",
    lguTag: "manila_city",
    category: "warning" as const,
    stepNumber: 4,
    title: "Mag-ingat sa mga fixer sa labas ng City Hall!",
    content: "May mga tao sa labas ng Manila City Hall na mag-ooffer na 'tulungan' kayo sa permit. Huwag kayong papayag — ₱3,000-₱5,000 ang singil nila para sa process na kaya niyong gawin mag-isa. Lahat ng info nasa NegosyoNav na! Kaya niyo 'to!",
    upvotes: 42,
    downvotes: 0,
    createdAt: new Date("2026-04-18T10:00:00Z"),
  },
  {
    userId: "demo-maria-santos",
    authorName: "Maria Santos",
    lguTag: "manila_city",
    category: "experience" as const,
    title: "Nakapag-register na ako ng carinderia ko sa Sampaloc!",
    content: "Salamat sa NegosyoNav! Hindi ko alam dati na kailangan ko pala ng Cedula bago Mayor's Permit. Natapos ko lahat in 1 week lang. Total gastos ko: ₱6,200. Nag-apply din ako sa BMBE para sa tax exemption. Kaya niyo rin 'to mga ka-negosyante!",
    upvotes: 18,
    downvotes: 0,
    createdAt: new Date("2026-04-15T14:00:00Z"),
  },
  {
    userId: "demo-tatay-jun",
    authorName: "Tatay Jun",
    lguTag: "manila_city",
    category: "question" as const,
    stepNumber: 4,
    title: "Kailangan ba talaga ng Fire Safety Certificate para sa sari-sari store?",
    content: "Nag-apply ako ng Mayor's Permit para sa maliit na sari-sari store sa Tondo. Sabi nila kailangan ko ng FSIC from BFP. Pero maliit lang naman ang tindahan ko, attached sa bahay. May exemption ba para sa ganito?",
    upvotes: 8,
    downvotes: 0,
    createdAt: new Date("2026-04-12T09:00:00Z"),
  },
];

const COMMENTS_ON_WARNING_POST = [
  {
    userId: "demo-aling-rosa",
    authorName: "Aling Rosa",
    body: "Totoo 'to! Halos napaglaruan ako noong una. Mabuti at hindi ako pumayag.",
    createdAt: new Date("2026-04-19T03:00:00Z"),
  },
  {
    userId: "demo-maria-santos",
    authorName: "Maria Santos",
    body: "+1. Ang tagal nilang mag-explain pero kapag tinanong mo lang sa guard, libre namang sagot.",
    createdAt: new Date("2026-04-19T05:30:00Z"),
  },
];

async function main() {
  const col = adminDb!.collection("community_posts");

  const existing = await col.where("seed", "==", true).limit(1).get();
  if (!existing.empty) {
    console.log("Seed posts already present — aborting (idempotent).");
    return;
  }

  let warningPostId: string | null = null;

  for (const p of POSTS) {
    const ref = await col.add({
      ...p,
      isFlagged: false,
      commentCount: p.category === "warning" ? COMMENTS_ON_WARNING_POST.length : 0,
      seed: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (p.category === "warning") warningPostId = ref.id;
    console.log(`  + ${p.category.padEnd(11)} ${ref.id}  ${p.title.slice(0, 60)}`);
  }

  if (warningPostId) {
    const commentsCol = col.doc(warningPostId).collection("comments");
    for (const c of COMMENTS_ON_WARNING_POST) {
      const ref = await commentsCol.add(c);
      console.log(`    └ comment ${ref.id} from ${c.authorName}`);
    }
  }

  console.log(`Seeded ${POSTS.length} posts + ${COMMENTS_ON_WARNING_POST.length} comments.`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add `seed:hub` script to `package.json`**

Open `package.json`. In the `"scripts"` section, add:

```json
"seed:hub": "tsx server/scripts/seedHubPosts.ts",
```

- [ ] **Step 3: Run seed script (DO NOT skip — needed for end-to-end test)**

Run: `pnpm seed:hub`
Expected output:
```
  + tip         <id>  Mabilis lang kumuha ng permit sa E-BOSS Lounge!
  + warning     <id>  Mag-ingat sa mga fixer sa labas ng City Hall!
  + experience  <id>  Nakapag-register na ako ng carinderia ko sa Sampaloc!
  + question    <id>  Kailangan ba talaga ng Fire Safety Certificate para sa sari-sari store?
    └ comment <id> from Aling Rosa
    └ comment <id> from Maria Santos
Seeded 4 posts + 2 comments.
```

> If `serviceAccount.json` is missing, the script will exit with an error. Drop the file in CWD and rerun.

- [ ] **Step 4: Verify idempotency**

Run: `pnpm seed:hub` (second time)
Expected output: `Seed posts already present — aborting (idempotent).`

- [ ] **Step 5: Commit**

```bash
git add server/scripts/seedHubPosts.ts package.json
git commit -m "chore(hub): idempotent seed script for demo posts + comments"
```

---

## Task 9: Drop `SEED_POSTS` from Hub.tsx, wire `myVotes` rehydration, show comment count

**Files:**
- Modify: `client/src/pages/Hub.tsx`

- [ ] **Step 1: Remove `SEED_POSTS` constant and the fallback**

Delete lines 53-110 (the `SEED_POSTS` array). Replace the `useMemo` block at lines 132-138 with:

```tsx
  const allPosts = useMemo(() => dbPosts ?? [], [dbPosts]);
```

- [ ] **Step 2: Add `myVotes` query and a vote-direction map**

Below the `voteMutation` declaration, add:

```tsx
  const { data: myVotesData } = trpc.community.myVotes.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const myVoteByPost = useMemo(() => {
    const m = new Map<string, "up" | "down">();
    for (const v of myVotesData ?? []) m.set(v.postId, v.voteType);
    return m;
  }, [myVotesData]);
```

- [ ] **Step 3: Color thumb buttons by prior vote + add comment count**

In the post card render, replace the existing "Post Actions" block (lines ~296-311) with:

```tsx
                <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4">
                  <button
                    onClick={() => handleVote(post.id, "up")}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      myVoteByPost.get(post.id) === "up" ? "text-teal" : "text-muted-foreground hover:text-teal"
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="font-[var(--font-mono)]">{post.upvotes}</span>
                  </button>
                  <button
                    onClick={() => handleVote(post.id, "down")}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      myVoteByPost.get(post.id) === "down" ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span className="font-[var(--font-mono)]">{post.downvotes}</span>
                  </button>
                  <button
                    onClick={() => navigate(`/hub/${post.id}`)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-earth-brown transition-colors ml-auto"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="font-[var(--font-mono)]">{post.commentCount ?? 0}</span>
                  </button>
                </div>
```

- [ ] **Step 4: Make the post body tappable → detail page**

Wrap the post header section (the `<div className="px-4 pt-4 pb-2">` containing avatar + title + content) in a clickable wrapper. Replace the opening `<div className="px-4 pt-4 pb-2">` with:

```tsx
                <button
                  onClick={() => navigate(`/hub/${post.id}`)}
                  className="w-full text-left px-4 pt-4 pb-2"
                >
```

And replace the matching closing `</div>` with `</button>`.

- [ ] **Step 5: Update lucide-react import**

In the import block at top, add `MessageSquare` to the existing `lucide-react` import.

- [ ] **Step 6: Verify type-check + manual smoke**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm dev` and load `http://localhost:3000/hub`. Confirm:
- Four real seed posts render (not the deleted SEED_POSTS).
- Comment count shows "2" on the fixer-warning post, "0" on the others.
- After voting on a post and refreshing, the thumb stays colored.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Hub.tsx
git commit -m "feat(hub): drop SEED_POSTS fallback, rehydrate myVotes, show comment count"
```

---

## Task 10: Add "Tag sa step" select to compose form + deep-link query support

**Files:**
- Modify: `client/src/pages/Hub.tsx`

- [ ] **Step 1: Add `newStepNumber` state**

Below the existing `useState` for `newCategory`, add:

```tsx
  const [newStepNumber, setNewStepNumber] = useState<number | "">("");
```

- [ ] **Step 2: Read `?compose=1&step=N` query string on mount**

Below the existing `useState` lines, add:

```tsx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("compose") === "1") {
      setShowCreateForm(true);
      const s = Number(params.get("step"));
      if (Number.isInteger(s) && s >= 1 && s <= 20) setNewStepNumber(s);
    }
  }, []);
```

Add `useEffect` to the React import at the top of the file.

- [ ] **Step 3: Add the step select inside the compose sheet**

After the category selector div (around line 379, just before the title `<input>`), insert:

```tsx
              <select
                value={newStepNumber}
                onChange={(e) => setNewStepNumber(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 mb-3 font-[var(--font-body)]"
              >
                <option value="">Walang step tag (general)</option>
                <option value={1}>Step 1 — DTI Business Name</option>
                <option value={2}>Step 2 — Barangay Clearance</option>
                <option value={3}>Step 3 — Cedula</option>
                <option value={4}>Step 4 — Mayor's Permit</option>
                <option value={5}>Step 5 — BIR Registration</option>
              </select>
```

- [ ] **Step 4: Pass `stepNumber` to the `create` mutation**

Update `handleCreatePost`:

```tsx
    createPost.mutate({
      title: newTitle,
      content: newContent,
      category: newCategory,
      lguTag: "manila_city",
      stepNumber: typeof newStepNumber === "number" ? newStepNumber : undefined,
    });
```

Also reset `setNewStepNumber("")` in the existing `onSuccess` reset block.

- [ ] **Step 5: Verify type-check + manual smoke**

Run: `pnpm check`
Expected: PASS.

Manual: in dev, open `/hub?compose=1&step=2`. The composer should auto-open with "Step 2 — Barangay Clearance" pre-selected.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Hub.tsx
git commit -m "feat(hub): step-tag select in composer + ?compose=1&step=N deep link"
```

---

## Task 11: Create `PostDetail.tsx` page

**Files:**
- Create: `client/src/pages/PostDetail.tsx`

- [ ] **Step 1: Write the page**

```tsx
/*
 * PostDetail — Single Hub post + comment thread.
 * Route: /hub/:postId
 */
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Streamdown } from "streamdown";
import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Send,
  AlertTriangle,
  Lightbulb,
  HelpCircle,
  Star,
  Shield,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Lightbulb> = {
  tip: Lightbulb,
  warning: AlertTriangle,
  question: HelpCircle,
  experience: Star,
};

const CATEGORY_LABELS: Record<string, string> = {
  tip: "Tip",
  warning: "Babala",
  question: "Tanong",
  experience: "Kwento",
};

export default function PostDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ postId: string }>();
  const postId = params.postId;
  const { isAuthenticated } = useAuth();
  const [body, setBody] = useState("");

  const { data: posts, refetch: refetchPosts } = trpc.community.list.useQuery({ lguTag: "manila_city" });
  const post = useMemo(() => posts?.find(p => p.id === postId), [posts, postId]);

  const { data: comments, refetch: refetchComments } =
    trpc.community.comments.useQuery({ postId }, { enabled: !!postId });

  const { data: myVotesData } = trpc.community.myVotes.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const myVote = useMemo(
    () => myVotesData?.find(v => v.postId === postId)?.voteType,
    [myVotesData, postId]
  );

  const voteMutation = trpc.community.vote.useMutation({ onSuccess: () => refetchPosts() });
  const addComment = trpc.community.addComment.useMutation({
    onSuccess: () => {
      setBody("");
      refetchComments();
      refetchPosts();
    },
  });

  const handleVote = (voteType: "up" | "down") => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    voteMutation.mutate({ postId, voteType });
  };

  const handleSubmit = () => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    addComment.mutate({ postId, body: trimmed });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("fil-PH", { month: "short", day: "numeric" });
  };

  if (!posts) {
    return <div className="min-h-screen bg-warm-cream p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!post) {
    return (
      <div className="min-h-screen bg-warm-cream p-8 text-center">
        <p className="text-sm text-muted-foreground mb-3">Hindi nahanap ang post na ito.</p>
        <Button onClick={() => navigate("/hub")}>Bumalik sa Hub</Button>
      </div>
    );
  }

  const Icon = CATEGORY_ICONS[post.category] || Lightbulb;

  return (
    <div className="min-h-screen bg-warm-cream pb-20">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button onClick={() => navigate("/hub")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-[var(--font-display)] text-base text-earth-brown">Post</h1>
        </div>
      </header>

      <div className="container max-w-2xl py-4 space-y-3">
        {/* Post card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center">
                <span className="text-xs font-bold text-teal">{post.authorName.charAt(0)}</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">{post.authorName}</div>
                <div className="text-[10px] text-muted-foreground">{formatDate(post.createdAt)}</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              <Icon className="w-3 h-3" />
              {CATEGORY_LABELS[post.category]}
            </span>
          </div>

          {post.category === "warning" && (
            <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-red-50 border border-red-200 rounded-lg">
              <Shield className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] font-semibold text-red-700">FIXER WARNING</span>
            </div>
          )}

          <h2 className="text-base font-bold text-earth-brown leading-snug mb-2">{post.title}</h2>
          <div className="text-sm text-muted-foreground leading-relaxed mb-3">
            <Streamdown>{post.content}</Streamdown>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-border/50">
            <button
              onClick={() => handleVote("up")}
              className={`flex items-center gap-1 text-xs ${myVote === "up" ? "text-teal" : "text-muted-foreground hover:text-teal"}`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span className="font-[var(--font-mono)]">{post.upvotes}</span>
            </button>
            <button
              onClick={() => handleVote("down")}
              className={`flex items-center gap-1 text-xs ${myVote === "down" ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span className="font-[var(--font-mono)]">{post.downvotes}</span>
            </button>
          </div>
        </div>

        {/* Comments */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-earth-brown px-1">Mga Sagot ({post.commentCount ?? 0})</h3>
          <AnimatePresence>
            {(comments ?? []).map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                className="bg-white rounded-xl border border-border p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-mango/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-mango">{c.authorName.charAt(0)}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-8">{c.body}</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {comments && comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Wala pang sagot. Maging una!</p>
          )}
        </section>

        {/* Composer */}
        <div className="bg-white rounded-xl border border-border p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={isAuthenticated ? "I-share ang sagot mo…" : "Mag-login para mag-comment"}
            rows={3}
            maxLength={500}
            disabled={!isAuthenticated}
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 resize-none font-[var(--font-body)] disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground font-[var(--font-mono)]">{body.length}/500</span>
            <Button
              onClick={handleSubmit}
              disabled={body.trim().length === 0 || addComment.isPending || !isAuthenticated}
              className="bg-teal hover:bg-teal/90 text-white text-xs px-3 py-1.5 h-auto rounded-full"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              {addComment.isPending ? "Ipinopost…" : "I-post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/PostDetail.tsx
git commit -m "feat(hub): PostDetail page with comment list + composer"
```

---

## Task 12: Register `/hub/:postId` route in App.tsx

**Files:**
- Modify: `client/src/App.tsx:38`

- [ ] **Step 1: Add import**

After `import Hub from "./pages/Hub";` add:

```tsx
import PostDetail from "./pages/PostDetail";
```

- [ ] **Step 2: Add route**

Right after `<Route path={"/hub"} component={Hub} />`, add:

```tsx
              <Route path={"/hub/:postId"} component={PostDetail} />
```

- [ ] **Step 3: Verify type-check + smoke**

Run: `pnpm check`
Expected: PASS.

Manual: In dev, click a Hub post card → URL becomes `/hub/<id>`, the detail page renders. Add a comment, verify it appears + count on Hub list increments.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(hub): register /hub/:postId route"
```

---

## Task 13: Create `RoadmapTipsForStep.tsx` component

**Files:**
- Create: `client/src/components/RoadmapTipsForStep.tsx`

- [ ] **Step 1: Write component**

```tsx
/*
 * RoadmapTipsForStep — surfaces top-3 step-tagged Hub posts inside a roadmap step.
 */
import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ThumbsUp, MessageCircle, Plus } from "lucide-react";

interface Props {
  stepNumber: number;
  lguTag: string;
}

export function RoadmapTipsForStep({ stepNumber, lguTag }: Props) {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.community.list.useQuery({ stepNumber, lguTag });

  const top3 = useMemo(() => {
    return [...(data ?? [])]
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, 3);
  }, [data]);

  if (isLoading) return null;

  if (top3.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border bg-white/50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-earth-brown">Walang tips pa rito.</p>
            <p className="text-[10px] text-muted-foreground">Maging unang mag-share ng experience mo sa step na ito.</p>
          </div>
          <button
            onClick={() => navigate(`/hub?compose=1&step=${stepNumber}`)}
            className="inline-flex items-center gap-1 text-xs text-teal hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Mag-share
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1.5 px-1">
        <MessageCircle className="w-3.5 h-3.5 text-mango" />
        <h4 className="text-xs font-semibold text-earth-brown">Tips mula sa Negosyante Hub</h4>
      </div>
      {top3.map(post => (
        <button
          key={post.id}
          onClick={() => navigate(`/hub/${post.id}`)}
          className="w-full text-left bg-white rounded-xl border border-border p-3 hover:border-teal/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-earth-brown line-clamp-2">{post.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">— {post.authorName}</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
              <ThumbsUp className="w-3 h-3" />
              <span className="font-[var(--font-mono)]">{post.upvotes}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RoadmapTipsForStep.tsx
git commit -m "feat(hub): RoadmapTipsForStep component"
```

---

## Task 14: Mount `RoadmapTipsForStep` inside expanded step view in Roadmap.tsx

**Files:**
- Modify: `client/src/pages/Roadmap.tsx`

- [ ] **Step 1: Import component**

Below `import { StepOfficeCard } from "@/components/StepOfficeCard";`, add:

```tsx
import { RoadmapTipsForStep } from "@/components/RoadmapTipsForStep";
```

- [ ] **Step 2: Mount after `StepOfficeCard`**

Find the line `<StepOfficeCard step={step} profile={profile} />` (around line 144). On the next line, add:

```tsx
                  <RoadmapTipsForStep stepNumber={step.step_number} lguTag="manila_city" />
```

- [ ] **Step 3: Verify type-check + smoke**

Run: `pnpm check`
Expected: PASS.

Manual: In dev, open `/roadmap`, expand Step 4 (Mayor's Permit). The "Tips mula sa Negosyante Hub" section shows three seeded posts (Aling Rosa's E-BOSS tip, Kuya Ben's fixer warning, Tatay Jun's question). Tap "Basahin →" / card body → navigates to `/hub/<id>`.

Expand Step 1 (DTI). Empty-state card renders with "Mag-share" link → navigates to `/hub?compose=1&step=1` and the composer auto-opens with Step 1 pre-selected.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Roadmap.tsx
git commit -m "feat(roadmap): mount RoadmapTipsForStep inside expanded step view"
```

---

## Task 15: Final smoke pass at 360×640

**Files:** none.

- [ ] **Step 1: Open Chrome DevTools at 360×640**

Run: `pnpm dev`. Open `http://localhost:3000` in Chrome. DevTools → device toolbar → custom 360×640.

- [ ] **Step 2: Walk the demo script**

Verify each:
1. `/roadmap` → expand Step 4. Tip card renders inline, tap "Basahin →" on Aling Rosa's tip.
2. URL becomes `/hub/<id>`. Two seeded comments render.
3. Tap thumbs-up. Counter increments.
4. Refresh. Thumb stays colored teal.
5. Type a comment, submit. Appears at the bottom.
6. Back arrow → `/hub`. Comment count on the warning post shows 3.
7. Filter "Babala" → only Kuya Ben's post visible.
8. Tap "Mag-post" → composer opens, "Tag sa step" shows.
9. No horizontal overflow at 360×640. BottomNav not covering CTAs.

- [ ] **Step 3: Run full test suite once**

Run: `pnpm test`
Expected: PASS (skips for DB-touching tests are fine if `serviceAccount.json` absent in test env).

- [ ] **Step 4: Final commit (if any cleanup)**

If smoke surfaced no issues, no extra commit. Otherwise patch + `git commit -m "fix(hub): smoke-pass cleanup"`.

---

## Self-review checklist (run after writing — outcomes)

**Spec coverage:**
- Schema: `stepNumber`, `commentCount`, `seed`, `FirestoreComment` → Task 1 ✓
- Helpers: `getCommunityPosts(opts)`, `getCommentsForPost`, `addCommentToPost` (txn) → Tasks 2, 4 ✓
- Procedures: `list` w/ `stepNumber`, `create` w/ `stepNumber`, `comments`, `addComment` → Tasks 5, 6 ✓
- Seed script + idempotency + `pnpm seed:hub` → Task 8 ✓
- Hub.tsx: drop SEED_POSTS, myVotes rehydrate, comment count, tap-to-detail, step tag in compose, deep-link → Tasks 9, 10 ✓
- PostDetail page + route → Tasks 11, 12 ✓
- RoadmapTipsForStep component + mount → Tasks 13, 14 ✓
- Tests: addComment txn (covered indirectly via mock), comments order, list stepNumber filter, body length validation → Task 7 ✓
- Vote against real post → covered by existing test fixture; Task 15 verifies live.
- Demo flow + 360×640 smoke → Task 15 ✓

**Out-of-scope honored:** No moderation, nesting, sort, push, edit/delete, avatars, comment voting, rate-limit. ✓

**Type consistency:** `getCommunityPosts(opts: { lguTag?, stepNumber?, limit? })` consistent across Tasks 2, 5, 6 (router calls), 7 (test asserts the same shape).
