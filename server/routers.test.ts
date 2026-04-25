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
const chatSessionStore = new Map<string, {
  uid: string;
  messages: Array<{ role: "user" | "assistant"; content: string; ts: Date }>;
  roadmapReady: boolean;
  extractedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>();

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
  getUserByUid: vi.fn().mockResolvedValue(null),
  setOnboardingStep: vi.fn().mockResolvedValue(undefined),
  markOnboardingComplete: vi.fn().mockResolvedValue(undefined),
  getChatSession: vi.fn(async (uid: string) => chatSessionStore.get(uid) ?? null),
  appendChatMessages: vi.fn(async (
    uid: string,
    msgs: Array<{ role: "user" | "assistant"; content: string }>,
    roadmapReady: boolean,
  ) => {
    const now = new Date();
    const prior = chatSessionStore.get(uid)?.messages ?? [];
    const stamped = msgs.map(m => ({ ...m, ts: now }));
    const combined = [...prior, ...stamped].slice(-40);
    const next = {
      uid,
      messages: combined,
      roadmapReady,
      extractedAt: null,
      createdAt: chatSessionStore.get(uid)?.createdAt ?? now,
      updatedAt: now,
    };
    chatSessionStore.set(uid, next);
    return next;
  }),
  clearChatSession: vi.fn(async (uid: string) => {
    chatSessionStore.delete(uid);
  }),
  setChatExtractedAt: vi.fn(async (uid: string) => {
    const s = chatSessionStore.get(uid);
    if (s) chatSessionStore.set(uid, { ...s, extractedAt: new Date() });
  }),
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
  it("getSession returns empty session when no doc exists", async () => {
    chatSessionStore.clear();
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.ai.getSession();
    expect(result).toEqual({ messages: [], roadmapReady: false });
  });

  it("ai.chat persists messages and returns roadmapReady=true for biz+locality", async () => {
    chatSessionStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.ai.chat({
      content: "Gusto ko mag-open ng sari-sari store sa Tondo, Manila",
    });

    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.roadmapReady).toBe(true);

    const stored = chatSessionStore.get("test-user-001");
    expect(stored?.messages.length).toBe(2);
    expect(stored?.messages[0].role).toBe("user");
    expect(stored?.messages[1].role).toBe("assistant");
    expect(stored?.roadmapReady).toBe(true);
  });

  it("ai.chat returns roadmapReady=false when content lacks signals", async () => {
    chatSessionStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.ai.chat({ content: "hello" });

    expect(result.roadmapReady).toBe(false);
  });

  it("ai.chat keeps roadmapReady sticky once true", async () => {
    chatSessionStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    await caller.ai.chat({ content: "Sari-sari store sa Tondo" });
    const followup = await caller.ai.chat({ content: "salamat!" });

    expect(followup.roadmapReady).toBe(true);
  });

  it("ai.extractProfile falls back to Firestore session when input omitted", async () => {
    chatSessionStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    await caller.ai.chat({ content: "Sari-sari store sa Tondo" });
    const result = await caller.ai.extractProfile();

    // Mocked LLM returns the canned Taglish string, which JSON.parse fails on,
    // so the procedure returns {} — but the call should not throw and should
    // have read from the persisted session.
    expect(result).toEqual({});
    const stored = chatSessionStore.get("test-user-001");
    expect(stored?.messages.length).toBeGreaterThan(0);
  });

  it("ai.clearSession wipes the doc", async () => {
    chatSessionStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    await caller.ai.chat({ content: "Sari-sari store sa Tondo" });
    expect(chatSessionStore.has("test-user-001")).toBe(true);

    await caller.ai.clearSession();
    expect(chatSessionStore.has("test-user-001")).toBe(false);
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
      c.ai.chat({ content: "hi" })],
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
