import { createHash } from "crypto";
import { PDFDocument, PDFPage } from "pdf-lib";
import { z } from "zod";
import { invokeLLMWithPdf } from "../_core/llm";
import { AVAILABLE_PROFILE_KEYS } from "./resolveProfile";
import { findReadyByHash } from "./templateRepo";
import { downloadPdf } from "./storage";
import type { FieldSpec, FieldType, FormTemplate } from "./types";

export type ProcessTemplateInput = {
  rawBytes: Buffer;
  templateId: string;
  manifestHints?: Partial<FormTemplate>;
};

export type ProcessTemplateOutput = {
  processedBytes: Buffer;
  fieldsSchema: FieldSpec[];
  sourceHash: string;
};

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 4;

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
    "Omit signature boxes, photo boxes, and check (BIR) checkboxes that are not user-fillable.",
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
        prompt:
          attempt === 0
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

export async function processTemplate(
  input: ProcessTemplateInput,
): Promise<ProcessTemplateOutput> {
  if (input.rawBytes.byteLength > MAX_BYTES) {
    throw new Error(
      `PDF too large: ${input.rawBytes.byteLength} > ${MAX_BYTES}`,
    );
  }

  const sourceHash = createHash("sha256").update(input.rawBytes).digest("hex");

  const cached = await findReadyByHash(sourceHash).catch(() => null);
  if (cached) {
    const processedBytes = await downloadPdf(cached.processedStoragePath);
    return {
      processedBytes,
      fieldsSchema: cached.fieldsSchema,
      sourceHash,
    };
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
    const fieldsSchema: FieldSpec[] = existingFields.map((f) => {
      const widget = f.acroField.getWidgets()[0];
      const rect = widget?.getRectangle();
      let pageIndex = 0;
      if (widget) {
        const widgetPageRef = widget.P();
        const pages = doc.getPages();
        const idx = pages.findIndex((p) => p.ref === widgetPageRef);
        if (idx >= 0) pageIndex = idx;
      }
      return {
        name: f.getName(),
        label: f.getName().replace(/[_-]/g, " "),
        page: pageIndex + 1,
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
      sourceHash,
    };
  }

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
    sourceHash,
  };
}
