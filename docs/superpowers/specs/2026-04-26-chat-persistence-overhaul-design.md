# Chat persistence + Track L close-out — design

Date: 2026-04-26
Track: L (chatbot integration verified end-to-end) + spillover into M.4 prefill.

## Why

`docs/DEV_TASKS.md` Track L lists chatbot end-to-end as HIGH but unwired. Validation against the codebase (2026-04-26) found:

- Chat history stored in `sessionStorage` only — lost across tabs / browser restart. Profile auto-extract on `/profile` reads it and silently fails.
- `extractProfile` only fires from a manual Sparkles button on `/profile`. Onboarding never calls it.
- `roadmapReady` flips on the first assistant reply regardless of content quality.
- Full transcript (incl. welcome boilerplate) shipped to LLM each turn — unbounded.
- No `ChatFab` on `/roadmap`, `/forms`, `/grants`.
- `client/src/components/AIChatBox.tsx` is dead in main flow (only used by `pages/ComponentShowcase.tsx`).
- Header pills below 44px tap target. No IME composition guard on Enter. Quick-suggest pills hidden after first reply.

## Architecture

Server owns the transcript. Client treats `chatSessions/{uid}` as the source of truth via tRPC.

### Firestore schema

New collection `chatSessions/{uid}` (single doc per user — pattern matches `profiles/{uid}`):

```ts
type FirestoreChatSession = {
  uid: string;
  messages: Array<{ role: "user" | "assistant"; content: string; ts: Timestamp }>;
  roadmapReady: boolean;
  extractedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

Storage cap: trim to last **40 messages** on every write. LLM payload cap: last **12 messages**. Welcome message is render-only — never stored, never sent.

### `server/db.ts` additions

- `getChatSession(uid)` → `FirestoreChatSession | null`
- `appendChatMessages(uid, newMsgs, roadmapReady)` → trims, stamps `updatedAt`
- `clearChatSession(uid)` → wipes doc
- `setChatExtractedAt(uid)`

### `server/routers.ts` `ai` sub-router

- `ai.getSession` — `protectedProcedure.query` → `{ messages, roadmapReady }`
- `ai.chat({ content })` — `protectedProcedure.mutation`:
  1. Load session
  2. Append user msg
  3. Build LLM payload: system prompt + last 12 messages
  4. `invokeLLM(...)` wrapped in try/catch → on failure throw `TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM_UNAVAILABLE" })`
  5. Compute `roadmapReady` heuristic: `true` once any user msg matches both a business-type keyword (sari-sari, carinderia, ukay, tindahan, kainan, store, online, home-based) AND a Manila locality token (Tondo, Sampaloc, Ermita, Quiapo, Binondo, Malate, Pandacan, Sta Cruz, San Nicolas, Paco, Sta Mesa, San Miguel, Port Area, Manila). Sticky once true.
  6. `appendChatMessages(uid, [user, assistant], roadmapReady)`
  7. Return `{ content, roadmapReady }`
- `ai.clearSession` — mutation
- `ai.extractProfile({ messages? })` — when `messages` omitted, reads from Firestore session; calls `setChatExtractedAt` on success

### Client wiring

**`Home.tsx`**
- Replace local `useState<ChatMessage[]>` with `trpc.ai.getSession.useQuery()`
- Welcome message rendered locally when `messages.length === 0`; never stored
- `chatMutation.mutate({ content })`; optimistic-append via `utils.ai.getSession.setData`
- Read `roadmapReady` from response; remove client-side flip
- Typed error → `toast("Bumalik mamaya — busy ang AI 🙏")`
- IME guard: `if (e.nativeEvent.isComposing) return;` before send
- Header pills: `min-h-11 px-4 py-2.5`
- Quick-suggest pills always visible; context-aware copy after first reply (`["Magkano gagastusin?", "Anong forms kailangan?", "May grant ba ako?"]`)
- Drop unused `useAuth` destructure

**`Onboarding.tsx`**
- On mount, when profile empty + chat session has ≥2 messages, call `ai.extractProfile({})` once and prefill draft

**`Profile.tsx`**
- Sparkles button keeps manual re-extract; drop `sessionStorage.getItem("negosyonav_chat_history")` block — call `ai.extractProfile({})` directly

**New `client/src/components/ChatFab.tsx`**
- Fixed `bottom-20 right-4`, `h-14 w-14`, teal, `MessageCircle` icon
- Mounted in `Roadmap.tsx`, `Forms.tsx`, `Grants.tsx`

**Delete `client/src/components/AIChatBox.tsx`**
- Strip import + usage from `pages/ComponentShowcase.tsx`

## Tests

`server/routers.test.ts` additions:
- `ai.getSession` returns empty session when doc missing
- `ai.chat` appends user + assistant via mocked `appendChatMessages`, returns `roadmapReady: true` for `"sari-sari sa Tondo"`
- `ai.chat` returns `roadmapReady: false` for `"hello"`
- `ai.extractProfile` with no `messages` falls back to Firestore session

Mock additions in `vi.mock("./db", ...)`: `getChatSession`, `appendChatMessages`, `clearChatSession`, `setChatExtractedAt`.

## Migration

None. New collection. Orphan `sessionStorage["negosyonav_chat_history"]` keys ignored — code path deleted.

## Files touched

- `server/db.ts`
- `server/routers.ts`
- `server/routers.test.ts`
- `client/src/pages/Home.tsx`
- `client/src/pages/Onboarding.tsx`
- `client/src/pages/Profile.tsx`
- `client/src/components/ChatFab.tsx` (new)
- `client/src/components/AIChatBox.tsx` (delete)
- `client/src/pages/ComponentShowcase.tsx`
- `client/src/pages/Roadmap.tsx`, `Forms.tsx`, `Grants.tsx`
- `docs/DEV_TASKS.md` (mark Track L done)

## Out of scope

- "Tapusin / start over" UI button (helper exists, no surface this round)
- Streaming responses
- Voice input (Track I)
- Track M.3 signup→`/profile?onboarding=1` (Onboarding gate handles first-fill differently today)
