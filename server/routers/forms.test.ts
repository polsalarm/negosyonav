import { describe, it, expect, vi, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("../forms/templateRepo");
vi.mock("../forms/storage");
vi.mock("../forms/processTemplate");
vi.mock("../db", async () => {
  const actual = await vi.importActual<typeof import("../db")>("../db");
  return { ...actual, getProfile: vi.fn() };
});

import * as repo from "../forms/templateRepo";
import * as storage from "../forms/storage";
import * as proc from "../forms/processTemplate";
import * as db from "../db";
import { formsRouter } from "./forms";
import type { FormTemplate } from "../forms/types";

const ctxFactory = (uid: string) =>
  ({
    user: { uid, email: `${uid}@x.ph`, name: uid, role: "user" as const },
  }) as any;

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
    {
      name: "first_name",
      label: "First Name",
      page: 1,
      bbox: [0, 0, 10, 10],
      type: "text",
      required: true,
      profileKey: "firstName",
      placeholder: null,
      maxLength: null,
    },
    {
      name: "tin",
      label: "TIN",
      page: 1,
      bbox: [0, 20, 10, 30],
      type: "text",
      required: false,
      profileKey: "tin",
      placeholder: null,
      maxLength: null,
    },
  ],
  flattenOnDownload: true,
  status: "ready",
  errorMessage: null,
  createdAt: new Date(),
  processedAt: new Date(),
  createdBy: "system",
  deletedAt: null,
};

async function realPdfWithFirstName(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const f = doc.getForm().createTextField("first_name");
  f.addToPage(page, { x: 50, y: 300, width: 200, height: 20 });
  return Buffer.from(await doc.save());
}

describe("forms router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list returns user template shadowing system on same formId", async () => {
    vi.mocked(repo.listSystemTemplates).mockResolvedValueOnce([sysTpl]);
    const userTpl = {
      ...sysTpl,
      templateId: "u1_abc",
      scope: "user" as const,
      ownerUid: "u1",
    };
    vi.mocked(repo.listUserTemplates).mockResolvedValueOnce([userTpl]);

    const caller = formsRouter.createCaller(ctxFactory("u1"));
    const list = await caller.list({});
    expect(list).toHaveLength(1);
    expect(list[0].templateId).toBe("u1_abc");
  });

  it("schema rejects cross-user", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce({
      ...sysTpl,
      scope: "user",
      ownerUid: "u2",
      templateId: "u2_x",
    });
    const caller = formsRouter.createCaller(ctxFactory("u1"));
    await expect(
      caller.schema({ templateId: "u2_x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("schema fills required field from profile", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce(sysTpl);
    vi.mocked(db.getProfile).mockResolvedValueOnce({
      userId: "u1",
      firstName: "Juan",
    } as any);

    const caller = formsRouter.createCaller(ctxFactory("u1"));
    const res = await caller.schema({ templateId: sysTpl.templateId });
    expect(res.filled).toEqual({ first_name: "Juan" });
    expect(res.missingRequired).toEqual([]);
  });

  it("schema reports missing required when profile lacks value", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce(sysTpl);
    vi.mocked(db.getProfile).mockResolvedValueOnce({ userId: "u1" } as any);

    const caller = formsRouter.createCaller(ctxFactory("u1"));
    const res = await caller.schema({ templateId: sysTpl.templateId });
    expect(res.missingRequired).toEqual(["first_name"]);
  });

  it("generatePdf returns %PDF- bytes on happy path", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce(sysTpl);
    vi.mocked(storage.downloadPdf).mockResolvedValueOnce(
      await realPdfWithFirstName(),
    );

    const caller = formsRouter.createCaller(ctxFactory("u1"));
    const res = await caller.generatePdf({
      templateId: sysTpl.templateId,
      values: { first_name: "Juan" },
    });
    expect(res.contentType).toBe("application/pdf");
    expect(
      Buffer.from(res.pdfContent, "base64").subarray(0, 5).toString(),
    ).toBe("%PDF-");
    expect(res.filename).toMatch(/^dti_bn-\d{8}\.pdf$/);
  });

  it("generatePdf rejects when required field missing", async () => {
    vi.mocked(repo.getTemplate).mockResolvedValueOnce(sysTpl);
    const caller = formsRouter.createCaller(ctxFactory("u1"));
    await expect(
      caller.generatePdf({ templateId: sysTpl.templateId, values: {} }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("uploadTemplate enforces 10/day cap", async () => {
    vi.mocked(repo.countUserUploadsLast24h).mockResolvedValueOnce(10);
    const validPdfDoc = await PDFDocument.create();
    validPdfDoc.addPage([200, 200]);
    const validPdfB64 = Buffer.from(await validPdfDoc.save()).toString("base64");
    const caller = formsRouter.createCaller(ctxFactory("u1"));
    await expect(
      caller.uploadTemplate({ formId: "x", pdfBase64: validPdfB64 }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("uploadTemplate rejects non-PDF base64", async () => {
    vi.mocked(repo.countUserUploadsLast24h).mockResolvedValueOnce(0);
    const caller = formsRouter.createCaller(ctxFactory("u1"));
    await expect(
      caller.uploadTemplate({
        formId: "x",
        pdfBase64: Buffer.from("not a pdf").toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("deleteTemplate forbids non-owner", async () => {
    vi.mocked(repo.softDeleteUserTemplate).mockRejectedValueOnce(
      new Error("forbidden"),
    );
    const caller = formsRouter.createCaller(ctxFactory("u1"));
    await expect(
      caller.deleteTemplate({ templateId: "u2_x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
