/*
 * NegosyoNav Lakad Roadmap Page — v3 (UI Refresh)
 * Logic, state, and all functions preserved from v2.
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Clock, FileText, ChevronDown, ChevronUp, ExternalLink,
  CheckCircle2, Coins, Award, Lightbulb, Building2, ShieldCheck,
  BadgeCheck, Flag, X, Send, SquareCheck, Square, Star,
  CalendarDays, Navigation,
} from "lucide-react";
import { manilaData, type RegistrationStep } from "@/data/manilaData";
import { StepOfficeCard } from "@/components/StepOfficeCard";
import ChatFab from "@/components/ChatFab";
import { toast } from "sonner";

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString()}`;
}

function StepCard({
  step, index, isCompleted, isActive, isLocked, checkedReqs,
  onToggleReq, onMarkComplete, profile,
}: {
  step: RegistrationStep;
  index: number;
  isCompleted: boolean;
  isActive: boolean;
  isLocked: boolean;
  checkedReqs: Set<string>;
  onToggleReq: (key: string) => void;
  onMarkComplete: () => void;
  profile: { bizBarangay?: string | null } | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const allReqsDone = step.requirements.every((_, i) => checkedReqs.has(`${step.step_number}-${i}`));
  const reqsDoneCount = step.requirements.filter((_, i) => checkedReqs.has(`${step.step_number}-${i}`)).length;

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
        <div className={`w-full h-full transition-colors duration-500 ${isCompleted ? "bg-success" : "bg-border"}`} />
      </div>

      {/* Timeline dot with step number */}
      <div className="absolute left-2.5 top-5 z-10">
        {isCompleted ? (
          <div className="w-6 h-6 rounded-full bg-success/20 border-2 border-success flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          </div>
        ) : isActive ? (
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
            <div className={`w-6 h-6 rounded-full ${color.dot} flex items-center justify-center shadow-sm`}>
              <span className="text-[10px] font-bold text-white font-[var(--font-mono)]">{step.step_number}</span>
            </div>
          </motion.div>
        ) : (
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLocked ? "border-muted-foreground/20 bg-muted/60" : "border-muted-foreground/40 bg-white"}`}>
            <span className={`text-[9px] font-bold font-[var(--font-mono)] ${isLocked ? "text-muted-foreground/30" : "text-muted-foreground/60"}`}>{step.step_number}</span>
          </div>
        )}
      </div>

      {/* Card */}
      <div className={`ml-12 mb-5 ${isLocked && !isCompleted ? "opacity-40 pointer-events-none" : ""}`}>
        <div className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
          isCompleted
            ? "bg-white/70 border-success/20 shadow-sm"
            : isActive
              ? `bg-white ${color.border} shadow-md`
              : "bg-white border-border shadow-sm"
        }`}>

          {/* Status banner */}
          {isActive && !isCompleted && (
            <div className={`${color.bg} px-4 py-1.5 flex items-center gap-2`}>
              <motion.div
                className={`w-1.5 h-1.5 rounded-full ${color.dot}`}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${color.accent}`}>
                Kasalukuyang Hakbang
              </span>
            </div>
          )}
          {isCompleted && (
            <div className="bg-success/10 px-4 py-1.5 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-success" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-success">Tapos Na!</span>
            </div>
          )}

          {/* Card Header */}
          <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className={`text-[10px] font-[var(--font-mono)] font-bold uppercase tracking-wide ${color.accent} ${color.bg} px-2 py-0.5 rounded-full`}>
                    Step {step.step_number}
                  </span>
                  {step.online_url && (
                    <span className="text-[10px] font-[var(--font-mono)] text-teal bg-teal-light px-2 py-0.5 rounded-full">
                      Online ↗
                    </span>
                  )}
                  {!isCompleted && (
                    <span className={`text-[10px] font-[var(--font-mono)] px-2 py-0.5 rounded-full ${
                      allReqsDone ? "text-success bg-success/10" : "text-muted-foreground bg-muted"
                    }`}>
                      {reqsDoneCount}/{step.requirements.length} ready
                    </span>
                  )}
                </div>
                <h3 className={`font-[var(--font-display)] text-sm font-bold leading-snug ${isCompleted ? "text-muted-foreground" : "text-earth-brown"}`}>
                  {step.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{step.agency}</p>
              </div>
              <div className="shrink-0 space-y-1.5 text-right">
                <div className="inline-flex items-center gap-1 bg-mango-light px-2.5 py-1.5 rounded-lg">
                  <Coins className="w-3.5 h-3.5 text-mango" />
                  <span className="font-[var(--font-mono)] text-xs font-bold text-earth-brown">
                    {step.cost.min === step.cost.max
                      ? formatCurrency(step.cost.min)
                      : `${formatCurrency(step.cost.min)}–${formatCurrency(step.cost.max)}`}
                  </span>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground font-[var(--font-mono)]">
                    {step.processing_time_days === 1 ? "1 araw" : `≤${step.processing_time_days} araw`}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 mt-2.5">
              {expanded ? (
                <><ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">I-collapse</span></>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Tingnan ang detalye</span></>
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
                <div className="border-t border-border/50 divide-y divide-border/40">
                  {/* Where to apply */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-teal" />
                      <span className="text-xs font-bold text-earth-brown">Saan Mag-aapply</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-5">{step.where_to_apply}</p>
                    {step.online_url && (
                      <a href={step.online_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal hover:underline mt-1.5 pl-5 font-medium">
                        I-apply Online <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Office card + map */}
                  <div className="px-4 py-4">
                    <StepOfficeCard step={step} profile={profile} />
                  </div>

                  {/* Requirements */}
                  <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-mango" />
                        <span className="text-xs font-bold text-earth-brown">Mga Requirement</span>
                      </div>
                      <span className={`text-[10px] font-bold font-[var(--font-mono)] px-2 py-0.5 rounded-full ${
                        allReqsDone ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                      }`}>
                        {reqsDoneCount}/{step.requirements.length}
                      </span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden mb-3">
                      <motion.div
                        className="h-full bg-gradient-to-r from-teal to-success rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(reqsDoneCount / step.requirements.length) * 100}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <div className="space-y-1">
                      {step.requirements.map((req, i) => {
                        const key = `${step.step_number}-${i}`;
                        const isChecked = checkedReqs.has(key);
                        return (
                          <button
                            key={key}
                            onClick={(e) => { e.stopPropagation(); onToggleReq(key); }}
                            className="flex items-start gap-2.5 text-xs text-left w-full py-2 hover:bg-muted/60 rounded-lg px-2 transition-colors min-h-[40px]"
                          >
                            {isChecked
                              ? <SquareCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
                              : <Square className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                            }
                            <span className={isChecked ? "text-muted-foreground line-through" : "text-foreground"}>
                              {req}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Coins className="w-3.5 h-3.5 text-mango" />
                      <span className="text-xs font-bold text-earth-brown">Breakdown ng Bayad</span>
                    </div>
                    <div className="space-y-2">
                      {step.cost.breakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{item.item}</span>
                          <span className="font-[var(--font-mono)] text-earth-brown font-semibold">
                            {item.amount !== undefined ? (item.amount === 0 ? item.note || "Libre" : formatCurrency(item.amount)) : item.amount_range}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Output & Validity */}
                  <div className="px-4 py-4 flex gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <BadgeCheck className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs font-bold text-earth-brown">Output</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.output_document}</p>
                    </div>
                    {step.validity_years && (
                      <div className="shrink-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal" />
                          <span className="text-xs font-bold text-earth-brown">Valid</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{step.validity_years} taon</p>
                      </div>
                    )}
                  </div>

                  {/* Tips */}
                  {step.tips.length > 0 && (
                    <div className="px-4 py-4">
                      <div className="bg-mango-light rounded-xl p-3.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Lightbulb className="w-3.5 h-3.5 text-mango" />
                          <span className="text-xs font-bold text-earth-brown">Mga Tip</span>
                        </div>
                        <ul className="space-y-1.5">
                          {step.tips.map((tip, i) => (
                            <li key={i} className="text-xs text-earth-brown/80 flex items-start gap-1.5">
                              <span className="text-mango mt-0.5 shrink-0">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Post-registration */}
                  {step.post_registration && (
                    <div className="px-4 py-4">
                      <div className="bg-teal-light rounded-xl p-3.5">
                        <span className="text-xs font-bold text-earth-brown block mb-2">Pagkatapos ng Registration:</span>
                        <ul className="space-y-1.5">
                          {step.post_registration.map((item, i) => (
                            <li key={i} className="text-xs text-earth-brown/80 flex items-start gap-1.5">
                              <span className="text-teal mt-0.5 shrink-0">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Renewal warning */}
                  {step.renewal_deadline && (
                    <div className="px-4 py-4">
                      <div className="bg-jeepney-red/10 rounded-xl p-3.5 border border-jeepney-red/20">
                        <p className="text-xs text-jeepney-red font-medium">
                          ⚠️ Deadline ng renewal: {step.renewal_deadline}. Late penalty: {step.late_penalty}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mark Step Complete CTA */}
                  {!isCompleted && (
                    <div className="px-4 py-4">
                      <Button
                        onClick={(e) => { e.stopPropagation(); onMarkComplete(); }}
                        disabled={!allReqsDone}
                        className={`w-full h-14 rounded-xl font-[var(--font-display)] text-sm ${
                          allReqsDone
                            ? "bg-success hover:bg-success/90 text-white shadow-sm"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        {allReqsDone
                          ? `Tapos na ang Step ${step.step_number}!`
                          : `I-check ang lahat ng ${step.requirements.length} requirement`
                        }
                      </Button>
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

/* ─── Main Roadmap Page ─── */
export default function Roadmap() {
  const [, navigate] = useLocation();
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [checkedReqs, setCheckedReqs] = useState<Set<string>>(new Set());
  const [showGrants, setShowGrants] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"outdated_info" | "incorrect_data" | "suggestion" | "bug_report" | "general">("outdated_info");
  const [feedbackStep, setFeedbackStep] = useState<number | undefined>(undefined);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const feedbackMutation = trpc.feedback.submit.useMutation({
    onSuccess: () => { toast.success("Salamat sa feedback mo! 🙏"); setShowFeedback(false); setFeedbackMessage(""); },
    onError: () => { toast.error("May error sa pag-submit. Subukan ulit."); },
  });

  const toggleReq = (key: string) => {
    setCheckedReqs((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const markStepComplete = (stepNum: number) => {
    const step = manilaData.registration_steps.find(s => s.step_number === stepNum);
    if (!step) return;
    const allDone = step.requirements.every((_, i) => checkedReqs.has(`${stepNum}-${i}`));
    if (!allDone) { toast.error("Complete all requirements first!"); return; }
    setCompletedSteps((prev) => { const next = new Set(prev); next.add(stepNum); return next; });
    toast.success(`Step ${stepNum} complete! 🎉`);
  };

  const progress = (completedSteps.size / manilaData.registration_steps.length) * 100;
  const firstIncomplete = manilaData.registration_steps.find(s => !completedSteps.has(s.step_number));

  const remainingCost = useMemo(() => {
    let min = 0, max = 0;
    manilaData.registration_steps.forEach(s => {
      if (!completedSteps.has(s.step_number)) { min += s.cost.min; max += s.cost.max; }
    });
    return { min, max };
  }, [completedSteps]);

  return (
    <div className="min-h-screen bg-warm-cream pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-xl hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-earth-brown" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-[var(--font-display)] text-sm font-bold text-earth-brown truncate">Lakad Roadmap</h1>
            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">Lungsod ng Maynila • Sole Proprietorship</p>
          </div>
          <div className="text-right shrink-0">
            <span className="font-[var(--font-mono)] text-sm font-bold text-earth-brown">{completedSteps.size}/{manilaData.registration_steps.length}</span>
            <p className="text-[10px] text-muted-foreground">hakbang</p>
          </div>
        </div>
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-teal to-success"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </header>

      {/* Progress Hero */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="container max-w-2xl mt-4">
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {completedSteps.size > 0 ? "Natitirang Gastos" : "Tinatayang Kabuuang Gastos"}
                </p>
                <p className="font-[var(--font-mono)] text-xl font-bold text-earth-brown mt-0.5">
                  {formatCurrency(remainingCost.min)} – {formatCurrency(remainingCost.max)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-mango-light flex items-center justify-center shrink-0">
                <Coins className="w-6 h-6 text-mango" />
              </div>
            </div>

            {/* Step progress track */}
            <div className="flex items-center gap-1.5">
              {manilaData.registration_steps.map((step) => (
                <div key={step.step_number} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`h-2 w-full rounded-full transition-all duration-500 ${
                    completedSteps.has(step.step_number)
                      ? "bg-success"
                      : firstIncomplete?.step_number === step.step_number
                        ? "bg-teal"
                        : "bg-muted"
                  }`} />
                  <span className="text-[9px] font-[var(--font-mono)] text-muted-foreground/50">{step.step_number}</span>
                </div>
              ))}
            </div>

            {completedSteps.size > 0 && (
              <p className="text-[10px] text-success mt-2">
                {completedSteps.size} hakbang na tapos! Original: {formatCurrency(manilaData.total_estimated_cost.min)} – {formatCurrency(manilaData.total_estimated_cost.max)}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Registration Steps */}
      <div className="container max-w-2xl mt-6">
        <h2 className="font-[var(--font-display)] text-base font-bold text-earth-brown mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal" />
          Mga Hakbang sa Registration
        </h2>
        <div className="relative">
          {manilaData.registration_steps.map((step, i) => {
            const prevCompleted = i === 0 || completedSteps.has(manilaData.registration_steps[i - 1].step_number);
            return (
              <StepCard
                key={step.step_number}
                step={step}
                index={i}
                isCompleted={completedSteps.has(step.step_number)}
                isActive={firstIncomplete?.step_number === step.step_number}
                isLocked={!prevCompleted && !completedSteps.has(step.step_number)}
                checkedReqs={checkedReqs}
                onToggleReq={toggleReq}
                onMarkComplete={() => markStepComplete(step.step_number)}
                profile={profile ?? null}
              />
            );
          })}
        </div>
      </div>

      {/* BIR RDO Finder */}
      <div className="container max-w-2xl mt-6">
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
          <h3 className="font-[var(--font-display)] text-sm font-bold text-earth-brown flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-teal" />
            Manila BIR RDO Finder
          </h3>
          <div className="space-y-2">
            {manilaData.bir_rdos.map((rdo) => (
              <div key={rdo.rdo_code} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <span className="font-[var(--font-mono)] text-xs font-bold text-teal bg-teal-light px-2.5 py-1.5 rounded-lg shrink-0">{rdo.rdo_code}</span>
                <div>
                  <p className="text-xs font-semibold text-earth-brown">{rdo.districts.join(", ")}</p>
                  {rdo.address && <p className="text-[10px] text-muted-foreground mt-0.5">{rdo.address}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grants & Programs */}
      <div className="container max-w-2xl mt-6">
        <button onClick={() => setShowGrants(!showGrants)} className="w-full">
          <div className="bg-gradient-to-r from-mango/20 to-mango-light rounded-2xl border border-mango/30 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mango/20 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-mango" />
                </div>
                <div className="text-left">
                  <h3 className="font-[var(--font-display)] text-sm font-bold text-earth-brown">Grants & Support Programs</h3>
                  <p className="text-xs text-muted-foreground">{manilaData.grants_and_programs.length} programs available</p>
                </div>
              </div>
              {showGrants ? <ChevronUp className="w-5 h-5 text-mango" /> : <ChevronDown className="w-5 h-5 text-mango" />}
            </div>
          </div>
        </button>
        <AnimatePresence>
          {showGrants && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="space-y-3 mt-3">
                {manilaData.grants_and_programs.map((grant, i) => (
                  <motion.div key={grant.program_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-white rounded-xl border border-border p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4 text-success" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-[var(--font-display)] text-xs font-bold text-earth-brown">{grant.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{grant.agency}</p>
                        <div className="mt-2 bg-teal-light rounded-lg px-2.5 py-1.5">
                          <p className="text-[10px] font-semibold text-teal">Eligibility: {grant.eligibility_summary}</p>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {grant.benefits.map((b, j) => (
                            <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" />{b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Key Offices */}
      <div className="container max-w-2xl mt-6">
        <h2 className="font-[var(--font-display)] text-base font-bold text-earth-brown mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal" />
          Mahahalagang Opisina
        </h2>
        <div className="space-y-2">
          {manilaData.offices.map((office, i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <h4 className="font-[var(--font-display)] text-xs font-bold text-earth-brown">{office.name}</h4>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-start gap-1.5">
                <MapPin className="w-3 h-3 shrink-0 mt-0.5" />{office.address}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />{office.hours}
                </span>
                {office.contact_phone && (
                  <a href={`tel:${office.contact_phone}`} className="text-[10px] text-teal hover:underline font-medium">
                    {office.contact_phone}
                  </a>
                )}
              </div>
              {office.notes && (
                <p className="text-[10px] text-mango mt-2 bg-mango-light/60 px-2.5 py-1.5 rounded-lg">💡 {office.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rating */}
      {completedSteps.size >= 3 && (
        <div className="container max-w-2xl mt-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-border p-5 shadow-sm text-center">
            <h3 className="font-[var(--font-display)] text-sm font-bold text-earth-brown mb-1">Kumusta ang Lakad Roadmap?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {ratingSubmitted ? "Salamat sa rating mo! Nakakatulong ito." : "I-rate ang guide na ito para makapag-improve kami."}
            </p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  disabled={ratingSubmitted}
                  onClick={() => {
                    setRating(star);
                    setRatingSubmitted(true);
                    feedbackMutation.mutate({ feedbackType: "general", lguId: "manila_city", message: `Roadmap rating: ${star}/5 stars` });
                    toast.success(`Salamat! ${star}/5 ⭐`);
                  }}
                  onMouseEnter={() => !ratingSubmitted && setHoverRating(star)}
                  onMouseLeave={() => !ratingSubmitted && setHoverRating(0)}
                  className="transition-transform hover:scale-110 disabled:cursor-default"
                >
                  <Star className={`w-8 h-8 transition-colors ${star <= (hoverRating || rating) ? "text-mango fill-mango" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Feedback */}
      <div className="container max-w-2xl mt-6">
        <button
          onClick={() => setShowFeedback(true)}
          className="w-full bg-white rounded-2xl border border-border p-4 shadow-sm flex items-center gap-3 hover:border-jeepney-red/30 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-full bg-jeepney-red/10 flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5 text-jeepney-red" />
          </div>
          <div>
            <h3 className="font-[var(--font-display)] text-sm font-bold text-earth-brown">May mali ba? I-report dito</h3>
            <p className="text-xs text-muted-foreground">Outdated info, incorrect data, o suggestions</p>
          </div>
        </button>
      </div>

      {/* Quick Access Cards */}
      <div className="container max-w-2xl mt-6 pb-24">
        <h2 className="font-[var(--font-display)] text-base font-bold text-earth-brown mb-3 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-mango" />
          Higit pang Tools
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { path: "/forms", icon: FileText, iconBg: "bg-teal-light", iconColor: "text-teal", borderHover: "hover:border-teal/30", title: "Auto-fill Forms", desc: "DTI, Barangay, BIR forms" },
            { path: "/grants", icon: Award, iconBg: "bg-mango-light", iconColor: "text-mango", borderHover: "hover:border-mango/30", title: "Grant Matching", desc: "BMBE, DOLE, SB Corp" },
            { path: "/places", icon: Navigation, iconBg: "bg-teal-light", iconColor: "text-teal", borderHover: "hover:border-teal/30", title: "Place Finder", desc: "Opisina, queue tips, maps" },
            { path: "/calendar", icon: CalendarDays, iconBg: "bg-mango-light", iconColor: "text-mango", borderHover: "hover:border-mango/30", title: "Renewal Calendar", desc: "Deadlines & reminders" },
          ].map(({ path, icon: Icon, iconBg, iconColor, borderHover, title, desc }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`bg-white rounded-xl border border-border p-3.5 shadow-sm ${borderHover} hover:shadow-md transition-all text-left group`}
            >
              <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              <h4 className="font-[var(--font-display)] text-xs font-bold text-earth-brown">{title}</h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
            </button>
          ))}
          <button
            onClick={() => navigate("/planner")}
            className="bg-white rounded-xl border border-border p-3.5 shadow-sm hover:border-teal/30 hover:shadow-md transition-all text-left col-span-2 flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-light flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4 text-teal" />
            </div>
            <div>
              <h4 className="font-[var(--font-display)] text-xs font-bold text-earth-brown">Task Planner</h4>
              <p className="text-[10px] text-muted-foreground">"May 2 oras ka ba?" — steps na kaya mo gawin ngayon</p>
            </div>
          </button>
        </div>
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
                <h2 className="font-[var(--font-display)] text-lg font-bold text-earth-brown">Report / Feedback</h2>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="p-2 rounded-xl hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
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
                    className={`text-xs font-semibold px-3 py-2 rounded-full border transition-all min-h-[36px] ${
                      feedbackType === type.value
                        ? "bg-teal/10 text-teal border-teal/30"
                        : "bg-white text-muted-foreground border-border hover:border-teal/30"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              <select
                value={feedbackStep ?? ""}
                onChange={(e) => setFeedbackStep(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 mb-3 min-h-[48px]"
              >
                <option value="">General (walang specific step)</option>
                {manilaData.registration_steps.map((s) => (
                  <option key={s.step_number} value={s.step_number}>Step {s.step_number}: {s.title}</option>
                ))}
              </select>
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Describe the issue or suggestion..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 mb-4 resize-none"
              />
              <Button
                onClick={() => {
                  if (!feedbackMessage.trim()) return;
                  feedbackMutation.mutate({ feedbackType, stepNumber: feedbackStep, lguId: "manila_city", message: feedbackMessage });
                }}
                disabled={!feedbackMessage.trim() || feedbackMutation.isPending}
                className="w-full h-12 bg-teal hover:bg-teal/90 text-white font-[var(--font-display)] rounded-xl"
              >
                <Send className="w-4 h-4 mr-2" />
                {feedbackMutation.isPending ? "Sending..." : "Submit Feedback"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatFab />
    </div>
  );
}
