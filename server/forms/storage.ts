import { adminBucket } from "../_core/firebaseAdmin";

function bucket() {
  if (!adminBucket) throw new Error("Firebase Storage not initialized");
  return adminBucket;
}

export function rawPath(templateId: string): string {
  return `formTemplates/raw/${templateId}.pdf`;
}

export function processedPath(templateId: string): string {
  return `formTemplates/processed/${templateId}.pdf`;
}

export async function uploadPdf(path: string, bytes: Buffer): Promise<void> {
  await bucket().file(path).save(bytes, {
    contentType: "application/pdf",
    resumable: false,
  });
}

export async function downloadPdf(path: string): Promise<Buffer> {
  const [buf] = await bucket().file(path).download();
  return buf;
}

export async function deletePdf(path: string): Promise<void> {
  await bucket().file(path).delete({ ignoreNotFound: true });
}
