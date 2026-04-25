import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { adminAuth, adminDb } from "./firebaseAdmin";

export type FirebaseContextUser = {
  uid: string;
  email: string | null;
  name: string | null;
  role: "user" | "admin";
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: FirebaseContextUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: FirebaseContextUser | null = null;

  try {
    const authHeader = opts.req.headers.authorization;
    const headerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split("Bearer ")[1]
      : undefined;
    const connectionToken = (opts.info?.connectionParams as { token?: string } | null | undefined)
      ?.token;
    const token = headerToken ?? connectionToken;

    if (token && adminAuth && adminDb) {
      const decoded = await adminAuth.verifyIdToken(token);

      // Fetch Firestore user doc to get role
      const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
      const userData = userDoc.data();

      user = {
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: decoded.name ?? userData?.name ?? null,
        role: userData?.role ?? "user",
      };
    }
  } catch {
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
