/*
 * NegosyoNav Lakad Roadmap Page
 * Design: Jeepney Modernism — vertical timeline with progress rail,
 * peso coin cost badges, expandable step cards, and grant matching alerts.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Circle,
  Coins,
  Award,
  Lightbulb,
  Building2,
  ShieldCheck,
  BadgeCheck,
  Users,
  MessageSquareWarning,
  Flag,
  X,
  Send,
  SquareCheck,
  Square,
} from "lucide-react";
import { manilaData, type RegistrationStep } from "@/data/manilaData";
import { toast } from "sonner";

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString()}`;
}

function StepCard({
  step,
  index,
  isCompleted,
  isActive,
  onToggleComplete,
}: {
  step: RegistrationStep;
  index: number;
  isCompleted: boolean;
  isActive: boolean;
  onToggleComplete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const stepColors = [
    { bg: "bg-teal/10", border: "border-teal/30", accent: "text-teal", dot: "bg-teal" },
    { bg: "bg-mango/10", border: "border-mango/30", accent: "text-mango", dot: "bg-mango" },
    { bg: "bg-teal/10", border: "border-teal/30", accent: "text-teal", dot: "bg-teal" },
    { bg: "bg-jeepney-red/10", border: "border-jeepney-red/30", accent: "text-jeepney-red", dot: "bg-jeepney-red" },
    { bg: "bg-teal/10", border: "border-teal/30", accent: "text-teal", dot: "bg-teal" },
  ];
  const color = stepColors[index % stepColors.length];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative"
    >
      {/* Timeline connector */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5">
        <div
          className={`w-full h-full transition-colors duration-500 ${
            isCompleted ? "bg-success" : "bg-border"
          }`}
        />
      </div>

      {/* Timeline dot */}
      <div className="absolute left-3 top-6 z-10">
        <button
          onClick={onToggleComplete}
          className="transition-transform hover:scale-110"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success fill-success/20" />
          ) : isActive ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Circle className={`w-5 h-5 ${color.accent} fill-current`} />
            </motion.div>
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Card */}
      <div className="ml-12 mb-4">
        <div
          className={`rounded-xl border ${color.border} ${
            isCompleted ? "opacity-60" : ""
          } bg-white shadow-sm overflow-hidden transition-all`}
        >
          {/* Card Header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-[var(--font-mono)] font-semibold uppercase tracking-wider ${color.accent} ${color.bg} px-2 py-0.5 rounded-full`}
                  >
                    Step {step.step_number}
                  </span>
                  {step.online_url && (
                    <span className="text-[10px] font-[var(--font-mono)] text-teal bg-teal-light px-2 py-0.5 rounded-full">
                      Online Available
                    </span>
                  )}
                </div>
                <h3 className="font-[var(--font-display)] text-sm text-earth-brown leading-snug">
                  {step.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-[var(--font-body)]">
                  {step.agency}
                </p>
              </div>

              {/* Cost badge */}
              <div className="shrink-0 text-right">
                <div className="inline-flex items-center gap-1 bg-mango-light text-earth-brown px-2.5 py-1.5 rounded-xl">
                  <Coins className="w-3.5 h-3.5 text-mango" />
                  <span className="font-[var(--font-mono)] text-xs font-semibold">
                    {step.cost.min === step.cost.max
                      ? formatCurrency(step.cost.min)
                      : `${formatCurrency(step.cost.min)}–${formatCurrency(step.cost.max)}`}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 justify-end">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
                    {step.processing_time_days === 1
                      ? "1 day"
                      : `1–${step.processing_time_days} days`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center mt-2">
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* Expanded Content */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-4 border-t border-border/50">
                  {/* Where to apply */}
                  <div className="pt-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal" />
                      <span className="text-xs font-semibold text-earth-brown">
                        Where to Apply
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                      {step.where_to_apply}
                    </p>
                    {step.online_url && (
                      <a
                        href={step.online_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal hover:underline mt-1 pl-5"
                      >
                        Apply Online <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Requirements */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-mango" />
                      <span className="text-xs font-semibold text-earth-brown">
                        Requirements
                      </span>
                    </div>
                    <ul className="space-y-1 pl-5">
                      {step.requirements.map((req, i) => (
                        <li
                          key={i}
                          className="text-xs text-muted-foreground flex items-start gap-1.5"
                        >
                          <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cost Breakdown */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Coins className="w-3.5 h-3.5 text-mango" />
                      <span className="text-xs font-semibold text-earth-brown">
                        Fee Breakdown
                      </span>
                    </div>
                    <div className="pl-5 space-y-1">
                      {step.cost.breakdown.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-muted-foreground">{item.item}</span>
                          <span className="font-[var(--font-mono)] text-earth-brown font-medium">
                            {item.amount !== undefined
                              ? item.amount === 0
                                ? item.note || "Free"
                                : formatCurrency(item.amount)
                              : item.amount_range}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Output & Validity */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <BadgeCheck className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs font-semibold text-earth-brown">
                          Output
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-5">
                        {step.output_document}
                      </p>
                    </div>
                    {step.validity_years && (
                      <div className="shrink-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal" />
                          <span className="text-xs font-semibold text-earth-brown">
                            Valid
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-5">
                          {step.validity_years} year{step.validity_years > 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tips */}
                  {step.tips.length > 0 && (
                    <div className="bg-mango-light/50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-mango" />
                        <span className="text-xs font-semibold text-earth-brown">
                          Tips
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {step.tips.map((tip, i) => (
                          <li
                            key={i}
                            className="text-xs text-earth-brown/80 flex items-start gap-1.5"
                          >
                            <span className="text-mango mt-0.5">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Post-registration */}
                  {step.post_registration && (
                    <div className="bg-teal-light/50 rounded-lg p-3">
                      <span className="text-xs font-semibold text-earth-brown block mb-1">
                        After Registration:
                      </span>
                      <ul className="space-y-1">
                        {step.post_registration.map((item, i) => (
                          <li
                            key={i}
                            className="text-xs text-earth-brown/80 flex items-start gap-1.5"
                          >
                            <span className="text-teal mt-0.5">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Renewal warning */}
                  {step.renewal_deadline && (
                    <div className="bg-jeepney-red/10 rounded-lg p-3 border border-jeepney-red/20">
                      <p className="text-xs text-jeepney-red font-medium">
                        ⚠️ Renewal deadline: {step.renewal_deadline}. Late penalty:{" "}
                        {step.late_penalty}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export default function Roadmap() {
  const [, navigate] = useLocation();
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showGrants, setShowGrants] = useState(false);
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"outdated_info" | "incorrect_data" | "suggestion" | "bug_report" | "general">("outdated_info");
  const [feedbackStep, setFeedbackStep] = useState<number | undefined>(undefined);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const feedbackMutation = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success("Salamat sa feedback mo! 🙏");
      setShowFeedback(false);
      setFeedbackMessage("");
    },
    onError: () => {
      toast.error("May error sa pag-submit. Subukan ulit.");
    },
  });

  const totalDocs = manilaData.registration_steps.reduce((sum, s) => sum + s.requirements.length, 0);

  const handleSubmitFeedback = () => {
    if (!feedbackMessage.trim()) return;
    feedbackMutation.mutate({
      feedbackType,
      stepNumber: feedbackStep,
      lguId: "manila_city",
      message: feedbackMessage,
    });
  };

  const toggleComplete = (stepNum: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  };

  const progress = (completedSteps.size / manilaData.registration_steps.length) * 100;
  const firstIncomplete = manilaData.registration_steps.find(
    (s) => !completedSteps.has(s.step_number)
  );

  return (
    <div className="min-h-screen bg-warm-cream pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button
            onClick={() => navigate("/")}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-earth-brown" />
          </button>
          <div className="flex-1">
            <h1 className="font-[var(--font-display)] text-sm text-earth-brown">
              Lakad Roadmap
            </h1>
            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
              City of Manila • Sole Proprietorship
            </p>
          </div>
          <div className="text-right">
            <span className="font-[var(--font-mono)] text-xs font-semibold text-earth-brown">
              {completedSteps.size}/{manilaData.registration_steps.length}
            </span>
            <span className="text-[10px] text-muted-foreground block">steps done</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-teal to-success"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </header>

      {/* Total Cost Summary */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="container max-w-2xl mt-4"
      >
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-[var(--font-body)]">
                Estimated Total Cost
              </p>
              <p className="font-[var(--font-mono)] text-xl font-bold text-earth-brown mt-0.5">
                {formatCurrency(manilaData.total_estimated_cost.min)} –{" "}
                {formatCurrency(manilaData.total_estimated_cost.max)}
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-mango-light flex items-center justify-center">
              <Coins className="w-7 h-7 text-mango" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-[var(--font-body)]">
            Range for a micro-enterprise sole proprietorship. BMBE-registered businesses may
            qualify for significant reductions.
          </p>
        </div>
      </motion.div>

      {/* Registration Steps Timeline */}
      <div className="container max-w-2xl mt-6">
        <h2 className="font-[var(--font-display)] text-base text-earth-brown mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal" />
          Registration Steps
        </h2>

        <div className="relative">
          {manilaData.registration_steps.map((step, i) => (
            <StepCard
              key={step.step_number}
              step={step}
              index={i}
              isCompleted={completedSteps.has(step.step_number)}
              isActive={firstIncomplete?.step_number === step.step_number}
              onToggleComplete={() => toggleComplete(step.step_number)}
            />
          ))}
        </div>
      </div>

      {/* BIR RDO Finder */}
      <div className="container max-w-2xl mt-6">
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="font-[var(--font-display)] text-sm text-earth-brown flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-teal" />
            Manila BIR RDO Finder
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Your assigned BIR Revenue District Office depends on your business district:
          </p>
          <div className="space-y-2">
            {manilaData.bir_rdos.map((rdo) => (
              <div
                key={rdo.rdo_code}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className="font-[var(--font-mono)] text-xs font-semibold text-teal bg-teal-light px-2 py-1 rounded-md shrink-0">
                  {rdo.rdo_code}
                </span>
                <div>
                  <p className="text-xs font-medium text-earth-brown">
                    {rdo.districts.join(", ")}
                  </p>
                  {rdo.address && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {rdo.address}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grants & Programs */}
      <div className="container max-w-2xl mt-6">
        <button
          onClick={() => setShowGrants(!showGrants)}
          className="w-full"
        >
          <div className="bg-gradient-to-r from-mango/20 to-mango-light rounded-2xl border border-mango/30 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mango/20 flex items-center justify-center">
                  <Award className="w-5 h-5 text-mango" />
                </div>
                <div className="text-left">
                  <h3 className="font-[var(--font-display)] text-sm text-earth-brown">
                    Grants & Support Programs
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {manilaData.grants_and_programs.length} programs available for you
                  </p>
                </div>
              </div>
              {showGrants ? (
                <ChevronUp className="w-5 h-5 text-mango" />
              ) : (
                <ChevronDown className="w-5 h-5 text-mango" />
              )}
            </div>
          </div>
        </button>

        <AnimatePresence>
          {showGrants && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 mt-3">
                {manilaData.grants_and_programs.map((grant, i) => (
                  <motion.div
                    key={grant.program_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white rounded-xl border border-border p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4 text-success" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-[var(--font-display)] text-xs text-earth-brown">
                          {grant.name}
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {grant.agency}
                        </p>
                        <div className="mt-2 bg-teal-light/50 rounded-lg px-2.5 py-1.5">
                          <p className="text-[10px] font-medium text-teal">
                            Eligibility: {grant.eligibility_summary}
                          </p>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {grant.benefits.map((benefit, j) => (
                            <li
                              key={j}
                              className="text-xs text-muted-foreground flex items-start gap-1.5"
                            >
                              <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          📍 {grant.where_to_apply}
                          {grant.cost && ` • ${grant.cost}`}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Government Offices */}
      <div className="container max-w-2xl mt-6">
        <h2 className="font-[var(--font-display)] text-base text-earth-brown mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal" />
          Key Offices
        </h2>
        <div className="space-y-2">
          {manilaData.offices.map((office, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-border p-3.5 shadow-sm"
            >
              <h4 className="font-[var(--font-display)] text-xs text-earth-brown">
                {office.name}
              </h4>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-start gap-1">
                <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                {office.address}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {office.hours}
                </span>
                {office.contact_phone && (
                  <a
                    href={`tel:${office.contact_phone}`}
                    className="text-[10px] text-teal hover:underline"
                  >
                    {office.contact_phone}
                  </a>
                )}
              </div>
              {office.notes && (
                <p className="text-[10px] text-mango mt-1.5 bg-mango-light/50 px-2 py-1 rounded-md">
                  💡 {office.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Document Checklist */}
      <div className="container max-w-2xl mt-6">
        <h2 className="font-[var(--font-display)] text-base text-earth-brown mb-3 flex items-center gap-2">
          <SquareCheck className="w-5 h-5 text-teal" />
          Document Checklist
        </h2>
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-3">
            I-check ang mga documents na meron ka na. Auto-calculate ang remaining costs.
          </p>
          {manilaData.registration_steps.map((step) => (
            <div key={step.step_number} className="mb-3 last:mb-0">
              <p className="text-xs font-semibold text-earth-brown mb-1.5">
                Step {step.step_number}: {step.title}
              </p>
              <div className="space-y-1 pl-2">
                {step.requirements.map((req, i) => {
                  const key = `${step.step_number}-${i}`;
                  const isChecked = checkedDocs.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setCheckedDocs((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                      }}
                      className="flex items-center gap-2 text-xs text-left w-full py-1 hover:bg-muted/50 rounded px-1 transition-colors"
                    >
                      {isChecked ? (
                        <SquareCheck className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={isChecked ? "text-muted-foreground line-through" : "text-foreground"}>
                        {req}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-teal">{checkedDocs.size}</span> of{" "}
              {totalDocs} documents ready
            </p>
          </div>
        </div>
      </div>

      {/* Feedback / Report Section */}
      <div className="container max-w-2xl mt-6">
        <button
          onClick={() => setShowFeedback(true)}
          className="w-full bg-white rounded-2xl border border-border p-4 shadow-sm flex items-center gap-3 hover:border-teal/30 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-full bg-jeepney-red/10 flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5 text-jeepney-red" />
          </div>
          <div>
            <h3 className="font-[var(--font-display)] text-sm text-earth-brown">
              May mali ba? I-report dito
            </h3>
            <p className="text-xs text-muted-foreground">
              Outdated info, incorrect data, o suggestions — tulungan mo kami mag-improve!
            </p>
          </div>
        </button>
      </div>

      {/* Back to Chat + Hub */}
      <div className="container max-w-2xl mt-8 flex justify-center gap-3 pb-8">
        <Button
          onClick={() => navigate("/")}
          variant="outline"
          className="rounded-xl border-teal/30 text-teal hover:bg-teal-light"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Chat
        </Button>
        <Button
          onClick={() => navigate("/hub")}
          variant="outline"
          className="rounded-xl border-mango/30 text-earth-brown hover:bg-mango-light"
        >
          <Users className="w-4 h-4 mr-2" />
          Negosyante Hub
        </Button>
      </div>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
            onClick={() => setShowFeedback(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-[var(--font-display)] text-lg text-earth-brown">
                  Report / Feedback
                </h2>
                <button onClick={() => setShowFeedback(false)}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Feedback Type */}
              <div className="flex flex-wrap gap-2 mb-4">
                {([
                  { value: "outdated_info", label: "Outdated Info" },
                  { value: "incorrect_data", label: "Incorrect Data" },
                  { value: "suggestion", label: "Suggestion" },
                  { value: "general", label: "General" },
                ] as const).map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setFeedbackType(type.value)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                      feedbackType === type.value
                        ? "bg-teal/10 text-teal border-teal/30 ring-2 ring-offset-1 ring-teal/20"
                        : "bg-white text-muted-foreground border-border"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Step selector */}
              <select
                value={feedbackStep ?? ""}
                onChange={(e) => setFeedbackStep(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 mb-3 font-[var(--font-body)]"
              >
                <option value="">General (walang specific step)</option>
                {manilaData.registration_steps.map((s) => (
                  <option key={s.step_number} value={s.step_number}>
                    Step {s.step_number}: {s.title}
                  </option>
                ))}
              </select>

              {/* Message */}
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Describe the issue or suggestion..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 mb-4 resize-none font-[var(--font-body)]"
              />

              <Button
                onClick={handleSubmitFeedback}
                disabled={!feedbackMessage.trim() || feedbackMutation.isPending}
                className="w-full bg-teal hover:bg-teal/90 text-white font-[var(--font-display)] py-3 rounded-xl"
              >
                <Send className="w-4 h-4 mr-2" />
                {feedbackMutation.isPending ? "Sending..." : "Submit Feedback"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
