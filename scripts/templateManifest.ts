export type ManifestEntry = {
  filename: string;
  formId: string;
  templateId: string;
  label: string;
  labelTl: string;
  agency: string;
  roadmapStep: number | null;
  description: string;
  flattenOnDownload: boolean;
};

export const TEMPLATE_MANIFEST: ManifestEntry[] = [
  // NOTE: DTI BN Registration form removed pending official PDF.
  // Drop file into template/ and re-add manifest entry to seed.
  {
    filename: "BUSINESS CLEARANCE APPLICATION FORM - Barangay-Bel-Air.pdf",
    formId: "barangay_clearance",
    templateId: "system_barangay_clearance",
    label: "Barangay Business Clearance Application",
    labelTl: "Aplikasyon para sa Barangay Business Clearance",
    agency: "Barangay Hall",
    roadmapStep: 2,
    description:
      "Required prior to Mayor's Permit. (Bel-Air sample; LGU may differ.)",
    flattenOnDownload: true,
  },
  {
    filename: "BIR Form 1901.pdf",
    formId: "bir_1901",
    templateId: "system_bir_1901",
    label: "BIR Form 1901 — Application for Registration",
    labelTl: "BIR Form 1901 — Aplikasyon para sa Pagpaparehistro",
    agency: "Bureau of Internal Revenue",
    roadmapStep: 5,
    description: "Self-employed and mixed-income earners.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form 1902.pdf",
    formId: "bir_1902",
    templateId: "system_bir_1902",
    label: "BIR Form 1902 — Application for TIN (Employees)",
    labelTl: "BIR Form 1902 — Pag-aplay ng TIN (Empleyado)",
    agency: "Bureau of Internal Revenue",
    roadmapStep: null,
    description: "TIN application for individuals earning purely compensation income.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form 1903.pdf",
    formId: "bir_1903",
    templateId: "system_bir_1903",
    label: "BIR Form 1903 — Application for Registration (Corporations / Partnerships)",
    labelTl: "BIR Form 1903",
    agency: "Bureau of Internal Revenue",
    roadmapStep: null,
    description: "For corporations, partnerships, cooperatives, government units.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form 1904.pdf",
    formId: "bir_1904",
    templateId: "system_bir_1904",
    label: "BIR Form 1904 — Application for TIN (One-Time / E.O. 98)",
    labelTl: "BIR Form 1904",
    agency: "Bureau of Internal Revenue",
    roadmapStep: null,
    description: "One-time taxpayers and persons registering under E.O. 98.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form No. 1905.pdf",
    formId: "bir_1905",
    templateId: "system_bir_1905",
    label: "BIR Form 1905 — Application for Registration Information Update",
    labelTl: "BIR Form 1905",
    agency: "Bureau of Internal Revenue",
    roadmapStep: null,
    description: "Update / change registration information.",
    flattenOnDownload: false,
  },
  {
    filename: "BIR Form No. 1906.pdf",
    formId: "bir_1906",
    templateId: "system_bir_1906",
    label: "BIR Form 1906 — Authority to Print Receipts and Invoices",
    labelTl: "BIR Form 1906",
    agency: "Bureau of Internal Revenue",
    roadmapStep: 6,
    description: "Authority to Print (ATP) for official receipts and invoices.",
    flattenOnDownload: false,
  },
  {
    filename: "View BIR Form No. 0605.pdf",
    formId: "bir_0605",
    templateId: "system_bir_0605",
    label: "BIR Form 0605 — Payment Form",
    labelTl: "BIR Form 0605 — Payment Form",
    agency: "Bureau of Internal Revenue",
    roadmapStep: 7,
    description:
      "Payment form for annual registration fee and other miscellaneous payments.",
    flattenOnDownload: false,
  },
  {
    filename: "Other BN-related Application Form.pdf",
    formId: "dti_other_bn",
    templateId: "system_dti_other_bn",
    label: "DTI Other BN Application (Renewal / Cancellation / Amendment)",
    labelTl: "DTI Other BN Application",
    agency: "Department of Trade and Industry",
    roadmapStep: null,
    description: "BN renewal, cancellation, or amendment.",
    flattenOnDownload: true,
  },
  {
    filename: "PMRF PhilHealth Member Registration Form.pdf",
    formId: "philhealth_pmrf",
    templateId: "system_philhealth_pmrf",
    label: "PhilHealth Member Registration Form (PMRF)",
    labelTl: "PMRF — Pagpaparehistro sa PhilHealth",
    agency: "Philippine Health Insurance Corporation",
    roadmapStep: null,
    description: "PhilHealth member registration.",
    flattenOnDownload: true,
  },
  {
    filename: "PMRF-FN PhilHealth Member Registration Form for Foreign Nationals.pdf",
    formId: "philhealth_pmrf_fn",
    templateId: "system_philhealth_pmrf_fn",
    label: "PhilHealth Member Registration Form (Foreign Nationals)",
    labelTl: "PMRF-FN PhilHealth Form (Foreign Nationals)",
    agency: "Philippine Health Insurance Corporation",
    roadmapStep: null,
    description: "PhilHealth registration for foreign nationals.",
    flattenOnDownload: true,
  },
  {
    filename: "Undertaking Document.pdf",
    formId: "dti_undertaking",
    templateId: "system_dti_undertaking",
    label: "DTI Undertaking Document",
    labelTl: "DTI Undertaking Document",
    agency: "Department of Trade and Industry",
    roadmapStep: 1,
    description: "Undertaking attached to DTI BN registration where applicable.",
    flattenOnDownload: true,
  },
];
