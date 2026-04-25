import { describe, it, expect, vi, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { FormTemplate } from "./types";

vi.mock("../_core/llm", () => ({
  invokeLLMWithPdf: vi.fn(),
  invokeLLM: vi.fn(),
}));

vi.mock("./templateRepo", () => ({
  findReadyByHash: vi.fn().mockResolvedValue(null),
}));

vi.mock("./storage", () => ({
  downloadPdf: vi.fn(),
}));

import { processTemplate } from "./processTemplate";
import { invokeLLMWithPdf } from "../_core/llm";
import * as repo from "./templateRepo";
import * as storage from "./storage";

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

async function makeFlatPdf(pageCount = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([400, 400]);
  return Buffer.from(await doc.save());
}

describe("processTemplate (AcroForm-already path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findReadyByHash).mockResolvedValue(null);
  });

  it("extracts existing fields without calling Gemini", async () => {
    const rawBytes = await makeAcroFormPdf();
    const result = await processTemplate({ rawBytes, templateId: "t1" });

    expect(invokeLLMWithPdf).not.toHaveBeenCalled();
    expect(result.fieldsSchema.length).toBe(2);
    expect(result.fieldsSchema.map((f) => f.name).sort()).toEqual([
      "first_name",
      "last_name",
    ]);
    expect(result.fieldsSchema.every((f) => f.type === "text")).toBe(true);
    expect(result.processedBytes).toBeInstanceOf(Buffer);
    expect(result.processedBytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("processTemplate (Gemini path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findReadyByHash).mockResolvedValue(null);
  });

  it("calls Gemini once and overlays detected fields", async () => {
    vi.mocked(invokeLLMWithPdf).mockResolvedValueOnce({
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

    const processed = await PDFDocument.load(result.processedBytes);
    const names = processed.getForm().getFields().map((f) => f.getName());
    expect(names).toContain(result.fieldsSchema[0].name);
    expect(names).toContain(result.fieldsSchema[1].name);
  });
});

describe("processTemplate (failures)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findReadyByHash).mockResolvedValue(null);
  });

  it("rejects PDFs over 20MB", async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1);
    await expect(
      processTemplate({ rawBytes: big, templateId: "t" }),
    ).rejects.toThrow(/too large/);
  });

  it("rejects when more than 4 pages", async () => {
    const bytes = await makeFlatPdf(5);
    await expect(
      processTemplate({ rawBytes: bytes, templateId: "t" }),
    ).rejects.toThrow(/5 pages/);
  });

  it("retries once on schema-invalid Gemini output, then fails", async () => {
    vi.mocked(invokeLLMWithPdf)
      .mockResolvedValueOnce({ wrong: "shape" })
      .mockResolvedValueOnce({ wrong: "shape again" });

    const flat = await makeFlatPdf();
    await expect(
      processTemplate({ rawBytes: flat, templateId: "t" }),
    ).rejects.toThrow();
    expect(invokeLLMWithPdf).toHaveBeenCalledTimes(2);
  });

  it("clamps bbox out of page bounds and drops invalid fields", async () => {
    vi.mocked(invokeLLMWithPdf).mockResolvedValueOnce({
      fields: [
        {
          label: "OK Field",
          page: 1,
          bbox: [10, 10, 100, 30],
          type: "text",
          required: false,
          profileKey: null,
          maxLength: null,
        },
        {
          label: "Tiny",
          page: 1,
          bbox: [50, 50, 51, 51],
          type: "text",
          required: false,
          profileKey: null,
          maxLength: null,
        },
        {
          label: "Off Page",
          page: 1,
          bbox: [10000, 10000, 10100, 10030],
          type: "text",
          required: false,
          profileKey: null,
          maxLength: null,
        },
      ],
    });

    const flat = await makeFlatPdf();
    const result = await processTemplate({ rawBytes: flat, templateId: "t" });
    expect(result.fieldsSchema).toHaveLength(1);
    expect(result.fieldsSchema[0].label).toBe("OK Field");
  });
});

describe("processTemplate cache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns cached processed bytes when sourceHash matches a ready doc", async () => {
    const cachedBytes = Buffer.from("%PDF-1.4 cached");
    vi.mocked(repo.findReadyByHash).mockResolvedValueOnce({
      templateId: "cached_t",
      status: "ready",
      processedStoragePath: "formTemplates/processed/cached_t.pdf",
      fieldsSchema: [
        {
          name: "x",
          label: "X",
          page: 1,
          bbox: [0, 0, 10, 10],
          type: "text",
          required: false,
          profileKey: null,
          placeholder: null,
          maxLength: null,
        },
      ],
    } as unknown as FormTemplate);

    vi.mocked(storage.downloadPdf).mockResolvedValueOnce(cachedBytes);

    const rawBytes = await makeAcroFormPdf();
    const result = await processTemplate({ rawBytes, templateId: "new_t" });

    expect(invokeLLMWithPdf).not.toHaveBeenCalled();
    expect(result.processedBytes).toEqual(cachedBytes);
    expect(result.fieldsSchema[0].name).toBe("x");
    expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
