import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Negosyante Profile — stores all personal + business info needed for form auto-fill.
 * Collected via onboarding form or extracted from chat by LLM.
 */
export const negosyanteProfiles = mysqlTable("negosyante_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Personal Info
  firstName: varchar("firstName", { length: 255 }),
  middleName: varchar("middleName", { length: 255 }),
  lastName: varchar("lastName", { length: 255 }),
  suffix: varchar("suffix", { length: 50 }),
  dateOfBirth: varchar("dateOfBirth", { length: 20 }),
  gender: mysqlEnum("gender", ["male", "female"]),
  civilStatus: mysqlEnum("civilStatus", ["single", "married", "widowed", "legally_separated"]),
  citizenship: varchar("citizenship", { length: 100 }).default("Filipino"),
  placeOfBirth: varchar("placeOfBirth", { length: 255 }),
  mothersName: varchar("mothersName", { length: 255 }),
  fathersName: varchar("fathersName", { length: 255 }),
  tin: varchar("tin", { length: 50 }),
  philsysId: varchar("philsysId", { length: 50 }),
  // Contact
  mobileNumber: varchar("mobileNumber", { length: 20 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  emailAddress: varchar("emailAddress", { length: 320 }),
  // Home Address
  homeBuilding: varchar("homeBuilding", { length: 255 }),
  homeStreet: varchar("homeStreet", { length: 255 }),
  homeBarangay: varchar("homeBarangay", { length: 255 }),
  homeCity: varchar("homeCity", { length: 255 }),
  homeProvince: varchar("homeProvince", { length: 255 }),
  homeRegion: varchar("homeRegion", { length: 255 }),
  homeZipCode: varchar("homeZipCode", { length: 10 }),
  // Business Info
  businessName: varchar("businessName", { length: 500 }),
  businessNameOption2: varchar("businessNameOption2", { length: 500 }),
  businessNameOption3: varchar("businessNameOption3", { length: 500 }),
  businessType: varchar("businessType", { length: 255 }),
  businessActivity: text("businessActivity"),
  territorialScope: mysqlEnum("territorialScope", ["barangay", "city", "regional", "national"]).default("city"),
  // Business Address
  bizBuilding: varchar("bizBuilding", { length: 255 }),
  bizStreet: varchar("bizStreet", { length: 255 }),
  bizBarangay: varchar("bizBarangay", { length: 255 }),
  bizCity: varchar("bizCity", { length: 255 }).default("Manila"),
  bizProvince: varchar("bizProvince", { length: 255 }).default("Metro Manila"),
  bizRegion: varchar("bizRegion", { length: 255 }).default("NCR"),
  bizZipCode: varchar("bizZipCode", { length: 10 }),
  // Financial
  capitalization: int("capitalization"),
  expectedAnnualSales: mysqlEnum("expectedAnnualSales", ["micro", "small", "medium", "large"]).default("micro"),
  numberOfEmployees: int("numberOfEmployees").default(0),
  preferTaxOption: mysqlEnum("preferTaxOption", ["graduated", "eight_percent"]).default("eight_percent"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NegosyanteProfile = typeof negosyanteProfiles.$inferSelect;
export type InsertNegosyanteProfile = typeof negosyanteProfiles.$inferInsert;

/**
 * Community posts for the Negosyante Hub.
 */
export const communityPosts = mysqlTable("community_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  lguTag: varchar("lguTag", { length: 100 }).notNull().default("manila_city"),
  category: mysqlEnum("category", ["tip", "warning", "question", "experience"]).notNull().default("tip"),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  upvotes: int("upvotes").notNull().default(0),
  downvotes: int("downvotes").notNull().default(0),
  isFlagged: boolean("isFlagged").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = typeof communityPosts.$inferInsert;

/**
 * Votes tracking for community posts.
 */
export const postVotes = mysqlTable("post_votes", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  voteType: mysqlEnum("voteType", ["up", "down"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PostVote = typeof postVotes.$inferSelect;
export type InsertPostVote = typeof postVotes.$inferInsert;

/**
 * Saved roadmaps generated by the AI for each user.
 */
export const roadmaps = mysqlTable("roadmaps", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  lguId: varchar("lguId", { length: 100 }).notNull().default("manila_city"),
  businessType: varchar("businessType", { length: 255 }),
  district: varchar("district", { length: 255 }),
  totalEstimatedCostMin: int("totalEstimatedCostMin"),
  totalEstimatedCostMax: int("totalEstimatedCostMax"),
  completedSteps: json("completedSteps").$type<number[]>().default([]),
  checkedDocuments: json("checkedDocuments").$type<Record<string, string[]>>().default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Roadmap = typeof roadmaps.$inferSelect;
export type InsertRoadmap = typeof roadmaps.$inferInsert;

/**
 * Feedback and reports.
 */
export const feedback = mysqlTable("feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  feedbackType: mysqlEnum("feedbackType", ["outdated_info", "incorrect_data", "suggestion", "bug_report", "general"]).notNull(),
  stepNumber: int("stepNumber"),
  lguId: varchar("lguId", { length: 100 }).default("manila_city"),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["pending", "reviewed", "resolved"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;
