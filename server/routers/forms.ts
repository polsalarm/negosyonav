import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { customAlphabet } from "nanoid";
import { PDFDocument } from "pdf-lib";
import { router, protectedProcedure } from "../_core/trpc";
import { getProfile } from "../db";
import {
  getTemplate,
  listSystemTemplates,
  listUserTemplates,
  writeTemplate,
  markFailed,
  softDeleteUserTemplate,
  countUserUploadsLast24h,
} from "../forms/templateRepo";
import {
  uploadPdf,
  downloadPdf,
  rawPath,
  processedPath,
} from "../forms/storage";
import { processTemplate } from "../forms/processTemplate";
import { resolveProfileValue } from "../forms/resolveProfile";
import type {
  FormTemplate,
  FormSummary,
  FilledSchemaResponse,
} from "../forms/types";

const nanoidLower = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

function toSummary(t: FormTemplate): FormSummary {
  return {
    templateId: t.templateId,
    formId: t.formId,
    label: t.label,
    labelTl: t.labelTl,
    agency: t.agency,
    roadmapStep: t.roadmapStep,
    scope: t.scope,
    fieldCount: t.fieldsSchema.length,
  };
}

async function generatePdfImpl(
  uid: string,
  templateId: string,
  values: Record<string, string>,
) {
  const tpl = await getTemplate(templateId);
  if (!tpl || tpl.deletedAt || tpl.status !== "ready") {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (tpl.scope === "user" && tpl.ownerUid !== uid) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  const missing = tpl.fieldsSchema
    .filter((f) => f.required && !values[f.name])
    .map((f) => f.name);
  if (missing.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `missing required: ${missing.join(",")}`,
    });
  }

  const bytes = await downloadPdf(tpl.processedStoragePath);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  for (const f of tpl.fieldsSchema) {
    const v = values[f.name];
    if (v == null) continue;
    try {
      if (f.type === "checkbox") {
        const cb = form.getCheckBox(f.name);
        if (v === "true") cb.check();
        else cb.uncheck();
      } else {
        form.getTextField(f.name).setText(String(v));
      }
    } catch {
      // Skip unknown fields silently per spec.
    }
  }

  if (tpl.flattenOnDownload) form.flatten();

  const filledBytes = Buffer.from(await doc.save());
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return {
    pdfContent: filledBytes.toString("base64"),
    contentType: "application/pdf" as const,
    filename: `${tpl.formId}-${today}.pdf`,
  };
}

export const formsRouter = router({
  list: protectedProcedure
    .input(z.object({ roadmapStep: z.number().optional() }).optional())
    .query(async ({ ctx, input }): Promise<FormSummary[]> => {
      const [system, user] = await Promise.all([
        listSystemTemplates(),
        listUserTemplates(ctx.user.uid),
      ]);
      const userByForm = new Map(user.map((t) => [t.formId, t]));
      const merged = [
        ...user,
        ...system.filter((s) => !userByForm.has(s.formId)),
      ];
      const filtered =
        input?.roadmapStep != null
          ? merged.filter((t) => t.roadmapStep === input.roadmapStep)
          : merged;
      return filtered.map(toSummary);
    }),

  schema: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }): Promise<FilledSchemaResponse> => {
      const tpl = await getTemplate(input.templateId);
      if (!tpl || tpl.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "template not found" });
      }
      if (tpl.status !== "ready") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `template status: ${tpl.status}`,
        });
      }
      if (tpl.scope === "user" && tpl.ownerUid !== ctx.user.uid) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const profile = await getProfile(ctx.user.uid).catch(() => null);

      const filled: Record<string, string> = {};
      const missingRequired: string[] = [];
      for (const f of tpl.fieldsSchema) {
        const v = f.profileKey
          ? resolveProfileValue(profile ?? undefined, f.profileKey, {
              type: f.type,
            })
          : "";
        if (v) filled[f.name] = v;
        if (f.required && !v) missingRequired.push(f.name);
      }
      return { template: tpl, filled, missingRequired };
    }),

  generatePdf: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        values: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      generatePdfImpl(ctx.user.uid, input.templateId, input.values),
    ),

  preview: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        values: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      generatePdfImpl(ctx.user.uid, input.templateId, input.values),
    ),

  uploadTemplate: protectedProcedure
    .input(
      z.object({
        formId: z.string().min(1).max(64),
        label: z.string().max(120).optional(),
        pdfBase64: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.pdfBase64, "base64");
      if (
        bytes.byteLength === 0 ||
        bytes.subarray(0, 4).toString() !== "%PDF"
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "not a PDF" });
      }
      if (bytes.byteLength > 10 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "max 10 MB" });
      }
      const today = await countUserUploadsLast24h(ctx.user.uid);
      if (today >= 10) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "10 uploads per day limit",
        });
      }

      const templateId = `${ctx.user.uid}_${nanoidLower()}`;
      try {
        const { processedBytes, fieldsSchema, sourceHash } =
          await processTemplate({
            rawBytes: bytes,
            templateId,
            manifestHints: {
              scope: "user",
              ownerUid: ctx.user.uid,
              formId: input.formId,
              label: input.label ?? input.formId,
            },
          });
        await uploadPdf(rawPath(templateId), bytes);
        await uploadPdf(processedPath(templateId), processedBytes);
        await writeTemplate({
          templateId,
          scope: "user",
          ownerUid: ctx.user.uid,
          formId: input.formId,
          label: input.label ?? input.formId,
          labelTl: input.label ?? input.formId,
          agency: "User Upload",
          roadmapStep: null,
          description: "User-uploaded template",
          rawStoragePath: rawPath(templateId),
          processedStoragePath: processedPath(templateId),
          sourceHash,
          fieldsSchema,
          flattenOnDownload: true,
          status: "ready",
          errorMessage: null,
          createdBy: ctx.user.uid,
        });
        return { templateId, status: "ready" as const };
      } catch (err) {
        const msg = (err as Error).message;
        await markFailed(templateId, msg).catch(() => {});
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await softDeleteUserTemplate(input.templateId, ctx.user.uid);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "forbidden") throw new TRPCError({ code: "FORBIDDEN" });
        if (msg === "not found") throw new TRPCError({ code: "NOT_FOUND" });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
      return { success: true };
    }),
});
