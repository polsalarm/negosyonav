# Dynamic Form Autofill Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded `Forms.tsx` + fake-PDF `forms.generatePdf` with a dynamic, template-driven engine: catalog and user-uploaded PDFs are turned into AcroForm templates via a one-time Gemini PDF-direct call, profiles auto-fill the fields, and `pdf-lib` produces real fillable/printable PDFs at download time.

**Spec:** `docs/superpowers/specs/2026-04-25-dynamic-form-autofill-design.md`

**Architecture:** Three layers — (1) template registry in Firestore (`formTemplates`) + Firebase Storage blobs (`raw/`, `processed/`), (2) one-shot AcroForm-ification pipeline that detects fields with one Gemini call per unique PDF and overlays invisible AcroForm widgets via `pdf-lib`, (3) per-fill runtime that loads the processed PDF, applies values, optionally flattens, returns base64.

**Tech stack:** Node 20 + tsx, tRPC v11, Firebase Admin SDK (Firestore + Storage), `pdf-lib`, `@pdf-lib/fontkit`, `nanoid`, Gemini OpenAI-compat (existing `invokeLLM`) + new `invokeLLMWithPdf` against the native Gemini endpoint, React 19 + wouter + shadcn/ui (existing).

**Project conventions (CLAUDE.md, mandatory):**
- Single-tRPC-router file convention is being deliberately broken here only by extracting `forms` into `server/routers/forms.ts` (the only sub-router that grows large enough to justify it). All other sub-routers stay inline in `server/routers.ts`. The Track 0 split work in `DEV_TASKS.md` is **not** in scope for this plan.
- New collection writes go through `server/db.ts` helpers (or a new module that calls `adminDb`). Never import `adminDb` directly from a router.
- All write procs are `protectedProcedure`. Cross-user reads gated by `ownerUid` server-side.
- Mobile-first UI: 360×640 baseline, tap targets ≥44px, `text-base` inputs, semantic tokens only (no hex), shadcn primitives.
- Tests live next to source (`server/forms/processTemplate.test.ts`). Vitest. Tests that need Firestore/Storage are guarded behind `serviceAccount.json` presence — skipped in CI without one.

---

## File Structure

### New files (server)

- `server/_core/firebaseAdmin.ts` (modify) — export `adminStorage` bucket alongside `adminDb`/`adminAuth`.
- `server/_core/llm.ts` (modify) — add `invokeLLMWithPdf(pdfBytes, prompt, opts?)`.
- `server/forms/types.ts` — internal types (`FieldSpec`, `FormTemplate`, `FormSummary`, `FilledSchemaResponse`).
- `server/forms/templateRepo.ts` — Firestore CRUD: `getTemplate`, `findByHash`, `listSystemTemplates`, `listUserTemplates`, `writeTemplate`, `markFailed`, `softDeleteUserTemplate`, `countUserUploadsLast24h`.
- `server/forms/storage.ts` — Storage helpers: `uploadRaw`, `uploadProcessed`, `downloadProcessed`.
- `server/forms/resolveProfile.ts` — synthesize values from `FirestoreProfile` for any `profileKey` (literal or synthetic like `fullName`, `homeAddressLine`, `bizAddressLine`).
- `server/forms/processTemplate.ts` — the AcroForm-ification pipeline.
- `server/forms/processTemplate.test.ts`
- `server/forms/resolveProfile.test.ts`
- `server/routers/forms.ts` — extracted, expanded forms sub-router.
- `server/routers/forms.test.ts`
- `scripts/templateManifest.ts` — human-curated metadata per catalog PDF.
- `scripts/seedTemplates.ts` — idempotent seed runner.

### New files (client)

- `client/src/components/forms/UploadTemplateButton.tsx` — file picker + base64 + `uploadTemplate` mutation + spinner + toast.
- `client/src/components/forms/PreviewSheet.tsx` — shadcn `Sheet` containing `<iframe src=blob:...>`.
- `client/src/lib/dataUriPdf.ts` — small helper that turns base64 → blob URL (single source of truth for the existing manual decode dance).

### Modified files

- `server/routers.ts` — replace inline `forms` sub-router with import from `./routers/forms`.
- `server/db.ts` — add `formTemplates` types + helpers OR delegate fully to `templateRepo.ts` (we choose `templateRepo.ts` to avoid bloating `db.ts`; document this in CLAUDE-style comment at top of `templateRepo.ts`).
- `client/src/pages/Forms.tsx` — full rewrite, data-driven from `forms.list` + `forms.schema`.
- `client/src/lib/trpc.ts` — no change expected; types flow through `AppRouter`.
- `package.json` — add `pdf-lib`, `@pdf-lib/fontkit`. (`nanoid` already present.)
- `docs/DEV_TASKS.md` — mark Track A complete with reference to spec + plan.

### Deleted

- Inline `forms` sub-router block in `server/routers.ts` (replaced by import).

### Out of scope (do **not** touch in this plan)

- `server/routers.ts` Track 0 split (other sub-routers).
- `MANILA_SYSTEM_PROMPT` / `PROFILE_EXTRACTION_PROMPT` extraction.
- Drizzle/MySQL legacy code.
- `formSubmissions` audit collection.
- Storage GC for soft-deleted user templates.

---

## Chunk 1: Foundations (deps, env, Storage bootstrap, llm helper)

### 1. Add dependencies

- [ ] **Step 1: Add packages**

```bash
pnpm add pdf-lib @pdf-lib/fontkit
```

Expected: both land in `dependencies` in `package.json`. Lockfile updated.

- [ ] **Step 2: Verify install + types**

Run: `pnpm check`
Expected: PASS (no compile error from new deps; both ship their own `.d.ts`).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add pdf-lib and @pdf-lib/fontkit for AcroForm pipeline"
```

### 2. Configure Firebase Storage bucket env

- [ ] **Step 1: Add bucket name to env**

Modify `server/_core/env.ts`. Add a new field:

```ts
firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
```

Place next to existing `firebaseProjectId`. The default keeps things working when `FIREBASE_STORAGE_BUCKET` is unset — Firebase's default bucket name follows the `<project>.appspot.com` pattern.

- [ ] **Step 2: Initialize Storage in firebaseAdmin**

Modify `server/_core/firebaseAdmin.ts`:

```ts
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";
import { ENV } from "./env";

if (!admin.apps.length) {
  try {
    const serviceAccountPath = join(process.cwd(), "serviceAccount.json");
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: ENV.firebaseStorageBucket,
    });
    console.log("[Firebase Admin] Initialized successfully");
  } catch (error) {
    console.error("[Firebase Admin] Failed to initialize:", error);
  }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
export const adminStorage = admin.apps.length ? admin.storage() : null;
export const adminBucket = admin.apps.length
  ? admin.storage().bucket(ENV.firebaseStorageBucket)
  : null;
```

- [ ] **Step 3: Verify compile**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/_core/env.ts server/_core/firebaseAdmin.ts
git commit -m "feat(server): wire firebase storage bucket via admin sdk"
```

### 3. Add `invokeLLMWithPdf` helper

`server/_core/llm.ts` already exposes `invokeLLM` against the OpenAI-compat endpoint. The new helper hits the **native** Gemini `generateContent` endpoint because OpenAI-compat does not accept `application/pdf` inline data.

- [ ] **Step 1: Write a unit test stub** (for the response parsing logic, not the network call)

Create `server/_core/llm.test.ts` (or append if it exists). Use `vi.spyOn(global, "fetch")` to mock the response.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeLLMWithPdf } from "./llm";

describe("invokeLLMWithPdf", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns parsed JSON when responseMimeType=application/json and Gemini returns text part", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"hello":"world"}' }] } }],
        }),
        { status: 200 },
      ),
    );

    const result = await invokeLLMWithPdf({
      pdfBytes: Buffer.from("%PDF-1.4 dummy"),
      prompt: "x",
      jsonMode: true,
    });

    expect(result).toEqual({ hello: "world" });
  });

  it("throws on non-200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("rate limit", { status: 429 }),
    );

    await expect(
      invokeLLMWithPdf({ pdfBytes: Buffer.from("x"), prompt: "x", jsonMode: true }),
    ).rejects.toThrow(/429/);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test -- server/_core/llm.test.ts`
Expected: FAIL — `invokeLLMWithPdf` not exported.

- [ ] **Step 3: Implement `invokeLLMWithPdf`**

Append to `server/_core/llm.ts`:

```ts
const GEMINI_NATIVE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

export type InvokeLLMWithPdfArgs = {
  pdfBytes: Buffer;
  prompt: string;
  model?: string; // default "gemini-2.0-flash"
  jsonMode?: boolean; // default true
};

export async function invokeLLMWithPdf<T = unknown>(
  args: InvokeLLMWithPdfArgs,
): Promise<T> {
  const model = args.model ?? "gemini-2.0-flash";
  const jsonMode = args.jsonMode ?? true;
  const url = `${GEMINI_NATIVE_ENDPOINT}/${model}:generateContent?key=${ENV.geminiApiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: "application/pdf",
              data: args.pdfBytes.toString("base64"),
            },
          },
          { text: args.prompt },
        ],
      },
    ],
    generationConfig: jsonMode
      ? { responseMimeType: "application/json" }
      : undefined,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (jsonMode) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Gemini returned non-JSON text: ${text.slice(0, 200)}`);
    }
  }
  return text as unknown as T;
}
```

Note: `ENV.geminiApiKey` must already exist — it does (`server/_core/env.ts` reads `GEMINI_API_KEY`). If the field name differs, adjust import accordingly.

- [ ] **Step 4: Run the test**

Run: `pnpm test -- server/_core/llm.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add server/_core/llm.ts server/_core/llm.test.ts
git commit -m "feat(llm): add invokeLLMWithPdf for native gemini pdf input"
```

### 4. Define shared form types

- [ ] **Step 1: Create types file**

Create `server/forms/types.ts`:

```ts
import type { Timestamp } from "firebase-admin/firestore";

export type FieldType = "text" | "checkbox" | "date" | "number";

