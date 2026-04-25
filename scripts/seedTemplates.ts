/**
 * Idempotent seed runner for system form templates.
 *
 *   pnpm seed:templates --dry-run   prints planned writes, no side effects
 *   pnpm seed:templates             skips entries already at status="ready"
 *   pnpm seed:templates --force     reprocesses everything
 */
import { readFileSync } from "fs";
import { join } from "path";
import { TEMPLATE_MANIFEST, type ManifestEntry } from "./templateManifest";
import { processTemplate } from "../server/forms/processTemplate";
import {
  getTemplate,
  writeTemplate,
} from "../server/forms/templateRepo";
import {
  uploadPdf,
  rawPath,
  processedPath,
} from "../server/forms/storage";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");

async function seedOne(entry: ManifestEntry) {
  const tag = `[${entry.templateId}]`;
  const filePath = join(process.cwd(), "template", entry.filename);
  let rawBytes: Buffer;
  try {
    rawBytes = readFileSync(filePath);
  } catch {
    console.error(`${tag} MISSING file at ${filePath}`);
    return;
  }

  if (!DRY_RUN) {
    const existing = await getTemplate(entry.templateId).catch(() => null);
    if (existing?.status === "ready" && !FORCE) {
      console.log(`${tag} already ready, skipping (use --force to reprocess)`);
      return;
    }
  }

  if (DRY_RUN) {
    console.log(
      `${tag} would process ${rawBytes.length} bytes -> ${entry.label}`,
    );
    return;
  }

  console.log(`${tag} processing...`);
  try {
    const { processedBytes, fieldsSchema, sourceHash } = await processTemplate({
      rawBytes,
      templateId: entry.templateId,
      manifestHints: {
        formId: entry.formId,
        scope: "system",
        ownerUid: null,
        label: entry.label,
        labelTl: entry.labelTl,
        agency: entry.agency,
        roadmapStep: entry.roadmapStep,
        description: entry.description,
        flattenOnDownload: entry.flattenOnDownload,
      },
    });

    await uploadPdf(rawPath(entry.templateId), rawBytes);
    await uploadPdf(processedPath(entry.templateId), processedBytes);

    await writeTemplate({
      templateId: entry.templateId,
      scope: "system",
      ownerUid: null,
      formId: entry.formId,
      label: entry.label,
      labelTl: entry.labelTl,
      agency: entry.agency,
      roadmapStep: entry.roadmapStep,
      description: entry.description,
      rawStoragePath: rawPath(entry.templateId),
      processedStoragePath: processedPath(entry.templateId),
      sourceHash,
      fieldsSchema,
      flattenOnDownload: entry.flattenOnDownload,
      status: "ready",
      errorMessage: null,
      createdBy: "system",
    });

    console.log(`${tag} ready (${fieldsSchema.length} fields)`);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`${tag} FAILED: ${msg}`);
    await writeTemplate({
      templateId: entry.templateId,
      scope: "system",
      ownerUid: null,
      formId: entry.formId,
      label: entry.label,
      labelTl: entry.labelTl,
      agency: entry.agency,
      roadmapStep: entry.roadmapStep,
      description: entry.description,
      rawStoragePath: rawPath(entry.templateId),
      processedStoragePath: processedPath(entry.templateId),
      sourceHash: "",
      fieldsSchema: [],
      flattenOnDownload: entry.flattenOnDownload,
      status: "failed",
      errorMessage: msg,
      createdBy: "system",
    }).catch(() => {});
  }
}

async function main() {
  console.log(
    `Seed mode: ${DRY_RUN ? "DRY RUN" : FORCE ? "FORCE" : "INCREMENTAL"}`,
  );
  for (const entry of TEMPLATE_MANIFEST) {
    await seedOne(entry);
    await new Promise((r) => setTimeout(r, 4000));
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
