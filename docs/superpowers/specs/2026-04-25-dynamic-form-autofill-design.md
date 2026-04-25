# Dynamic Form Autofill — Design Spec

**Date:** 2026-04-25
**Status:** Approved, ready for implementation plan
**Track:** Supersedes Track A in `docs/DEV_TASKS.md` (real PDF generation MVP anchor)

## Problem

`client/src/pages/Forms.tsx` hardcodes 3 forms with hardcoded field lists, and `forms.generatePdf` returns base64 of plain text mislabelled as `.pdf`. The user vision:

1. App suggests which forms to fill (driven by Lakad Roadmap step).
2. App fetches a real template PDF for each form when possible.
3. The fields in the user-friendly UI are derived from the actual fillable fields of the PDF.
4. Fields auto-populate from the user's profile.
5. If the app cannot source the template, the user uploads their own PDF.
6. The user never sees the raw PDF unless they explicitly preview or download it.
7. Output is a real, fillable, print-ready PDF.

## Non-goals

- Multi-LGU catalog (Manila-only at MVP; user upload covers other LGUs).
- Persistent submission audit log / renewal reminders (`formSubmissions` collection deferred).
- Garbage collection of soft-deleted user uploads.
- Batch download / zip multiple forms.
- Server-rendered preview thumbnails for catalog cards.

## High-level architecture

Three layers:

1. **Template registry** — `formTemplates` Firestore collection + Firebase Storage blobs. Two scopes: `system` (curated catalog seeded by dev) and `user` (uploaded fallback, owner-scoped).
2. **AcroForm-ification pipeline** — server-side, run once per unique template (catalog seed or user upload). Detects fillable fields via Gemini (PDF-direct), overlays invisible AcroForm widgets onto the original PDF using `pdf-lib`. Original visual untouched.
3. **Fill + render runtime** — per user submission. Server loads the processed AcroForm PDF, applies values, optionally flattens, returns base64. Client downloads or previews via blob URL + `<iframe>`.

The user never sees the PDF unless they hit Preview (inline blob iframe) or Download.

## Data model

### Firestore: `formTemplates/{templateId}`

```ts
type FormTemplate = {
  templateId: string;          // {scope}_{formId} for system, {uid}_{nanoid} for user
  scope: "system" | "user";
  ownerUid: string | null;     // null for system
  formId: string;              // "dti_bn", "bir_1901", "barangay_clearance", "philhealth_pmrf", ...
  label: string;
  labelTl: string;
  agency: string;
  roadmapStep: number | null;  // ties form to Lakad Roadmap step; null = uncategorised
  description: string;

  rawStoragePath: string;      // formTemplates/raw/{templateId}.pdf
  processedStoragePath: string;// formTemplates/processed/{templateId}.pdf
  sourceHash: string;          // sha256 of raw bytes — cache key for Gemini
  fieldsSchema: FieldSpec[];
  status: "pending" | "processing" | "ready" | "failed";
  errorMessage: string | null;

  createdAt: Timestamp;
  processedAt: Timestamp | null;
  createdBy: string;           // uid or "system"
  deletedAt: Timestamp | null; // soft delete for user templates
};

type FieldSpec = {
  name: string;                // AcroForm field name; stable id "{slug(label)}_p{page}_i{idx}"
  label: string;
  page: number;                // 1-indexed
  bbox: [number, number, number, number]; // PDF user-space points, origin bottom-left
  type: "text" | "checkbox" | "date" | "number";
  required: boolean;
  profileKey: string | null;   // dotted path into profile, or synthetic key
  placeholder: string | null;
  maxLength: number | null;
};
```

### Firebase Storage layout

```
formTemplates/raw/{templateId}.pdf          // immutable original
formTemplates/processed/{templateId}.pdf    // AcroForm-ified, used at fill time
```

### Storage rules

- `formTemplates/**` — read/write **denied** to client SDK. Client never touches Storage directly; all access goes through tRPC procedures using Admin SDK. Avoids signed-URL plumbing and keeps `ownerUid` enforcement single-sourced server-side.

### Notes

