import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module to avoid hitting Firestore in tests
vi.mock("./db", () => ({
  getCommunityPosts: vi.fn().mockResolvedValue([]),
  createCommunityPost: vi.fn().mockResolvedValue({}),
  voteOnPost: vi.fn().mockResolvedValue({ action: "voted" }),
  getUserVotes: vi.fn().mockResolvedValue([]),
  createFeedback: vi.fn().mockResolvedValue({}),
  getProfile: vi.fn().mockResolvedValue(null),
  upsertProfile: vi.fn().mockResolvedValue({}),
  upsertUser: vi.fn(),
}));

function createAuthContext(): TrpcContext {
  return {
    user: { uid: "test-user-001", email: "test@example.com", name: "Test Negosyante", role: "user" },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("grants.check", () => {
  it("returns BMBE as eligible for micro-enterprises under 3M", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const grants = await caller.grants.check({
      capitalization: 500000,
      businessType: "sole_proprietorship",
      numberOfEmployees: 2,
    });

    expect(grants).toBeInstanceOf(Array);
    expect(grants.length).toBeGreaterThanOrEqual(3);

    const bmbe = grants.find(g => g.id === "bmbe");
    expect(bmbe).toBeDefined();
    expect(bmbe!.eligible).toBe(true);
    expect(bmbe!.name).toContain("BMBE");
  });

  it("returns BMBE as not eligible for businesses over 3M", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const grants = await caller.grants.check({
      capitalization: 5000000,
      businessType: "corporation",
      numberOfEmployees: 50,
    });

    const bmbe = grants.find(g => g.id === "bmbe");
    expect(bmbe).toBeDefined();
    expect(bmbe!.eligible).toBe(false);
  });

  it("returns DOLE DILP as always eligible", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const grants = await caller.grants.check({});

    const dole = grants.find(g => g.id === "dole_dilp");
    expect(dole).toBeDefined();
    expect(dole!.eligible).toBe(true);
  });

  it("returns SB Corp as not eligible when no capitalization", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const grants = await caller.grants.check({
      capitalization: 0,
    });

    const sbcorp = grants.find(g => g.id === "sbcorp");
    expect(sbcorp).toBeDefined();
    expect(sbcorp!.eligible).toBe(false);
  });
});

describe("forms.generatePdf", () => {
  it("generates a real PDF (text fallback) for DTI form", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.forms.generatePdf({
      formId: "dti_form",
      fields: {
        dti_name: "Juan Dela Cruz",
        dti_bn1: "Juan's Sari-Sari Store",
        dti_activity: "Retail Trade",
        dti_scope: "city",
      },
    });

    expect(result.pdfContent).toBeDefined();
    expect(result.formId).toBe("dti_form");
    expect(result.contentType).toBe("application/pdf");

    const bytes = Buffer.from(result.pdfContent, "base64");
    expect(bytes.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });

  it("generates a real PDF for BIR 1901 form", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.forms.generatePdf({
      formId: "bir_1901",
      fields: {
        bir_first: "Juan",
        bir_last: "Dela Cruz",
        bir_trade: "Juan's Store",
      },
    });

    expect(result.pdfContent).toBeDefined();
    expect(result.formId).toBe("bir_1901");
    const bytes = Buffer.from(result.pdfContent, "base64");
    expect(bytes.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });

  it("fills the Barangay Clearance AcroForm template", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.forms.generatePdf({
      formId: "barangay_clearance",
      fields: {
        business_name: "Aling Nena's Sari-Sari",
        contact_person: "Juan Dela Cruz",
        street: "Rizal Ave",
        locale: "Barangay 123",
        app_new: true,
        own_sole: true,
        nob_retailer: true,
      },
    });

    expect(result.formId).toBe("barangay_clearance");
    const bytes = Buffer.from(result.pdfContent, "base64");
    expect(bytes.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    // Template is ~700KB — anything well above the text-fallback ~2KB confirms
    // we're returning the filled template, not a generated page.
    expect(bytes.byteLength).toBeGreaterThan(50_000);
  });

  it("rejects barangay submission missing required fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.forms.generatePdf({
        formId: "barangay_clearance",
        fields: { business_name: "Test" }, // no contact_person, no app_*, no own_*, no street/locale
      }),
    ).rejects.toThrow(/Missing required fields/);
  });
});

describe("feedback.submit", () => {
  it("accepts feedback submission from public users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.feedback.submit({
      feedbackType: "outdated_info",
      stepNumber: 1,
      lguId: "manila_city",
      message: "The DTI fee has been updated to ₱600 as of 2026.",
    });

    expect(result.success).toBe(true);
  });

  it("accepts general feedback without step number", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.feedback.submit({
      feedbackType: "suggestion",
      message: "Please add Quezon City support next!",
    });

    expect(result.success).toBe(true);
  });
});

describe("community.list", () => {
  it("returns an array of community posts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const posts = await caller.community.list({});

    expect(posts).toBeInstanceOf(Array);
  });

  it("filters by LGU tag", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const posts = await caller.community.list({ lguTag: "manila_city" });

    expect(posts).toBeInstanceOf(Array);
  });
});
