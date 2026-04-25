import type { Timestamp } from "firebase-admin/firestore";

export type FieldType = "text" | "checkbox" | "date" | "number";

export type FieldSpec = {
  name: string;
  label: string;
  page: number;
  bbox: [number, number, number, number];
  type: FieldType;
  required: boolean;
  profileKey: string | null;
  placeholder: string | null;
  maxLength: number | null;
};

export type TemplateScope = "system" | "user";
export type TemplateStatus = "pending" | "processing" | "ready" | "failed";

export type FormTemplate = {
  templateId: string;
  scope: TemplateScope;
  ownerUid: string | null;
  formId: string;
  label: string;
  labelTl: string;
  agency: string;
  roadmapStep: number | null;
  description: string;
  rawStoragePath: string;
  processedStoragePath: string;
  sourceHash: string;
  fieldsSchema: FieldSpec[];
  flattenOnDownload: boolean;
  status: TemplateStatus;
  errorMessage: string | null;
  createdAt: Date;
  processedAt: Date | null;
  createdBy: string;
  deletedAt: Date | null;
};

export type FormSummary = {
  templateId: string;
  formId: string;
  label: string;
  labelTl: string;
  agency: string;
  roadmapStep: number | null;
  scope: TemplateScope;
  fieldCount: number;
};

export type FilledSchemaResponse = {
  template: FormTemplate;
  filled: Record<string, string>;
  missingRequired: string[];
};

export type FormTemplateDoc = Omit<
  FormTemplate,
  "createdAt" | "processedAt" | "deletedAt"
> & {
  createdAt: Timestamp;
  processedAt: Timestamp | null;
  deletedAt: Timestamp | null;
};
