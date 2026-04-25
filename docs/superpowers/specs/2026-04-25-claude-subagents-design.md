# Claude Code Subagents for negosyonav

**Date:** 2026-04-25
**Status:** Design approved, ready for implementation plan
**Author:** rodney@bscalelabs.com (with Claude)

## Goal

Stand up a project-scoped Claude Code subagent suite (`.claude/agents/*.md`) that automates the recurring, high-friction work in this repo: design-system enforcement, tRPC + Firestore scaffolding, mobile QA, LLM prompt iteration, and Manila LGU domain research.

## Non-goals

- CI integration (running agents in GitHub Actions). Defer to a separate spec.
- An eval-fixture pipeline sourced from real production Firestore data. Defer.
- A `firestore-rules-auditor` agent. Defer until a `firestore.rules` file actually exists in the repo.

## Approach

Thin specialists over fat generalists. Five narrow agents, each with one responsibility and a sharp `description` for accurate auto-routing. Rejected alternatives: fat generalists (fuzzy triggers, bloated prompts) and slash-commands-only (loses auto-delegation).

## Agent roster

| # | Name | Purpose | Auto-trigger |
|---|------|---------|--------------|
| 1 | `design-system-guard` | Block hex colors, non-shadcn components, desktop-first CSS. Verify semantic tokens, brand palette, font classes. | Editing `client/src/**/*.{tsx,css}` |
| 2 | `trpc-firestore-scaffolder` | End-to-end new procedure: zod input → `db()` helper in `server/db.ts` → wire in `server/routers.ts` → client `trpc.X.useQuery` hook. | Phrases: "add procedure", "new endpoint", "new collection" |
| 3 | `mobile-qa` | Playwright at 360×640 — tap target ≥44px, no horizontal overflow, `pb-20` clears `BottomNav`, safe-area insets, iOS no-zoom (`text-base` inputs). | Manual trigger / "test mobile" |
| 4 | `prompt-eval` | Iterate `MANILA_SYSTEM_PROMPT` and `PROFILE_EXTRACTION_PROMPT`. Run eval cases via `invokeLLM` against Gemini, diff outputs, flag regressions. | Editing the two prompt constants in `server/routers.ts` |
| 5 | `manila-domain-researcher` | Fetch current Manila LGU rules (BPLO, RDOs, grants). Reconcile with hardcoded data in `routers.ts` and `grants.check`. | Phrases: "update grants", "verify RDO", "Manila registration steps" |

## Per-agent specs

### 1. design-system-guard

