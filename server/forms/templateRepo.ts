/**
 * Firestore CRUD for `formTemplates`. Sole owner of this collection.
 * Routers and pipeline import from here; do not call adminDb directly.
 */
import { adminDb } from "../_core/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { FormTemplate, FormTemplateDoc } from "./types";

const COLL = "formTemplates";

function db() {
  if (!adminDb) throw new Error("Firestore not initialized");
  return adminDb;
}

function fromDoc(d: FormTemplateDoc): FormTemplate {
  return {
    ...d,
    createdAt: d.createdAt.toDate(),
    processedAt: d.processedAt ? d.processedAt.toDate() : null,
    deletedAt: d.deletedAt ? d.deletedAt.toDate() : null,
  };
}

export async function getTemplate(
  templateId: string,
): Promise<FormTemplate | null> {
  const snap = await db().collection(COLL).doc(templateId).get();
  if (!snap.exists) return null;
  return fromDoc(snap.data() as FormTemplateDoc);
}

export async function findReadyByHash(
  sourceHash: string,
): Promise<FormTemplate | null> {
  const snap = await db()
    .collection(COLL)
    .where("sourceHash", "==", sourceHash)
    .where("status", "==", "ready")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return fromDoc(snap.docs[0].data() as FormTemplateDoc);
}

export async function listSystemTemplates(): Promise<FormTemplate[]> {
  const snap = await db()
    .collection(COLL)
    .where("scope", "==", "system")
    .where("status", "==", "ready")
    .where("deletedAt", "==", null)
    .get();
  return snap.docs.map((d) => fromDoc(d.data() as FormTemplateDoc));
}

export async function listUserTemplates(uid: string): Promise<FormTemplate[]> {
  const snap = await db()
    .collection(COLL)
    .where("scope", "==", "user")
    .where("ownerUid", "==", uid)
    .where("status", "==", "ready")
    .where("deletedAt", "==", null)
    .get();
  return snap.docs.map((d) => fromDoc(d.data() as FormTemplateDoc));
}

export async function countUserUploadsLast24h(uid: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const snap = await db()
    .collection(COLL)
    .where("ownerUid", "==", uid)
    .where("createdAt", ">=", Timestamp.fromDate(since))
    .count()
    .get();
  return snap.data().count;
}

type WriteInput = Omit<FormTemplate, "createdAt" | "processedAt" | "deletedAt"> & {
  createdAt?: Date;
};

export async function writeTemplate(input: WriteInput): Promise<void> {
  await db()
    .collection(COLL)
    .doc(input.templateId)
    .set(
      {
        ...input,
        createdAt: input.createdAt
          ? Timestamp.fromDate(input.createdAt)
          : FieldValue.serverTimestamp(),
        processedAt:
          input.status === "ready" ? FieldValue.serverTimestamp() : null,
        deletedAt: null,
      },
      { merge: true },
    );
}

export async function markFailed(
  templateId: string,
  errorMessage: string,
): Promise<void> {
  await db().collection(COLL).doc(templateId).update({
    status: "failed",
    errorMessage,
  });
}

export async function softDeleteUserTemplate(
  templateId: string,
  uid: string,
): Promise<void> {
  const ref = db().collection(COLL).doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("not found");
  const data = snap.data() as FormTemplateDoc;
  if (data.scope !== "user" || data.ownerUid !== uid) {
    throw new Error("forbidden");
  }
  await ref.update({ deletedAt: FieldValue.serverTimestamp() });
}