- `fieldsSchema` is denormalised onto the template doc. Forms have well under 1 MiB of field metadata.
- `sourceHash` is the idempotency key. Re-uploading or re-seeding the same PDF skips Gemini.
- `roadmapStep` lets `Forms.tsx` group templates by step (replaces today's hardcoded `step: 1|2|5`).
- No new profile fields. Mapping is done via `profileKey` against the existing `FirestoreProfile` shape.

## AcroForm-ification pipeline

Single function used by both seed script and the user-upload route.

```ts
// server/forms/processTemplate.ts
async function processTemplate(input: {
  rawBytes: Buffer;
  templateId: string;
  manifestHints?: Partial<FormTemplate>;
}): Promise<{ processedBytes: Buffer; fieldsSchema: FieldSpec[] }>;
```

### Steps

1. **Hash & cache.** `sha256(rawBytes)`. If a `formTemplates` doc with matching `sourceHash` and `status === "ready"` exists, return cached result.
2. **AcroForm probe.** `pdf-lib` `getForm().getFields()`. Non-empty → extract `{name, type, page, rect}` from existing widgets, skip to step 6.
3. **Single Gemini call (PDF-direct).** New helper `invokeLLMWithPdf` in `server/_core/llm.ts`:
   ```
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
   { contents:[{ parts:[
       { inline_data:{ mime_type:"application/pdf", data:<base64> } },
       { text: PROMPT }
   ]}], generationConfig:{ responseMimeType:"application/json" } }
   ```
   Prompt asks Gemini to return JSON conforming to:
   ```json
   {
     "fields":[
       {"label":"...", "page":1, "bbox":[x0,y0,x1,y1],
        "bboxUnit":"pdf_points", "type":"text|checkbox|date|number",
        "required":true, "profileKey":"firstName|null", "maxLength":null}
     ]
   }
   ```
   Prompt includes the available `profileKey` list inline. `bbox` is requested in PDF points (origin bottom-left) directly so no coordinate flip is needed.
4. **Validate.** Zod schema on the JSON. Parse fail → re-prompt once with strict schema. Second fail → mark template `failed`.
5. **Normalise.** Stable `name`. Heuristic override on `type` (label contains "petsa"/"date" → date; "₱"/"halaga"/"capital" → number). Manifest hints override `profileKey` per field.
6. **Overlay with `pdf-lib`.** For each field: `form.createTextField(name)` / `createCheckBox(name)`, `field.addToPage(page, {x, y, width, height})`, font size 10. For non-Latin glyph support (ñ, ú in Filipino names), embed `NotoSans-Regular` as the field default font (one-time embed).
7. **Persist.** Storage upload `raw/{templateId}.pdf` + `processed/{templateId}.pdf`. Firestore write with `status: "ready"`, `processedAt`, `fieldsSchema`.

### Failures

- Gemini 429/5xx → backoff `[2s, 5s, 12s]` then `failed`.
- File >20 MB / non-PDF MIME / >4 pages → reject before Gemini.
- Schema-invalid response → one retry then `failed`.
- Bbox out of page bounds → clamp; if any field still invalid, drop it, partial schema returned with `errorMessage` warning, `status: "ready"`.

### Cost ceiling

- Catalog ≈ 13 PDFs × 1 call = 13 calls one-time.
- User upload = 1 call per unique PDF, hash-cached. Per-uid cap 10 uploads/day.

## Catalog seeding

One-time, idempotent script:

- `scripts/seedTemplates.ts` reads `template/*.pdf`, joins each with metadata from `scripts/templateManifest.ts`, runs `processTemplate`, writes Firestore + Storage via Admin SDK.
- `scripts/templateManifest.ts` is the human-curated source of truth: per-PDF `formId`, `label`, `labelTl`, `agency`, `roadmapStep`, optional per-field `profileKey` overrides and `bboxOverride`.
- `--dry-run` flag prints planned writes without touching Firebase.
- `--force` required to overwrite an existing `ready` row.
- Run with `pnpm seed:templates` against the shared dev/prod Firebase project (single project for hackathon).

Adding a new template = drop PDF in `template/`, append manifest entry, re-run script.

## Runtime fill flow

### tRPC surface (`server/routers/forms.ts`)

```ts
forms: router({
  list: protectedProcedure
    .input(z.object({ roadmapStep: z.number().optional() }).optional())
    .query(/* FormSummary[] */),

  schema: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(/* { template, filled, missingRequired } */),

  generatePdf: protectedProcedure
    .input(z.object({ templateId: z.string(), values: z.record(z.string(), z.string()) }))
    .mutation(/* { pdfContent, contentType, filename } */),

  preview: protectedProcedure
    .input(z.object({ templateId: z.string(), values: z.record(z.string(), z.string()) }))
    .mutation(/* same shape as generatePdf */),

  uploadTemplate: protectedProcedure
    .input(z.object({ formId: z.string(), label: z.string().optional(), pdfBase64: z.string() }))
    .mutation(/* { templateId, status, errorMessage? } */),

  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(/* checks ownerUid === ctx.user.uid; soft delete */),
})
```

### `forms.list`

1. Read system templates: `scope==="system" AND status==="ready" AND deletedAt==null`.
2. Read user templates: `scope==="user" AND ownerUid===ctx.user.uid AND status==="ready" AND deletedAt==null`.
3. Merge. User-scoped templates **shadow** the system one for the same `formId`.
4. Filter by `roadmapStep` if provided.
5. Project to `FormSummary = {templateId, formId, label, agency, roadmapStep, scope, fieldCount}`.

### `forms.schema`

1. Load template doc. Authorize: `scope==="system"` OR `ownerUid===ctx.user.uid`.
2. Load `profiles/{ctx.user.uid}` once.
3. For each `FieldSpec`, resolve via `profileKey` lookup. Synthetic keys (`fullName`, `homeAddressLine`, `bizAddressLine`) handled by `server/forms/resolveProfile.ts`.
4. Apply trivial coercions (date ISO → `MM/DD/YYYY` for `type:"date"`).
5. Compute `missingRequired`. Return `{ template, filled, missingRequired }`.

### `forms.generatePdf`

1. Load template doc + Storage `processed/{templateId}.pdf` bytes.
2. `PDFDocument.load(bytes)` → `getForm()`.
3. For each `(name, value)`: `form.getTextField(name).setText(value)` or `getCheckBox(name).check/uncheck()`. Unknown names skipped silently.
4. `form.flatten()` (configurable per template via manifest; default `true`). Skip flatten for forms where the bureau wants typeable fields after print (e.g. some BIR forms).
5. `doc.save()` → base64 → return with `filename: "{formId}-{YYYYMMDD}.pdf"`.

### `forms.uploadTemplate`

1. Validate base64, MIME prefix, size cap 10 MB.
2. Per-uid daily cap (10 uploads / 24h) via Firestore count.
3. `templateId = ${uid}_${nanoid(8)}`. Write Firestore stub `status: "processing"`.
4. Call `processTemplate({rawBytes, templateId, manifestHints: {formId, label, scope:"user", ownerUid:uid}})`.
5. Update Firestore `ready` / `failed` accordingly.

### Auth & security

- All four procedures `protectedProcedure`.
- User-scope template access enforces `ownerUid === ctx.user.uid` server-side; never trust `templateId` alone.
- `uploadTemplate` sanitises filename; stored under generated id.
- Storage paths server-only (rules deny client SDK reads/writes under `formTemplates/**`).
- `values` from `generatePdf` are not persisted.

## Client UX (Forms.tsx)

1. On mount: `forms.list.useQuery({roadmapStep})`. Render cards data-driven from the result. Existing card layout reused.
2. Expand card → `forms.schema.useQuery({templateId})`. Iterate `template.fieldsSchema`, seed inputs from `filled`. Profile-derived values get a "from Profile" badge.
3. Per field with `profileKey`: if user types over the prefilled value, show "Save to Profile" affordance.
4. **Download** → `generatePdf` → blob → save (existing download code reused).
5. **Preview** → `preview` → blob URL → `<iframe src=blob:...>` in a sheet/dialog.
6. **No template found** branch → upload button. File picker `accept="application/pdf"` → base64 → `uploadTemplate`. Spinner during processing (~3–8s). Refetch `list` on success. Toast on failure.
7. User-uploaded templates show a "Yours" badge + delete affordance.

The user never sees the raw PDF unless they hit Preview or Download.

## Error handling & edge cases

### Pipeline (one-time, per template)

| Failure | Behavior |
|---|---|
| Gemini 429/5xx | Backoff `[2s, 5s, 12s]` then `failed` with retryable `errorMessage`. |
| Malformed Gemini JSON | One re-prompt with strict schema. Second fail → `failed`. |
| File >20 MB / non-PDF / >4 pages | Reject pre-Gemini with specific cause. |
| Bbox out of bounds | Clamp; if invalid, drop field; partial schema, warning in `errorMessage`, `status: "ready"`. |
| `sourceHash` re-hit on `failed` doc | Re-process; overwrite. |

### Runtime (per fill)

| Failure | Behavior |
|---|---|
| Template `status !== "ready"` | `forms.schema` throws `PRECONDITION_FAILED`; client polls every 3s up to 30s. |
| Storage `processed/` missing | `INTERNAL_SERVER_ERROR`; admin concern. |
| `getTextField(name)` throws | Skip per field. >50% skipped → return error, prompt re-upload (`user`) or admin (`system`). |
| Empty required value | `BAD_REQUEST` with `missingRequired[]`. Client highlights inputs. |
| Profile missing | `filled: {}`; existing "Complete profile first" banner handles. |

### Upload edge cases

| Case | Behavior |
|---|---|
| Same PDF re-uploaded | Hash hit → return existing `templateId`, no new doc. |
| User upload mirrors a system template | Allowed; user-scope shadows system in `list`. |
| Daily cap (10) hit | `BAD_REQUEST` with explanation. |
| Delete during fill | Soft delete; in-flight `schema` results still complete. |

### Rendering

| Case | Behavior |
|---|---|
| Bbox 5–10pt off | Acceptable for MVP. Preview surfaces it. Catalog forms can carry per-field `bboxOverride` in manifest. |
| Multi-line address into single-line field | `setText` truncates visually but stores full string. UI input gets `maxLength` hint. |
| Non-Latin chars (ñ, ú) | Embed `NotoSans-Regular` for fields. |
| Checkbox glyph | `pdf-lib createCheckBox`; UI toggle; server maps `"true"`/`"false"`. |
| Date format mismatch | `resolveProfile.ts` central coercer; default `MM/DD/YYYY`. |

### Privacy

- Fill values never persisted (no `formSubmissions` collection in MVP).
- User uploads kept until user deletes. Surface this in onboarding copy.
- All cross-user reads gated by `ownerUid` server-side.

## Testing

| File | Cases |
|---|---|
| `server/forms/processTemplate.test.ts` | AcroForm-already path; Gemini path with mocked `invokeLLMWithPdf`; hash cache hit byte-identical; malformed JSON retry then fail; size/page rejections; bbox clamping. |
| `server/forms/resolveProfile.test.ts` | Each `profileKey` resolves; synthetic keys compose with empty parts; date coercion; missing profile yields empty filled. |
| `server/routers/forms.test.ts` | `list` segregation; `schema` cross-user denial; `generatePdf` `BAD_REQUEST` on missing required + happy path returns `%PDF-` magic; `uploadTemplate` 10/day cap; `deleteTemplate` non-owner rejection. |
| `server/forms/seedTemplates.test.ts` | Dry-run mode logs without writes. |

Manual smoke after R3:
1. `pnpm seed:templates --dry-run` shows 13 planned writes.
2. `pnpm seed:templates` populates Firebase; console verified.
3. Forms page: expand → preview → download produces real PDF in Chrome viewer + Acrobat.
4. Edit a field → "Save to Profile" → reload → profile updated.
5. Upload BIR 1903 as user template → fields detected → fill → download.
6. Oversized non-PDF rejected.
7. 11th upload in 24h rejected.

## Rollout

| Step | Deliverable | Risk |
|---|---|---|
| R1 | Add `pdf-lib`, `nanoid`. Add `server/forms/` module: `processTemplate`, `resolveProfile`, `invokeLLMWithPdf`. Unit tests pass. | None (dead code). |
| R2 | New `formTemplates` collection writes via Admin SDK. Storage rules updated. Seed script wired. | None (write-only). |
| R3 | Run seed against shared Firebase. Inspect catalog. | Catalog visible but UI still hardcoded. |
| R4 | Rewrite `forms` router (`list`, `schema`, `generatePdf`, `preview`, `uploadTemplate`, `deleteTemplate`). Old `generatePdf` shape removed. | Forms page broken until R5. |
| R5 | `Forms.tsx` rewritten data-driven; old hardcoded array deleted; Preview + Upload UI added. | Ship with R4 in same PR. |
| R6 | Update `docs/DEV_TASKS.md` Track A status. | Doc-only. |

R4 + R5 land in one PR. R1–R3 land first to de-risk seed.

## Open follow-ups (deferred)

- Multi-LGU template variants beyond Manila.
- `formSubmissions` audit log + renewal reminders.
- Storage GC for soft-deleted user uploads.
- Per-form `flattenOnDownload` UI control (default true; manifest-only at MVP).
- Batch download / zip multiple forms.
- Server-rendered PNG thumbnails for catalog cards.