export type FieldSpec = {
  name: string;
  label: string;
  page: number; // 1-indexed
  bbox: [number, number, number, number]; // PDF user-space points, origin bottom-left
  type: FieldType;
  required: boolean;
  profileKey: string | null;
  placeholder: string | null;
  maxLength: number | null;
};

export type TemplateScope = "system" | "user";
export type TemplateStatus = "pending" | "processing" | "ready" | "failed";

export type FormTemplate = {
  templateId: string;
  scope: TemplateScope;
  ownerUid: string | null;
  formId: string;
  label: string;
  labelTl: string;
  agency: string;
  roadmapStep: number | null;
  description: string;
  rawStoragePath: string;
  processedStoragePath: string;
  sourceHash: string;
  fieldsSchema: FieldSpec[];
  flattenOnDownload: boolean;
  status: TemplateStatus;
  errorMessage: string | null;
  createdAt: Date;
  processedAt: Date | null;
  createdBy: string;
  deletedAt: Date | null;
};

export type FormSummary = {
  templateId: string;
  formId: string;
  label: string;
  labelTl: string;
  agency: string;
  roadmapStep: number | null;
  scope: TemplateScope;
  fieldCount: number;
};

export type FilledSchemaResponse = {
  template: FormTemplate;
  filled: Record<string, string>;
  missingRequired: string[];
};

// Firestore-shape (Timestamp instead of Date) for write/read serialization.
export type FormTemplateDoc = Omit<
  FormTemplate,
  "createdAt" | "processedAt" | "deletedAt"
> & {
  createdAt: Timestamp;
  processedAt: Timestamp | null;
  deletedAt: Timestamp | null;
};
```

- [ ] **Step 2: Verify compile**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/forms/types.ts
git commit -m "feat(forms): add shared form template types"
```

---

## Chunk 2: Pipeline (resolveProfile, processTemplate)

### 5. `resolveProfile`

Maps a `profileKey` (literal `FirestoreProfile` field name OR a synthetic key like `fullName` / `homeAddressLine` / `bizAddressLine`) to a string for use in form fills. Centralised so the runtime fill, the upload-time profile inference, and tests share identical logic.

- [ ] **Step 1: Write tests first**

Create `server/forms/resolveProfile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveProfileValue, AVAILABLE_PROFILE_KEYS } from "./resolveProfile";
import type { FirestoreProfile } from "../db";

const sample: FirestoreProfile = {
  userId: "u1",
  firstName: "Juan",
  middleName: "Reyes",
  lastName: "Dela Cruz",
  suffix: "Jr.",
  dateOfBirth: "1990-05-04",
  civilStatus: "single",
  citizenship: "Filipino",
  tin: "123-456-789-000",
  mobileNumber: "09171234567",
  emailAddress: "j@x.ph",
  homeBuilding: "Unit 4",
  homeStreet: "Aguinaldo St.",
  homeBarangay: "Sampaloc",
  homeCity: "Manila",
  homeProvince: "NCR",
  homeZipCode: "1008",
  bizBuilding: "Stall 3",
  bizStreet: "Quezon Ave.",
  bizBarangay: "Sampaloc",
  bizCity: "Manila",
  bizProvince: "NCR",
  bizZipCode: "1008",
  businessName: "Aling Nena Sari-sari",
  businessActivity: "Sari-sari retail",
  capitalization: 25000,
};

describe("resolveProfileValue", () => {
  it("returns literal field value", () => {
    expect(resolveProfileValue(sample, "firstName")).toBe("Juan");
    expect(resolveProfileValue(sample, "tin")).toBe("123-456-789-000");
  });

  it("composes synthetic fullName with all parts", () => {
    expect(resolveProfileValue(sample, "fullName")).toBe(
      "Juan Reyes Dela Cruz Jr.",
    );
  });

  it("composes fullName skipping missing parts", () => {
    expect(
      resolveProfileValue({ ...sample, middleName: undefined, suffix: undefined }, "fullName"),
    ).toBe("Juan Dela Cruz");
  });

  it("composes homeAddressLine and bizAddressLine", () => {
    expect(resolveProfileValue(sample, "homeAddressLine")).toBe(
      "Unit 4, Aguinaldo St., Sampaloc, Manila, NCR, 1008",
    );
    expect(resolveProfileValue(sample, "bizAddressLine")).toBe(
      "Stall 3, Quezon Ave., Sampaloc, Manila, NCR, 1008",
    );
  });

  it("coerces dateOfBirth to MM/DD/YYYY when type=date", () => {
    expect(
      resolveProfileValue(sample, "dateOfBirth", { type: "date" }),
    ).toBe("05/04/1990");
  });

  it("returns empty string for unknown key", () => {
    expect(resolveProfileValue(sample, "nonExistent")).toBe("");
  });

  it("returns empty string when profile is undefined", () => {
    expect(resolveProfileValue(undefined, "firstName")).toBe("");
  });

  it("AVAILABLE_PROFILE_KEYS includes literal + synthetic keys", () => {
    expect(AVAILABLE_PROFILE_KEYS).toContain("firstName");
    expect(AVAILABLE_PROFILE_KEYS).toContain("fullName");
    expect(AVAILABLE_PROFILE_KEYS).toContain("homeAddressLine");
    expect(AVAILABLE_PROFILE_KEYS).toContain("bizAddressLine");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm test -- server/forms/resolveProfile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/forms/resolveProfile.ts`:

```ts
import type { FirestoreProfile } from "../db";
import type { FieldType } from "./types";

const SYNTHETIC_KEYS = ["fullName", "homeAddressLine", "bizAddressLine"] as const;

const LITERAL_KEYS: (keyof FirestoreProfile)[] = [
  "firstName", "middleName", "lastName", "suffix",
  "dateOfBirth", "gender", "civilStatus", "citizenship",
  "placeOfBirth", "mothersName", "fathersName",
  "tin", "philsysId", "mobileNumber", "phoneNumber", "emailAddress",
  "homeBuilding", "homeStreet", "homeBarangay", "homeCity",
  "homeProvince", "homeRegion", "homeZipCode",
  "businessName", "businessNameOption2", "businessNameOption3",
  "businessType", "businessActivity", "territorialScope",
  "bizBuilding", "bizStreet", "bizBarangay", "bizCity",
  "bizProvince", "bizRegion", "bizZipCode",
  "capitalization", "expectedAnnualSales", "numberOfEmployees", "preferTaxOption",
];

export const AVAILABLE_PROFILE_KEYS: string[] = [
  ...LITERAL_KEYS.map(String),
  ...SYNTHETIC_KEYS,
];

export function resolveProfileValue(
  profile: FirestoreProfile | undefined,
  key: string,
  opts?: { type?: FieldType },
): string {
  if (!profile) return "";

  if (key === "fullName") {
    return [profile.firstName, profile.middleName, profile.lastName, profile.suffix]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (key === "homeAddressLine") {
    return [
      profile.homeBuilding, profile.homeStreet, profile.homeBarangay,
      profile.homeCity, profile.homeProvince, profile.homeZipCode,
    ].filter(Boolean).join(", ");
  }
  if (key === "bizAddressLine") {
    return [
      profile.bizBuilding, profile.bizStreet, profile.bizBarangay,
      profile.bizCity, profile.bizProvince, profile.bizZipCode,
    ].filter(Boolean).join(", ");
  }

  const raw = (profile as Record<string, unknown>)[key];
  if (raw == null) return "";
  let value = typeof raw === "number" ? raw.toString() : String(raw);

  if (opts?.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    value = `${m}/${d}/${y}`;
  }

  return value;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm test -- server/forms/resolveProfile.test.ts`
Expected: PASS (8 cases).

- [ ] **Step 5: Commit**

```bash
git add server/forms/resolveProfile.ts server/forms/resolveProfile.test.ts
git commit -m "feat(forms): resolve profile values incl. synthetic keys"
```

### 6. `processTemplate` — AcroForm-already path

Build the pipeline incrementally. First case: PDF that already has AcroForm fields → no Gemini call.

- [ ] **Step 1: Write the test**

Create `server/forms/processTemplate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("../_core/llm", () => ({
  invokeLLMWithPdf: vi.fn(),
  invokeLLM: vi.fn(),
}));

import { processTemplate } from "./processTemplate";
import { invokeLLMWithPdf } from "../_core/llm";

async function makeAcroFormPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  const f1 = form.createTextField("first_name");
  f1.addToPage(page, { x: 50, y: 300, width: 200, height: 20 });
  const f2 = form.createTextField("last_name");
  f2.addToPage(page, { x: 50, y: 250, width: 200, height: 20 });
  return Buffer.from(await doc.save());
}

describe("processTemplate (AcroForm-already path)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts existing fields without calling Gemini", async () => {
    const rawBytes = await makeAcroFormPdf();
    const result = await processTemplate({
      rawBytes,
      templateId: "t1",
    });

    expect(invokeLLMWithPdf).not.toHaveBeenCalled();
    expect(result.fieldsSchema.length).toBe(2);
    expect(result.fieldsSchema.map((f) => f.name).sort()).toEqual([
      "first_name",
      "last_name",
    ]);
    expect(result.fieldsSchema.every((f) => f.type === "text")).toBe(true);
    expect(result.processedBytes).toBeInstanceOf(Buffer);
    // Magic bytes
    expect(result.processedBytes.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm test -- server/forms/processTemplate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement scaffold + AcroForm path**

Create `server/forms/processTemplate.ts`:

```ts
import { PDFDocument } from "pdf-lib";
import type { FieldSpec, FormTemplate } from "./types";

export type ProcessTemplateInput = {
  rawBytes: Buffer;
  templateId: string;
  manifestHints?: Partial<FormTemplate>;
};

export type ProcessTemplateOutput = {
  processedBytes: Buffer;
  fieldsSchema: FieldSpec[];
};

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 4;