- **Model:** `haiku` (mechanical rule checks)
- **Tools:** `Read`, `Grep`, `Glob` (read-only — reports violations, doesn't fix)
- **Checks:**
  - Ban `#[0-9a-f]{3,8}` color literals
  - Ban `rounded-\[...\]` arbitrary radius
  - Flag raw color classes (`bg-red-500`, `text-blue-600`) — must use semantic tokens (`bg-destructive`, `text-foreground`)
  - Require `font-display` / `font-body` / `font-mono` for typography
  - Flag hover-only affordances without `:active` or `focus-visible` pair
- **Output:** `file:line` list, rule violated, suggested token replacement.

### 2. trpc-firestore-scaffolder

- **Model:** `sonnet`
- **Tools:** `Read`, `Edit`, `Write`, `Grep`, `Glob`
- **Allowlist (hard boundary):** `server/db.ts`, `server/routers.ts`, `client/src/pages/**`, `client/src/lib/trpc.ts`. Never touches `server/_core/`, `drizzle/`, or any legacy file listed in CLAUDE.md.
- **Pattern enforced:**
  - `protectedProcedure` by default; `adminProcedure` only when explicitly requested
  - `FieldValue.serverTimestamp()` on writes
  - `toDate()` helper on reads
  - Error messages from `@shared/const` (`UNAUTHED_ERR_MSG`, `NOT_ADMIN_ERR_MSG`)

### 3. mobile-qa

- **Model:** `sonnet`
- **Tools:** Playwright MCP (`browser_*`), `Read`, `Bash` (to start `pnpm dev`)
- **Viewports:** 360×640 first, then 414×896
- **Flows:** logged-out + logged-in
- **Asserts:**
  - `document.documentElement.scrollWidth <= clientWidth` (no horizontal overflow)
  - `getBoundingClientRect().height >= 44` on `button, a[role=button], [role=link]`
  - `BottomNav` doesn't cover page CTAs (compute overlap)
  - Inputs with `text-base` (16px) to avoid iOS zoom

### 4. prompt-eval

- **Model:** `sonnet`
- **Tools:** `Read`, `Edit`, `Bash`, `Write` (writes eval fixtures to `server/__evals__/*.json`, gitignored)
- **Loop:** load N profile examples → call `invokeLLM` with old + new prompt → diff JSON output → report regression count
- **Boundary:** edits only the two prompt constants in `server/routers.ts`. Doesn't refactor surrounding router logic.
- **Determinism:** temperature 0; assert fuzzy match on key fields, not exact JSON equality.

### 5. manila-domain-researcher

- **Model:** `sonnet`
- **Tools:** `WebSearch`, `WebFetch`, `Read`, `Edit`
- **Sources (allowlist):** `dti.gov.ph`, `bir.gov.ph`, `manila.gov.ph` (BPLO), `dswd.gov.ph`
- **Output:** PR diff for hardcoded data in `routers.ts` (RDO list, registration steps, grant programs, costs). Each change carries `// source: <url> fetched <YYYY-MM-DD>` comment.
- **Boundary:** never invents data. If a source is unreachable or contradictory, flag and stop — do not guess.

## Orchestration

### File layout

```
.claude/
├── agents/
│   ├── _shared.md                         # repo invariants, imported via @_shared.md
│   ├── design-system-guard.md
│   ├── trpc-firestore-scaffolder.md
│   ├── mobile-qa.md
│   ├── prompt-eval.md
│   └── manila-domain-researcher.md
└── settings.json                          # WebFetch allowlist for researcher
```

### Agent file shape

```markdown
---
name: design-system-guard
description: <when-to-trigger sentence — sharp, mechanical>
tools: Read, Grep, Glob
model: haiku
---
<system prompt body — rules, examples, output format>
```

### Invocation patterns

- **Auto-delegate:** `design-system-guard`, `mobile-qa` (mechanical, run on UI changes / before commit)
- **Manual / keyword-triggered:** `trpc-firestore-scaffolder`, `prompt-eval`, `manila-domain-researcher` (high-impact, user opts in)

### Parallel safety

- Read-only agents fan out in parallel (`design-system-guard`, researcher's research phase, `prompt-eval`'s eval phase).
- Write agents run serially, one at a time (`trpc-firestore-scaffolder`, researcher's edit phase).
- `mobile-qa` holds an exclusive Playwright session lock — never run two at once.

### Inter-agent flow

No auto-chaining between agents. The main agent orchestrates:

1. User: "add `events.list` procedure" → main spawns `trpc-firestore-scaffolder` → after edit lands, main spawns `design-system-guard` + `mobile-qa` in parallel for verification.
2. User edits a prompt → main spawns `prompt-eval` → reports regression → user decides whether to keep.

### Shared context

`.claude/agents/_shared.md` holds repo invariants (tRPC-only API surface, Firestore-only DB, legacy-file ignore list, design tokens). Each agent's body references it via `@_shared.md` to avoid duplicating CLAUDE.md content.

### Permissions

`manila-domain-researcher` needs `WebFetch` allowlist entries in `.claude/settings.json` for `dti.gov.ph`, `bir.gov.ph`, `manila.gov.ph`, `dswd.gov.ph` to skip per-call permission prompts.

## Success criteria

- **`design-system-guard`:** zero hex / raw-color regressions reach `main`. Catch rate measured by weekly grep audit.
- **`trpc-firestore-scaffolder`:** new procedure compiles, type-checks, and unit-test passes on first run with no manual wiring fix-ups.
- **`mobile-qa`:** every UI PR has a 360×640 screenshot and assertion log attached.
- **`prompt-eval`:** every prompt edit produces a before/after diff against ≥10 fixtures. Flagged regressions block merge.
- **`manila-domain-researcher`:** every hardcoded datum in `routers.ts` carries `// source: <url> fetched <date>` comment.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `design-system-guard` over-fires on every `.tsx` save (noise) | Scope `description` to "review before commit / on PR", not on every edit |
| `mobile-qa` is slow + token-heavy | Manual trigger only, not auto on every UI edit |
| Manila domain data goes stale | Fetch-date comment per datum; schedule quarterly re-run |
| Gemini non-determinism makes prompt-eval noisy | Temperature 0; fuzzy match on key fields, not exact JSON equality |
| Scaffolder over-edits into legacy files | Hard allowlist in agent body; reject any edit outside the allowlist |
