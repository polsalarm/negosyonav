/*
 * NegosyoNav — Negosyante Profile Page
 * Edit/review existing profile data. New-user first-fill lives in Onboarding.tsx.
 * Single-scroll layout with sticky section nav, autosave draft to localStorage,
 * final CTA persists to Firestore via profile.save.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Building2,
  MapPin,
  FileText,
  Save,
  CheckCircle2,
  Loader2,
  Sparkles,
  MessageCircle,
  LogOut,
  MoreVertical,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface ProfileData {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  civilStatus: "single" | "married" | "widowed" | "legally_separated";
  citizenship: string;
  tin: string;
  philsysId: string;
  mobileNumber: string;
  emailAddress: string;
  homeBuilding: string;
  homeStreet: string;
  homeBarangay: string;
  homeCity: string;
  homeProvince: string;
  homeZipCode: string;
  businessName: string;
  businessNameOption2: string;
  businessNameOption3: string;
  businessType: string;
  businessActivity: string;
  bizBuilding: string;
  bizStreet: string;
  bizBarangay: string;
  bizCity: string;
  bizProvince: string;
  bizZipCode: string;
  territorialScope: "barangay" | "city" | "regional" | "national";
  capitalization: string;
  expectedAnnualSales: string;
  numberOfEmployees: string;
  preferTaxOption: "graduated" | "eight_percent";
}

const emptyProfile: ProfileData = {
  firstName: "", middleName: "", lastName: "", suffix: "",
  dateOfBirth: "", civilStatus: "single", citizenship: "Filipino", tin: "", philsysId: "",
  mobileNumber: "", emailAddress: "",
  homeBuilding: "", homeStreet: "", homeBarangay: "", homeCity: "Manila", homeProvince: "Metro Manila", homeZipCode: "",
  businessName: "", businessNameOption2: "", businessNameOption3: "",
  businessType: "sole_proprietorship", businessActivity: "",
  bizBuilding: "", bizStreet: "", bizBarangay: "", bizCity: "Manila", bizProvince: "Metro Manila", bizZipCode: "",
  territorialScope: "city", capitalization: "", expectedAnnualSales: "", numberOfEmployees: "0",
  preferTaxOption: "graduated",
};

const SUFFIXES = ["", "Jr.", "Sr.", "II", "III", "IV"] as const;

const HOME_ADDRESS_KEYS = [
  "homeBuilding", "homeStreet", "homeBarangay", "homeCity", "homeProvince", "homeZipCode",
] as const satisfies readonly (keyof ProfileData)[];
const BIZ_ADDRESS_KEYS = [
  "bizBuilding", "bizStreet", "bizBarangay", "bizCity", "bizProvince", "bizZipCode",
] as const satisfies readonly (keyof ProfileData)[];

const SECTIONS = [
  { id: "personal", label: "Personal", icon: User, required: ["firstName", "lastName", "mobileNumber"] as const },
  { id: "address", label: "Address", icon: MapPin, required: [] as readonly (keyof ProfileData)[] },
  { id: "business", label: "Business", icon: Building2, required: ["businessName", "bizBarangay"] as const },
  { id: "tax", label: "Tax", icon: FileText, required: [] as readonly (keyof ProfileData)[] },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

function formatTin(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)].filter(Boolean);
  return parts.join("-");
}

function formatPhilsys(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(.{4})(?=.)/g, "$1-");
}

function formatMobileLocal(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

function draftKey(uid: string | null | undefined): string | null {
  return uid ? `negosyonav_profile_draft_${uid}` : null;
}

const inputClass =
  "w-full px-3 py-3 min-h-11 rounded-xl bg-muted border border-border text-base focus:outline-none focus:ring-2 focus:ring-teal/40 font-[var(--font-body)] disabled:opacity-50 disabled:cursor-not-allowed";

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-earth-brown block mb-1">
        {label}
        {required && <span className="text-jeepney-red ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function SectionCard({
  id, title, icon: Icon, children,
}: { id: SectionId; title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section
      id={id}
      data-section={id}
      className="bg-white rounded-2xl border border-border p-5 shadow-sm scroll-mt-32"
    >
      <h3 className="font-[var(--font-display)] text-sm text-earth-brown flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-teal" />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading, logout, user } = useAuth();
  const uid = user?.uid ?? null;

  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [serverSnapshot, setServerSnapshot] = useState<ProfileData | null>(null);
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeSection, setActiveSection] = useState<SectionId>("personal");
  const [bizSameAsHome, setBizSameAsHome] = useState(false);
  const [taxSheetOpen, setTaxSheetOpen] = useState(false);

  const reduceMotion = useReducedMotion();
  const tabTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.6 };
  const sectionTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 28, mass: 0.7 };

  const profileQuery = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const saveMutation = trpc.profile.save.useMutation({
    onSuccess: () => {
      toast.success("Profile saved! 🎉");
      setSaved(true);
      setServerSnapshot(profile);
      const k = draftKey(uid);
      if (k) localStorage.removeItem(k);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast.error("Error saving profile. Try again."),
  });
  const extractMutation = trpc.ai.extractProfile.useMutation({
    onSuccess: (data) => {
      let n = 0;
      const u: Partial<ProfileData> = {};
      const set = <K extends keyof ProfileData>(k: K, v: ProfileData[K] | undefined | null) => {
        if (v != null && v !== "" && !profile[k]) { u[k] = v as ProfileData[K]; n++; }
      };
      set("firstName", data.firstName);
      set("lastName", data.lastName);
      set("middleName", data.middleName);
      set("businessName", data.businessName);
      set("businessType", data.businessType);
      set("businessActivity", data.businessActivity);
      set("bizBarangay", data.bizBarangay);
      set("bizCity", data.bizCity);
      set("mobileNumber", data.mobileNumber);
      set("emailAddress", data.emailAddress);
      if (data.capitalization != null) set("capitalization", String(data.capitalization));
      if (data.numberOfEmployees != null) set("numberOfEmployees", String(data.numberOfEmployees));
      if (n > 0) {
        setProfile((p) => ({ ...p, ...u }));
        toast.success(`Na-extract ang ${n} field${n > 1 ? "s" : ""} mula sa chat! Review and save.`);
      } else {
        toast.info("Walang bagong info na na-extract. Try chatting more details first.");
      }
      setExtracting(false);
    },
    onError: () => { toast.error("Error extracting from chat. Try again."); setExtracting(false); },
  });

  // Hydrate: prefer newer draft over server data.
  useEffect(() => {
    if (!profileQuery.data || hydrated) return;
    const d = profileQuery.data;
    const fromServer: ProfileData = {
      firstName: d.firstName || "",
      middleName: d.middleName || "",
      lastName: d.lastName || "",
      suffix: d.suffix || "",
      dateOfBirth: d.dateOfBirth || "",
      civilStatus: (d.civilStatus as ProfileData["civilStatus"]) || "single",
      citizenship: d.citizenship || "Filipino",
      tin: d.tin || "",
      philsysId: d.philsysId || "",
      mobileNumber: d.mobileNumber || "",
      emailAddress: d.emailAddress || "",
      homeBuilding: d.homeBuilding || "",
      homeStreet: d.homeStreet || "",
      homeBarangay: d.homeBarangay || "",
      homeCity: d.homeCity || "Manila",
      homeProvince: d.homeProvince || "Metro Manila",
      homeZipCode: d.homeZipCode || "",
      businessName: d.businessName || "",
      businessNameOption2: d.businessNameOption2 || "",
      businessNameOption3: d.businessNameOption3 || "",
      businessType: d.businessType || "sole_proprietorship",
      businessActivity: d.businessActivity || "",
      bizBuilding: d.bizBuilding || "",
      bizStreet: d.bizStreet || "",
      bizBarangay: d.bizBarangay || "",
      bizCity: d.bizCity || "Manila",
      bizProvince: d.bizProvince || "Metro Manila",
      bizZipCode: d.bizZipCode || "",
      territorialScope: (d.territorialScope as ProfileData["territorialScope"]) || "city",
      capitalization: d.capitalization?.toString() || "",
      expectedAnnualSales: d.expectedAnnualSales || "",
      numberOfEmployees: d.numberOfEmployees?.toString() || "0",
      preferTaxOption: (d.preferTaxOption as ProfileData["preferTaxOption"]) || "graduated",
    };
    const k = draftKey(uid);
    let next = fromServer;
    if (k) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw) as { data: ProfileData; updatedAt: number };
          if (parsed?.data) {
            // Draft exists = unsaved local edits; final CTA clears it.
            next = { ...fromServer, ...parsed.data };
          }
        }
      } catch {
        // ignore corrupt draft
      }
    }
    setProfile(next);
    setServerSnapshot(fromServer);
    // Reflect "same as home" if biz address mirrors home on hydrate.
    const sameOnLoad = HOME_ADDRESS_KEYS.every((hk, i) => {
      const bk = BIZ_ADDRESS_KEYS[i];
      return (next[hk] || "") === (next[bk] || "") && (next[hk] || "") !== "";
    });
    setBizSameAsHome(sameOnLoad);
    setHydrated(true);
  }, [profileQuery.data, hydrated, uid]);

  // Persist draft on blur via flushDraft.
  const flushDraft = useCallback(
    (snapshot: ProfileData) => {
      const k = draftKey(uid);
      if (!k) return;
      setDraftStatus("saving");
      try {
        localStorage.setItem(k, JSON.stringify({ data: snapshot, updatedAt: Date.now() }));
        setDraftStatus("saved");
      } catch {
        setDraftStatus("idle");
      }
    },
    [uid],
  );

  const update = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const onFieldBlur = () => {
    if (!hydrated) return;
    flushDraft(profile);
  };

  // "Same as home" toggle: copy + lock biz address fields.
  const toggleSameAsHome = (next: boolean) => {
    setBizSameAsHome(next);
    setProfile((prev) => {
      const updated = { ...prev };
      HOME_ADDRESS_KEYS.forEach((hk, i) => {
        const bk = BIZ_ADDRESS_KEYS[i];
        updated[bk] = next ? prev[hk] : "";
      });
      flushDraft(updated);
      return updated;
    });
  };

  // Keep biz mirroring home while toggle is on.
  useEffect(() => {
    if (!bizSameAsHome) return;
    setProfile((prev) => {
      let changed = false;
      const updated = { ...prev };
      HOME_ADDRESS_KEYS.forEach((hk, i) => {
        const bk = BIZ_ADDRESS_KEYS[i];
        if (updated[bk] !== prev[hk]) {
          updated[bk] = prev[hk];
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [
    bizSameAsHome,
    profile.homeBuilding, profile.homeStreet, profile.homeBarangay,
    profile.homeCity, profile.homeProvince, profile.homeZipCode,
  ]);

  const requiredFilled = useMemo(() => {
    const map: Record<SectionId, { filled: number; total: number }> = {
      personal: { filled: 0, total: 0 },
      address: { filled: 0, total: 0 },
      business: { filled: 0, total: 0 },
      tax: { filled: 0, total: 0 },
    };
    SECTIONS.forEach((s) => {
      map[s.id].total = s.required.length;
      map[s.id].filled = s.required.filter((k) => (profile[k as keyof ProfileData] as string)?.trim().length > 0).length;
    });
    return map;
  }, [profile]);

  const isProfileEmpty =
    !profile.firstName && !profile.lastName && !profile.businessName && !profile.mobileNumber;

  const isDirty = useMemo(() => {
    if (!serverSnapshot) return false;
    return JSON.stringify(profile) !== JSON.stringify(serverSnapshot);
  }, [profile, serverSnapshot]);

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleExtract = () => {
    const stored = sessionStorage.getItem("negosyonav_chat_history");
    if (!stored) { toast.error("Wala pang chat history. Mag-chat muna sa Home page."); return; }
    try {
      const msgs = JSON.parse(stored);
      if (!Array.isArray(msgs) || msgs.length < 2) { toast.error("Kulang pa ang chat. Mag-chat pa ng konti."); return; }
      setExtracting(true);
      extractMutation.mutate({ messages: msgs });
    } catch {
      toast.error("Error reading chat history.");
    }
  };

  const handleSave = () => {
    if (!profile.firstName || !profile.lastName) {
      toast.error("First name and last name are required.");
      setActiveSection("personal");
      return;
    }
    saveMutation.mutate({
      firstName: profile.firstName || undefined,
      middleName: profile.middleName || undefined,
      lastName: profile.lastName || undefined,
      suffix: profile.suffix || undefined,
      dateOfBirth: profile.dateOfBirth || undefined,
      civilStatus: profile.civilStatus || undefined,
      citizenship: profile.citizenship || undefined,
      tin: profile.tin || undefined,
      philsysId: profile.philsysId || undefined,
      mobileNumber: profile.mobileNumber || undefined,
      emailAddress: profile.emailAddress || undefined,
      homeBuilding: profile.homeBuilding || undefined,
      homeStreet: profile.homeStreet || undefined,
      homeBarangay: profile.homeBarangay || undefined,
      homeCity: profile.homeCity || undefined,
      homeProvince: profile.homeProvince || undefined,
      homeZipCode: profile.homeZipCode || undefined,
      businessName: profile.businessName || undefined,
      businessNameOption2: profile.businessNameOption2 || undefined,
      businessNameOption3: profile.businessNameOption3 || undefined,
      businessType: profile.businessType || undefined,
      businessActivity: profile.businessActivity || undefined,
      bizBuilding: profile.bizBuilding || undefined,
      bizStreet: profile.bizStreet || undefined,
      bizBarangay: profile.bizBarangay || undefined,
      bizCity: profile.bizCity || undefined,
      bizProvince: profile.bizProvince || undefined,
      bizZipCode: profile.bizZipCode || undefined,
      territorialScope: profile.territorialScope || undefined,
      capitalization: profile.capitalization ? Number(profile.capitalization.replace(/,/g, "")) : undefined,
      expectedAnnualSales: (profile.expectedAnnualSales as "micro" | "small" | "medium" | "large") || undefined,
      numberOfEmployees: profile.numberOfEmployees ? Number(profile.numberOfEmployees) : undefined,
      preferTaxOption: profile.preferTaxOption || undefined,
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-cream pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-2 h-14 px-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-muted active:bg-muted transition-colors flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-earth-brown" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-[var(--font-display)] text-sm text-earth-brown truncate">Negosyante Profile</h1>
            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)] flex items-center gap-1 h-3.5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={draftStatus}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-1"
                >
                  {draftStatus === "saving" ? (
                    <><Loader2 className="w-3 h-3 animate-spin" />Saving…</>
                  ) : draftStatus === "saved" ? (
                    <><CheckCircle2 className="w-3 h-3 text-success" />Saved</>
                  ) : (
                    <>Para sa auto-fill ng government forms</>
                  )}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>

          {/* Auto-Extract icon (returning users with data) */}
          {!isProfileEmpty && (
            <button
              onClick={handleExtract}
              disabled={extracting}
              aria-label="Auto-extract from chat"
              className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-muted active:bg-muted transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {extracting ? (
                <Loader2 className="w-5 h-5 animate-spin text-teal" />
              ) : (
                <Sparkles className="w-5 h-5 text-teal" />
              )}
            </button>
          )}

          {/* 3-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="More options"
                className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-muted active:bg-muted transition-colors flex items-center justify-center"
              >
                <MoreVertical className="w-5 h-5 text-earth-brown" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={handleSignOut} className="text-jeepney-red">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      </header>

      <div className="container max-w-2xl px-4 mt-4 space-y-4">
        {/* Auto-Extract banner — only when profile empty */}
        {isProfileEmpty && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={sectionTransition}
            className="bg-gradient-to-r from-teal/10 to-mango/10 rounded-2xl border border-teal/20 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-teal/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-teal" />
              </div>
              <div className="flex-1">
                <h3 className="font-[var(--font-display)] text-xs text-earth-brown">Auto-Extract from Chat</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Na-chat mo na ba ang business details mo? I-extract namin ang info para hindi mo na kailangan i-type ulit.
                </p>
                <Button
                  onClick={handleExtract}
                  disabled={extracting}
                  size="sm"
                  className="mt-2 bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] text-xs min-h-11"
                >
                  {extracting ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Extracting…</>
                  ) : (
                    <><MessageCircle className="w-3 h-3 mr-1" />Extract from Chat</>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as SectionId)}>
          <TabsList className="sticky top-14 z-40 w-full grid grid-cols-4 h-auto bg-white/95 backdrop-blur border border-border rounded-xl p-1 mb-4 shadow-sm">
            {SECTIONS.map((s) => {
              const r = requiredFilled[s.id];
              const complete = r.total > 0 && r.filled === r.total;
              const incomplete = r.total > 0 && r.filled < r.total;
              const isActive = activeSection === s.id;
              return (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className={
                    "relative min-h-11 rounded-lg text-xs font-[var(--font-display)] flex items-center gap-1.5 transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none " +
                    (isActive ? "text-white" : "text-earth-brown")
                  }
                >
                  {isActive && (
                    <motion.span
                      layoutId="profile-tab-pill"
                      className="absolute inset-0 rounded-lg bg-teal -z-0"
                      transition={tabTransition}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {s.label}
                    <AnimatePresence>
                      {complete && (
                        <motion.span
                          key="ok"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className="w-1.5 h-1.5 rounded-full bg-success"
                          aria-hidden
                        />
                      )}
                      {incomplete && (
                        <motion.span
                          key="missing"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className={
                            "w-1.5 h-1.5 rounded-full " + (isActive ? "bg-white/70" : "bg-jeepney-red/70")
                          }
                          aria-hidden
                        />
                      )}
                    </AnimatePresence>
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="personal" className="mt-0">
            <motion.div
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={sectionTransition}
            >
        {/* Personal */}
        <SectionCard id="personal" title="Personal Information" icon={User}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" required>
              <input
                type="text" value={profile.firstName}
                onChange={(e) => update("firstName", e.target.value)} onBlur={onFieldBlur}
                className={inputClass} placeholder="Juan"
                autoComplete="given-name"
              />
            </Field>
            <Field label="Middle Name">
              <input
                type="text" value={profile.middleName}
                onChange={(e) => update("middleName", e.target.value)} onBlur={onFieldBlur}
                className={inputClass} placeholder="Santos"
                autoComplete="additional-name"
              />
            </Field>
          </div>
          <Field label="Last Name" required>
            <input
              type="text" value={profile.lastName}
              onChange={(e) => update("lastName", e.target.value)} onBlur={onFieldBlur}
              className={inputClass} placeholder="Dela Cruz"
              autoComplete="family-name"
            />
          </Field>
          <Field label="Suffix">
            <select
              value={profile.suffix}
              onChange={(e) => { update("suffix", e.target.value); flushDraft({ ...profile, suffix: e.target.value }); }}
              className={inputClass}
            >
              {SUFFIXES.map((s) => (
                <option key={s} value={s}>{s === "" ? "None" : s}</option>
              ))}
            </select>
          </Field>
          <Field label="Date of Birth">
            <input
              type="date" value={profile.dateOfBirth}
              onChange={(e) => { update("dateOfBirth", e.target.value); flushDraft({ ...profile, dateOfBirth: e.target.value }); }}
              className={inputClass}
              autoComplete="bday"
            />
          </Field>
          <Field label="Civil Status">
            <select
              value={profile.civilStatus}
              onChange={(e) => { update("civilStatus", e.target.value); flushDraft({ ...profile, civilStatus: e.target.value as ProfileData["civilStatus"] }); }}
              className={inputClass}
            >
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="widowed">Widowed</option>
              <option value="legally_separated">Legally Separated</option>
            </select>
          </Field>
          <Field label="Citizenship">
            <input
              type="text" value={profile.citizenship}
              onChange={(e) => update("citizenship", e.target.value)} onBlur={onFieldBlur}
              className={inputClass}
            />
          </Field>
          <Field label="TIN" hint="Leave blank if you don't have one yet">
            <input
              type="text"
              inputMode="numeric"
              value={profile.tin}
              onChange={(e) => update("tin", formatTin(e.target.value))}
              onBlur={onFieldBlur}
              className={inputClass}
              placeholder="000-000-000-00"
            />
          </Field>
          <Field label="PhilSys ID" hint="Optional — pwedeng i-skip kung wala pa">
            <input
              type="text"
              inputMode="numeric"
              value={profile.philsysId}
              onChange={(e) => update("philsysId", formatPhilsys(e.target.value))}
              onBlur={onFieldBlur}
              className={inputClass}
              placeholder="0000-0000-0000-0000"
            />
          </Field>
          <Field label="Mobile Number" required>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-xl bg-muted border border-r-0 border-border text-sm text-muted-foreground font-[var(--font-mono)]">
                +63
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={profile.mobileNumber}
                onChange={(e) => update("mobileNumber", formatMobileLocal(e.target.value))}
                onBlur={onFieldBlur}
                className={inputClass + " rounded-l-none"}
                placeholder="09XX XXX XXXX"
              />
            </div>
          </Field>
          <Field label="Email">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={profile.emailAddress}
              onChange={(e) => update("emailAddress", e.target.value)} onBlur={onFieldBlur}
              className={inputClass}
              placeholder="juan@email.com"
            />
          </Field>
        </SectionCard>

            </motion.div>
          </TabsContent>

          <TabsContent value="address" className="mt-0">
            <motion.div
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={sectionTransition}
            >
        {/* Home Address */}
        <SectionCard id="address" title="Home Address" icon={MapPin}>
          <Field label="Building / House No.">
            <input
              type="text" value={profile.homeBuilding}
              onChange={(e) => update("homeBuilding", e.target.value)} onBlur={onFieldBlur}
              className={inputClass} placeholder="123"
              autoComplete="address-line2"
            />
          </Field>
          <Field label="Street">
            <input
              type="text" value={profile.homeStreet}
              onChange={(e) => update("homeStreet", e.target.value)} onBlur={onFieldBlur}
              className={inputClass} placeholder="Rizal St."
              autoComplete="address-line1"
            />
          </Field>
          <Field label="Barangay">
            <input
              type="text" value={profile.homeBarangay}
              onChange={(e) => update("homeBarangay", e.target.value)} onBlur={onFieldBlur}
              className={inputClass} placeholder="Brgy. 123"
            />
          </Field>
          <Field label="City / Municipality">
            <input
              type="text" value={profile.homeCity}
              onChange={(e) => update("homeCity", e.target.value)} onBlur={onFieldBlur}
              className={inputClass}
              autoComplete="address-level2"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Province">
              <input
                type="text" value={profile.homeProvince}
                onChange={(e) => update("homeProvince", e.target.value)} onBlur={onFieldBlur}
                className={inputClass}
                autoComplete="address-level1"
              />
            </Field>
            <Field label="ZIP Code">
              <input
                type="text" inputMode="numeric"
                value={profile.homeZipCode}
                onChange={(e) => update("homeZipCode", e.target.value.replace(/\D/g, "").slice(0, 4))}
                onBlur={onFieldBlur}
                className={inputClass} placeholder="1000"
                autoComplete="postal-code"
              />
            </Field>
          </div>
        </SectionCard>

            </motion.div>
          </TabsContent>

          <TabsContent value="business" className="mt-0">
            <motion.div
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={sectionTransition}
            >
        {/* Business */}
        <SectionCard id="business" title="Business Information" icon={Building2}>
          <Field label="Proposed Business Name (1st choice)" required hint="Must be unique — check at bnrs.dti.gov.ph">
            <input
              type="text" value={profile.businessName}
              onChange={(e) => update("businessName", e.target.value)} onBlur={onFieldBlur}
              className={inputClass} placeholder="Juan's Sari-Sari Store"
            />
          </Field>
          <Field label="2nd Choice">
            <input
              type="text" value={profile.businessNameOption2}
              onChange={(e) => update("businessNameOption2", e.target.value)} onBlur={onFieldBlur}
              className={inputClass}
            />
          </Field>
          <Field label="3rd Choice">
            <input
              type="text" value={profile.businessNameOption3}
              onChange={(e) => update("businessNameOption3", e.target.value)} onBlur={onFieldBlur}
              className={inputClass}
            />
          </Field>
          <Field label="Business Type">
            <select
              value={profile.businessType}
              onChange={(e) => { update("businessType", e.target.value); flushDraft({ ...profile, businessType: e.target.value }); }}
              className={inputClass}
            >
              <option value="sole_proprietorship">Sole Proprietorship</option>
              <option value="partnership">Partnership</option>
              <option value="corporation">Corporation</option>
            </select>
          </Field>
          <Field label="Business Activity" hint="e.g., Retail Trade, Food Service">
            <input
              type="text" value={profile.businessActivity}
              onChange={(e) => update("businessActivity", e.target.value)} onBlur={onFieldBlur}
              className={inputClass} placeholder="Retail Trade"
            />
          </Field>

          {/* Same as home toggle */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-teal/5 border border-teal/20 cursor-pointer min-h-11">
            <input
              type="checkbox"
              checked={bizSameAsHome}
              onChange={(e) => toggleSameAsHome(e.target.checked)}
              className="w-5 h-5 rounded border-border text-teal focus:ring-teal/40"
            />
            <span className="text-xs font-medium text-earth-brown">
              Pareho sa home address ko
              <span className="block text-[10px] text-muted-foreground font-normal">
                Same as home address
              </span>
            </span>
          </label>

          <Field label="Business Building / Unit">
            <input
              type="text" value={profile.bizBuilding}
              onChange={(e) => update("bizBuilding", e.target.value)} onBlur={onFieldBlur}
              disabled={bizSameAsHome}
              className={inputClass} placeholder="e.g., Unit 4B"
            />
          </Field>
          <Field label="Business Street">
            <input
              type="text" value={profile.bizStreet}
              onChange={(e) => update("bizStreet", e.target.value)} onBlur={onFieldBlur}
              disabled={bizSameAsHome}
              className={inputClass} placeholder="e.g., 123 Rizal St."
            />
          </Field>
          <Field label="Business Barangay" required>
            <input
              type="text" value={profile.bizBarangay}
              onChange={(e) => update("bizBarangay", e.target.value)} onBlur={onFieldBlur}
              disabled={bizSameAsHome}
              className={inputClass}
            />
          </Field>
          <Field label="Business City">
            <input
              type="text" value={profile.bizCity}
              onChange={(e) => update("bizCity", e.target.value)} onBlur={onFieldBlur}
              disabled={bizSameAsHome}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Business Province">
              <input
                type="text" value={profile.bizProvince}
                onChange={(e) => update("bizProvince", e.target.value)} onBlur={onFieldBlur}
                disabled={bizSameAsHome}
                className={inputClass}
              />
            </Field>
            <Field label="Business ZIP">
              <input
                type="text" inputMode="numeric" value={profile.bizZipCode}
                onChange={(e) => update("bizZipCode", e.target.value.replace(/\D/g, "").slice(0, 4))}
                onBlur={onFieldBlur}
                disabled={bizSameAsHome}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Territorial Scope" hint="For DTI registration">
            <select
              value={profile.territorialScope}
              onChange={(e) => { update("territorialScope", e.target.value); flushDraft({ ...profile, territorialScope: e.target.value as ProfileData["territorialScope"] }); }}
              className={inputClass}
            >
              <option value="barangay">Barangay (₱200)</option>
              <option value="city">City/Municipality (₱500)</option>
              <option value="regional">Regional (₱1,000)</option>
              <option value="national">National (₱2,000)</option>
            </select>
          </Field>
          <Field label="Capitalization (₱)" hint="How much pera ang ipupuhunan mo?">
            <input
              type="text" inputMode="numeric"
              value={profile.capitalization}
              onChange={(e) => update("capitalization", e.target.value)} onBlur={onFieldBlur}
              className={inputClass} placeholder="50,000"
            />
          </Field>
          <Field label="Expected Annual Sales" hint="Estimate lang — pwedeng baguhin later">
            <select
              value={profile.expectedAnnualSales}
              onChange={(e) => { update("expectedAnnualSales", e.target.value); flushDraft({ ...profile, expectedAnnualSales: e.target.value }); }}
              className={inputClass}
            >
              <option value="">Select range</option>
              <option value="micro">Below ₱3M (Micro)</option>
              <option value="small">₱3M – ₱15M (Small)</option>
              <option value="medium">₱15M – ₱100M (Medium)</option>
            </select>
          </Field>
          <Field label="Number of Employees">
            <input
              type="number" inputMode="numeric"
              value={profile.numberOfEmployees}
              onChange={(e) => update("numberOfEmployees", e.target.value)} onBlur={onFieldBlur}
              className={inputClass} min={0}
            />
          </Field>
        </SectionCard>

            </motion.div>
          </TabsContent>

          <TabsContent value="tax" className="mt-0">
            <motion.div
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={sectionTransition}
            >
        {/* Tax */}
        <SectionCard id="tax" title="Tax Preference" icon={FileText}>
          <Field
            label="Preferred Tax Option"
            hint="8% flat tax is simpler for micro-entrepreneurs with gross sales ≤ ₱3M"
          >
            <select
              value={profile.preferTaxOption}
              onChange={(e) => { update("preferTaxOption", e.target.value); flushDraft({ ...profile, preferTaxOption: e.target.value as ProfileData["preferTaxOption"] }); }}
              className={inputClass}
            >
              <option value="graduated">Graduated Income Tax Rates</option>
              <option value="eight_percent">8% Flat Tax (if gross sales ≤ ₱3M)</option>
            </select>
          </Field>
          <Sheet open={taxSheetOpen} onOpenChange={setTaxSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-teal underline-offset-2 hover:underline min-h-11"
              >
                <Info className="w-3.5 h-3.5" />
                Learn more — ano'ng pagkakaiba?
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
              <SheetHeader className="text-left">
                <SheetTitle className="font-[var(--font-display)] text-earth-brown">
                  Graduated vs 8% Flat Tax
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Plain Taglish na paliwanag — pumili kung alin ang bagay sa negosyo mo.
                </SheetDescription>
              </SheetHeader>
              <div className="p-4 space-y-4 text-sm text-earth-brown">
                <div>
                  <h4 className="font-[var(--font-display)] text-sm mb-1">Graduated Income Tax</h4>
                  <p className="text-xs text-muted-foreground">
                    Sumusunod sa BIR tax table — mas maliit ang kita, mas maliit ang tax. Pwede mag-deduct ng business expenses (rent, supplies, atbp). Para sa mga gusto mag-itemize.
                  </p>
                </div>
                <div>
                  <h4 className="font-[var(--font-display)] text-sm mb-1">8% Flat Tax</h4>
                  <p className="text-xs text-muted-foreground">
                    Isang rate lang — 8% sa gross sales (minus ₱250,000 na exemption). Walang itemized deductions, pero mas simple sa filing. Para sa mga micro-entrepreneur na malinis lang ang books.
                  </p>
                </div>
                <div className="bg-mango/10 border border-mango/30 rounded-xl p-3 text-xs">
                  <strong className="font-[var(--font-display)]">Tip:</strong> Kung gross sales mo ay below ₱3M at konti lang ang gastusin, 8% Flat ang madalas mas mura. Pwede mong baguhin yan once a year sa BIR.
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </SectionCard>

            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, ...sectionTransition }}
          className="pt-2 pb-6"
        >
          <motion.div
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            animate={saved ? { scale: [1, 1.03, 1] } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !isDirty}
              className="w-full bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] py-4 min-h-11 text-base relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={saveMutation.isPending ? "saving" : saved ? "saved" : !isDirty ? "clean" : "idle"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center justify-center"
                >
                  {saveMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Saving…</>
                  ) : saved ? (
                    <><CheckCircle2 className="w-5 h-5 mr-2" />Saved</>
                  ) : !isDirty ? (
                    <><CheckCircle2 className="w-5 h-5 mr-2" />No changes</>
                  ) : (
                    <><Save className="w-5 h-5 mr-2" />Save Profile</>
                  )}
                </motion.span>
              </AnimatePresence>
            </Button>
          </motion.div>
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            Your data is stored securely and only used for auto-filling government forms.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
