import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "Kumusta! Sige, tulungan kita sa pag-register ng sari-sari store sa Tondo, Manila.",
        },
      },
    ],
  }),
}));

// Mock the db module
vi.mock("./db", () => ({
  getCommunityPosts: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      authorName: "Test User",
      lguTag: "manila_city",
      category: "tip",
      title: "Test Post",
      content: "Test content",
      upvotes: 5,
      downvotes: 0,
      isFlagged: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  createCommunityPost: vi.fn().mockResolvedValue({}),
  voteOnPost: vi.fn().mockResolvedValue({ action: "voted" }),
  getUserVotes: vi.fn().mockResolvedValue([]),
  createFeedback: vi.fn().mockResolvedValue({}),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("AI Chat Router", () => {
  it("returns a Taglish response from the LLM", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.chat({
      messages: [{ role: "user", content: "Gusto ko mag-open ng sari-sari store sa Tondo, Manila" }],
    });

    expect(result).toHaveProperty("content");
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  });
});

describe("Community Hub Router", () => {
  it("lists community posts for manila_city", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const posts = await caller.community.list({ lguTag: "manila_city" });

    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0]).toHaveProperty("title");
    expect(posts[0]).toHaveProperty("category");
  });

  it("creates a community post when authenticated", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.community.create({
      title: "Mabilis ang permit sa E-BOSS Lounge!",
      content: "Natapos ako in 2 hours lang. Bring complete documents.",
      category: "tip",
      lguTag: "manila_city",
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects post creation when not authenticated", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.community.create({
        title: "Test post",
        content: "Test content for the post",
        category: "tip",
        lguTag: "manila_city",
      })
    ).rejects.toThrow();
  });

  it("allows voting on posts when authenticated", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.community.vote({ postId: 1, voteType: "up" });

    expect(result).toHaveProperty("action");
  });
});

describe("Feedback Router", () => {
  it("submits feedback without authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.feedback.submit({
      feedbackType: "outdated_info",
      stepNumber: 4,
      lguId: "manila_city",
      message: "The Mayor's Permit fee has changed to ₱3,000 minimum.",
    });

    expect(result).toEqual({ success: true });
  });

  it("validates feedback message minimum length", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.feedback.submit({
        feedbackType: "general",
        lguId: "manila_city",
        message: "hi",
      })
    ).rejects.toThrow();
  });
});
