/*
 * NegosyoNav — Smart Form Auto-fill + PDF Download (Feature 03 — MVP Anchor)
 * Shows pre-populated government forms based on the user's profile.
 * User reviews, edits, and downloads print-ready PDFs.
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, Download, CheckCircle2, AlertCircle, User, Loader2,
  ChevronDown, ChevronUp, Edit3, Eye, HelpCircle, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import FormHelpDrawer from "@/components/FormHelpDrawer";
import { useFormHelp } from "@/hooks/useFormHelp";

interface FormField {
  label: string;
  value: string;
  key: string;
  required?: boolean;
}

interface GovernmentForm {
  id: string;
  title: string;
  titleTl: string;
  agency: string;
  description: string;
  fields: FormField[];
  step: number;
}

export default function Forms() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>({});
  const [activeFormName, setActiveFormName] = useState("");
  const formHelp = useFormHelp(activeFormName);

  const profileQuery = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const generatePdfMutation = trpc.forms.generatePdf.useMutation({
    onSuccess: (data) => {
      if (data.pdfContent) {
        // Decode base64 and download
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
    onError: () => { toast.error("Error generating PDF. Try again."); },
  });

  const p = profileQuery.data;
  const fullName = p ? [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(" ") : "";
  const homeAddr = p ? [p.homeBuilding, p.homeStreet, p.homeBarangay, p.homeCity, p.homeProvince, p.homeZipCode].filter(Boolean).join(", ") : "";
  const bizAddr = p ? [p.bizBuilding, p.bizStreet, p.bizBarangay, p.bizCity, p.bizProvince, p.bizZipCode].filter(Boolean).join(", ") : "";

  const forms: GovernmentForm[] = useMemo(() => [
    {
      id: "dti_form",
      title: "DTI Business Name Registration Form (FM-BN-01)",
      titleTl: "Form ng Pagpaparehistro ng Pangalan ng Negosyo",
      agency: "Department of Trade and Industry",
      description: "Application form for registering your business name with DTI. This is Step 1 of the Lakad Roadmap.",
      step: 1,
      fields: [
        { label: "Applicant's Full Name", value: fullName, key: "dti_name", required: true },
        { label: "Date of Birth", value: p?.dateOfBirth || "", key: "dti_dob" },
        { label: "Civil Status", value: p?.civilStatus || "", key: "dti_civil" },
        { label: "Citizenship", value: p?.citizenship || "Filipino", key: "dti_citizen" },
        { label: "TIN", value: p?.tin || "", key: "dti_tin" },
        { label: "PhilSys ID", value: p?.philsysId || "", key: "dti_philsys" },
        { label: "Mobile Number", value: p?.mobileNumber || "", key: "dti_mobile" },
        { label: "Email Address", value: p?.emailAddress || "", key: "dti_email" },
        { label: "Home Address", value: homeAddr, key: "dti_home_addr" },
        { label: "Proposed Business Name (1st)", value: p?.businessName || "", key: "dti_bn1", required: true },
        { label: "Proposed Business Name (2nd)", value: p?.businessNameOption2 || "", key: "dti_bn2" },
        { label: "Proposed Business Name (3rd)", value: p?.businessNameOption3 || "", key: "dti_bn3" },
        { label: "Business Address", value: bizAddr, key: "dti_biz_addr" },
        { label: "Business Activity", value: p?.businessActivity || "", key: "dti_activity" },
        { label: "Territorial Scope", value: p?.territorialScope || "city", key: "dti_scope" },
        { label: "Capitalization (₱)", value: p?.capitalization?.toString() || "", key: "dti_cap" },
      ],
    },
    {
      id: "barangay_clearance",
      title: "Barangay Business Clearance Application",
      titleTl: "Aplikasyon para sa Barangay Business Clearance",
      agency: "Barangay Hall",
      description: "Application for barangay clearance. Required before applying for Mayor's Permit. Step 2 of the Lakad Roadmap.",
      step: 2,
      fields: [
        { label: "Owner's Full Name", value: fullName, key: "brgy_name", required: true },
        { label: "Home Address", value: homeAddr, key: "brgy_home" },
        { label: "Business Name", value: p?.businessName || "", key: "brgy_bn", required: true },
        { label: "Business Address", value: bizAddr, key: "brgy_biz_addr" },
        { label: "Business Barangay", value: p?.bizBarangay || "", key: "brgy_barangay", required: true },
        { label: "Nature of Business", value: p?.businessActivity || "", key: "brgy_nature" },
        { label: "DTI Certificate No.", value: "(from Step 1)", key: "brgy_dti_cert" },
        { label: "Contact Number", value: p?.mobileNumber || "", key: "brgy_contact" },
      ],
    },
    {
      id: "bir_1901",
      title: "BIR Form 1901 — Application for Registration",
      titleTl: "BIR Form 1901 — Aplikasyon para sa Pagpaparehistro",
      agency: "Bureau of Internal Revenue",
      description: "Registration form for self-employed individuals and mixed income earners. Step 5 of the Lakad Roadmap.",
      step: 5,
      fields: [
        { label: "Taxpayer's Last Name", value: p?.lastName || "", key: "bir_last", required: true },
        { label: "Taxpayer's First Name", value: p?.firstName || "", key: "bir_first", required: true },
        { label: "Taxpayer's Middle Name", value: p?.middleName || "", key: "bir_middle" },
        { label: "TIN", value: p?.tin || "", key: "bir_tin" },
        { label: "Date of Birth", value: p?.dateOfBirth || "", key: "bir_dob" },
        { label: "Civil Status", value: p?.civilStatus || "", key: "bir_civil" },
        { label: "Citizenship", value: p?.citizenship || "Filipino", key: "bir_citizen" },
        { label: "Registered Address", value: bizAddr, key: "bir_reg_addr" },
        { label: "ZIP Code", value: p?.bizZipCode || "", key: "bir_zip" },
        { label: "Mobile Number", value: p?.mobileNumber || "", key: "bir_mobile" },
        { label: "Email Address", value: p?.emailAddress || "", key: "bir_email" },
        { label: "Trade Name / Business Name", value: p?.businessName || "", key: "bir_trade", required: true },
        { label: "Line of Business / Occupation", value: p?.businessActivity || "", key: "bir_line" },
        { label: "Tax Type", value: p?.preferTaxOption === "eight_percent" ? "8% Gross Sales" : "Graduated Rates", key: "bir_tax_type" },
      ],
    },
  ], [p, fullName, homeAddr, bizAddr]);

  const getFieldValue = (key: string, defaultValue: string) => {
    return fieldOverrides[key] !== undefined ? fieldOverrides[key] : defaultValue;
  };

  const filledCount = (form: GovernmentForm) => {
    return form.fields.filter(f => {
      const val = getFieldValue(f.key, f.value);
      return val && val.trim() !== "" && val !== "(from Step 1)";
    }).length;
  };

  const handleDownloadPdf = (form: GovernmentForm) => {
    const fields: Record<string, string> = {};
    form.fields.forEach(f => {
      fields[f.key] = getFieldValue(f.key, f.value);
    });
    generatePdfMutation.mutate({ formId: form.id, fields });
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
    <div className="min-h-screen bg-warm-cream pb-8">
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
          const total = form.fields.length;
          const isExpanded = expandedForm === form.id;
          const isEditing = editMode === form.id;

          return (
            <motion.div key={form.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Form header */}
              <button onClick={() => setExpandedForm(isExpanded ? null : form.id)} className="w-full text-left p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-[var(--font-mono)] font-semibold uppercase tracking-wider text-teal bg-teal/10 px-2 py-0.5 rounded-full">Step {form.step}</span>
                      <span className={`text-[10px] font-[var(--font-mono)] px-2 py-0.5 rounded-full ${filled === total ? "text-success bg-success/10" : "text-mango bg-mango-light"}`}>
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

              {/* Expanded form fields */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-4 pb-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mt-3 mb-4">{form.description}</p>

                      {/* Toggle edit/preview */}
                      <div className="flex gap-2 mb-4">
                        <Button onClick={() => setEditMode(isEditing ? null : form.id)} variant="outline" size="sm" className="rounded-xl text-xs border-teal/30 text-teal">
                          {isEditing ? <><Eye className="w-3 h-3 mr-1" />Preview</> : <><Edit3 className="w-3 h-3 mr-1" />Edit Fields</>}
                        </Button>
                      </div>

                      {/* Fields */}
                      <div className="space-y-2">
                        {form.fields.map((field) => {
                          const val = getFieldValue(field.key, field.value);
                          const isEmpty = !val || val.trim() === "" || val === "(from Step 1)";
                          return (
                            <div key={field.key} className="flex items-start gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                  {field.label}
                                  {field.required && <span className="text-jeepney-red">*</span>}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveFormName(form.title);
                                      formHelp.openHelp(field.label);
                                    }}
                                    className="ml-auto text-muted-foreground/60 hover:text-teal transition-colors"
                                    title={`Tulong sa "${field.label}"`}
                                  >
                                    <HelpCircle className="w-3 h-3" />
                                  </button>
                                </label>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={getFieldValue(field.key, field.value)}
                                    onChange={(e) => setFieldOverrides(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 font-[var(--font-body)] mt-0.5"
                                  />
                                ) : (
                                  <p className={`text-sm mt-0.5 ${isEmpty ? "text-muted-foreground/50 italic" : "text-earth-brown"} font-[var(--font-body)]`}>
                                    {isEmpty ? "(empty — fill in profile)" : val}
                                  </p>
                                )}
                              </div>
                              {!isEmpty && !isEditing && (
                                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-4" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Download button */}
                      <div className="mt-4 pt-3 border-t border-border/50">
                        <Button
                          onClick={() => handleDownloadPdf(form)}
                          disabled={generatePdfMutation.isPending}
                          className="w-full bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] py-3"
                        >
                          {generatePdfMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating PDF...</>
                          ) : (
                            <><Download className="w-4 h-4 mr-2" />I-download ang PDF</>
                          )}
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground mt-2">Print-ready PDF — works offline after download</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Navigation */}
        <div className="flex flex-wrap justify-center gap-3 pt-4 pb-8">
          <Button onClick={() => navigate("/profile")} variant="outline" className="rounded-xl border-teal/30 text-teal hover:bg-teal-light">
            <User className="w-4 h-4 mr-2" />Edit Profile
          </Button>
          <Button onClick={() => navigate("/roadmap")} variant="outline" className="rounded-xl border-mango/30 text-earth-brown hover:bg-mango-light">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Roadmap
          </Button>
        </div>
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