export async function processTemplate(
  input: ProcessTemplateInput,
): Promise<ProcessTemplateOutput> {
  if (input.rawBytes.byteLength > MAX_BYTES) {
    throw new Error(`PDF too large: ${input.rawBytes.byteLength} > ${MAX_BYTES}`);
  }

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(input.rawBytes);
  } catch (err) {
    throw new Error(`Failed to parse PDF: ${(err as Error).message}`);
  }

  const pageCount = doc.getPageCount();
  if (pageCount > MAX_PAGES) {
    throw new Error(`PDF has ${pageCount} pages; max ${MAX_PAGES}`);
  }

  // Path A: AcroForm already present.
  const existingFields = doc.getForm().getFields();
  if (existingFields.length > 0) {
    const fieldsSchema: FieldSpec[] = existingFields.map((f, idx) => {
      const widget = f.acroField.getWidgets()[0];
      const rect = widget?.getRectangle();
      const pageIndex = widget
        ? doc.getPages().findIndex((p) => p.ref === widget.P()?.ref)
        : 0;
      return {
        name: f.getName(),
        label: f.getName().replace(/[_-]/g, " "),
        page: pageIndex + 1 || 1,
        bbox: rect
          ? [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height]
          : [0, 0, 0, 0],
        type: "text",
        required: false,
        profileKey: null,
        placeholder: null,
        maxLength: null,
      };
    });
    return {
      processedBytes: Buffer.from(await doc.save()),
      fieldsSchema,
    };
  }

  // Path B (Gemini) — implemented in next step.
  throw new Error("Gemini path not yet implemented");
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm test -- server/forms/processTemplate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/forms/processTemplate.ts server/forms/processTemplate.test.ts
git commit -m "feat(forms): processTemplate handles AcroForm-already path"
```

### 7. `processTemplate` — Gemini path (happy)

- [ ] **Step 1: Add the happy-path test**

Append to `server/forms/processTemplate.test.ts`:

```ts
async function makeFlatPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  return Buffer.from(await doc.save());
}

describe("processTemplate (Gemini path)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls Gemini once and overlays detected fields", async () => {
    (invokeLLMWithPdf as unknown as vi.Mock).mockResolvedValueOnce({
      fields: [
        {
          label: "First Name",
          page: 1,
          bbox: [50, 300, 250, 320],
          bboxUnit: "pdf_points",
          type: "text",
          required: true,
          profileKey: "firstName",
          maxLength: 50,
        },
        {
          label: "Date of Birth",
          page: 1,
          bbox: [50, 250, 250, 270],
          bboxUnit: "pdf_points",
          type: "date",
          required: false,
          profileKey: "dateOfBirth",
          maxLength: null,
        },
      ],
    });

    const rawBytes = await makeFlatPdf();
    const result = await processTemplate({ rawBytes, templateId: "t2" });

    expect(invokeLLMWithPdf).toHaveBeenCalledTimes(1);
    expect(result.fieldsSchema).toHaveLength(2);
    expect(result.fieldsSchema[0].name).toMatch(/^first_name_p1_i\d+$/);
    expect(result.fieldsSchema[0].profileKey).toBe("firstName");
    expect(result.fieldsSchema[1].type).toBe("date");

    // The processed PDF must now have AcroForm widgets at those names.
    const processed = await PDFDocument.load(result.processedBytes);
    const names = processed.getForm().getFields().map((f) => f.getName());
    expect(names).toContain(result.fieldsSchema[0].name);
    expect(names).toContain(result.fieldsSchema[1].name);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm test -- server/forms/processTemplate.test.ts`
Expected: FAIL — Gemini path throws.

- [ ] **Step 3: Implement Gemini path**

Replace the `throw new Error("Gemini path not yet implemented")` line with the full implementation. Update `server/forms/processTemplate.ts`:

```ts
import { PDFDocument, PDFPage } from "pdf-lib";
import { z } from "zod";
import { invokeLLMWithPdf } from "../_core/llm";
import { AVAILABLE_PROFILE_KEYS } from "./resolveProfile";
import type { FieldSpec, FieldType, FormTemplate } from "./types";

// ...input/output types + constants unchanged...

const GeminiFieldSchema = z.object({
  label: z.string(),
  page: z.number().int().min(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  bboxUnit: z.literal("pdf_points").optional(),
  type: z.enum(["text", "checkbox", "date", "number"]).default("text"),
  required: z.boolean().default(false),
  profileKey: z.string().nullable().default(null),
  maxLength: z.number().nullable().default(null),
});

const GeminiResponseSchema = z.object({
  fields: z.array(GeminiFieldSchema),
});

function buildPrompt(): string {
  return [
    "You are extracting fillable form fields from a Philippine government form PDF.",
    "Return STRICT JSON with this schema:",
    `{"fields":[{"label":string,"page":number(1-indexed),"bbox":[x0,y0,x1,y1],"bboxUnit":"pdf_points","type":"text|checkbox|date|number","required":boolean,"profileKey":string|null,"maxLength":number|null}]}`,
    "bbox is in PDF user-space points with origin at bottom-left of the page (NOT pixels).",
    "bbox is the WRITEABLE area, not the printed label.",
    "Omit signature boxes, photo boxes, OR check (BIR) checkboxes that are not user-fillable.",
    "Set profileKey to one of these EXACT values when applicable, else null:",
    AVAILABLE_PROFILE_KEYS.map((k) => `- ${k}`).join("\n"),
    "Return ONLY the JSON object, no surrounding prose.",
  ].join("\n");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function inferTypeOverride(label: string, geminiType: FieldType): FieldType {
  const l = label.toLowerCase();
  if (/petsa|date of|date\b/.test(l)) return "date";
  if (/halaga|amount|capital|₱|peso|sales/.test(l)) return "number";
  return geminiType;
}

function clampBboxToPage(
  bbox: [number, number, number, number],
  page: PDFPage,
): [number, number, number, number] | null {
  const { width, height } = page.getSize();
  const [x0, y0, x1, y1] = bbox;
  const cx0 = Math.max(0, Math.min(x0, width));
  const cy0 = Math.max(0, Math.min(y0, height));
  const cx1 = Math.max(0, Math.min(x1, width));
  const cy1 = Math.max(0, Math.min(y1, height));
  if (cx1 - cx0 < 5 || cy1 - cy0 < 5) return null;
  return [cx0, cy0, cx1, cy1];
}

async function callGeminiWithRetry(
  rawBytes: Buffer,
  prompt: string,
): Promise<z.infer<typeof GeminiResponseSchema>> {
  const delays = [2000, 5000, 12000];
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await invokeLLMWithPdf<unknown>({
        pdfBytes: rawBytes,
        prompt: attempt === 0
          ? prompt
          : `${prompt}\n\nReturn ONLY valid JSON matching the schema above.`,
        jsonMode: true,
      });
      return GeminiResponseSchema.parse(raw);
    } catch (err) {
      lastErr = err as Error;
      if (/Gemini 429|Gemini 5\d\d/.test(lastErr.message)) {
        const wait = delays[attempt] ?? delays[delays.length - 1];
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      // For schema/parse failures, fall through to retry-with-strict prompt once.
    }
  }
  throw lastErr ?? new Error("Gemini call failed");
}
```

Then replace the post-AcroForm-path body with:

```ts
  // Path B: Gemini detection.
  const parsed = await callGeminiWithRetry(input.rawBytes, buildPrompt());

  const fieldsSchema: FieldSpec[] = [];
  const usedNames = new Set<string>();
  const pages = doc.getPages();
  const form = doc.getForm();

  parsed.fields.forEach((g, idx) => {
    const pageIdx = Math.min(Math.max(g.page - 1, 0), pages.length - 1);
    const page = pages[pageIdx];
    const clamped = clampBboxToPage(g.bbox, page);
    if (!clamped) return;

    const baseName = `${slug(g.label) || "field"}_p${pageIdx + 1}_i${idx}`;
    let name = baseName;
    let suffix = 1;
    while (usedNames.has(name)) {
      name = `${baseName}_${suffix++}`;
    }
    usedNames.add(name);

    const type = inferTypeOverride(g.label, g.type);
    const [x0, y0, x1, y1] = clamped;
    const width = x1 - x0;
    const height = y1 - y0;

    if (type === "checkbox") {
      const cb = form.createCheckBox(name);
      cb.addToPage(page, { x: x0, y: y0, width, height });
    } else {
      const tf = form.createTextField(name);
      tf.addToPage(page, { x: x0, y: y0, width, height });
      tf.setFontSize(10);
      if (g.maxLength) tf.setMaxLength(g.maxLength);
    }

    fieldsSchema.push({
      name,
      label: g.label,
      page: pageIdx + 1,
      bbox: clamped,
      type,
      required: g.required,
      profileKey: g.profileKey,
      placeholder: null,
      maxLength: g.maxLength ?? null,
    });
  });

  return {
    processedBytes: Buffer.from(await doc.save()),
    fieldsSchema,
  };
```

- [ ] **Step 4: Run all tests in file**

Run: `pnpm test -- server/forms/processTemplate.test.ts`
Expected: both `describe` blocks PASS.

- [ ] **Step 5: Commit**

```bash
git add server/forms/processTemplate.ts server/forms/processTemplate.test.ts
git commit -m "feat(forms): processTemplate gemini path with overlay"
```

### 8. `processTemplate` — failure cases

- [ ] **Step 1: Add tests**

Append to `server/forms/processTemplate.test.ts`:

```ts
describe("processTemplate (failures)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects PDFs over 20MB", async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1);
    await expect(
      processTemplate({ rawBytes: big, templateId: "t" }),
    ).rejects.toThrow(/too large/);
  });

  it("rejects when more than 4 pages", async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 5; i++) doc.addPage([400, 400]);
    const bytes = Buffer.from(await doc.save());
    await expect(
      processTemplate({ rawBytes: bytes, templateId: "t" }),
    ).rejects.toThrow(/5 pages/);
  });

  it("retries once on schema-invalid Gemini output, then fails", async () => {
    (invokeLLMWithPdf as unknown as vi.Mock)
      .mockResolvedValueOnce({ wrong: "shape" })
      .mockResolvedValueOnce({ wrong: "shape again" });

    const flat = await makeFlatPdf();
    await expect(
      processTemplate({ rawBytes: flat, templateId: "t" }),
    ).rejects.toThrow();
    expect(invokeLLMWithPdf).toHaveBeenCalledTimes(2);
  });

  it("clamps bbox out of page bounds and drops invalid fields", async () => {
    (invokeLLMWithPdf as unknown as vi.Mock).mockResolvedValueOnce({
      fields: [
        { label: "OK Field", page: 1, bbox: [10, 10, 100, 30], type: "text", required: false, profileKey: null, maxLength: null },
        { label: "Tiny", page: 1, bbox: [50, 50, 51, 51], type: "text", required: false, profileKey: null, maxLength: null }, // dropped (<5pt)
        { label: "Off Page", page: 1, bbox: [10000, 10000, 10100, 10030], type: "text", required: false, profileKey: null, maxLength: null }, // clamped to 0×0 then dropped
      ],
    });

    const flat = await makeFlatPdf();
    const result = await processTemplate({ rawBytes: flat, templateId: "t" });
    expect(result.fieldsSchema).toHaveLength(1);
    expect(result.fieldsSchema[0].label).toBe("OK Field");
  });
});
```

- [ ] **Step 2: Run, expect failures pass through retry logic**

Run: `pnpm test -- server/forms/processTemplate.test.ts`
Expected: PASS for all (the implementation already handles these — verify; if any fail, fix `processTemplate.ts`).

- [ ] **Step 3: Commit**

```bash
git add server/forms/processTemplate.test.ts
git commit -m "test(forms): processTemplate edge cases"
```

---

## Chunk 3: Storage + Repo + Seed

### 9. Storage helpers

- [ ] **Step 1: Create module**

Create `server/forms/storage.ts`:

```ts
import { adminBucket } from "../_core/firebaseAdmin";

