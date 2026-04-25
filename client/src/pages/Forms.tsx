/*
 * NegosyoNav — Smart Form Auto-fill (data-driven)
 * Renders templates from the dynamic form registry, prefills from profile,
 * downloads real PDFs via pdf-lib server-side.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, Download, CheckCircle2, AlertCircle, User, Loader2,
  ChevronDown, ChevronUp, Edit3, Eye, HelpCircle, MessageCircle, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import FormHelpDrawer from "@/components/FormHelpDrawer";
import { useFormHelp } from "@/hooks/useFormHelp";
import { triggerPdfDownload, base64PdfToBlobUrl } from "@/lib/dataUriPdf";
import { PreviewSheet } from "@/components/forms/PreviewSheet";

type FormSummary = {
  templateId: string;
  formId: string;
  label: string;
  labelTl: string;
  agency: string;
  roadmapStep: number | null;
  scope: "system" | "user";
  fieldCount: number;
};

export default function Forms() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const [activeFormName, setActiveFormName] = useState("");
  const formHelp = useFormHelp(activeFormName);

  const [previewState, setPreviewState] = useState<{ url: string; title: string } | null>(null);

  const profileQuery = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const listQuery = trpc.forms.list.useQuery(undefined, { enabled: isAuthenticated });

  const generateMut = trpc.forms.generatePdf.useMutation({
    onSuccess: (data) => {
      triggerPdfDownload(data.pdfContent, data.filename);
      toast.success("PDF na-download!");
    },
    onError: (err) => toast.error(err.message ?? "Error sa pag-generate ng PDF"),
  });

  const previewMut = trpc.forms.preview.useMutation({
    onSuccess: (data) => {
      const { url } = base64PdfToBlobUrl(data.pdfContent);
      setPreviewState({ url, title: data.filename });
    },
    onError: (err) => toast.error(err.message ?? "Error sa preview"),
  });

  const deleteMut = trpc.forms.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Tinanggal na ang template");
      listQuery.refetch();
    },
  });

  useEffect(() => {
    return () => {
      if (previewState) URL.revokeObjectURL(previewState.url);
    };
  }, [previewState]);

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
        <h2 className="font-[var(--font-display)] text-lg text-earth-brown mb-2">
          Sign in para gamitin ang Auto-fill
        </h2>
        <Button
          onClick={() => { window.location.href = getLoginUrl(); }}
          className="bg-teal hover:bg-teal/90 text-white rounded-xl px-8 py-3 font-[var(--font-display)] h-12 min-h-11"
        >
          Sign In
        </Button>
        <button onClick={() => navigate("/")} className="text-sm text-muted-foreground mt-4 hover:text-teal min-h-11">
          Back to Home
        </button>
      </div>
    );
  }

  const profile = profileQuery.data;
  const fullName = profile
    ? [profile.firstName, profile.middleName, profile.lastName, profile.suffix].filter(Boolean).join(" ")
    : "";
  const hasProfile = !!profile?.firstName;

  const summaries: FormSummary[] = (listQuery.data ?? []) as FormSummary[];

  return (
    <div className="min-h-screen bg-warm-cream pb-24">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button
            onClick={() => navigate("/roadmap")}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors min-h-11 min-w-11 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-earth-brown" />
          </button>
          <div className="flex-1">
            <h1 className="font-[var(--font-display)] text-sm text-earth-brown">Smart Form Auto-fill</h1>
            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
              Punan, i-preview, at i-download
            </p>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mt-4 space-y-4 px-4">
        {!hasProfile ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-mango-light rounded-2xl border border-mango/30 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-mango shrink-0 mt-0.5" />
              <div>
                <h3 className="font-[var(--font-display)] text-sm text-earth-brown">
                  Punan muna ang Profile
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Para ma-auto-fill ang forms, kompletuhin muna ang Profile.
                </p>
                <Button
                  onClick={() => navigate("/profile")}
                  size="sm"
                  className="mt-3 bg-mango hover:bg-mango/90 text-earth-brown rounded-xl font-[var(--font-display)] text-xs h-11 min-h-11"
                >
                  <User className="w-4 h-4 mr-1" />Pumunta sa Profile
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-teal-light rounded-2xl border border-teal/30 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-teal shrink-0" />
              <div className="flex-1">
                <h3 className="font-[var(--font-display)] text-sm text-earth-brown">
                  Profile loaded: {fullName}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Forms are auto-filled from your profile. You can edit any field below.
                </p>
              </div>
              <Button
                onClick={() => navigate("/profile")}
                variant="outline"
                size="sm"
                className="rounded-xl border-teal/30 text-teal text-xs h-11 min-h-11 shrink-0"
              >
                <Edit3 className="w-3 h-3 mr-1" />Edit
              </Button>
            </div>
          </motion.div>
        )}

        {listQuery.isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-teal" />
          </div>
        )}

        {!listQuery.isLoading && summaries.length === 0 && (
          <div className="bg-white rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
            Wala pang available na forms. Subukan ulit mamaya.
          </div>
        )}

        {summaries.map((s, i) => (
          <FormCard
            key={s.templateId}
            summary={s}
            isExpanded={expandedId === s.templateId}
            isEditing={editingId === s.templateId}
            overrides={overrides[s.templateId] ?? {}}
            onToggleExpand={() =>
              setExpandedId(expandedId === s.templateId ? null : s.templateId)
            }
            onToggleEdit={() =>
              setEditingId(editingId === s.templateId ? null : s.templateId)
            }
            onChangeField={(name, value) =>
              setOverrides((prev) => ({
                ...prev,
                [s.templateId]: { ...(prev[s.templateId] ?? {}), [name]: value },
              }))
            }
            onDownload={(values) =>
              generateMut.mutate({ templateId: s.templateId, values })
            }
            onPreview={(values) =>
              previewMut.mutate({ templateId: s.templateId, values })
            }
            onDelete={
              s.scope === "user"
                ? () => deleteMut.mutate({ templateId: s.templateId })
                : null
            }
            onOpenHelp={(label) => {
              setActiveFormName(s.label);
              formHelp.openHelp(label);
            }}
            isDownloading={generateMut.isPending}
            isPreviewing={previewMut.isPending}
            indexAnimDelay={i * 0.05}
          />
        ))}

        {/* Footer nav */}
        <div className="flex flex-wrap justify-center gap-3 pt-2 pb-4">
          <Button
            onClick={() => navigate("/profile")}
            variant="outline"
            className="rounded-xl border-teal/30 text-teal hover:bg-teal-light h-12 min-h-11"
          >
            <User className="w-4 h-4 mr-2" />Edit Profile
          </Button>
          <Button
            onClick={() => navigate("/roadmap")}
            variant="outline"
            className="rounded-xl border-mango/30 text-earth-brown hover:bg-mango-light h-12 min-h-11"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Roadmap
          </Button>
        </div>
      </div>

      <PreviewSheet
        open={!!previewState}
        onOpenChange={(b) => {
          if (!b) setPreviewState(null);
        }}
        blobUrl={previewState?.url ?? null}
        title={previewState?.title ?? ""}
      />

      {!formHelp.isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            const first = summaries[0];
            if (first) {
              setActiveFormName(first.label);
              formHelp.openHelp("General na tanong sa form");
            }
          }}
          className="fixed bottom-24 right-4 w-14 h-14 bg-teal text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:bg-teal/90 transition-colors"
          title="Form Help Assistant"
        >
          <MessageCircle className="w-6 h-6" />
        </motion.button>
      )}

      <FormHelpDrawer
        isOpen={formHelp.isOpen}
        onClose={formHelp.closeHelp}
        formName={formHelp.formName}
        fieldLabel={formHelp.activeField?.label ?? ""}
        history={formHelp.history}
        onAddMessage={formHelp.addMessage}
        userProfile={profile ? (profile as unknown as Record<string, unknown>) : undefined}
      />
    </div>
  );
}

