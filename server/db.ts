import { adminDb } from "./_core/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FirestoreUser = {
  uid: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  lastSignedIn: Date;
};

export type FirestoreProfile = {
  userId: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  dateOfBirth?: string;
  gender?: "male" | "female";
  civilStatus?: "single" | "married" | "widowed" | "legally_separated";
  citizenship?: string;
  placeOfBirth?: string;
  mothersName?: string;
  fathersName?: string;
  tin?: string;
  philsysId?: string;
  mobileNumber?: string;
  phoneNumber?: string;
  emailAddress?: string;
  homeBuilding?: string;
  homeStreet?: string;
  homeBarangay?: string;
  homeCity?: string;
  homeProvince?: string;
  homeRegion?: string;
  homeZipCode?: string;
  businessName?: string;
  businessNameOption2?: string;
  businessNameOption3?: string;
  businessType?: string;
  businessActivity?: string;
  territorialScope?: "barangay" | "city" | "regional" | "national";
  bizBuilding?: string;
  bizStreet?: string;
  bizBarangay?: string;
  bizCity?: string;
  bizProvince?: string;
  bizRegion?: string;
  bizZipCode?: string;
  capitalization?: number;
  expectedAnnualSales?: "micro" | "small" | "medium" | "large";
  numberOfEmployees?: number;
  preferTaxOption?: "graduated" | "eight_percent";
};

export type FirestorePost = {
  id: string;
  userId: string;
  authorName: string;
  lguTag: string;
  category: "tip" | "warning" | "question" | "experience";
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  isFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FirestoreFeedback = {
  userId?: string;
  feedbackType: "outdated_info" | "incorrect_data" | "suggestion" | "bug_report" | "general";
  stepNumber?: number;
  lguId: string;
  message: string;
  status: "pending" | "reviewed" | "resolved";
  createdAt: Date;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function db() {
  if (!adminDb) throw new Error("Firestore not initialized");
  return adminDb;
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  // Firestore Timestamp
  if (v && typeof v === "object" && "toDate" in v) return (v as { toDate: () => Date }).toDate();
  return new Date();
}

// ─── Users ─────────────────────────────────────────────────────────────────────

export async function upsertUser(data: {
  uid: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
}): Promise<void> {
  const ref = db().collection("users").doc(data.uid);
  const existing = await ref.get();

  if (existing.exists) {
    await ref.update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      lastSignedIn: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set({
      uid: data.uid,
      name: data.name ?? null,
      email: data.email ?? null,
      loginMethod: data.loginMethod ?? "email",
      role: "user",
      createdAt: FieldValue.serverTimestamp(),
      lastSignedIn: FieldValue.serverTimestamp(),
    });
  }
}

export async function getUserByUid(uid: string): Promise<FirestoreUser | null> {
  const doc = await db().collection("users").doc(uid).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    uid,
    name: d.name ?? null,
    email: d.email ?? null,
    loginMethod: d.loginMethod ?? null,
    role: d.role ?? "user",
    createdAt: toDate(d.createdAt),
    lastSignedIn: toDate(d.lastSignedIn),
  };
}

// ─── Negosyante Profiles ───────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<FirestoreProfile | null> {
  const doc = await db().collection("profiles").doc(userId).get();
  if (!doc.exists) return null;
  return { ...(doc.data() as FirestoreProfile), userId };
}

export async function upsertProfile(userId: string, data: Partial<FirestoreProfile>): Promise<{ action: "created" | "updated" }> {
  const ref = db().collection("profiles").doc(userId);
  const existing = await ref.get();

  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  if (existing.exists) {
    await ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
    return { action: "updated" };
  } else {
    await ref.set({ ...clean, userId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return { action: "created" };
  }
}

// ─── Community Posts ───────────────────────────────────────────────────────────

export async function getCommunityPosts(lguTag?: string, limit = 50): Promise<FirestorePost[]> {
  const col = db().collection("community_posts");
  const query = lguTag
    ? col.where("lguTag", "==", lguTag).orderBy("createdAt", "desc").limit(limit)
    : col.orderBy("createdAt", "desc").limit(limit);

  const snapshot = await query.get();
  return snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      userId: d.userId,
      authorName: d.authorName,
      lguTag: d.lguTag,
      category: d.category,
      title: d.title,
      content: d.content,
      upvotes: d.upvotes ?? 0,
      downvotes: d.downvotes ?? 0,
      isFlagged: d.isFlagged ?? false,
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
    };
  });
}

export async function createCommunityPost(post: {
  userId: string;
  authorName: string;
  title: string;
  content: string;
  category: "tip" | "warning" | "question" | "experience";
  lguTag: string;
}): Promise<void> {
  await db().collection("community_posts").add({
    ...post,
    upvotes: 0,
    downvotes: 0,
    isFlagged: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function voteOnPost(
  postId: string,
  userId: string,
  voteType: "up" | "down"
): Promise<{ action: "voted" | "removed" | "switched" }> {
  const voteDocId = `${userId}_${postId}`;
  const voteRef = db().collection("post_votes").doc(voteDocId);
  const postRef = db().collection("community_posts").doc(postId);

  const existingVote = await voteRef.get();

  if (existingVote.exists) {
    const prev = existingVote.data()!.voteType as "up" | "down";

    if (prev === voteType) {
      // Same vote → remove
      await voteRef.delete();
      await postRef.update({
        [voteType === "up" ? "upvotes" : "downvotes"]: FieldValue.increment(-1),
      });
      return { action: "removed" };
    } else {
      // Different vote → switch
      await voteRef.update({ voteType });
      await postRef.update({
        [voteType === "up" ? "upvotes" : "downvotes"]: FieldValue.increment(1),
        [voteType === "up" ? "downvotes" : "upvotes"]: FieldValue.increment(-1),
      });
      return { action: "switched" };
    }
  }

  await voteRef.set({ postId, userId, voteType, createdAt: FieldValue.serverTimestamp() });
  await postRef.update({
    [voteType === "up" ? "upvotes" : "downvotes"]: FieldValue.increment(1),
  });
  return { action: "voted" };
}

export async function getUserVotes(userId: string): Promise<Array<{ postId: string; voteType: "up" | "down" }>> {
  const snapshot = await db().collection("post_votes")
    .where("userId", "==", userId)
    .get();
  return snapshot.docs.map(doc => ({
    postId: doc.data().postId,
    voteType: doc.data().voteType,
  }));
}

// ─── Feedback ──────────────────────────────────────────────────────────────────

export async function createFeedback(fb: {
  userId?: string;
  feedbackType: "outdated_info" | "incorrect_data" | "suggestion" | "bug_report" | "general";
  stepNumber?: number;
  lguId: string;
  message: string;
}): Promise<void> {
  await db().collection("feedback").add({
    ...fb,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });
}
