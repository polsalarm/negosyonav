# Validation: mapping a request to `docs/DEV_TASKS.md`

Read this only when Phase 1 of `SKILL.md` is non-trivial — i.e., the request doesn't obviously match one bullet.

## Step 1 — Parse intent

Extract from the user message:

- **Verb**: add / fix / wire / ship / change / refactor / explain. (Refactor and explain often mean *don't* trigger; see SKILL.md negative triggers.)
- **Target**: feature name, page, file, component, or symptom (e.g., "PDF download", "like button", "the chatbot").
- **LGU / scope** (if any): Manila, Taguig, Cavite, Sampaloc.
- **Priority signal**: did the user say "urgent", "first", "before X"? Treat as a hint, but Section 0 of the doc still rules.

## Step 2 — Scan tracks in this order

1. **Section 0 priority directives.** HIGH items first (Tracks A, L, M, N, O), then LOW (E, P), then anything else. If the request matches a HIGH item still open, prefer that mapping.
2. **Section 4 track list.** Match on owner-files first (most reliable), then on prose. Each track has a one-line summary + sub-items.
3. **Section 1 status table.** If the feature is already marked `Working`, the request is probably a fix or enhancement, not new work. Confirm with the user before treating it as net-new.

## Step 3 — Decide

```
                ┌──────────────────────────────────────────┐
                │  Does request match an existing bullet?  │
                └──────────────────────────────────────────┘
                          │             │
                       Yes│             │No
                          ▼             ▼
        ┌─────────────────────────┐   ┌──────────────────────────────┐
        │ Quote bullet, name      │   │ Does it fit an existing      │
        │ Track id.sub. Done.     │   │ track's theme (e.g., new     │
        └─────────────────────────┘   │ sub-item under Track L)?     │
                                      └──────────────────────────────┘
                                            │           │
                                         Yes│           │No
                                            ▼           ▼
                            ┌──────────────────────┐  ┌─────────────────────────┐
                            │ Propose new sub-item │  │ ASK USER (3 options):   │
                            │ (e.g., "fits as L.6"│  │  a) add new track to    │
                            │  with text). Ask    │  │     DEV_TASKS.md first  │
                            │  for OK before code.│  │  b) fold into <track>   │
                            └──────────────────────┘  │  c) proceed unanchored  │
                                                      │     (flag conflict risk)│
                                                      └─────────────────────────┘
```

## Step 4 — Surface blockers

Before exiting Phase 1, scan Section 5 ("Cross-track coordination") and the doc's prose for:

- **Hard blockers**: Track M (auth gate) blocks B/F/O. Track 0 (refactor) blocks parallel work in `server/routers.ts`.
- **Soft conflicts**: Tracks N and O both add UI inside `Roadmap.tsx` step cards.
- **Schema overlaps**: Track O's `community.list({ stepNumber })` filter overlaps Track E.4.

If a blocker affects this request, mention it in one line. Do not refuse — the user may have already merged the blocker.

## Examples

**Example 1 — clean match**
> User: "fix the hub like button"
>
> → Track P (LOW). P.1 is the preferred fix per the doc itself ("seed posts have non-Firestore IDs so `community.vote` 404s"). Owner files: `client/src/pages/Hub.tsx`, optionally `server/routers/community.ts` + `server/scripts/seedHubPosts.ts`.

**Example 2 — new sub-item**
> User: "let's add a 'copy link' button to each hub post"
>
> → Track E theme (Hub) but no existing sub-item. Propose as E.6. Confirm with user before coding.

**Example 3 — off-track**
> User: "let's add a dark-mode toggle"
>
> → No track matches. CLAUDE.md mentions `.dark` is wired but no toggle exists. Ask: (a) new Track Q, (b) fold into Track J accessibility pass, (c) proceed unanchored. Recommend (b) — toggle ships with the a11y pass cleanly.

**Example 4 — already working**
> User: "add a chat feature on the home page"
>
> → Section 1 says feature 01 (Taglish chat intake) is Working. This is likely a fix or enhancement to Track L (chatbot E2E verification, HIGH). Confirm: are they reporting a bug, or asking for something new on top? Don't assume net-new.

**Example 5 — priority override**
> User: "let me add hub comments now"
>
> → Track E.1–E.5. Section 0 explicitly retagged this as LOW. Surface: "Track E is LOW per Section 0. HIGH items still open: A (PDF), L (chatbot E2E), M (auth gate), N (map in steps), O (per-step feedback). Want to proceed with E anyway?" Don't block — just inform.

## When the doc is wrong

`docs/DEV_TASKS.md` is hand-maintained. If your code exploration in Phase 2 shows the doc is out of date (file moved, sub-item already shipped without annotation, owner-file list incomplete), capture the discrepancy and fix it in Phase 5 alongside your normal status update. Use the Revised pattern from `tracker.md`.
