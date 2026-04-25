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

// Mock the db module — multi-thread chat store keyed by `${uid}:${threadId}`
type ThreadDoc = {
  uid: string;
  threadId: string;
  title: string;
  messages: Array<{ role: "user" | "assistant"; content: string; ts: Date }>;
  roadmapReady: boolean;
  extractedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
const chatThreadStore = new Map<string, ThreadDoc>();
let threadIdCounter = 0;

function threadsForUser(uid: string): ThreadDoc[] {
  return Array.from(chatThreadStore.values()).filter(t => t.uid === uid);
}

function deriveTitleMock(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= 60 ? (t || "Bagong chat") : t.slice(0, 59).trimEnd() + "…";
}

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
  getChatThread: vi.fn(async (uid: string, threadId: string) => {
    return chatThreadStore.get(`${uid}:${threadId}`) ?? null;
  }),
  listChatThreads: vi.fn(async (uid: string) => {
    return threadsForUser(uid)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(t => ({
        threadId: t.threadId,
        title: t.title,
        messageCount: t.messages.length,
        roadmapReady: t.roadmapReady,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
      }));
  }),
  getMostRecentThread: vi.fn(async (uid: string) => {
    const all = threadsForUser(uid).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return all[0] ?? null;
  }),
  appendThreadMessages: vi.fn(async (
    uid: string,
    threadId: string | null,
    msgs: Array<{ role: "user" | "assistant"; content: string }>,
    roadmapReady: boolean,
  ) => {
    const now = new Date();
    const stamped = msgs.map(m => ({ ...m, ts: now }));
    const key = threadId ? `${uid}:${threadId}` : null;
    const existing = key ? chatThreadStore.get(key) : null;
    if (existing) {
      const combined = [...existing.messages, ...stamped].slice(-40);
      const updated: ThreadDoc = {
        ...existing,
        messages: combined,
        roadmapReady,
        updatedAt: now,
      };
      chatThreadStore.set(key!, updated);
      return updated;
    }
    threadIdCounter += 1;
    const newId = `t${threadIdCounter}`;
    const firstUser = stamped.find(m => m.role === "user");
    const doc: ThreadDoc = {
      uid,
      threadId: newId,
      title: deriveTitleMock(firstUser?.content ?? "Bagong chat"),
      messages: stamped.slice(-40),
      roadmapReady,
      extractedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    chatThreadStore.set(`${uid}:${newId}`, doc);
    return doc;
  }),
  deleteChatThread: vi.fn(async (uid: string, threadId: string) => {
    chatThreadStore.delete(`${uid}:${threadId}`);
  }),
  setThreadExtractedAt: vi.fn(async (uid: string, threadId: string) => {
    const k = `${uid}:${threadId}`;
    const t = chatThreadStore.get(k);
    if (t) chatThreadStore.set(k, { ...t, extractedAt: new Date() });
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
  it("listThreads returns empty when user has no chats", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.ai.listThreads();
    expect(result).toEqual([]);
  });

  it("ai.chat without threadId creates a new thread and returns its id", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.ai.chat({
      content: "Gusto ko mag-open ng sari-sari store sa Tondo, Manila",
    });

    expect(result.threadId).toMatch(/^t\d+$/);
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.roadmapReady).toBe(true);

    const stored = chatThreadStore.get(`test-user-001:${result.threadId}`);
    expect(stored?.messages.length).toBe(2);
    expect(stored?.messages[0].role).toBe("user");
    expect(stored?.messages[1].role).toBe("assistant");
    expect(stored?.roadmapReady).toBe(true);
  });

  it("ai.chat with threadId appends to that thread", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const first = await caller.ai.chat({ content: "Sari-sari store sa Tondo" });
    const second = await caller.ai.chat({
      content: "salamat!",
      threadId: first.threadId,
    });

    expect(second.threadId).toBe(first.threadId);
    const stored = chatThreadStore.get(`test-user-001:${first.threadId}`);
    expect(stored?.messages.length).toBe(4);
    expect(second.roadmapReady).toBe(true);
  });

  it("ai.chat returns roadmapReady=false when content lacks signals", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.ai.chat({ content: "hello" });

    expect(result.roadmapReady).toBe(false);
  });

  it("ai.chat keeps roadmapReady sticky once true within a thread", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const first = await caller.ai.chat({ content: "Sari-sari store sa Tondo" });
    const followup = await caller.ai.chat({
      content: "salamat!",
      threadId: first.threadId,
    });

    expect(followup.roadmapReady).toBe(true);
  });

  it("ai.chat without threadId always creates a fresh thread (default fresh)", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const a = await caller.ai.chat({ content: "first chat" });
    const b = await caller.ai.chat({ content: "second chat" });

    expect(a.threadId).not.toBe(b.threadId);
    expect(threadsForUser("test-user-001").length).toBe(2);
  });

  it("ai.getThread returns the messages of a specific thread", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const created = await caller.ai.chat({ content: "Sari-sari store sa Tondo" });
    const got = await caller.ai.getThread({ threadId: created.threadId });

    expect(got.threadId).toBe(created.threadId);
    expect(got.messages.length).toBe(2);
    expect(got.roadmapReady).toBe(true);
  });

  it("ai.getThread throws NOT_FOUND for unknown threadId", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.ai.getThread({ threadId: "does-not-exist" })
    ).rejects.toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("ai.listThreads returns most-recent first", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const a = await caller.ai.chat({ content: "first" });
    // small delay so updatedAt differs
    await new Promise(r => setTimeout(r, 5));
    const b = await caller.ai.chat({ content: "second" });

    const list = await caller.ai.listThreads();
    expect(list.length).toBe(2);
    expect(list[0].threadId).toBe(b.threadId);
    expect(list[1].threadId).toBe(a.threadId);
  });

  it("ai.deleteThread removes the thread", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    const created = await caller.ai.chat({ content: "Sari-sari store sa Tondo" });
    expect(chatThreadStore.has(`test-user-001:${created.threadId}`)).toBe(true);

    await caller.ai.deleteThread({ threadId: created.threadId });
    expect(chatThreadStore.has(`test-user-001:${created.threadId}`)).toBe(false);
  });

  it("ai.extractProfile falls back to most-recent thread when input omitted", async () => {
    chatThreadStore.clear();
    const caller = appRouter.createCaller(createAuthContext());

    await caller.ai.chat({ content: "Sari-sari store sa Tondo" });
    const result = await caller.ai.extractProfile();

    // Mocked LLM returns canned Taglish — JSON.parse fails → returns {}.
    expect(result).toEqual({});
    expect(threadsForUser("test-user-001").length).toBe(1);
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