function FormCard(props: {
  summary: FormSummary;
  isExpanded: boolean;
  isEditing: boolean;
  overrides: Record<string, string>;
  onToggleExpand: () => void;
  onToggleEdit: () => void;
  onChangeField: (name: string, value: string) => void;
  onDownload: (values: Record<string, string>) => void;
  onPreview: (values: Record<string, string>) => void;
  onDelete: (() => void) | null;
  onOpenHelp: (label: string) => void;
  isDownloading: boolean;
  isPreviewing: boolean;
  indexAnimDelay: number;
}) {
  const { summary, isExpanded, isEditing, overrides } = props;
  const schemaQuery = trpc.forms.schema.useQuery(
    { templateId: summary.templateId },
    { enabled: isExpanded },
  );

  const tpl = schemaQuery.data?.template;
  const filled = schemaQuery.data?.filled ?? {};

  function valueOf(name: string): string {
    return overrides[name] ?? filled[name] ?? "";
  }
  function fieldsAsValues(): Record<string, string> {
    const out: Record<string, string> = {};
    tpl?.fieldsSchema.forEach((f) => {
      out[f.name] = valueOf(f.name);
    });
    return out;
  }
  const filledCount = tpl
    ? tpl.fieldsSchema.filter((f) => valueOf(f.name).trim()).length
    : 0;
  const total = tpl?.fieldsSchema.length ?? summary.fieldCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: props.indexAnimDelay }}
      className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
    >
      <button
        onClick={props.onToggleExpand}
        className="w-full text-left p-4 min-h-11"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {summary.roadmapStep != null && (
                <span className="text-[10px] font-[var(--font-mono)] uppercase tracking-wider text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                  Step {summary.roadmapStep}
                </span>
              )}
              {summary.scope === "user" && (
                <span className="text-[10px] uppercase tracking-wider text-mango bg-mango-light px-2 py-0.5 rounded-full">
                  Sariling Upload
                </span>
              )}
              {tpl && (
                <span
                  className={`text-[10px] font-[var(--font-mono)] px-2 py-0.5 rounded-full ${
                    filledCount === total
                      ? "text-success bg-success/10"
                      : "text-mango bg-mango-light"
                  }`}
                >
                  {filledCount}/{total} filled
                </span>
              )}
            </div>
            <h3 className="font-[var(--font-display)] text-sm text-earth-brown leading-snug">
              {summary.label}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{summary.agency}</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border/50">
              {schemaQuery.isLoading && (
                <div className="py-6 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-teal" />
                </div>
              )}
              {schemaQuery.error && (
                <p className="text-xs text-destructive py-3">
                  {schemaQuery.error.message}
                </p>
              )}
              {tpl && (
                <>
                  <p className="text-xs text-muted-foreground mt-3 mb-3">
                    {tpl.description}
                  </p>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <Button
                      onClick={props.onToggleEdit}
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs border-teal/30 text-teal h-11 min-h-11"
                    >
                      {isEditing ? (
                        <>
                          <Eye className="w-3 h-3 mr-1" />Preview Mode
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3 h-3 mr-1" />Edit Fields
                        </>
                      )}
                    </Button>
                    {props.onDelete && (
                      <Button
                        onClick={props.onDelete}
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs text-destructive border-destructive/30 h-11 min-h-11"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />Tanggalin
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {tpl.fieldsSchema.map((f) => {
                      const v = valueOf(f.name);
                      const isEmpty = !v.trim();
                      return (
                        <div key={f.name} className="flex items-start gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              {f.label}
                              {f.required && (
                                <span className="text-destructive">*</span>
                              )}
                              <button
                                type="button"
                                onClick={() => props.onOpenHelp(f.label)}
                                className="ml-auto text-muted-foreground/60 hover:text-teal transition-colors"
                                title={`Tulong sa "${f.label}"`}
                              >
                                <HelpCircle className="w-3 h-3" />
                              </button>
                            </label>
                            {isEditing ? (
                              <input
                                type={f.type === "number" ? "number" : "text"}
                                inputMode={f.type === "number" ? "numeric" : undefined}
                                value={v}
                                maxLength={f.maxLength ?? undefined}
                                onChange={(e) => props.onChangeField(f.name, e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-base focus:outline-none focus:ring-2 focus:ring-teal/40 mt-0.5 min-h-11 font-[var(--font-body)]"
                              />
                            ) : (
                              <p
                                className={`text-sm mt-0.5 ${
                                  isEmpty ? "text-muted-foreground/50 italic" : "text-earth-brown"
                                } font-[var(--font-body)]`}
                              >
                                {isEmpty ? "(walang laman — punan sa Profile)" : v}
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

                  <div className="mt-4 pt-3 border-t border-border/50 flex gap-2 flex-wrap">
                    <Button
                      onClick={() => props.onPreview(fieldsAsValues())}
                      disabled={props.isPreviewing}
                      variant="outline"
                      className="flex-1 rounded-xl border-teal/30 text-teal h-12 min-h-11"
                    >
                      {props.isPreviewing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      Preview
                    </Button>
                    <Button
                      onClick={() => props.onDownload(fieldsAsValues())}
                      disabled={props.isDownloading}
                      className="flex-1 bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] h-12 min-h-11"
                    >
                      {props.isDownloading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Download
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
