---
name: feature-flow
description: Use this skill EVERY time the user asks to add, build, implement, fix, ship, wire up, or change a feature in the NegosyoNav project (e.g., "let's do Track A", "fix the hub like button", "add geolocation to Places", "the chatbot is broken", "implement progress persistence", "real PDF generation now", "add multi-LGU support"). The skill anchors the work to docs/DEV_TASKS.md (the single source of truth for tracks, priorities, and owner files), explores the affected code, presents 2–3 approaches with a recommendation when alternatives meaningfully differ, and updates docs/DEV_TASKS.md when done so parallel devs don't collide. Trigger even when the user does not name a track explicitly — almost any feature/bug request in this repo qualifies. Hackathon-paced — fast by default, gates only where ambiguity is real. Do NOT trigger for pure refactors with no track impact, doc-only edits, code-explanation questions, or general programming Q&A.
---

# feature-flow

Workflow skill for the NegosyoNav hackathon. Anchors every feature/fix to `docs/DEV_TASKS.md` so parallel devs don't step on each other. Five phases: validate → explore → approaches → implement → update tracker.

## Why this skill exists

`docs/DEV_TASKS.md` defines 16 tracks (0, A–P) with HIGH/LOW priorities, owner-file lists, and explicit conflict zones. Section 2 ("Conflict-zone map") and Section 5 ("Cross-track coordination") exist because uncoordinated edits to `server/routers.ts`, `client/src/pages/Roadmap.tsx`, and `client/src/data/lgu/manila.ts` produce merge thrash. The skill's job is to keep work inside lanes and the doc in sync.

When in doubt about anything (ownership, priority order, status markers), the doc wins. The doc is the contract.

## Phase 1 — Validate against `docs/DEV_TASKS.md`

Read the doc end-to-end before doing anything else. It changes between sessions; never rely on memory.

Map the user request to one of:

- **Existing sub-item** (e.g., A.3, B.2, P.1) — quote the bullet so the user sees what is in/out of scope.
- **Existing track, new sub-item** — propose where it slots in (e.g., "this fits Track L as L.6").
- **Off-track work** — ask the user before proceeding. See `references/validation.md` for the decision tree.

Then check:

- **Section 0 priority directives.** If user asks for a LOW item while HIGH items remain open, surface that — do not block, just inform.
- **Section 5 cross-track coordination.** If a blocker is unmerged (e.g., Track M auth gate blocks B/F/O), say so.
- **Section 2 conflict-zone map.** Note files that other tracks may also be editing this week.

Output one line: `Track <id.sub> — <HIGH|LOW|untagged> — owner files: <list>` plus any blocker notes. Keep it under 5 lines total — the user has the doc, you don't need to recap it.

## Phase 2 — Explore the codebase (scoped, fast)

Seed: the track's owner-files list. Do not crawl the whole repo.

- For a small bugfix with a single owner file → just `Read` it directly. No subagents.
- For a multi-file change touching unfamiliar areas → spawn ONE Explore subagent scoped to the owner files plus their direct imports.
- For a track that touches 5+ files across client and server → up to two Explore agents in parallel (e.g., one client, one server).

Hackathon rule: agent spawning costs latency. Use them only when reading files yourself would take longer than dispatching.

`docs/DEV_TASKS.md` may be stale. If the code disagrees with the doc, **trust the code** and flag the staleness for the Phase 5 update.

Output a tight bullet list: files inspected, current behavior, what's missing vs the track bullet. No file dumps.

## Phase 3 — Approaches + recommendation (conditional gate)

Decide first: are there **2+ meaningfully different approaches**?

Meaningfully different = different files touched, different libraries, different patterns, or different tradeoffs (perf / scope / risk / dependency on other tracks). Cosmetic variants (`if/else` vs ternary, named vs anonymous function) do **not** count.

**Branch A — gate fires (≥2 real approaches)**: present this format, then stop and wait.

```
## Approaches

### A. <name>
- What: …
- Pros: …
- Cons: …
- Effort: S / M / L  (hackathon hours)

### B. <name>
…

### C. <name>  (only include if a third path is genuinely different)
…

## Recommendation: <A|B|C>
Because: <1–3 sentences citing DEV_TASKS.md priority, conflict zones,
or Section 6 "Definition of done" — pnpm check, tokens-only colors,
≥44px tap targets, protectedProcedure for Firestore writes, etc.>
```

If the user just says "go" or "proceed", run with the recommendation.

**Branch B — only one sensible path**: don't fabricate alternatives. Write one short paragraph:

```
## Picked: <approach>
Because: <justification tied to DEV_TASKS.md or CLAUDE.md>.
Proceeding unless you redirect.
```

Then continue without waiting. The user can still intercept before edits land.

## Phase 4 — Implement

- **Stay inside the track's owner-files list.** If the change demands editing a non-owner file, pause and confirm — that's a Section 2 conflict-zone violation in the making.
- **Defer to `CLAUDE.md`** — mobile-first, tokens-only colors, `protectedProcedure` for Firestore writes, tRPC as the only API surface, no Drizzle/Manus extensions. Don't restate these rules in your output; just follow them.
- **Run `pnpm check` and `pnpm test`** before declaring done (Section 6 DoD). Fix failures, don't skip.
- For UI changes, follow the existing design tokens in `client/src/index.css`; do not introduce hex colors or hardcoded radii.

## Phase 5 — Update `docs/DEV_TASKS.md` (mandatory, last)

Update the doc only AFTER code lands and checks pass. Partial updates are worse than no update — they desync the parallel devs reading the doc as their queue.

See `references/tracker.md` for the exact markdown patterns. Summary:

- **Done** → append ` — ✅ done <YYYY-MM-DD>` to the bullet. Never delete.
- **Partial** → append ` — 🟡 partial <YYYY-MM-DD>: <what shipped / didn't>`.
- **Revised scope** → edit bullet text in place AND add a `> Revised <YYYY-MM-DD>: <why>` blockquote under it.
- **New follow-up** → new bullet in same track with ` — 🆕 <YYYY-MM-DD>` and a one-line description.
- **Track fully complete** → flip the Section 1 status-table cell to `Done <YYYY-MM-DD>`.
- **HIGH item shipped** → move it to a "Shipped" subsection at the bottom of Section 0 (do not delete — the doc is also a changelog).

Today's date is in your environment context — use that, never invent.

End your turn with one line: `DEV_TASKS.md updated: <bullets touched>`. Do not commit unless the user asks (global repo rule).

## What NOT to do

- Don't fabricate fake alternatives to fill the gate. One sensible path → say so plainly.
- Don't propose work outside the track's owner-files without flagging — that's how parallel devs collide.
- Don't invent new tracks silently. If work doesn't fit any track, ask the user (validation.md decision tree).
- Don't touch `docs/DEV_TASKS.md` before the code change lands and `pnpm check` / `pnpm test` pass.
- Don't reread the whole codebase for tiny fixes — trust owner-files.
- Don't restate `CLAUDE.md` rules in your output. Defer silently.

## When unsure

Ask the user. Cheaper than a wrong-track PR. The skill is fast by design but never silent on ambiguity.
