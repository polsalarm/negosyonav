import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test Negosyante",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("grants.check", () => {
  it("returns BMBE as eligible for micro-enterprises under 3M", async () => {
    const ctx = createPublicContext();
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
    const ctx = createPublicContext();
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
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const grants = await caller.grants.check({});

    const dole = grants.find(g => g.id === "dole_dilp");
    expect(dole).toBeDefined();
    expect(dole!.eligible).toBe(true);
  });

  it("returns SB Corp as not eligible when no capitalization", async () => {
    const ctx = createPublicContext();
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
  it("generates a base64 encoded PDF for DTI form", async () => {
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

    // Decode and verify content
    const decoded = Buffer.from(result.pdfContent, "base64").toString("utf-8");
    expect(decoded).toContain("DTI Business Name Registration Form");
    expect(decoded).toContain("Juan Dela Cruz");
    expect(decoded).toContain("Juan's Sari-Sari Store");
  });

  it("generates PDF for BIR 1901 form", async () => {
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
    const decoded = Buffer.from(result.pdfContent, "base64").toString("utf-8");
    expect(decoded).toContain("BIR Form 1901");
  });
});

describe("feedback.submit", () => {
  it("accepts feedback submission from public users", async () => {
    const ctx = createPublicContext();
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
    const ctx = createPublicContext();
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
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const posts = await caller.community.list({});

    expect(posts).toBeInstanceOf(Array);
  });

  it("filters by LGU tag", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const posts = await caller.community.list({ lguTag: "manila_city" });

    expect(posts).toBeInstanceOf(Array);
  });
});
