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
