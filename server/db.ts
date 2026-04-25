import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, communityPosts, InsertCommunityPost, postVotes, feedback, InsertFeedback } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Community Posts =====

export async function getCommunityPosts(lguTag?: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  if (lguTag) {
    return db.select().from(communityPosts)
      .where(eq(communityPosts.lguTag, lguTag))
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit);
  }
  return db.select().from(communityPosts)
    .orderBy(desc(communityPosts.createdAt))
    .limit(limit);
}

export async function createCommunityPost(post: InsertCommunityPost) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(communityPosts).values(post);
}

export async function voteOnPost(postId: number, userId: number, voteType: "up" | "down") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(postVotes)
    .where(and(eq(postVotes.postId, postId), eq(postVotes.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    const existingVote = existing[0];
    if (existingVote.voteType === voteType) {
      await db.delete(postVotes).where(eq(postVotes.id, existingVote.id));
      if (voteType === "up") {
        await db.update(communityPosts).set({ upvotes: sql`${communityPosts.upvotes} - 1` }).where(eq(communityPosts.id, postId));
      } else {
        await db.update(communityPosts).set({ downvotes: sql`${communityPosts.downvotes} - 1` }).where(eq(communityPosts.id, postId));
      }
      return { action: "removed" as const };
    } else {
      await db.update(postVotes).set({ voteType }).where(eq(postVotes.id, existingVote.id));
      if (voteType === "up") {
        await db.update(communityPosts).set({
          upvotes: sql`${communityPosts.upvotes} + 1`,
          downvotes: sql`${communityPosts.downvotes} - 1`,
        }).where(eq(communityPosts.id, postId));
      } else {
        await db.update(communityPosts).set({
          upvotes: sql`${communityPosts.upvotes} - 1`,
          downvotes: sql`${communityPosts.downvotes} + 1`,
        }).where(eq(communityPosts.id, postId));
      }
      return { action: "switched" as const };
    }
  }

  await db.insert(postVotes).values({ postId, userId, voteType });
  if (voteType === "up") {
    await db.update(communityPosts).set({ upvotes: sql`${communityPosts.upvotes} + 1` }).where(eq(communityPosts.id, postId));
  } else {
    await db.update(communityPosts).set({ downvotes: sql`${communityPosts.downvotes} + 1` }).where(eq(communityPosts.id, postId));
  }
  return { action: "voted" as const };
}

export async function getUserVotes(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(postVotes).where(eq(postVotes.userId, userId));
}

// ===== Feedback =====

export async function createFeedback(fb: InsertFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(feedback).values(fb);
}

export async function getFeedback() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(feedback).orderBy(desc(feedback.createdAt));
}