function bucket() {
  if (!adminBucket) throw new Error("Firebase Storage not initialized");
  return adminBucket;
}

export function rawPath(templateId: string): string {
  return `formTemplates/raw/${templateId}.pdf`;
}

export function processedPath(templateId: string): string {
  return `formTemplates/processed/${templateId}.pdf`;
}

export async function uploadPdf(path: string, bytes: Buffer): Promise<void> {
  await bucket().file(path).save(bytes, {
    contentType: "application/pdf",
    resumable: false,
  });
}

export async function downloadPdf(path: string): Promise<Buffer> {
  const [buf] = await bucket().file(path).download();
  return buf;
}

export async function deletePdf(path: string): Promise<void> {
  await bucket().file(path).delete({ ignoreNotFound: true });
}
```

- [ ] **Step 2: Compile check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/forms/storage.ts
git commit -m "feat(forms): firebase storage helpers for templates"
```

### 10. Template repo (Firestore CRUD)

- [ ] **Step 1: Create module**

Create `server/forms/templateRepo.ts`:

```ts
/**
 * Firestore CRUD for `formTemplates`. Sole owner of this collection.
 * Routers and pipeline import from here; do not call adminDb directly.
 */
import { adminDb } from "../_core/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { FormTemplate, FormTemplateDoc } from "./types";

const COLL = "formTemplates";

function db() {
  if (!adminDb) throw new Error("Firestore not initialized");
  return adminDb;
}

function fromDoc(d: FormTemplateDoc): FormTemplate {
  return {
    ...d,
    createdAt: d.createdAt.toDate(),
    processedAt: d.processedAt ? d.processedAt.toDate() : null,
    deletedAt: d.deletedAt ? d.deletedAt.toDate() : null,
  };
}

export async function getTemplate(templateId: string): Promise<FormTemplate | null> {
  const snap = await db().collection(COLL).doc(templateId).get();
  if (!snap.exists) return null;
  return fromDoc(snap.data() as FormTemplateDoc);
}

export async function findReadyByHash(sourceHash: string): Promise<FormTemplate | null> {
  const snap = await db()
    .collection(COLL)
    .where("sourceHash", "==", sourceHash)
    .where("status", "==", "ready")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return fromDoc(snap.docs[0].data() as FormTemplateDoc);
}

export async function listSystemTemplates(): Promise<FormTemplate[]> {
  const snap = await db()
    .collection(COLL)
    .where("scope", "==", "system")
    .where("status", "==", "ready")
    .where("deletedAt", "==", null)
    .get();
  return snap.docs.map((d) => fromDoc(d.data() as FormTemplateDoc));
}

export async function listUserTemplates(uid: string): Promise<FormTemplate[]> {
  const snap = await db()
    .collection(COLL)
    .where("scope", "==", "user")
    .where("ownerUid", "==", uid)
    .where("status", "==", "ready")
    .where("deletedAt", "==", null)
    .get();
  return snap.docs.map((d) => fromDoc(d.data() as FormTemplateDoc));
}

export async function countUserUploadsLast24h(uid: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const snap = await db()
    .collection(COLL)
    .where("ownerUid", "==", uid)
    .where("createdAt", ">=", Timestamp.fromDate(since))
    .count()
    .get();
  return snap.data().count;
}

type WriteInput = Omit<FormTemplate, "createdAt" | "processedAt" | "deletedAt"> & {
  createdAt?: Date;
};

export async function writeTemplate(input: WriteInput): Promise<void> {
  await db().collection(COLL).doc(input.templateId).set(
    {
      ...input,
      createdAt: input.createdAt
        ? Timestamp.fromDate(input.createdAt)
        : FieldValue.serverTimestamp(),
      processedAt: input.status === "ready" ? FieldValue.serverTimestamp() : null,
      deletedAt: null,
    },
    { merge: true },
  );
}

export async function markFailed(templateId: string, errorMessage: string): Promise<void> {
  await db().collection(COLL).doc(templateId).update({
    status: "failed",
    errorMessage,
  });
}

export async function softDeleteUserTemplate(templateId: string, uid: string): Promise<void> {
  const ref = db().collection(COLL).doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("not found");
  const data = snap.data() as FormTemplateDoc;
  if (data.scope !== "user" || data.ownerUid !== uid) throw new Error("forbidden");
  await ref.update({ deletedAt: FieldValue.serverTimestamp() });
}
```

- [ ] **Step 2: Compile check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/forms/templateRepo.ts
git commit -m "feat(forms): firestore template repo"
```

### 11. Hash helper + processTemplate cache integration

- [ ] **Step 1: Add cache test**

Append to `server/forms/processTemplate.test.ts`:

```ts
import * as repo from "./templateRepo";

describe("processTemplate cache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns cached processed bytes when sourceHash matches a ready doc", async () => {
    const cachedBytes = Buffer.from("%PDF-1.4 cached");
    vi.spyOn(repo, "findReadyByHash").mockResolvedValueOnce({
      templateId: "cached_t",
      status: "ready",
      processedStoragePath: "formTemplates/processed/cached_t.pdf",
      fieldsSchema: [
        { name: "x", label: "X", page: 1, bbox: [0,0,10,10], type: "text", required: false, profileKey: null, placeholder: null, maxLength: null },
      ],
    } as unknown as FormTemplate);

    const storage = await import("./storage");
    vi.spyOn(storage, "downloadPdf").mockResolvedValueOnce(cachedBytes);

    const rawBytes = await makeAcroFormPdf();
    const result = await processTemplate({ rawBytes, templateId: "new_t" });

    expect(invokeLLMWithPdf).not.toHaveBeenCalled();
    expect(result.processedBytes).toEqual(cachedBytes);
    expect(result.fieldsSchema[0].name).toBe("x");
  });
});
```

Add the import for `FormTemplate` at the top of the test file: `import type { FormTemplate } from "./types";`.

- [ ] **Step 2: Run, expect failure** (cache logic not present yet)

Run: `pnpm test -- server/forms/processTemplate.test.ts`
Expected: FAIL — Gemini called or no cached bytes returned.

- [ ] **Step 3: Implement cache check in `processTemplate`**

At the very top of the function (before AcroForm probe), add:

```ts
import { createHash } from "crypto";
import { findReadyByHash } from "./templateRepo";
import { downloadPdf } from "./storage";
```

```ts
const sourceHash = createHash("sha256").update(input.rawBytes).digest("hex");
const cached = await findReadyByHash(sourceHash);
if (cached) {
  const processedBytes = await downloadPdf(cached.processedStoragePath);
  return { processedBytes, fieldsSchema: cached.fieldsSchema };
}
```

Also expose `sourceHash` in the return type so callers can persist it without re-hashing:

```ts
export type ProcessTemplateOutput = {
  processedBytes: Buffer;
  fieldsSchema: FieldSpec[];
  sourceHash: string;
};
```

Add `sourceHash` to all `return` statements in the function.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- server/forms/processTemplate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/forms/processTemplate.ts server/forms/processTemplate.test.ts
git commit -m "feat(forms): hash-based cache short-circuit in processTemplate"
```

### 12. Template manifest

- [ ] **Step 1: Inventory the bundled PDFs**

Run: `ls template/`
Confirm the 13 files match the spec list. Note any new arrivals or removals to update the manifest accordingly.

- [ ] **Step 2: Create `scripts/templateManifest.ts`**

