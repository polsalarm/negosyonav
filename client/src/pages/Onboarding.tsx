/*
 * NegosyoNav — Onboarding Wizard
 * Auto-fires for first-time users. Captures 6 required profile fields one at a
 * time, then offers an optional grouped polish step. Each step persists to the
 * server so users can resume on any device.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2, MapPin, Phone,
  Sparkles, Store, User, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type CoreFields = {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  businessName: string;
  businessType: "sole_proprietorship" | "partnership" | "corporation";
  bizBarangay: string;
};

type PolishFields = {
  middleName: string;
  suffix: string;
  dateOfBirth: string;
  civilStatus: "single" | "married" | "widowed" | "legally_separated";
  citizenship: string;
  tin: string;
  emailAddress: string;
  homeBuilding: string;
  homeStreet: string;
  homeBarangay: string;
  homeCity: string;
  homeProvince: string;
  homeZipCode: string;
  businessActivity: string;
  bizBuilding: string;
  bizStreet: string;
  bizCity: string;
  bizProvince: string;
  bizZipCode: string;
  territorialScope: "barangay" | "city" | "regional" | "national";
  capitalization: string;
  expectedAnnualSales: "" | "micro" | "small" | "medium";
  numberOfEmployees: string;
  preferTaxOption: "graduated" | "eight_percent";
};

type WizardData = CoreFields & PolishFields;

const DEFAULTS: WizardData = {
  firstName: "", lastName: "", mobileNumber: "",
  businessName: "", businessType: "sole_proprietorship", bizBarangay: "",
  middleName: "", suffix: "", dateOfBirth: "", civilStatus: "single",
  citizenship: "Filipino", tin: "", emailAddress: "",
  homeBuilding: "", homeStreet: "", homeBarangay: "",
  homeCity: "Manila", homeProvince: "Metro Manila", homeZipCode: "",
  businessActivity: "",
  bizBuilding: "", bizStreet: "", bizCity: "Manila",
  bizProvince: "Metro Manila", bizZipCode: "",
  territorialScope: "city", capitalization: "",
  expectedAnnualSales: "", numberOfEmployees: "0",
  preferTaxOption: "graduated",
};

const TOTAL_REQUIRED = 6;

function deriveStepFromProfile(d: WizardData): number {
  if (!d.firstName) return 1;
  if (!d.lastName) return 2;
  if (!d.mobileNumber) return 3;
  if (!d.businessName) return 4;
  if (!d.businessType) return 5;
  if (!d.bizBarangay) return 6;
  return 7;
}

function normalizeMobile(v: string): string {
  return v.replace(/\D/g, "");
}

export default function Onboarding() {
  const [, navigate] = useLocation();
  const reduce = useReducedMotion();

  const meQuery = trpc.auth.me.useQuery();
  const profileQuery = trpc.profile.get.useQuery();
  const utils = trpc.useUtils();

  const saveProfile = trpc.profile.save.useMutation();
  const setStep = trpc.auth.setOnboardingStep.useMutation();
  const completeOnboarding = trpc.auth.completeOnboarding.useMutation();

  const [data, setData] = useState<WizardData>(DEFAULTS);
  const [step, setStepState] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);
  const [resumeBanner, setResumeBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingFlash, setSavingFlash] = useState(false);
  const initial = useRef(true);

  // Hydrate from server once both queries land.
  useEffect(() => {
    if (hydrated) return;
    if (meQuery.isLoading || profileQuery.isLoading) return;
    if (!meQuery.data) return;
    const p = profileQuery.data;
    if (p) {
      setData(prev => ({
        ...prev,
        firstName: p.firstName ?? prev.firstName,
        lastName: p.lastName ?? prev.lastName,
        mobileNumber: p.mobileNumber ?? prev.mobileNumber,
        businessName: p.businessName ?? prev.businessName,
        businessType: (p.businessType as CoreFields["businessType"]) ?? prev.businessType,
        bizBarangay: p.bizBarangay ?? prev.bizBarangay,
        middleName: p.middleName ?? prev.middleName,
        suffix: p.suffix ?? prev.suffix,
        dateOfBirth: p.dateOfBirth ?? prev.dateOfBirth,
        civilStatus: (p.civilStatus as PolishFields["civilStatus"]) ?? prev.civilStatus,
        citizenship: p.citizenship ?? prev.citizenship,
        tin: p.tin ?? prev.tin,
        emailAddress: p.emailAddress ?? prev.emailAddress,
        homeBuilding: p.homeBuilding ?? prev.homeBuilding,
        homeStreet: p.homeStreet ?? prev.homeStreet,
        homeBarangay: p.homeBarangay ?? prev.homeBarangay,
        homeCity: p.homeCity ?? prev.homeCity,
        homeProvince: p.homeProvince ?? prev.homeProvince,
        homeZipCode: p.homeZipCode ?? prev.homeZipCode,
        businessActivity: p.businessActivity ?? prev.businessActivity,
        bizBuilding: p.bizBuilding ?? prev.bizBuilding,
        bizStreet: p.bizStreet ?? prev.bizStreet,
        bizCity: p.bizCity ?? prev.bizCity,
        bizProvince: p.bizProvince ?? prev.bizProvince,
        bizZipCode: p.bizZipCode ?? prev.bizZipCode,
        territorialScope: (p.territorialScope as PolishFields["territorialScope"]) ?? prev.territorialScope,
        capitalization: p.capitalization != null ? String(p.capitalization) : prev.capitalization,
        expectedAnnualSales:
          (p.expectedAnnualSales as PolishFields["expectedAnnualSales"]) ?? prev.expectedAnnualSales,
        numberOfEmployees: p.numberOfEmployees != null ? String(p.numberOfEmployees) : prev.numberOfEmployees,
        preferTaxOption: (p.preferTaxOption as PolishFields["preferTaxOption"]) ?? prev.preferTaxOption,
      }));
    }
    const serverStep = meQuery.data.onboardingStep ?? 0;
    const merged: WizardData = {
      ...DEFAULTS,
      firstName: p?.firstName ?? "",
      lastName: p?.lastName ?? "",
      mobileNumber: p?.mobileNumber ?? "",
      businessName: p?.businessName ?? "",
      businessType: (p?.businessType as CoreFields["businessType"]) ?? "sole_proprietorship",
      bizBarangay: p?.bizBarangay ?? "",
    } as WizardData;
    const heuristic = deriveStepFromProfile(merged);
    const startAt = Math.max(serverStep, heuristic > 0 ? heuristic : 0);
    setStepState(startAt);
    if (startAt > 0 && startAt < 7) {
      setResumeBanner(true);
      setTimeout(() => setResumeBanner(false), 3000);
    }
    setHydrated(true);
    initial.current = false;
  }, [hydrated, meQuery.isLoading, profileQuery.isLoading, meQuery.data, profileQuery.data]);

  const update = <K extends keyof WizardData>(k: K, v: WizardData[K]) => {
    setData(prev => ({ ...prev, [k]: v }));
    if (error) setError(null);
  };

  const advanceTo = async (next: number, payload: Record<string, unknown>) => {
    setSavingFlash(false);
    try {
      await saveProfile.mutateAsync(payload);
      setSavingFlash(true);
      setTimeout(() => setSavingFlash(false), 200);
      setStep.mutate({ step: next });
      utils.profile.get.invalidate();
      setStepState(next);
    } catch {
      toast.error("Hindi na-save. Try ulit.");
    }
  };

  const finish = async () => {
    const payload = polishPayload(data);
    try {
      if (Object.keys(payload).length > 0) {
        await saveProfile.mutateAsync(payload);
      }
      await completeOnboarding.mutateAsync();
      utils.auth.me.invalidate();
      utils.profile.get.invalidate();
      try { navigator.vibrate?.(20); } catch { /* noop */ }
      setStepState(8);
    } catch {
      toast.error("Hindi natapos. Try ulit.");
    }
  };

  const goNext = async () => {
    if (step === 0) {
      setStepState(1);
      setStep.mutate({ step: 1 });
      return;
    }
    if (step === 1) {
      const v = data.firstName.trim();
      if (!v) return setError("First name required.");
      await advanceTo(2, { firstName: v });
      return;
    }
    if (step === 2) {
      const v = data.lastName.trim();
      if (!v) return setError("Last name required.");
      await advanceTo(3, { lastName: v });
      return;
    }
    if (step === 3) {
      const v = normalizeMobile(data.mobileNumber);
      if (!/^09\d{9}$/.test(v)) return setError("Format: 09XXXXXXXXX (11 digits).");
      await advanceTo(4, { mobileNumber: v });
      return;
    }
    if (step === 4) {
      const v = data.businessName.trim();
      if (!v) return setError("Business name required.");
      await advanceTo(5, { businessName: v });
      return;
    }
    if (step === 5) {
      await advanceTo(6, { businessType: data.businessType });
      return;
    }
    if (step === 6) {
      const v = data.bizBarangay.trim();
      if (!v) return setError("Barangay required.");
      await advanceTo(7, { bizBarangay: v });
      return;
    }
    if (step === 7) {
      await finish();
      return;
    }
  };

  const goBack = () => {
    if (step <= 0) return;
    setError(null);
    setStepState(step - 1);
  };

  const skipPolish = async () => {
    try {
      await completeOnboarding.mutateAsync();
      utils.auth.me.invalidate();
      try { navigator.vibrate?.(20); } catch { /* noop */ }
      setStepState(8);
    } catch {
      toast.error("Hindi natapos. Try ulit.");
    }
  };

  const isLoading = meQuery.isLoading || profileQuery.isLoading || !hydrated;
  const pending = saveProfile.isPending || completeOnboarding.isPending;

  useEffect(() => {
    if (step === 7 || step === 8) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t && t.tagName === "TEXTAREA") return;
      if (pending) return;
      e.preventDefault();
      goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pending, data]);

  const progress = useMemo(() => {
    if (step <= 0) return 0;
    if (step >= 7) return 100;
    return ((step - 1) / TOTAL_REQUIRED) * 100;
  }, [step]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-warm-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-warm-cream flex flex-col">
      {/* Top bar: progress + counter */}
      {step > 0 && step < 8 && (
        <div className="px-6 pt-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-mango rounded-full"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <span className="font-[var(--font-mono)] text-[10px] text-muted-foreground tabular-nums">
              {step <= 6 ? `Step ${step} of ${TOTAL_REQUIRED}` : "Optional"}
            </span>
          </div>
          <AnimatePresence>
            {resumeBanner && (
              <motion.div
                key="resume-banner"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl bg-teal/10 border border-teal/20 px-3 py-2 text-xs text-earth-brown font-[var(--font-body)] flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal shrink-0" />
                Welcome back! Continuing kung saan ka tumigil.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col px-6 pt-6 pb-32 max-w-screen-sm w-full mx-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: reduce ? 0 : 0.28, ease: "easeOut", delay: reduce ? 0 : 0.06 }}
            className="flex-1 flex flex-col"
          >
            {step === 0 && <WelcomeStep />}
            {step === 1 && (
              <FieldStep
                icon={User}
                title="Anong first name mo?"
                hint="Para sa DTI at BIR forms."
              >
                <Input
                  autoFocus
                  type="text"
                  inputMode="text"
                  autoComplete="given-name"
                  value={data.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  className="h-12 text-base rounded-xl bg-white"
                  placeholder="Juan"
                  aria-invalid={!!error}
                />
              </FieldStep>
            )}
            {step === 2 && (
              <FieldStep icon={User} title="At anong last name?" hint="Apelyido sa government IDs.">
                <Input
                  autoFocus
                  type="text"
                  autoComplete="family-name"
                  value={data.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  className="h-12 text-base rounded-xl bg-white"
                  placeholder="Dela Cruz"
                  aria-invalid={!!error}
                />
              </FieldStep>
            )}
            {step === 3 && (
              <FieldStep
                icon={Phone}
                title="Mobile number?"
                hint="Para sa SMS confirmations ng government agencies."
              >
                <Input
                  autoFocus
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={data.mobileNumber}
                  onChange={(e) => update("mobileNumber", e.target.value)}
                  className="h-12 text-base rounded-xl bg-white tracking-wide"
                  placeholder="09XX XXX XXXX"
                  aria-invalid={!!error}
                />
              </FieldStep>
            )}
            {step === 4 && (
              <FieldStep
                icon={Store}
                title="Anong pangalan ng business?"
                hint="Pwedeng palitan later — placeholder muna ok."
              >
                <Input
                  autoFocus
                  type="text"
                  value={data.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                  className="h-12 text-base rounded-xl bg-white"
                  placeholder="Juan's Sari-Sari Store"
                  aria-invalid={!!error}
                />
              </FieldStep>
            )}
            {step === 5 && (
              <FieldStep
                icon={Building2}
                title="Anong klase ng business?"
                hint="Karamihan ng micro-entrepreneurs ay sole proprietorship."
              >
                <div className="flex flex-col gap-3">
                  {(
                    [
                      { v: "sole_proprietorship", label: "Sole Proprietorship", desc: "Ikaw lang ang may-ari" },
                      { v: "partnership", label: "Partnership", desc: "Dalawa o higit pang partners" },
                      { v: "corporation", label: "Corporation", desc: "Registered sa SEC" },
                    ] as const
                  ).map((opt) => {
                    const active = data.businessType === opt.v;
                    return (
                      <motion.button
                        key={opt.v}
                        type="button"
                        whileTap={reduce ? undefined : { scale: 0.97 }}
                        onClick={() => update("businessType", opt.v)}
                        className={`text-left rounded-2xl border bg-white px-4 py-4 min-h-[64px] transition-colors ${
                          active
                            ? "border-teal ring-2 ring-teal/30 bg-teal/5"
                            : "border-border hover:border-teal/40 active:border-teal/40"
                        }`}
                        aria-pressed={active}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-teal text-white" : "bg-muted text-earth-brown"}`}>
                            {opt.v === "partnership" ? <Users className="w-5 h-5" /> : opt.v === "corporation" ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-[var(--font-display)] text-sm text-earth-brown">{opt.label}</div>
                            <div className="font-[var(--font-body)] text-xs text-muted-foreground">{opt.desc}</div>
                          </div>
                          {active && <CheckCircle2 className="w-5 h-5 text-teal shrink-0" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </FieldStep>
            )}
            {step === 6 && (
              <FieldStep
                icon={MapPin}
                title="Saang barangay ang business?"
                hint="Manila City lang muna ang supported."
              >
                <Input
                  autoFocus
                  type="text"
                  value={data.bizBarangay}
                  onChange={(e) => update("bizBarangay", e.target.value)}
                  className="h-12 text-base rounded-xl bg-white"
                  placeholder="Brgy. 123 / Tondo / Sampaloc"
                  aria-invalid={!!error}
                />
              </FieldStep>
            )}
            {step === 7 && <PolishStep data={data} update={update} reduce={!!reduce} />}
            {step === 8 && <DoneStep data={data} reduce={!!reduce} navigate={navigate} />}
            {error && step >= 1 && step <= 6 && (
              <p className="text-xs text-jeepney-red font-[var(--font-body)] mt-2" role="alert">
                {error}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky bottom CTA bar — hidden on Done step */}
      {step !== 8 && (
        <div
          className="fixed bottom-0 inset-x-0 bg-warm-cream/95 backdrop-blur border-t border-border"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        >
          <div className="max-w-screen-sm mx-auto px-6 pt-3 flex items-center gap-3">
            {step > 0 && step !== 7 && (
              <Button
                variant="outline"
                onClick={goBack}
                disabled={pending}
                className="flex-1 min-h-12 rounded-xl font-[var(--font-display)] text-sm border-border text-earth-brown"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            {step === 7 ? (
              <>
                <Button
                  variant="outline"
                  onClick={skipPolish}
                  disabled={pending}
                  className="flex-1 min-h-12 rounded-xl font-[var(--font-display)] text-sm border-border text-earth-brown"
                >
                  Skip rest
                </Button>
                <Button
                  onClick={goNext}
                  disabled={pending}
                  className="flex-1 min-h-12 rounded-xl font-[var(--font-display)] text-sm bg-teal hover:bg-teal/90 text-white"
                >
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & finish"}
                </Button>
              </>
            ) : (
              <Button
                onClick={goNext}
                disabled={pending}
                className="flex-1 min-h-12 rounded-xl font-[var(--font-display)] text-sm bg-teal hover:bg-teal/90 text-white"
              >
                {pending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </span>
                ) : savingFlash ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Saved
                  </span>
                ) : step === 0 ? (
                  <span className="flex items-center gap-2">
                    Start
                    <ArrowRight className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step components ───────────────────────────────────────────────────────────

function WelcomeStep() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center pt-12">
      <div className="w-20 h-20 rounded-3xl bg-mango/20 flex items-center justify-center mb-6">
        <Sparkles className="w-10 h-10 text-mango" />
      </div>
      <h1 className="font-[var(--font-display)] text-3xl text-earth-brown leading-tight">
        Welcome sa<br />NegosyoNav!
      </h1>
      <p className="font-[var(--font-body)] text-sm text-muted-foreground mt-3 max-w-[28ch]">
        I-set up natin ang profile mo in 2 minutes. Auto-fill na lang lahat ng government forms after.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-2 w-full max-w-xs">
        {[
          { icon: User, label: "Personal" },
          { icon: Store, label: "Business" },
          { icon: MapPin, label: "Location" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-border py-3">
            <Icon className="w-5 h-5 text-teal" />
            <span className="font-[var(--font-mono)] text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldStep({
  icon: Icon, title, hint, children,
}: { icon: React.ElementType; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="w-12 h-12 rounded-2xl bg-teal/10 flex items-center justify-center">
        <Icon className="w-6 h-6 text-teal" />
      </div>
      <h2 className="font-[var(--font-display)] text-2xl text-earth-brown leading-tight">{title}</h2>
      {hint && <p className="font-[var(--font-body)] text-sm text-muted-foreground -mt-2">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PolishStep({
  data, update, reduce,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  reduce: boolean;
}) {
  const inputClass = "h-12 text-base rounded-xl bg-white";
  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="w-12 h-12 rounded-2xl bg-mango/15 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-mango" />
      </div>
      <h2 className="font-[var(--font-display)] text-2xl text-earth-brown leading-tight">
        Polish your profile
      </h2>
      <p className="font-[var(--font-body)] text-sm text-muted-foreground -mt-2">
        Optional. Mas kompleto = mas auto-fill ang forms later. Skip for now if you want.
      </p>

      <Section title="Personal extras" defaultOpen reduce={reduce}>
        <Row>
          <Field label="Middle name">
            <Input className={inputClass} value={data.middleName} onChange={(e) => update("middleName", e.target.value)} />
          </Field>
          <Field label="Suffix">
            <Input className={inputClass} value={data.suffix} onChange={(e) => update("suffix", e.target.value)} placeholder="Jr., III" />
          </Field>
        </Row>
        <Row>
          <Field label="Date of birth">
            <Input type="date" className={inputClass} value={data.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
          </Field>
          <Field label="Civil status">
            <select
              className={`${inputClass} border border-border px-3`}
              value={data.civilStatus}
              onChange={(e) => update("civilStatus", e.target.value as PolishFields["civilStatus"])}
            >
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="widowed">Widowed</option>
              <option value="legally_separated">Legally separated</option>
            </select>
          </Field>
        </Row>
        <Field label="TIN (optional)">
          <Input className={inputClass} value={data.tin} onChange={(e) => update("tin", e.target.value)} placeholder="000-000-000-000" />
        </Field>
        <Field label="Email">
          <Input type="email" inputMode="email" autoComplete="email" className={inputClass} value={data.emailAddress} onChange={(e) => update("emailAddress", e.target.value)} placeholder="juan@email.com" />
        </Field>
      </Section>

      <Section title="Home address" reduce={reduce}>
        <Field label="Building / House #">
          <Input className={inputClass} value={data.homeBuilding} onChange={(e) => update("homeBuilding", e.target.value)} />
        </Field>
        <Field label="Street">
          <Input className={inputClass} value={data.homeStreet} onChange={(e) => update("homeStreet", e.target.value)} />
        </Field>
        <Row>
          <Field label="Barangay">
            <Input className={inputClass} value={data.homeBarangay} onChange={(e) => update("homeBarangay", e.target.value)} />
          </Field>
          <Field label="ZIP">
            <Input className={inputClass} inputMode="numeric" value={data.homeZipCode} onChange={(e) => update("homeZipCode", e.target.value)} placeholder="1000" />
          </Field>
        </Row>
        <Row>
          <Field label="City">
            <Input className={inputClass} value={data.homeCity} onChange={(e) => update("homeCity", e.target.value)} />
          </Field>
          <Field label="Province">
            <Input className={inputClass} value={data.homeProvince} onChange={(e) => update("homeProvince", e.target.value)} />
          </Field>
        </Row>
      </Section>

      <Section title="Business details" reduce={reduce}>
        <Field label="Business activity" hint="Hal: Retail Trade, Food Service">
          <Input className={inputClass} value={data.businessActivity} onChange={(e) => update("businessActivity", e.target.value)} />
        </Field>
        <Field label="Business street">
          <Input className={inputClass} value={data.bizStreet} onChange={(e) => update("bizStreet", e.target.value)} />
        </Field>
        <Row>
          <Field label="City">
            <Input className={inputClass} value={data.bizCity} onChange={(e) => update("bizCity", e.target.value)} />
          </Field>
          <Field label="ZIP">
            <Input className={inputClass} inputMode="numeric" value={data.bizZipCode} onChange={(e) => update("bizZipCode", e.target.value)} />
          </Field>
        </Row>
        <Row>
          <Field label="Territorial scope">
            <select
              className={`${inputClass} border border-border px-3`}
              value={data.territorialScope}
              onChange={(e) => update("territorialScope", e.target.value as PolishFields["territorialScope"])}
            >
              <option value="barangay">Barangay (₱200)</option>
              <option value="city">City (₱500)</option>
              <option value="regional">Regional (₱1,000)</option>
              <option value="national">National (₱2,000)</option>
            </select>
          </Field>
          <Field label="Capital (₱)">
            <Input className={inputClass} inputMode="numeric" value={data.capitalization} onChange={(e) => update("capitalization", e.target.value)} placeholder="50,000" />
          </Field>
        </Row>
        <Row>
          <Field label="Annual sales">
            <select
              className={`${inputClass} border border-border px-3`}
              value={data.expectedAnnualSales}
              onChange={(e) => update("expectedAnnualSales", e.target.value as PolishFields["expectedAnnualSales"])}
            >
              <option value="">—</option>
              <option value="micro">Below ₱3M (Micro)</option>
              <option value="small">₱3M – ₱15M (Small)</option>
              <option value="medium">₱15M – ₱100M (Medium)</option>
            </select>
          </Field>
          <Field label="Employees">
            <Input type="number" inputMode="numeric" min={0} className={inputClass} value={data.numberOfEmployees} onChange={(e) => update("numberOfEmployees", e.target.value)} />
          </Field>
        </Row>
      </Section>

      <Section title="Tax preference" reduce={reduce}>
        <Field label="Preferred tax option" hint="8% flat is simpler kung ≤ ₱3M sales.">
          <select
            className={`${inputClass} border border-border px-3`}
            value={data.preferTaxOption}
            onChange={(e) => update("preferTaxOption", e.target.value as PolishFields["preferTaxOption"])}
          >
            <option value="graduated">Graduated income tax rates</option>
            <option value="eight_percent">8% flat tax (gross sales ≤ ₱3M)</option>
          </select>
        </Field>
      </Section>
    </div>
  );
}

function Section({
  title, defaultOpen, reduce, children,
}: { title: string; defaultOpen?: boolean; reduce: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 min-h-12 text-left"
        aria-expanded={open}
      >
        <span className="font-[var(--font-display)] text-sm text-earth-brown">{title}</span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2 }}
          className="text-muted-foreground"
        >
          <ArrowRight className="w-4 h-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 flex flex-col gap-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-earth-brown block mb-1 font-[var(--font-body)]">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function DoneStep({
  data, reduce, navigate,
}: { data: WizardData; reduce: boolean; navigate: (to: string) => void }) {
  useEffect(() => {
    toast.success("Profile saved! Tara, simulan na.");
  }, []);
  const summary: Array<[string, string]> = [
    ["Pangalan", `${data.firstName} ${data.lastName}`.trim()],
    ["Mobile", data.mobileNumber],
    ["Business", data.businessName],
    ["Type", data.businessType.replace(/_/g, " ")],
    ["Barangay", data.bizBarangay],
  ].filter(([, v]) => !!v) as Array<[string, string]>;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center pt-8">
      <motion.div
        initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
        animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 18 }}
        className="w-24 h-24 rounded-full bg-success/15 flex items-center justify-center mb-6"
      >
        <CheckCircle2 className="w-12 h-12 text-success" />
      </motion.div>
      <h1 className="font-[var(--font-display)] text-3xl text-earth-brown leading-tight">Tara, simulan na!</h1>
      <p className="font-[var(--font-body)] text-sm text-muted-foreground mt-2 max-w-[30ch]">
        Saved na ang profile mo. Auto-fill na lang ang forms next time.
      </p>

      <motion.ul
        className="mt-6 w-full max-w-xs flex flex-col gap-2"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.05 } } }}
      >
        {summary.map(([k, v]) => (
          <motion.li
            key={k}
            variants={{
              hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
              show: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
            }}
            className="flex items-center justify-between rounded-xl bg-white border border-border px-3 py-2 text-left"
          >
            <span className="font-[var(--font-mono)] text-[10px] uppercase text-muted-foreground">{k}</span>
            <span className="font-[var(--font-body)] text-xs text-earth-brown truncate max-w-[60%]">{v}</span>
          </motion.li>
        ))}
      </motion.ul>

      <div className="mt-8 flex flex-col gap-2 w-full max-w-xs">
        <Button
          onClick={() => navigate("/roadmap")}
          className="min-h-12 rounded-xl font-[var(--font-display)] text-sm bg-teal hover:bg-teal/90 text-white"
        >
          Tingnan ang Roadmap
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/")}
          className="min-h-12 rounded-xl font-[var(--font-display)] text-sm border-border text-earth-brown"
        >
          Mag-chat muna
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function polishPayload(d: WizardData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const opt = (k: keyof WizardData) => {
    const v = d[k];
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  };
  opt("middleName"); opt("suffix"); opt("dateOfBirth"); opt("civilStatus");
  opt("citizenship"); opt("tin"); opt("emailAddress");
  opt("homeBuilding"); opt("homeStreet"); opt("homeBarangay");
  opt("homeCity"); opt("homeProvince"); opt("homeZipCode");
  opt("businessActivity");
  opt("bizBuilding"); opt("bizStreet"); opt("bizCity");
  opt("bizProvince"); opt("bizZipCode"); opt("territorialScope");
  opt("preferTaxOption");
  if (d.capitalization.trim()) {
    const n = Number(d.capitalization.replace(/,/g, ""));
    if (!Number.isNaN(n)) out.capitalization = n;
  }
  if (d.expectedAnnualSales) out.expectedAnnualSales = d.expectedAnnualSales;
  if (d.numberOfEmployees.trim()) {
    const n = Number(d.numberOfEmployees);
    if (!Number.isNaN(n)) out.numberOfEmployees = n;
  }
  return out;
}
