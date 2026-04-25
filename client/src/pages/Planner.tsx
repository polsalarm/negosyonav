/*
 * Time-based Task Planner (Feature 06)
 * "Mayroon ka bang 2 oras ngayon?"
 * AI surfaces only the steps completable within the user's available time and day,
 * accounting for office hours.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  CalendarClock,
  Timer,
  Building2,
} from "lucide-react";
// Data is self-contained in STEP_TIME_MAP for the planner

interface TaskSuggestion {
  stepIndex: number;
  stepName: string;
  office: string;
  estimatedTime: string; // e.g., "30 min", "1 hr"
  minutesNeeded: number;
  canDoOnline: boolean;
  officeHours: string;
  isOpenNow: boolean;
  tips: string[];
}

const STEP_TIME_MAP: TaskSuggestion[] = [
  {
    stepIndex: 0,
    stepName: "DTI Business Name Registration",
    office: "DTI BNRS Online / Negosyo Center",
    estimatedTime: "30 min",
    minutesNeeded: 30,
    canDoOnline: true,
    officeHours: "8:00 AM – 5:00 PM, Mon–Fri",
    isOpenNow: false,
    tips: [
      "Online registration is fastest — bnrs.dti.gov.ph",
      "Check name availability first before going to the office",
      "Bring 2 valid IDs if going in person",
    ],
  },
  {
    stepIndex: 1,
    stepName: "Barangay Business Clearance",
    office: "Barangay Hall",
    estimatedTime: "1–2 hrs",
    minutesNeeded: 90,
    canDoOnline: false,
    officeHours: "8:00 AM – 5:00 PM, Mon–Fri",
    isOpenNow: false,
    tips: [
      "Go early morning (8 AM) to avoid long queues",
      "Some barangays require a visit from the Barangay Captain",
      "Bring your DTI certificate — they'll need it",
    ],
  },
  {
    stepIndex: 2,
    stepName: "Community Tax Certificate (Cedula)",
    office: "Manila City Treasurer's Office / Online",
    estimatedTime: "30 min",
    minutesNeeded: 30,
    canDoOnline: true,
    officeHours: "8:00 AM – 5:00 PM, Mon–Fri",
    isOpenNow: false,
    tips: [
      "Can be done online via Manila eCedula portal",
      "Minimum fee is ₱5 + ₱1 per ₱1,000 income",
      "Quick process — usually 15-30 minutes in person",
    ],
  },
  {
    stepIndex: 3,
    stepName: "Mayor's Permit / Business Permit",
    office: "Bureau of Permits, Manila City Hall",
    estimatedTime: "2–4 hrs",
    minutesNeeded: 180,
    canDoOnline: false,
    officeHours: "8:00 AM – 5:00 PM, Mon–Fri",
    isOpenNow: false,
    tips: [
      "Use E-BOSS Lounge at Ground Floor for faster processing",
      "Bring ALL documents — incomplete applications are rejected",
      "January is peak season (renewal) — avoid if possible",
      "Budget a full morning for this step",
    ],
  },
  {
    stepIndex: 4,
    stepName: "BIR Registration",
    office: "Bureau of Internal Revenue (BIR) RDO",
    estimatedTime: "2–3 hrs",
    minutesNeeded: 150,
    canDoOnline: true,
    officeHours: "8:00 AM – 5:00 PM, Mon–Fri",
    isOpenNow: false,
    tips: [
      "New BIR Registration (Form 1901) can be started online",
      "Go to the correct RDO for your business address",
      "Bring your Mayor's Permit — BIR requires it",
      "Ask for ATP (Authority to Print) for receipts",
    ],
  },
];

function isOfficeOpen(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const hour = now.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 17;
}

export default function Planner() {
  const [, navigate] = useLocation();
  const [availableHours, setAvailableHours] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const officeOpen = isOfficeOpen();

  const timeOptions = [
    { label: "30 minuto", value: "0.5", minutes: 30 },
    { label: "1 oras", value: "1", minutes: 60 },
    { label: "2 oras", value: "2", minutes: 120 },
    { label: "Kalahating araw (4 hrs)", value: "4", minutes: 240 },
    { label: "Buong araw (8 hrs)", value: "8", minutes: 480 },
  ];

  const handleTimeSelect = (minutes: number, value: string) => {
    setAvailableHours(minutes);
    setSelectedTime(value);
    setShowResults(true);
  };

  const getDoableTasks = (): TaskSuggestion[] => {
    if (!availableHours) return [];
    let remainingMinutes = availableHours;
    const doable: TaskSuggestion[] = [];

    for (const task of STEP_TIME_MAP) {
      const updatedTask = { ...task, isOpenNow: officeOpen };
      if (task.minutesNeeded <= remainingMinutes) {
        // If office is closed but task can be done online, still suggest it
        if (!officeOpen && !task.canDoOnline) continue;
        doable.push(updatedTask);
        remainingMinutes -= task.minutesNeeded;
      }
    }
    return doable;
  };

  const doableTasks = getDoableTasks();
  const onlineTasks = STEP_TIME_MAP.filter((t) => t.canDoOnline);

  return (
    <div className="min-h-screen bg-warm-cream pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/roadmap")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-[var(--font-display)] text-base text-earth-brown">Task Planner</h1>
              <p className="text-[10px] text-muted-foreground">Anong kaya mong gawin ngayon?</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${officeOpen ? "bg-green-500" : "bg-red-400"}`} />
            <span className="text-[10px] font-[var(--font-mono)] text-muted-foreground">
              {officeOpen ? "Offices Open" : "Offices Closed"}
            </span>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl py-6 space-y-6">
        {/* Time Selection */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-teal" />
            <h2 className="font-[var(--font-display)] text-sm text-earth-brown">
              Gaano katagal ang available mo?
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {timeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleTimeSelect(opt.minutes, opt.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedTime === opt.value
                    ? "bg-teal/10 border-teal text-teal shadow-sm"
                    : "bg-white border-border text-earth-brown hover:border-teal/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  <span className="font-[var(--font-display)] text-xs">{opt.label}</span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Office Status Banner */}
        {!officeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-3"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-800">Sarado na ang mga offices ngayon</p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  Government offices are open Mon–Fri, 8 AM – 5 PM. Pero may mga online tasks na pwede mo gawin kahit ngayon!
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {showResults && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Doable Tasks */}
              {doableTasks.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h3 className="font-[var(--font-display)] text-sm text-earth-brown">
                      Kaya mong gawin ({doableTasks.length} {doableTasks.length === 1 ? "step" : "steps"})
                    </h3>
                  </div>
                  {doableTasks.map((task, i) => (
                    <motion.div
                      key={task.stepIndex}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white rounded-xl border border-border p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-[var(--font-mono)] text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                              STEP {task.stepIndex + 1}
                            </span>
                            {task.canDoOnline && (
                              <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                Online
                              </span>
                            )}
                          </div>
                          <h4 className="font-[var(--font-display)] text-xs text-earth-brown">{task.stepName}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {task.office}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-mango" />
                            <span className="text-[10px] font-[var(--font-mono)] text-mango">{task.estimatedTime}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate("/roadmap")}
                          className="text-teal hover:text-teal/80"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                      {/* Tips */}
                      <div className="mt-3 space-y-1">
                        {task.tips.map((tip, j) => (
                          <p key={j} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                            <span className="text-mango mt-0.5">💡</span> {tip}
                          </p>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-border p-6 text-center">
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {!officeOpen
                      ? "Walang available na in-person tasks ngayon. Subukan ang online tasks sa ibaba!"
                      : "Hindi sapat ang oras para sa kahit isang step. Subukan ang mas mahabang time slot."}
                  </p>
                </div>
              )}

              {/* Online Tasks (always available) */}
              {!officeOpen && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-teal" />
                    <h3 className="font-[var(--font-display)] text-sm text-earth-brown">
                      Online Tasks (24/7)
                    </h3>
                  </div>
                  {onlineTasks.map((task, i) => (
                    <motion.div
                      key={task.stepIndex}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 + 0.3 }}
                      className="bg-teal/5 rounded-xl border border-teal/20 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-[var(--font-mono)] text-teal">STEP {task.stepIndex + 1}</span>
                          <h4 className="font-[var(--font-display)] text-xs text-earth-brown">{task.stepName}</h4>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" /> {task.estimatedTime}
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          Available Now
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Suggested Schedule */}
              <div className="bg-gradient-to-r from-teal/5 to-mango/5 rounded-xl border border-teal/20 p-4">
                <h3 className="font-[var(--font-display)] text-xs text-earth-brown mb-2">
                  💡 Suggested Schedule para Mabilis
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-[var(--font-mono)] text-teal bg-teal/10 px-2 py-0.5 rounded-full shrink-0">Day 1</span>
                    <p className="text-[10px] text-muted-foreground">DTI online registration (30 min) + Cedula online (30 min)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-[var(--font-mono)] text-teal bg-teal/10 px-2 py-0.5 rounded-full shrink-0">Day 2</span>
                    <p className="text-[10px] text-muted-foreground">Barangay Clearance (1-2 hrs, go at 8 AM)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-[var(--font-mono)] text-teal bg-teal/10 px-2 py-0.5 rounded-full shrink-0">Day 3</span>
                    <p className="text-[10px] text-muted-foreground">Mayor's Permit at City Hall (half day, use E-BOSS Lounge)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-[var(--font-mono)] text-teal bg-teal/10 px-2 py-0.5 rounded-full shrink-0">Day 4</span>
                    <p className="text-[10px] text-muted-foreground">BIR Registration at your RDO (2-3 hrs)</p>
                  </div>
                </div>
                <p className="text-[10px] text-teal font-medium mt-3">
                  Total: 4 araw lang kung sunod-sunod! 🎉
                </p>
              </div>

              <Button onClick={() => navigate("/roadmap")} className="w-full bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] py-4">
                Bumalik sa Roadmap
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