```ts
import type { FieldSpec } from "../server/forms/types";

export type ManifestEntry = {
  filename: string; // relative to repo's template/ directory
  formId: string;
  templateId: string; // system_<formId>
  label: string;
  labelTl: string;
  agency: string;
  roadmapStep: number | null;
  description: string;
  flattenOnDownload: boolean;
  // Optional per-field profileKey overrides; applied after Gemini.
  fieldOverrides?: Partial<Pick<FieldSpec, "profileKey" | "type" | "required" | "maxLength">> &
    { matchLabel: string }[];
};

export const TEMPLATE_MANIFEST: ManifestEntry[] = [
  {
    filename: "Business Name Registration Application Forms.pdf",
    formId: "dti_bn",
    templateId: "system_dti_bn",
    label: "DTI Business Name Registration",
    labelTl: "Pagpaparehistro ng Pangalan ng Negosyo (DTI)",
    agency: "Department of Trade and Industry",
    roadmapStep: 1,
    description: "Apply for a DTI Business Name Certificate (sole proprietor).",
    flattenOnDownload: true,
  },
  {
    filename: "BUSINESS CLEARANCE APPLICATION FORM - Barangay-Bel-Air.pdf",
    formId: "barangay_clearance",
    templateId: "system_barangay_clearance",
    label: "Barangay Business Clearance Application",
    labelTl: "Aplikasyon para sa Barangay Business Clearance",
    agency: "Barangay Hall",
    roadmapStep: 2,
    description: "Required prior to Mayor's Permit. (Bel-Air sample; LGU may differ.)",
    flattenOnDownload: true,
  },
  {
    filename: "BIR Form 1901.pdf",
    formId: "bir_1901",
    templateId: "system_bir_1901",
    label: "BIR Form 1901 — Application for Registration",
    labelTl: "BIR Form 1901 — Aplikasyon para sa Pagpaparehistro",
    agency: "Bureau of Internal Revenue",
    roadmapStep: 5,
    description: "Self-employed and mixed-income earners.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form 1902.pdf",
    formId: "bir_1902",
    templateId: "system_bir_1902",
    label: "BIR Form 1902 — Application for TIN (Employees)",
    labelTl: "BIR Form 1902 — Pag-aplay ng TIN (Empleyado)",
    agency: "Bureau of Internal Revenue",
    roadmapStep: null,
    description: "TIN application for individuals earning purely compensation income.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form 1903.pdf",
    formId: "bir_1903",
    templateId: "system_bir_1903",
    label: "BIR Form 1903 — Application for Registration (Corporations / Partnerships)",
    labelTl: "BIR Form 1903",
    agency: "Bureau of Internal Revenue",
    roadmapStep: null,
    description: "For corporations, partnerships, cooperatives, government units.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form 1904.pdf",
    formId: "bir_1904",
    templateId: "system_bir_1904",
    label: "BIR Form 1904 — Application for TIN (One-Time Payors / Persons Registering Under E.O. 98)",
    labelTl: "BIR Form 1904",
    agency: "Bureau of Internal Revenue",
    roadmapStep: null,
    description: "One-time taxpayers and persons registering under E.O. 98.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form No. 1905.pdf",
    formId: "bir_1905",
    templateId: "system_bir_1905",
    label: "BIR Form 1905 — Application for Registration Information Update",
    labelTl: "BIR Form 1905",
    agency: "Bureau of Internal Revenue",
    roadmapStep: null,
    description: "Update / change registration information.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form No. 1906.pdf",
    formId: "bir_1906",
    templateId: "system_bir_1906",
    label: "BIR Form 1906 — Authority to Print Receipts and Invoices",
    labelTl: "BIR Form 1906",
    agency: "Bureau of Internal Revenue",
    roadmapStep: 6,
    description: "Authority to Print (ATP) for official receipts and invoices.",
    flattenOnDownload: false,
  },
  {
    filename: "View BIR Form No. 0605.pdf",
    formId: "bir_0605",
    templateId: "system_bir_0605",
    label: "BIR Form 0605 — Payment Form",
    labelTl: "BIR Form 0605 — Payment Form",
    agency: "Bureau of Internal Revenue",
    roadmapStep: 7,
    description: "Payment form for annual registration fee and other miscellaneous payments.",
    flattenOnDownload: false,
  },
  {
    filename: "Other BN-related Application Form.pdf",
    formId: "dti_other_bn",
    templateId: "system_dti_other_bn",
    label: "DTI Other BN Application (Renewal / Cancellation / Amendment)",
    labelTl: "DTI Other BN Application",
    agency: "Department of Trade and Industry",
    roadmapStep: null,
    description: "BN renewal, cancellation, or amendment.",
    flattenOnDownload: true,
  },
  {
    filename: "PMRF PhilHealth Member Registration Form.pdf",
    formId: "philhealth_pmrf",
    templateId: "system_philhealth_pmrf",
    label: "PhilHealth Member Registration Form (PMRF)",
    labelTl: "PMRF — Pagpaparehistro sa PhilHealth",
    agency: "Philippine Health Insurance Corporation",
    roadmapStep: null,
    description: "PhilHealth member registration.",
    flattenOnDownload: true,
  },
  {
    filename: "PMRF-FN PhilHealth Member Registration Form for Foreign Nationals.pdf",
    formId: "philhealth_pmrf_fn",
    templateId: "system_philhealth_pmrf_fn",
    label: "PhilHealth Member Registration Form (Foreign Nationals)",
    labelTl: "PMRF-FN PhilHealth Form (Foreign Nationals)",
    agency: "Philippine Health Insurance Corporation",
    roadmapStep: null,
    description: "PhilHealth registration for foreign nationals.",
    flattenOnDownload: true,
  },
  {
    filename: "Undertaking Document.pdf",
    formId: "dti_undertaking",
    templateId: "system_dti_undertaking",
    label: "DTI Undertaking Document",
    labelTl: "DTI Undertaking Document",
    agency: "Department of Trade and Industry",
    roadmapStep: 1,
    description: "Undertaking attached to DTI BN registration where applicable.",
    flattenOnDownload: true,
  },
];
```

If `ls template/` shows a different set, edit the manifest accordingly. The key invariant: every file in `template/` either has a manifest entry OR is intentionally excluded.

- [ ] **Step 3: Commit**

```bash
git add scripts/templateManifest.ts
git commit -m "feat(forms): catalog manifest for system templates"
```

### 13. Seed script

- [ ] **Step 1: Add `seed:templates` script to package.json**

```json
"scripts": {
  "seed:templates": "tsx scripts/seedTemplates.ts"
}
```

- [ ] **Step 2: Create `scripts/seedTemplates.ts`**

```ts
/**
 * Idempotent seed runner. Reads template/<filename>.pdf for each manifest entry,
 * runs processTemplate, uploads raw + processed to Firebase Storage,
 * writes Firestore doc.
 *
 *   pnpm seed:templates --dry-run   prints planned writes, no side effects
 *   pnpm seed:templates             skips entries already at status="ready"
 *   pnpm seed:templates --force     reprocesses everything
 */
import { readFileSync } from "fs";
import { join } from "path";
import { TEMPLATE_MANIFEST, type ManifestEntry } from "./templateManifest";
import { processTemplate } from "../server/forms/processTemplate";
import {
  getTemplate, writeTemplate, markFailed,
} from "../server/forms/templateRepo";
import {
  uploadPdf, rawPath, processedPath,
} from "../server/forms/storage";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");

async function seedOne(entry: ManifestEntry) {
  const tag = `[${entry.templateId}]`;
  const filePath = join(process.cwd(), "template", entry.filename);
  let rawBytes: Buffer;
  try {
    rawBytes = readFileSync(filePath);
  } catch {
    console.error(`${tag} MISSING file at ${filePath}`);
    return;
  }

  const existing = await getTemplate(entry.templateId);
  if (existing?.status === "ready" && !FORCE) {
    console.log(`${tag} already ready, skipping (use --force to reprocess)`);
    return;
  }

  if (DRY_RUN) {
    console.log(`${tag} would process ${rawBytes.length} bytes -> ${entry.label}`);
    return;
  }

  console.log(`${tag} processing...`);
  try {
    const { processedBytes, fieldsSchema, sourceHash } = await processTemplate({
      rawBytes,
      templateId: entry.templateId,
      manifestHints: {
        formId: entry.formId,
        scope: "system",
        ownerUid: null,
        label: entry.label,
        labelTl: entry.labelTl,
        agency: entry.agency,
        roadmapStep: entry.roadmapStep,
        description: entry.description,
        flattenOnDownload: entry.flattenOnDownload,
      },
    });

    await uploadPdf(rawPath(entry.templateId), rawBytes);
    await uploadPdf(processedPath(entry.templateId), processedBytes);

    await writeTemplate({
      templateId: entry.templateId,
      scope: "system",
      ownerUid: null,
      formId: entry.formId,
      label: entry.label,
      labelTl: entry.labelTl,
      agency: entry.agency,
      roadmapStep: entry.roadmapStep,
      description: entry.description,
      rawStoragePath: rawPath(entry.templateId),
      processedStoragePath: processedPath(entry.templateId),
      sourceHash,
      fieldsSchema,
      flattenOnDownload: entry.flattenOnDownload,
      status: "ready",
      errorMessage: null,
      createdBy: "system",
    });

    console.log(`${tag} ready (${fieldsSchema.length} fields)`);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`${tag} FAILED: ${msg}`);
    if (!DRY_RUN) {
      await writeTemplate({
        templateId: entry.templateId,
        scope: "system",
        ownerUid: null,
        formId: entry.formId,
        label: entry.label,
        labelTl: entry.labelTl,
        agency: entry.agency,
        roadmapStep: entry.roadmapStep,
        description: entry.description,
        rawStoragePath: rawPath(entry.templateId),
        processedStoragePath: processedPath(entry.templateId),
        sourceHash: "",
        fieldsSchema: [],
        flattenOnDownload: entry.flattenOnDownload,
        status: "failed",
        errorMessage: msg,
        createdBy: "system",
      }).catch(() => {});
    }
  }
}

async function main() {
  console.log(`Seed mode: ${DRY_RUN ? "DRY RUN" : FORCE ? "FORCE" : "INCREMENTAL"}`);
  for (const entry of TEMPLATE_MANIFEST) {
    await seedOne(entry);
    // Be polite to Gemini free tier.
    await new Promise((r) => setTimeout(r, 4000));
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Dry-run sanity**

Run: `pnpm seed:templates --dry-run`
Expected: prints one `would process` line per manifest entry. No Firebase writes. Confirms `template/` filenames match manifest.

If any `MISSING file` appears, either rename in manifest or move PDF to match.

- [ ] **Step 4: Live seed (requires `serviceAccount.json` + `GEMINI_API_KEY`)**

Run: `pnpm seed:templates`
Expected: each entry processed; final `ready` count printed; Firestore `formTemplates` collection populated; Storage objects under `formTemplates/raw/` and `formTemplates/processed/`.

Manually verify in Firebase console: 13 docs, each with `status: "ready"` and a non-empty `fieldsSchema`.

- [ ] **Step 5: Commit**

```bash
git add scripts/seedTemplates.ts package.json
git commit -m "feat(forms): seed:templates idempotent runner"
```

---

## Chunk 4: Router rewrite

### 14. Extract forms router into its own file

- [ ] **Step 1: Create `server/routers/forms.ts`**

```ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { customAlphabet } from "nanoid";
import { PDFDocument } from "pdf-lib";
import { router, protectedProcedure } from "../_core/trpc";
import { getProfile } from "../db";
import {
  getTemplate, listSystemTemplates, listUserTemplates,
  writeTemplate, markFailed, softDeleteUserTemplate,
  countUserUploadsLast24h,
} from "../forms/templateRepo";
import {
  uploadPdf, downloadPdf, rawPath, processedPath,
} from "../forms/storage";
import { processTemplate } from "../forms/processTemplate";
import { resolveProfileValue } from "../forms/resolveProfile";
import type {
  FormTemplate, FormSummary, FilledSchemaResponse,
} from "../forms/types";

