import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { UNAUTHED_ERR_MSG } from "@shared/const";

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
  getProfile: vi.fn().mockResolvedValue(null),
  upsertProfile: vi.fn().mockResolvedValue({}),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  return {
    user: { uid: "test-user-001", email: "test@example.com", name: "Test Negosyante", role: "user" },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("AI Chat Router", () => {
  it("returns a Taglish response from the LLM", async () => {
    const ctx = createAuthContext();
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
    const ctx = createAuthContext();
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

    const result = await caller.community.vote({ postId: "1", voteType: "up" });

    expect(result).toHaveProperty("action");
  });
});

describe("Feedback Router", () => {
  it("submits feedback when authenticated", async () => {
    const ctx = createAuthContext();
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
    const ctx = createAuthContext();
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

describe("Procedure auth gates", () => {
  it.each([
    ["ai.chat", (c: ReturnType<typeof appRouter.createCaller>) =>
      c.ai.chat({ messages: [{ role: "user", content: "hi" }] })],
    ["grants.check", (c: ReturnType<typeof appRouter.createCaller>) =>
      c.grants.check({ capitalization: 1000 })],
    ["community.list", (c: ReturnType<typeof appRouter.createCaller>) =>
      c.community.list()],
    ["feedback.submit", (c: ReturnType<typeof appRouter.createCaller>) =>
      c.feedback.submit({ feedbackType: "general", message: "hello world" })],
  ])("%s rejects unauthenticated callers", async (_name, call) => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(call(caller)).rejects.toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG } as Partial<TRPCError>),
    );
  });

  it("auth.me stays public", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.auth.me()).resolves.toBeNull();
  });
});
