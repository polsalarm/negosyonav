# Tracker: editing `docs/DEV_TASKS.md` safely

`docs/DEV_TASKS.md` is the queue parallel devs read. Silent rewrites desync them and create the conflicts the doc exists to prevent. **Annotate, don't replace.** Today's date is in your environment context — use that.

## Status markers

Append to the existing bullet text, do not delete the original wording.

### Done
```
- A.1 Add `pdf-lib` dependency. — ✅ done 2026-04-25
```

### Partial
```
- B.4 Server-side: when `progress.get` runs and `lastTouchedAt` > 3 days ago … — 🟡 partial 2026-04-25: banner renders, FCM still pending Track F
```

### Revised scope (text actually changes)
Edit the bullet in place, then add a blockquote underneath explaining why.
```
- A.2 Build `server/pdf/dtiForm.ts`, `barangayClearance.ts`, `bir1901.ts`. Each exports `render(fields): Promise<Uint8Array>` that draws onto a real form template (start with from-scratch layout matching the official field labels; later swap to overlay on scanned official PDF).
> Revised 2026-04-25: dropped `bir1901.ts` from v1 — BIR 1901 layout requires the scanned overlay path, deferred to a follow-up. DTI + Barangay ship now.
```

### New follow-up discovered during implementation
Add a fresh bullet under the same track. Keep it one line.
```
- A.7 🆕 2026-04-25: `pdf-lib` font embedding fails on Tagalog ñ — ship with ASCII-only fallback, real fix tracked here.
```

### Track fully complete
Two edits:

1. Mark every sub-item bullet `— ✅ done <date>`.
2. Flip the row in the Section 1 status table:
```
| 03 | Form auto-fill + … | Done 2026-04-25 | … |
```

### HIGH item shipped → Section 0 "Shipped" subsection
Section 0 lists HIGH/LOW directives as the live priority queue. When a HIGH item ships, **move** (don't delete) it to a "Shipped" subsection at the bottom of Section 0:

```markdown
**HIGH**
- Chatbot integration verified end-to-end → **Track L** (new).
- First-visit must land on signup, post-signup must route to Profile → **Track M** (new).
- Map integrated *inside* roadmap steps (not standalone /places only) → **Track N** (new).
- Per-step report/feedback that also posts to Negosyante Hub → **Track O** (new).

**LOW**
- Hub comments → **Track E** (already in plan, retagged LOW).
- Hub like button broken → **Track P** (new bugfix; root cause: seed posts have non-Firestore IDs so `community.vote` 404s).

**Shipped**
- ✅ 2026-04-25 — PDF downloader + form templates → **Track A**.
```

If "Shipped" subsection does not yet exist, create it once. Do not duplicate.

## Editing patterns

**Use the `Edit` tool with unique anchor text.** Most bullets contain a unique sub-item id (e.g., `- A.1`, `- B.4`) that makes the `old_string` unambiguous.

**Don't reformat unrelated lines.** No prettier-style cleanups while you're in there. The diff should show only your status change.

**One commit-worthy update per task.** If you touched A.1 and A.5 in the same task, both get annotated in one edit pass. Don't open the doc twice.

**Date format.** ISO `YYYY-MM-DD`, always. Pulled from the environment, not invented.

## What to do when the doc is wrong

Phase 2 exploration sometimes reveals the doc is stale (e.g., a sub-item already shipped without annotation, an owner-files list missed a file, a track says "Working" but the code disagrees). Fix it in Phase 5 alongside your normal update, using the Revised pattern, with a blockquote citing what you found:

```
> Revised 2026-04-25: file moved to client/src/components/Map.tsx in commit abc123 but doc still listed legacy path. Updated owner-files.
```

This keeps the doc honest and prevents the next dev from chasing a phantom file.

## Final-line confirmation

After every doc edit, end your turn with one line:

```
DEV_TASKS.md updated: A.1 ✅, A.2 revised, Section 0 HIGH→Shipped (Track A).
```

That's the user's confirmation the source of truth moved. No commit unless they ask.