const nanoidLower = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

function toSummary(t: FormTemplate): FormSummary {
  return {
    templateId: t.templateId,
    formId: t.formId,
    label: t.label,
    labelTl: t.labelTl,
    agency: t.agency,
    roadmapStep: t.roadmapStep,
    scope: t.scope,
    fieldCount: t.fieldsSchema.length,
  };
}

export const formsRouter = router({
  list: protectedProcedure
    .input(z.object({ roadmapStep: z.number().optional() }).optional())
    .query(async ({ ctx, input }): Promise<FormSummary[]> => {
      const [system, user] = await Promise.all([
        listSystemTemplates(),
        listUserTemplates(ctx.user.uid),
      ]);
      const userByForm = new Map(user.map((t) => [t.formId, t]));
      const merged = [
        ...user,
        ...system.filter((s) => !userByForm.has(s.formId)),
      ];
      const filtered = input?.roadmapStep != null
        ? merged.filter((t) => t.roadmapStep === input.roadmapStep)
        : merged;
      return filtered.map(toSummary);
    }),

  schema: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }): Promise<FilledSchemaResponse> => {
      const tpl = await getTemplate(input.templateId);
      if (!tpl || tpl.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "template not found" });
      }
      if (tpl.status !== "ready") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `template status: ${tpl.status}`,
        });
      }
      if (tpl.scope === "user" && tpl.ownerUid !== ctx.user.uid) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const profile = await getProfile(ctx.user.uid).catch(() => undefined);

      const filled: Record<string, string> = {};
      const missingRequired: string[] = [];
      for (const f of tpl.fieldsSchema) {
        const v = f.profileKey
          ? resolveProfileValue(profile ?? undefined, f.profileKey, { type: f.type })
          : "";
        if (v) filled[f.name] = v;
        if (f.required && !v) missingRequired.push(f.name);
      }
      return { template: tpl, filled, missingRequired };
    }),

  generatePdf: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      values: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const tpl = await getTemplate(input.templateId);
      if (!tpl || tpl.deletedAt || tpl.status !== "ready") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (tpl.scope === "user" && tpl.ownerUid !== ctx.user.uid) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const missing = tpl.fieldsSchema
        .filter((f) => f.required && !input.values[f.name])
        .map((f) => f.name);
      if (missing.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `missing required: ${missing.join(",")}`,
        });
      }

      const bytes = await downloadPdf(tpl.processedStoragePath);
      const doc = await PDFDocument.load(bytes);
      const form = doc.getForm();

      for (const f of tpl.fieldsSchema) {
        const v = input.values[f.name];
        if (v == null) continue;
        try {
          if (f.type === "checkbox") {
            const cb = form.getCheckBox(f.name);
            v === "true" ? cb.check() : cb.uncheck();
          } else {
            form.getTextField(f.name).setText(String(v));
          }
        } catch {
          // Skip unknown fields silently per spec.
        }
      }

      if (tpl.flattenOnDownload) form.flatten();

      const filledBytes = Buffer.from(await doc.save());
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      return {
        pdfContent: filledBytes.toString("base64"),
        contentType: "application/pdf",
        filename: `${tpl.formId}-${today}.pdf`,
      };
    }),

  preview: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      values: z.record(z.string(), z.string()),
    }))
    .mutation(async (opts) =>
      // Same body as generatePdf; reuse via direct call.
      formsRouter.createCaller(opts.ctx).generatePdf(opts.input),
    ),

  uploadTemplate: protectedProcedure
    .input(z.object({
      formId: z.string().min(1).max(64),
      label: z.string().max(120).optional(),
      pdfBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.pdfBase64, "base64");
      if (bytes.byteLength === 0 || bytes.subarray(0, 4).toString() !== "%PDF") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "not a PDF" });
      }
      if (bytes.byteLength > 10 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "max 10 MB" });
      }
      const today = await countUserUploadsLast24h(ctx.user.uid);
      if (today >= 10) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "10 uploads per day limit",
        });
      }

      const templateId = `${ctx.user.uid}_${nanoidLower()}`;
      try {
        const { processedBytes, fieldsSchema, sourceHash } = await processTemplate({
          rawBytes: bytes,
          templateId,
          manifestHints: {
            scope: "user",
            ownerUid: ctx.user.uid,
            formId: input.formId,
            label: input.label ?? input.formId,
          },
        });
        await uploadPdf(rawPath(templateId), bytes);
        await uploadPdf(processedPath(templateId), processedBytes);
        await writeTemplate({
          templateId,
          scope: "user",
          ownerUid: ctx.user.uid,
          formId: input.formId,
          label: input.label ?? input.formId,
          labelTl: input.label ?? input.formId,
          agency: "User Upload",
          roadmapStep: null,
          description: "User-uploaded template",
          rawStoragePath: rawPath(templateId),
          processedStoragePath: processedPath(templateId),
          sourceHash,
          fieldsSchema,
          flattenOnDownload: true,
          status: "ready",
          errorMessage: null,
          createdBy: ctx.user.uid,
        });
        return { templateId, status: "ready" as const };
      } catch (err) {
        const msg = (err as Error).message;
        await markFailed(templateId, msg).catch(() => {});
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await softDeleteUserTemplate(input.templateId, ctx.user.uid);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "forbidden") throw new TRPCError({ code: "FORBIDDEN" });
        if (msg === "not found") throw new TRPCError({ code: "NOT_FOUND" });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
      return { success: true };
    }),
});
```

Note: `getProfile` must already exist in `server/db.ts`. If not, add a helper:

```ts
// in server/db.ts
export async function getProfile(uid: string): Promise<FirestoreProfile | null> {
  if (!adminDb) throw new Error("Firestore not initialized");
  const snap = await adminDb.collection("profiles").doc(uid).get();
  return snap.exists ? (snap.data() as FirestoreProfile) : null;
}
```

(Check first; the inline `forms.generatePdf` today reads via existing `profile.get` semantics — find the equivalent helper or add `getProfile` cleanly.)

- [ ] **Step 2: Replace inline forms block in `server/routers.ts`**

In `server/routers.ts`:
1. Remove the existing `forms: router({ generatePdf: ... })` block (around line 405).
2. Add at the top: `import { formsRouter } from "./routers/forms";`
3. In the `appRouter` composition, replace the inline `forms` entry with `forms: formsRouter`.

- [ ] **Step 3: Compile**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routers/forms.ts server/routers.ts server/db.ts
git commit -m "feat(forms): rewrite forms router with template registry"
```

### 15. Router tests

