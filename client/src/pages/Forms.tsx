/*
 * NegosyoNav — Smart Form Auto-fill + PDF Download (Feature 03 — MVP Anchor)
 * All three forms (Barangay Clearance, DTI, BIR 1901) render through the same
 * FormWizard so styling, validation, and review behavior stay consistent.
 *
 * Barangay uses the live AcroForm schema from `forms.getSchema`; DTI and BIR
 * use locally-defined schemas keyed by their PDF-renderer field names so the
 * wizard's name → value map flows straight into pdf-lib (or the text fallback).
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, CheckCircle2, AlertCircle, User, Loader2,
  ChevronDown, ChevronUp, Edit3, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import FormHelpDrawer from "@/components/FormHelpDrawer";
import FormWizard, { type SchemaField, type StepDef } from "@/components/FormWizard";
import { useFormHelp } from "@/hooks/useFormHelp";

type FormConfig = {
  id: string;
  title: string;
  titleTl: string;
  agency: string;
  description: string;
  step: number;
  // Barangay's schema is fetched at runtime; DTI/BIR are static.
  schemaSource: "barangay" | "static";
  staticSchema?: SchemaField[];
  steps: StepDef[];
  prefill: Record<string, string | boolean>;
};

export default function Forms() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  // Single store for all wizard values, keyed by formId then field name.
  const [formValues, setFormValues] = useState<Record<string, Record<string, string | boolean>>>({});
  const [activeFormName, setActiveFormName] = useState("");
  const formHelp = useFormHelp(activeFormName);

  const profileQuery = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const barangaySchemaQuery = trpc.forms.getSchema.useQuery(
    { formId: "barangay_clearance" },
    { enabled: isAuthenticated, staleTime: Infinity },
  );

  const generatePdfMutation = trpc.forms.generatePdf.useMutation({
    onSuccess: (data) => {
      if (data.pdfContent) {
        const byteChars = atob(data.pdfContent);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.formId || "form"}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("PDF downloaded! Ready to print. 🎉");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Error generating PDF. Try again.");
    },
  });

  const p = profileQuery.data;
  const fullName = p ? [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(" ") : "";
  const homeAddr = p ? [p.homeBuilding, p.homeStreet, p.homeBarangay, p.homeCity, p.homeProvince, p.homeZipCode].filter(Boolean).join(", ") : "";
  const bizAddr = p ? [p.bizBuilding, p.bizStreet, p.bizBarangay, p.bizCity, p.bizProvince, p.bizZipCode].filter(Boolean).join(", ") : "";

  // ─── Barangay (AcroForm-driven) prefill ────────────────────────────────────
  const barangayPrefill = useMemo<Record<string, string | boolean>>(() => {
    const today = new Date().toLocaleDateString("en-PH");
    const cap = p?.capitalization?.toString() ?? "";
    return {
      date_applied: today,
      business_name: p?.businessName ?? "",
      trade_name: p?.businessName ?? "",
      building: p?.bizBuilding ?? "",
      street: p?.bizStreet ?? "",
      locale: p?.bizBarangay ?? "",
      business_tin: p?.tin ?? "",
      contact_person: fullName,
      telephone_no: p?.mobileNumber ?? p?.phoneNumber ?? "",
      email: p?.emailAddress ?? "",
      paid_up_capital: cap,
      capitalization: cap,
      app_new: true,
      own_sole: true,
    };
  }, [p, fullName]);

  // ─── DTI (static schema) ───────────────────────────────────────────────────
  const dtiSchema: SchemaField[] = useMemo(() => [
    { name: "dti_name", type: "text", label: "Applicant's Full Name", group: "Personal Info", required: true },
    { name: "dti_dob", type: "text", label: "Date of Birth", group: "Personal Info" },
    { name: "dti_civil", type: "text", label: "Civil Status", group: "Personal Info" },
    { name: "dti_citizen", type: "text", label: "Citizenship", group: "Personal Info" },
    { name: "dti_tin", type: "text", label: "TIN", group: "Identification" },
    { name: "dti_philsys", type: "text", label: "PhilSys ID", group: "Identification" },
    { name: "dti_mobile", type: "text", label: "Mobile Number", group: "Contact" },
    { name: "dti_email", type: "text", label: "Email Address", group: "Contact" },
    { name: "dti_home_addr", type: "text", label: "Home Address", group: "Address" },
    { name: "dti_bn1", type: "text", label: "Proposed Business Name (1st)", group: "Business Names", required: true },
    { name: "dti_bn2", type: "text", label: "Proposed Business Name (2nd)", group: "Business Names" },
    { name: "dti_bn3", type: "text", label: "Proposed Business Name (3rd)", group: "Business Names" },
    { name: "dti_biz_addr", type: "text", label: "Business Address", group: "Business Details" },
    { name: "dti_activity", type: "text", label: "Business Activity", group: "Business Details" },
    { name: "dti_scope", type: "text", label: "Territorial Scope", group: "Business Details" },
    { name: "dti_cap", type: "text", label: "Capitalization (₱)", group: "Business Details" },
  ], []);

  const dtiSteps: StepDef[] = useMemo(() => [
    { title: "Personal Info", subtitle: "Sino ang nag-a-apply?", kind: "fields", names: ["dti_name", "dti_dob", "dti_civil", "dti_citizen"] },
    { title: "Identification", subtitle: "Para ma-verify ka.", kind: "fields", names: ["dti_tin", "dti_philsys"] },
    { title: "Contact", subtitle: "Paano ka makokontak?", kind: "fields", names: ["dti_mobile", "dti_email"] },
    { title: "Address", subtitle: "Saan ka nakatira?", kind: "fields", names: ["dti_home_addr"] },
    { title: "Business Names", subtitle: "Tatlong choices, in order of preference.", kind: "fields", names: ["dti_bn1", "dti_bn2", "dti_bn3"] },
    { title: "Business Details", subtitle: "Tungkol sa negosyo.", kind: "fields", names: ["dti_biz_addr", "dti_activity", "dti_scope", "dti_cap"] },
    { title: "Review & Download", kind: "review" },
  ], []);

  const dtiPrefill = useMemo<Record<string, string | boolean>>(() => ({
    dti_name: fullName,
    dti_dob: p?.dateOfBirth ?? "",
    dti_civil: p?.civilStatus ?? "",
    dti_citizen: p?.citizenship ?? "Filipino",
    dti_tin: p?.tin ?? "",
    dti_philsys: p?.philsysId ?? "",
    dti_mobile: p?.mobileNumber ?? "",
    dti_email: p?.emailAddress ?? "",
    dti_home_addr: homeAddr,
    dti_bn1: p?.businessName ?? "",
    dti_bn2: p?.businessNameOption2 ?? "",
    dti_bn3: p?.businessNameOption3 ?? "",
    dti_biz_addr: bizAddr,
    dti_activity: p?.businessActivity ?? "",
    dti_scope: p?.territorialScope ?? "city",
    dti_cap: p?.capitalization?.toString() ?? "",
  }), [p, fullName, homeAddr, bizAddr]);

  // ─── BIR 1901 (static schema) ──────────────────────────────────────────────
  const birSchema: SchemaField[] = useMemo(() => [
    { name: "bir_last", type: "text", label: "Taxpayer's Last Name", group: "Taxpayer Name", required: true },
    { name: "bir_first", type: "text", label: "Taxpayer's First Name", group: "Taxpayer Name", required: true },
    { name: "bir_middle", type: "text", label: "Taxpayer's Middle Name", group: "Taxpayer Name" },
    { name: "bir_tin", type: "text", label: "TIN", group: "Identification" },
    { name: "bir_dob", type: "text", label: "Date of Birth", group: "Identification" },
    { name: "bir_civil", type: "text", label: "Civil Status", group: "Identification" },
    { name: "bir_citizen", type: "text", label: "Citizenship", group: "Identification" },
    { name: "bir_reg_addr", type: "text", label: "Registered Address", group: "Address" },
    { name: "bir_zip", type: "text", label: "ZIP Code", group: "Address" },
    { name: "bir_mobile", type: "text", label: "Mobile Number", group: "Contact" },
    { name: "bir_email", type: "text", label: "Email Address", group: "Contact" },
    { name: "bir_trade", type: "text", label: "Trade Name / Business Name", group: "Business", required: true },
    { name: "bir_line", type: "text", label: "Line of Business / Occupation", group: "Business" },
    { name: "bir_tax_type", type: "text", label: "Tax Type", group: "Business" },
  ], []);

  const birSteps: StepDef[] = useMemo(() => [
    { title: "Taxpayer Name", subtitle: "Buong pangalan mo.", kind: "fields", names: ["bir_last", "bir_first", "bir_middle"] },
    { title: "Identification", subtitle: "Para ma-verify ka.", kind: "fields", names: ["bir_tin", "bir_dob", "bir_civil", "bir_citizen"] },
    { title: "Address", subtitle: "Saan ka nakarehistro?", kind: "fields", names: ["bir_reg_addr", "bir_zip"] },
    { title: "Contact", subtitle: "Paano ka makokontak?", kind: "fields", names: ["bir_mobile", "bir_email"] },
    { title: "Business", subtitle: "Tungkol sa negosyo.", kind: "fields", names: ["bir_trade", "bir_line", "bir_tax_type"] },
    { title: "Review & Download", kind: "review" },
  ], []);

  const birPrefill = useMemo<Record<string, string | boolean>>(() => ({
    bir_last: p?.lastName ?? "",
    bir_first: p?.firstName ?? "",
    bir_middle: p?.middleName ?? "",
    bir_tin: p?.tin ?? "",
    bir_dob: p?.dateOfBirth ?? "",
    bir_civil: p?.civilStatus ?? "",
    bir_citizen: p?.citizenship ?? "Filipino",
    bir_reg_addr: bizAddr,
    bir_zip: p?.bizZipCode ?? "",
    bir_mobile: p?.mobileNumber ?? "",
    bir_email: p?.emailAddress ?? "",
    bir_trade: p?.businessName ?? "",
    bir_line: p?.businessActivity ?? "",
    bir_tax_type: p?.preferTaxOption === "eight_percent" ? "8% Gross Sales" : "Graduated Rates",
  }), [p, bizAddr]);

  // ─── Barangay step definitions (drives the wizard for the AcroForm form) ───
  const barangaySteps: StepDef[] = useMemo(() => [
    { title: "Application Type", subtitle: "Pumili ng isa.", kind: "radio", group: "Application Type" },
    { title: "Business Identity", subtitle: "Ano ang pangalan ng negosyo mo?", kind: "fields", names: ["business_name", "trade_name"] },
    { title: "Business Address", subtitle: "Saan matatagpuan ang negosyo?", kind: "fields", names: ["unit_room", "floor", "building", "street_no", "street", "locale"] },
    { title: "Form of Ownership", subtitle: "Pumili ng isa.", kind: "radio", group: "Form of Ownership" },
    {
      title: "Nature of Business",
      subtitle: "Tap mga services na binibigay mo. Pwede mahigit isa.",
      kind: "chips",
      group: "Nature of Business",
      specifyMap: { nob_services: "nob_services_specify", nob_others: "nob_others_specify" },
    },
    { title: "Contact + Capital", subtitle: "Paano ka makokontak?", kind: "fields", names: ["contact_person", "telephone_no", "email", "business_tin", "paid_up_capital", "capitalization", "assessed_value", "fax_no"] },
    { title: "Review & Download", kind: "review" },
  ], []);

  const forms: FormConfig[] = useMemo(() => [
    {
      id: "barangay_clearance",
      title: "Barangay Business Clearance Application",
      titleTl: "Aplikasyon para sa Barangay Business Clearance",
      agency: "Barangay Hall",
      description: "Application for barangay clearance. Required before applying for Mayor's Permit. Fields below mirror the official AcroForm — what you fill is exactly what gets stamped into the PDF.",
      step: 1,
      schemaSource: "barangay",
      steps: barangaySteps,
      prefill: barangayPrefill,
    },
    {
      id: "dti_form",
      title: "DTI Business Name Registration Form (FM-BN-01)",
      titleTl: "Form ng Pagpaparehistro ng Pangalan ng Negosyo",
      agency: "Department of Trade and Industry",
      description: "Application form for registering your business name with DTI.",
      step: 2,
      schemaSource: "static",
      staticSchema: dtiSchema,
      steps: dtiSteps,
      prefill: dtiPrefill,
    },
    {
      id: "bir_1901",
      title: "BIR Form 1901 — Application for Registration",
      titleTl: "BIR Form 1901 — Aplikasyon para sa Pagpaparehistro",
      agency: "Bureau of Internal Revenue",
      description: "Registration form for self-employed individuals and mixed income earners.",
      step: 3,
      schemaSource: "static",
      staticSchema: birSchema,
      steps: birSteps,
      prefill: birPrefill,
    },
  ], [barangayPrefill, barangaySteps, dtiSchema, dtiSteps, dtiPrefill, birSchema, birSteps, birPrefill]);

  const schemaFor = (form: FormConfig): SchemaField[] => {
    if (form.schemaSource === "barangay") return barangaySchemaQuery.data?.fields ?? [];
    return form.staticSchema ?? [];
  };

  const getValue = (formId: string, name: string, fallback: string | boolean): string | boolean => {
    const v = formValues[formId]?.[name];
    return v !== undefined ? v : fallback;
  };

  const setValue = (formId: string, name: string, value: string | boolean) => {
    setFormValues(prev => ({
      ...prev,
      [formId]: { ...(prev[formId] ?? {}), [name]: value },
    }));
  };

  const filledCount = (form: FormConfig) => {
    const schema = schemaFor(form);
    return schema.filter(def => {
      const fb = form.prefill[def.name] ?? (def.type === "checkbox" ? false : "");
      const v = getValue(form.id, def.name, fb);
      if (def.type === "checkbox") return v === true;
      return typeof v === "string" && v.trim() !== "";
    }).length;
  };

  const totalCount = (form: FormConfig) => schemaFor(form).length;

  const handleDownloadPdf = (form: FormConfig) => {
    const schema = schemaFor(form);
    const payload: Record<string, string | boolean> = {};
    for (const def of schema) {
      const fb = form.prefill[def.name] ?? (def.type === "checkbox" ? false : "");
      payload[def.name] = getValue(form.id, def.name, fb);
    }
    generatePdfMutation.mutate({ formId: form.id, fields: payload });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-warm-cream flex flex-col items-center justify-center p-6 text-center">
        <FileText className="w-12 h-12 text-teal mb-4" />
        <h2 className="font-[var(--font-display)] text-lg text-earth-brown mb-2">Sign in to use Auto-fill</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">Save your profile once, then auto-fill all government forms instantly.</p>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="bg-teal hover:bg-teal/90 text-white rounded-xl px-8 py-3 font-[var(--font-display)]">Sign In</Button>
        <button onClick={() => navigate("/")} className="text-sm text-muted-foreground mt-4 hover:text-teal">Back to Home</button>
      </div>
    );
  }

  const hasProfile = p && p.firstName;

  return (
    <div className="min-h-screen bg-warm-cream pb-24 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button onClick={() => navigate("/roadmap")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-earth-brown" />
          </button>
          <div className="flex-1">
            <h1 className="font-[var(--font-display)] text-sm text-earth-brown">Smart Form Auto-fill</h1>
            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">Review, edit, and download print-ready PDFs</p>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mt-4 space-y-4">
        {/* Profile status */}
        {!hasProfile ? (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-mango-light rounded-2xl border border-mango/30 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-mango shrink-0 mt-0.5" />
              <div>
                <h3 className="font-[var(--font-display)] text-sm text-earth-brown">Complete your profile first</h3>
                <p className="text-xs text-muted-foreground mt-1">Fill out your Negosyante Profile para ma-auto-fill ang forms.</p>
                <Button onClick={() => navigate("/profile")} size="sm" className="mt-3 bg-mango hover:bg-mango/90 text-earth-brown rounded-xl font-[var(--font-display)] text-xs">
                  <User className="w-4 h-4 mr-1" />Go to Profile
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-teal-light rounded-2xl border border-teal/30 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-teal shrink-0" />
              <div className="flex-1">
                <h3 className="font-[var(--font-display)] text-sm text-earth-brown">Profile loaded: {fullName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Forms are auto-filled from your profile. You can edit any field below.</p>
              </div>
              <Button onClick={() => navigate("/profile")} variant="outline" size="sm" className="rounded-xl border-teal/30 text-teal text-xs shrink-0">
                <Edit3 className="w-3 h-3 mr-1" />Edit
              </Button>
            </div>
          </motion.div>
        )}

        {/* Form Cards */}
        {forms.map((form, i) => {
          const filled = filledCount(form);
          const total = totalCount(form);
          const isExpanded = expandedForm === form.id;
          const isBarangayLoading = form.schemaSource === "barangay" && barangaySchemaQuery.isLoading;
          const isBarangayError = form.schemaSource === "barangay" && barangaySchemaQuery.error;

          return (
            <motion.div key={form.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Form header */}
              <button onClick={() => setExpandedForm(isExpanded ? null : form.id)} className="w-full text-left p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-[var(--font-mono)] font-semibold uppercase tracking-wider text-teal bg-teal/10 px-2 py-0.5 rounded-full">Step {form.step}</span>
                      <span className={`text-[10px] font-[var(--font-mono)] px-2 py-0.5 rounded-full ${total > 0 && filled === total ? "text-success bg-success/10" : "text-mango bg-mango-light"}`}>
                        {filled}/{total} filled
                      </span>
                    </div>
                    <h3 className="font-[var(--font-display)] text-sm text-earth-brown leading-snug">{form.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{form.agency}</p>
                  </div>
                  <div className="shrink-0">
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </div>
              </button>

              {/* Expanded wizard */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-4 pb-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mt-3 mb-4">{form.description}</p>

                      {isBarangayLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-teal" />
                        </div>
                      ) : isBarangayError ? (
                        <p className="text-xs text-jeepney-red">Could not load form schema. Try again.</p>
                      ) : (
                        <FormWizard
                          schema={schemaFor(form)}
                          steps={form.steps}
                          prefill={form.prefill}
                          getValue={(name, fb) => getValue(form.id, name, fb)}
                          setValue={(name, v) => setValue(form.id, name, v)}
                          onSubmit={() => handleDownloadPdf(form)}
                          isSubmitting={generatePdfMutation.isPending}
                          onHelp={(label) => { setActiveFormName(form.title); formHelp.openHelp(label); }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

      </div>

      {/* Floating Form Help Button */}
      {!formHelp.isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            const firstForm = forms[0];
            if (firstForm) {
              setActiveFormName(firstForm.title);
              formHelp.openHelp("General na tanong sa form");
            }
          }}
          className="fixed bottom-20 right-4 w-14 h-14 bg-teal text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:bg-teal/90 transition-colors"
          title="Form Help Assistant"
        >
          <MessageCircle className="w-6 h-6" />
        </motion.button>
      )}

      {/* Form Help Drawer */}
      <FormHelpDrawer
        isOpen={formHelp.isOpen}
        onClose={formHelp.closeHelp}
        formName={formHelp.formName}
        fieldLabel={formHelp.activeField?.label ?? ""}
        history={formHelp.history}
        onAddMessage={formHelp.addMessage}
        userProfile={p ? (p as unknown as Record<string, unknown>) : undefined}
      />
    </div>
  );
}