- [ ] **Step 1: Create `server/routers/forms.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("../forms/templateRepo");
vi.mock("../forms/storage");
vi.mock("../forms/processTemplate");
vi.mock("../db");

import * as repo from "../forms/templateRepo";
import * as storage from "../forms/storage";
import * as proc from "../forms/processTemplate";
import * as db from "../db";
import { formsRouter } from "./forms";
import type { FormTemplate } from "../forms/types";
import { PDFDocument } from "pdf-lib";

const ctxFactory = (uid: string) => ({
  user: { uid, email: `${uid}@x.ph`, name: uid, role: "user" as const },
});

const sysTpl: FormTemplate = {
  templateId: "system_dti_bn",
  scope: "system",
  ownerUid: null,
  formId: "dti_bn",
  label: "DTI BN",
  labelTl: "DTI BN TL",
  agency: "DTI",
  roadmapStep: 1,
  description: "",
  rawStoragePath: "raw/x.pdf",
  processedStoragePath: "processed/x.pdf",
  sourceHash: "h",
  fieldsSchema: [
    { name: "first_name", label: "First Name", page: 1, bbox: [0,0,10,10], type: "text", required: true, profileKey: "firstName", placeholder: null, maxLength: null },
    { name: "tin", label: "TIN", page: 1, bbox: [0,20,10,30], type: "text", required: false, profileKey: "tin", placeholder: null, maxLength: null },
  ],
  flattenOnDownload: true,
  status: "ready",
  errorMessage: null,
  createdAt: new Date(),
  processedAt: new Date(),
  createdBy: "system",
  deletedAt: null,
};

describe("forms router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list returns system + user (user shadows on formId)", async () => {
    vi.mocked(repo.listSystemTemplates).mockResolvedValueOnce([sysTpl]);
    const userTpl = { ...sysTpl, templateId: "u1_abc", scope: "user" as const, ownerUid: "u1" };
    vi.mocked(repo.listUserTemplates).mockResolvedValueOnce([userTpl]);

    const caller = formsRouter.createCaller(ctxFactory("u1") as any);
    const list = await caller.list({});
    expect(list).toHaveLength(1);
    expect(list[0].templateId).toBe("u1_abc");
  });

  it("schema rejects cross-user", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce({
      ...sysTpl, scope: "user", ownerUid: "u2", templateId: "u2_x",
    });
    const caller = formsRouter.createCaller(ctxFactory("u1") as any);
    await expect(caller.schema({ templateId: "u2_x" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("schema fills required fields and reports missing", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce(sysTpl);
    vi.mocked(db.getProfile).mockResolvedValueOnce({
      userId: "u1", firstName: "Juan", tin: "",
    } as any);

    const caller = formsRouter.createCaller(ctxFactory("u1") as any);
    const res = await caller.schema({ templateId: sysTpl.templateId });
    expect(res.filled).toEqual({ first_name: "Juan" });
    expect(res.missingRequired).toEqual([]);
  });

  it("schema reports missing required when profile lacks value", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce(sysTpl);
    vi.mocked(db.getProfile).mockResolvedValueOnce({ userId: "u1" } as any);

    const caller = formsRouter.createCaller(ctxFactory("u1") as any);
    const res = await caller.schema({ templateId: sysTpl.templateId });
    expect(res.missingRequired).toEqual(["first_name"]);
  });

  it("generatePdf returns %PDF- bytes on happy path", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce(sysTpl);

    // Build a real PDF so pdf-lib can load it.
    const realDoc = await PDFDocument.create();
    const page = realDoc.addPage([400, 400]);
    const f = realDoc.getForm().createTextField("first_name");
    f.addToPage(page, { x: 50, y: 300, width: 200, height: 20 });
    const realBytes = Buffer.from(await realDoc.save());
    vi.mocked(storage.downloadPdf).mockResolvedValueOnce(realBytes);

    const caller = formsRouter.createCaller(ctxFactory("u1") as any);
    const res = await caller.generatePdf({
      templateId: sysTpl.templateId,
      values: { first_name: "Juan" },
    });
    expect(res.contentType).toBe("application/pdf");
    expect(Buffer.from(res.pdfContent, "base64").subarray(0, 5).toString())
      .toBe("%PDF-");
    expect(res.filename).toMatch(/^dti_bn-\d{8}\.pdf$/);
  });

  it("generatePdf rejects when required field missing", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce(sysTpl);

    const caller = formsRouter.createCaller(ctxFactory("u1") as any);
    await expect(
      caller.generatePdf({ templateId: sysTpl.templateId, values: {} }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("uploadTemplate enforces 10/day cap", async () => {
    vi.mocked(repo.countUserUploadsLast24h).mockResolvedValueOnce(10);
    const validPdfB64 = (await PDFDocument.create()
      .then((d) => d.addPage([200, 200]) && d.save())
      .then((b) => Buffer.from(b).toString("base64"))) as unknown as string;
    const caller = formsRouter.createCaller(ctxFactory("u1") as any);
    await expect(
      caller.uploadTemplate({ formId: "x", pdfBase64: validPdfB64 }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("uploadTemplate rejects non-PDF base64", async () => {
    vi.mocked(repo.countUserUploadsLast24h).mockResolvedValueOnce(0);
    const caller = formsRouter.createCaller(ctxFactory("u1") as any);
    await expect(
      caller.uploadTemplate({
        formId: "x",
        pdfBase64: Buffer.from("not a pdf").toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("deleteTemplate forbids non-owner", async () => {
    vi.mocked(repo.softDeleteUserTemplate).mockRejectedValueOnce(new Error("forbidden"));
    const caller = formsRouter.createCaller(ctxFactory("u1") as any);
    await expect(
      caller.deleteTemplate({ templateId: "u2_x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test -- server/routers/forms.test.ts`
Expected: 9 cases PASS.

If a test fails because `getProfile` mock or context shape mismatches the real codebase, adjust the mock — do **not** weaken the test.

- [ ] **Step 3: Commit**

```bash
git add server/routers/forms.test.ts
git commit -m "test(forms): router contract coverage"
```

---

## Chunk 5: Client rewrite + docs

### 16. tRPC types confirmation

- [ ] **Step 1: Verify client side picks up new shapes**

Run: `pnpm check`
Expected: PASS. Client `client/src/pages/Forms.tsx` will not yet compile because the procs it calls are gone — that's fine; we rewrite next.

If the type error in `Forms.tsx` is the only one, proceed to step 17.

### 17. Helpers and small components

- [ ] **Step 1: Create `client/src/lib/dataUriPdf.ts`**

```ts
export function base64PdfToBlobUrl(base64: string): { url: string; revoke: () => void } {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export function triggerPdfDownload(base64: string, filename: string): void {
  const { url, revoke } = base64PdfToBlobUrl(base64);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  revoke();
}
```

- [ ] **Step 2: Create `PreviewSheet.tsx`**

`client/src/components/forms/PreviewSheet.tsx`:

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function PreviewSheet({
  open, onOpenChange, blobUrl, title,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  blobUrl: string | null;
  title: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0">
        <SheetHeader className="p-3 border-b border-border">
          <SheetTitle className="font-[var(--font-display)] text-sm">{title}</SheetTitle>
        </SheetHeader>
        {blobUrl && (
          <iframe
            src={blobUrl}
            title={title}
            className="w-full h-[calc(85vh-3rem)] border-0"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Create `UploadTemplateButton.tsx`**

`client/src/components/forms/UploadTemplateButton.tsx`:

```tsx
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function UploadTemplateButton({
  formId, formLabel, onUploaded,
}: {
  formId: string;
  formLabel: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = trpc.forms.uploadTemplate.useMutation();

  async function handleFile(file: File) {
    if (!file.type.includes("pdf")) {
      toast.error("Please pick a PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB.");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      await upload.mutateAsync({ formId, label: formLabel, pdfBase64: b64 });
      toast.success("Uploaded! Detecting fields...");
      onUploaded();
    } catch (err) {
      toast.error((err as Error).message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        variant="outline"
        size="sm"
        className="rounded-xl border-teal/30 text-teal text-xs h-11"
      >
        {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
        Mag-upload ng template
      </Button>
    </>
  );
}
```

- [ ] **Step 4: Compile check**

Run: `pnpm check`
Expected: PASS for new components (Forms.tsx still broken).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/dataUriPdf.ts client/src/components/forms/
git commit -m "feat(forms-ui): preview sheet, upload button, pdf helpers"
```

### 18. Rewrite Forms.tsx

- [ ] **Step 1: Replace `client/src/pages/Forms.tsx` whole-file**

Constraints:
- Keep existing visual structure (sticky header, profile-status banner, expandable form cards, edit/preview toggle, `FormHelpDrawer` floating button, login + profile-empty branches).
- Drive the form list from `forms.list` instead of the hardcoded array.
- For each card, lazily call `forms.schema` when expanded.
- Use `triggerPdfDownload` helper.
- For preview, mutate `forms.preview`, build blob URL, open `<PreviewSheet>`.
- For "no template" rows in `list` (unlikely after seed), render `<UploadTemplateButton>` and on success refetch `list`.

```tsx
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, Download, CheckCircle2, AlertCircle, User, Loader2,
  ChevronDown, ChevronUp, Edit3, Eye, HelpCircle, MessageCircle, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import FormHelpDrawer from "@/components/FormHelpDrawer";
import { useFormHelp } from "@/hooks/useFormHelp";
import { triggerPdfDownload, base64PdfToBlobUrl } from "@/lib/dataUriPdf";
import { PreviewSheet } from "@/components/forms/PreviewSheet";
import { UploadTemplateButton } from "@/components/forms/UploadTemplateButton";

export default function Forms() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const [activeFormName, setActiveFormName] = useState("");
  const formHelp = useFormHelp(activeFormName);

  const [previewState, setPreviewState] = useState<{ url: string; title: string } | null>(null);

  const profileQuery = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const listQuery = trpc.forms.list.useQuery(undefined, { enabled: isAuthenticated });

  const generateMut = trpc.forms.generatePdf.useMutation({
    onSuccess: (data) => {
      triggerPdfDownload(data.pdfContent, data.filename);
      toast.success("PDF na-download!");
    },
    onError: (err) => toast.error(err.message ?? "Error sa pag-generate ng PDF"),
  });

  const previewMut = trpc.forms.preview.useMutation({
    onSuccess: (data) => {
      const { url } = base64PdfToBlobUrl(data.pdfContent);
      setPreviewState({ url, title: data.filename });
    },
    onError: (err) => toast.error(err.message ?? "Error sa preview"),
  });

  const deleteMut = trpc.forms.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Tinanggal na ang template");
      listQuery.refetch();
    },
  });

  useEffect(() => () => { previewState && URL.revokeObjectURL(previewState.url); }, [previewState]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-warm-cream flex flex-col items-center justify-center p-6 text-center">
        <FileText className="w-12 h-12 text-teal mb-4" />
        <h2 className="font-[var(--font-display)] text-lg text-earth-brown mb-2">Sign in para gamitin ang Auto-fill</h2>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="bg-teal hover:bg-teal/90 text-white rounded-xl px-8 py-3 font-[var(--font-display)] h-12 min-h-11">Sign In</Button>
      </div>
    );
  }

  const profile = profileQuery.data;
  const fullName = profile
    ? [profile.firstName, profile.middleName, profile.lastName, profile.suffix].filter(Boolean).join(" ")
    : "";
  const hasProfile = !!profile?.firstName;

  const summaries = listQuery.data ?? [];

  return (
    <div className="min-h-screen bg-warm-cream pb-24">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button onClick={() => navigate("/roadmap")} className="p-1.5 rounded-lg hover:bg-muted transition-colors min-h-11 min-w-11 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-earth-brown" />
          </button>
          <div className="flex-1">
            <h1 className="font-[var(--font-display)] text-sm text-earth-brown">Smart Form Auto-fill</h1>
            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">Punan, i-preview, at i-download</p>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mt-4 space-y-4 px-4">
        {!hasProfile ? (
          <div className="bg-mango-light rounded-2xl border border-mango/30 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-mango shrink-0 mt-0.5" />
              <div>
                <h3 className="font-[var(--font-display)] text-sm">Punan muna ang Profile</h3>
                <Button onClick={() => navigate("/profile")} size="sm" className="mt-3 bg-mango text-earth-brown rounded-xl h-11">
                  <User className="w-4 h-4 mr-1" />Pumunta sa Profile
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-teal-light rounded-2xl border border-teal/30 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal shrink-0" />
            <div className="flex-1 text-sm">Profile loaded: {fullName}</div>
            <Button onClick={() => navigate("/profile")} variant="outline" size="sm" className="rounded-xl border-teal/30 text-teal text-xs h-11">
              <Edit3 className="w-3 h-3 mr-1" />Edit
            </Button>
          </div>
        )}

        {listQuery.isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-teal" />
          </div>
        )}

        {summaries.map((s, i) => (
          <FormCard
            key={s.templateId}
            summary={s}
            isExpanded={expandedId === s.templateId}
            isEditing={editingId === s.templateId}
            overrides={overrides[s.templateId] ?? {}}
            onToggleExpand={() => setExpandedId(expandedId === s.templateId ? null : s.templateId)}
            onToggleEdit={() => setEditingId(editingId === s.templateId ? null : s.templateId)}
            onChangeField={(name, value) => setOverrides((prev) => ({
              ...prev,
              [s.templateId]: { ...(prev[s.templateId] ?? {}), [name]: value },
            }))}
            onDownload={(values) => generateMut.mutate({ templateId: s.templateId, values })}
            onPreview={(values) => previewMut.mutate({ templateId: s.templateId, values })}
            onDelete={s.scope === "user" ? () => deleteMut.mutate({ templateId: s.templateId }) : null}
            onOpenHelp={(label) => {
              setActiveFormName(s.label);
              formHelp.openHelp(label);
            }}
            isDownloading={generateMut.isPending}
            isPreviewing={previewMut.isPending}
            indexAnimDelay={i * 0.05}
          />
        ))}
      </div>

      <PreviewSheet
        open={!!previewState}
        onOpenChange={(b) => { if (!b) setPreviewState(null); }}
        blobUrl={previewState?.url ?? null}
        title={previewState?.title ?? ""}
      />

      {!formHelp.isOpen && (
        <button
          onClick={() => formHelp.openHelp("General na tanong sa form")}
          className="fixed bottom-24 right-4 w-14 h-14 bg-teal text-white rounded-full shadow-lg flex items-center justify-center z-30"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      <FormHelpDrawer
        isOpen={formHelp.isOpen}
        onClose={formHelp.closeHelp}
        formName={formHelp.formName}
        fieldLabel={formHelp.activeField?.label ?? ""}
        history={formHelp.history}
        onAddMessage={formHelp.addMessage}
        userProfile={profile ? (profile as unknown as Record<string, unknown>) : undefined}
      />
    </div>
  );
}

function FormCard(props: {
  summary: any;
  isExpanded: boolean;
  isEditing: boolean;
  overrides: Record<string, string>;
  onToggleExpand: () => void;
  onToggleEdit: () => void;
  onChangeField: (name: string, value: string) => void;
  onDownload: (values: Record<string, string>) => void;
  onPreview: (values: Record<string, string>) => void;
  onDelete: (() => void) | null;
  onOpenHelp: (label: string) => void;
  isDownloading: boolean;
  isPreviewing: boolean;
  indexAnimDelay: number;
}) {
  const { summary, isExpanded, isEditing, overrides } = props;
  const schemaQuery = trpc.forms.schema.useQuery(
    { templateId: summary.templateId },
    { enabled: isExpanded },
  );

  const tpl = schemaQuery.data?.template;
  const filled = schemaQuery.data?.filled ?? {};

  function valueOf(name: string): string {
    return overrides[name] ?? filled[name] ?? "";
  }
  function fieldsAsValues(): Record<string, string> {
    const out: Record<string, string> = {};
    tpl?.fieldsSchema.forEach((f: any) => { out[f.name] = valueOf(f.name); });
    return out;
  }
  const filledCount = tpl ? tpl.fieldsSchema.filter((f: any) => valueOf(f.name).trim()).length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: props.indexAnimDelay }}
      className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
    >
      <button onClick={props.onToggleExpand} className="w-full text-left p-4 min-h-11">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {summary.roadmapStep != null && (
                <span className="text-[10px] font-[var(--font-mono)] uppercase tracking-wider text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                  Step {summary.roadmapStep}
                </span>
              )}
              {summary.scope === "user" && (
                <span className="text-[10px] uppercase tracking-wider text-mango bg-mango-light px-2 py-0.5 rounded-full">Sariling Upload</span>
              )}
              {tpl && (
                <span className={`text-[10px] font-[var(--font-mono)] px-2 py-0.5 rounded-full ${
                  filledCount === tpl.fieldsSchema.length ? "text-success bg-success/10" : "text-mango bg-mango-light"
                }`}>{filledCount}/{tpl.fieldsSchema.length} filled</span>
              )}
            </div>
            <h3 className="font-[var(--font-display)] text-sm text-earth-brown leading-snug">{summary.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{summary.agency}</p>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-border/50">
              {schemaQuery.isLoading && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-teal" /></div>}
              {schemaQuery.error && <p className="text-xs text-destructive py-3">{schemaQuery.error.message}</p>}
              {tpl && (
                <>
                  <p className="text-xs text-muted-foreground mt-3 mb-3">{tpl.description}</p>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <Button onClick={props.onToggleEdit} variant="outline" size="sm" className="rounded-xl text-xs border-teal/30 text-teal h-11">
                      {isEditing ? <><Eye className="w-3 h-3 mr-1" />Preview Mode</> : <><Edit3 className="w-3 h-3 mr-1" />Edit Fields</>}
                    </Button>
                    {props.onDelete && (
                      <Button onClick={props.onDelete} variant="outline" size="sm" className="rounded-xl text-xs text-destructive border-destructive/30 h-11">
                        <Trash2 className="w-3 h-3 mr-1" />Tanggalin
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {tpl.fieldsSchema.map((f: any) => {
                      const v = valueOf(f.name);
                      const isEmpty = !v.trim();
                      return (
                        <div key={f.name} className="flex items-start gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              {f.label}
                              {f.required && <span className="text-destructive">*</span>}
                              <button type="button" onClick={() => props.onOpenHelp(f.label)} className="ml-auto text-muted-foreground/60 hover:text-teal">
                                <HelpCircle className="w-3 h-3" />
                              </button>
                            </label>
                            {isEditing ? (
                              <input
                                type={f.type === "number" ? "number" : "text"}
                                inputMode={f.type === "number" ? "numeric" : undefined}
                                value={v}
                                maxLength={f.maxLength ?? undefined}
                                onChange={(e) => props.onChangeField(f.name, e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-base focus:outline-none focus:ring-2 focus:ring-teal/40 mt-0.5 min-h-11"
                              />
                            ) : (
                              <p className={`text-sm mt-0.5 ${isEmpty ? "text-muted-foreground/50 italic" : "text-earth-brown"}`}>
                                {isEmpty ? "(walang laman)" : v}
                              </p>
                            )}
                          </div>
                          {!isEmpty && !isEditing && <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-4" />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/50 flex gap-2 flex-wrap">
                    <Button onClick={() => props.onPreview(fieldsAsValues())} disabled={props.isPreviewing} variant="outline" className="flex-1 rounded-xl border-teal/30 text-teal h-12 min-h-11">
                      {props.isPreviewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}Preview
                    </Button>
                    <Button onClick={() => props.onDownload(fieldsAsValues())} disabled={props.isDownloading} className="flex-1 bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] h-12 min-h-11">
                      {props.isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Download
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 2: Compile check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Dev server smoke test**

Run: `pnpm dev`
Open http://localhost:3000/forms (sign in if needed). Expected:
- 13 form cards render from `forms.list`.
- Expand one → fields prefilled from profile.
- Edit Fields → input values, see them change. Tap targets feel ≥44px on a 360-wide viewport.
- Preview → bottom sheet opens, PDF renders inside iframe with values in detected boxes.
- Download → real PDF lands, opens in Chrome viewer + (optional) Acrobat with `%PDF-` header.
- Upload (if a row offers it) → spinner ~5s, then refresh shows "Sariling Upload" badge.

If alignment is off for a catalog form, document it as a follow-up — DO NOT fix in this plan; spec covers it via per-field `bboxOverride` in manifest, which is a separate change.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Forms.tsx
git commit -m "feat(forms-ui): rewrite Forms.tsx data-driven from forms.list/schema"
```

### 19. Update DEV_TASKS.md

- [ ] **Step 1: Mark Track A complete**

In `docs/DEV_TASKS.md`, locate the Track A block. Update header to indicate it's now done, and add a pointer:

```md
### Track A — Real PDF generation [DONE — 2026-04-25]

Replaced by dynamic form autofill engine. See:
- Spec: `docs/superpowers/specs/2026-04-25-dynamic-form-autofill-design.md`
- Plan: `docs/superpowers/plans/2026-04-25-dynamic-form-autofill.md`
```

Also update the table row near the top of the file (`| 03 | Form auto-fill ... |`) to `Working — see Track A done note`.

- [ ] **Step 2: Commit**

```bash
git add docs/DEV_TASKS.md
git commit -m "docs(dev-tasks): mark track A complete (dynamic form autofill)"
```

---

## Smoke checklist (post-merge sanity)

After all chunks land:

- [ ] `pnpm test` — all passing.
- [ ] `pnpm check` — clean.
- [ ] `pnpm seed:templates --dry-run` against shared Firebase — 13 entries planned.
- [ ] `pnpm seed:templates` — 13 entries `ready` in console.
- [ ] `pnpm dev`, navigate to `/forms`, expand DTI BN, Preview shows values in fields, Download yields real `%PDF-` opening in Chrome PDF viewer.
- [ ] Upload `template/BIR Form 1903.pdf` as a user template → fields detected → fill → download → PDF opens.
- [ ] Upload non-PDF → graceful toast.
- [ ] Force >10 uploads in 24h → 11th rejected.
- [ ] Sign out, sign in as another user → cannot see prior user's templates in `forms.list`.

## Open follow-ups (not in this plan)

- Per-field `bboxOverride` for catalog templates with poor Gemini bbox.
- Multi-LGU catalog beyond Manila / Bel-Air sample.
- `formSubmissions` audit collection + renewal reminders.
- Storage GC cron for soft-deleted user templates.
- Server-rendered preview thumbnail PNGs.
- NotoSans font embed for non-Latin glyphs (deferred — current `pdf-lib` defaults handle ASCII; revisit when a real ñ-bearing form fails).
