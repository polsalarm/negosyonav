/*
 * NegosyoNav — Negosyante Profile Page
 * Onboarding form that collects user info for auto-filling government forms.
 * Data feeds into DTI, Barangay Clearance, and BIR Form 1901.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion } from "framer-motion";
import {
  ArrowLeft, User, Building2, MapPin, FileText, Save, CheckCircle2, Loader2, Sparkles, MessageCircle, LogOut,
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

function FormSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
      <h3 className="font-[var(--font-display)] text-sm text-earth-brown flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-teal" />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-earth-brown block mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

const inputClass = "w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 font-[var(--font-body)]";
const selectClass = "w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal/40 font-[var(--font-body)]";

export default function Profile() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [saved, setSaved] = useState(false);

  const [extracting, setExtracting] = useState(false);

  const profileQuery = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const saveMutation = trpc.profile.save.useMutation({
    onSuccess: () => { toast.success("Profile saved! Ready for auto-fill. 🎉"); setSaved(true); setTimeout(() => setSaved(false), 3000); },
    onError: () => { toast.error("Error saving profile. Try again."); },
  });
  const extractMutation = trpc.ai.extractProfile.useMutation({
    onSuccess: (data) => {
      let fieldsUpdated = 0;
      const updates: Partial<ProfileData> = {};
      if (data.firstName && !profile.firstName) { updates.firstName = data.firstName; fieldsUpdated++; }
      if (data.lastName && !profile.lastName) { updates.lastName = data.lastName; fieldsUpdated++; }
      if (data.middleName && !profile.middleName) { updates.middleName = data.middleName; fieldsUpdated++; }
      if (data.businessName && !profile.businessName) { updates.businessName = data.businessName; fieldsUpdated++; }
      if (data.businessType && !profile.businessType) { updates.businessType = data.businessType; fieldsUpdated++; }
      if (data.businessActivity && !profile.businessActivity) { updates.businessActivity = data.businessActivity; fieldsUpdated++; }
      if (data.bizBarangay && !profile.bizBarangay) { updates.bizBarangay = data.bizBarangay; fieldsUpdated++; }
      if (data.bizCity && !profile.bizCity) { updates.bizCity = data.bizCity; fieldsUpdated++; }
      if (data.mobileNumber && !profile.mobileNumber) { updates.mobileNumber = data.mobileNumber; fieldsUpdated++; }
      if (data.emailAddress && !profile.emailAddress) { updates.emailAddress = data.emailAddress; fieldsUpdated++; }
      if (data.capitalization && !profile.capitalization) { updates.capitalization = String(data.capitalization); fieldsUpdated++; }
      if (data.numberOfEmployees !== null && data.numberOfEmployees !== undefined && !profile.numberOfEmployees) { updates.numberOfEmployees = String(data.numberOfEmployees); fieldsUpdated++; }
      if (fieldsUpdated > 0) {
        setProfile(prev => ({ ...prev, ...updates }));
        toast.success(`Na-extract ang ${fieldsUpdated} field${fieldsUpdated > 1 ? 's' : ''} mula sa chat! Review and save.`);
      } else {
        toast.info("Walang bagong info na na-extract. Try chatting more details first.");
      }
      setExtracting(false);
    },
    onError: () => { toast.error("Error extracting from chat. Try again."); setExtracting(false); },
  });

  useEffect(() => {
    if (profileQuery.data) {
      const d = profileQuery.data;
      setProfile({
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
      });
    }
  }, [profileQuery.data]);

  const update = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleSave = () => {
    if (!profile.firstName || !profile.lastName) {
      toast.error("First name and last name are required.");
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
    <div className="min-h-screen bg-warm-cream pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-earth-brown" />
          </button>
          <div className="flex-1">
            <h1 className="font-[var(--font-display)] text-sm text-earth-brown">Negosyante Profile</h1>
            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">Para sa auto-fill ng government forms</p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm" className="bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] text-xs">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><CheckCircle2 className="w-4 h-4 mr-1" />Saved</> : <><Save className="w-4 h-4 mr-1" />Save</>}
          </Button>
        </div>
      </header>

      <div className="container max-w-2xl mt-4 space-y-4">
        {/* Extract from Chat Banner */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-teal/10 to-mango/10 rounded-2xl border border-teal/20 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-teal/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-teal" />
            </div>
            <div className="flex-1">
              <h3 className="font-[var(--font-display)] text-xs text-earth-brown">Auto-Extract from Chat</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Na-chat mo na ba ang business details mo? I-extract namin ang info para hindi mo na kailangan i-type ulit.</p>
              <Button
                onClick={() => {
                  const stored = sessionStorage.getItem('negosyonav_chat_history');
                  if (!stored) { toast.error("Wala pang chat history. Mag-chat muna sa Home page."); return; }
                  try {
                    const msgs = JSON.parse(stored);
                    if (!Array.isArray(msgs) || msgs.length < 2) { toast.error("Kulang pa ang chat. Mag-chat pa ng konti."); return; }
                    setExtracting(true);
                    extractMutation.mutate({ messages: msgs });
                  } catch { toast.error("Error reading chat history."); }
                }}
                disabled={extracting}
                size="sm"
                className="mt-2 bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] text-xs"
              >
                {extracting ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Extracting...</> : <><MessageCircle className="w-3 h-3 mr-1" />Extract from Chat</>}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Personal Info */}
        <FormSection title="Personal Information" icon={User}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First Name *">
              <input type="text" value={profile.firstName} onChange={(e) => update("firstName", e.target.value)} className={inputClass} placeholder="Juan" />
            </FormField>
            <FormField label="Middle Name">
              <input type="text" value={profile.middleName} onChange={(e) => update("middleName", e.target.value)} className={inputClass} placeholder="Santos" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Last Name *">
              <input type="text" value={profile.lastName} onChange={(e) => update("lastName", e.target.value)} className={inputClass} placeholder="Dela Cruz" />
            </FormField>
            <FormField label="Suffix">
              <input type="text" value={profile.suffix} onChange={(e) => update("suffix", e.target.value)} className={inputClass} placeholder="Jr., Sr., III" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date of Birth">
              <input type="date" value={profile.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Civil Status">
              <select value={profile.civilStatus} onChange={(e) => update("civilStatus", e.target.value)} className={selectClass}>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="widowed">Widowed</option>
                <option value="legally_separated">Legally Separated</option>
              </select>
            </FormField>
          </div>
          <FormField label="Citizenship">
            <input type="text" value={profile.citizenship} onChange={(e) => update("citizenship", e.target.value)} className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="TIN" hint="Leave blank if you don't have one yet">
              <input type="text" value={profile.tin} onChange={(e) => update("tin", e.target.value)} className={inputClass} placeholder="000-000-000-000" />
            </FormField>
            <FormField label="PhilSys ID" hint="Optional">
              <input type="text" value={profile.philsysId} onChange={(e) => update("philsysId", e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mobile Number">
              <input type="tel" value={profile.mobileNumber} onChange={(e) => update("mobileNumber", e.target.value)} className={inputClass} placeholder="09XX XXX XXXX" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={profile.emailAddress} onChange={(e) => update("emailAddress", e.target.value)} className={inputClass} placeholder="juan@email.com" />
            </FormField>
          </div>
        </FormSection>

        {/* Home Address */}
        <FormSection title="Home Address" icon={MapPin}>
          <FormField label="Building / House No.">
            <input type="text" value={profile.homeBuilding} onChange={(e) => update("homeBuilding", e.target.value)} className={inputClass} placeholder="123" />
          </FormField>
          <FormField label="Street">
            <input type="text" value={profile.homeStreet} onChange={(e) => update("homeStreet", e.target.value)} className={inputClass} placeholder="Rizal St." />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Barangay">
              <input type="text" value={profile.homeBarangay} onChange={(e) => update("homeBarangay", e.target.value)} className={inputClass} placeholder="Brgy. 123" />
            </FormField>
            <FormField label="City / Municipality">
              <input type="text" value={profile.homeCity} onChange={(e) => update("homeCity", e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Province">
              <input type="text" value={profile.homeProvince} onChange={(e) => update("homeProvince", e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="ZIP Code">
              <input type="text" value={profile.homeZipCode} onChange={(e) => update("homeZipCode", e.target.value)} className={inputClass} placeholder="1000" />
            </FormField>
          </div>
        </FormSection>

        {/* Business Info */}
        <FormSection title="Business Information" icon={Building2}>
          <FormField label="Proposed Business Name (1st choice) *" hint="Must be unique — check at bnrs.dti.gov.ph">
            <input type="text" value={profile.businessName} onChange={(e) => update("businessName", e.target.value)} className={inputClass} placeholder="Juan's Sari-Sari Store" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="2nd Choice">
              <input type="text" value={profile.businessNameOption2} onChange={(e) => update("businessNameOption2", e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="3rd Choice">
              <input type="text" value={profile.businessNameOption3} onChange={(e) => update("businessNameOption3", e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Business Type">
              <select value={profile.businessType} onChange={(e) => update("businessType", e.target.value)} className={selectClass}>
                <option value="sole_proprietorship">Sole Proprietorship</option>
                <option value="partnership">Partnership</option>
                <option value="corporation">Corporation</option>
              </select>
            </FormField>
            <FormField label="Business Activity" hint="e.g., Retail Trade, Food Service">
              <input type="text" value={profile.businessActivity} onChange={(e) => update("businessActivity", e.target.value)} className={inputClass} placeholder="Retail Trade" />
            </FormField>
          </div>
          <FormField label="Business Building / Unit">
            <input type="text" value={profile.bizBuilding} onChange={(e) => update("bizBuilding", e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Business Street">
            <input type="text" value={profile.bizStreet} onChange={(e) => update("bizStreet", e.target.value)} className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Business Barangay">
              <input type="text" value={profile.bizBarangay} onChange={(e) => update("bizBarangay", e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Business City">
              <input type="text" value={profile.bizCity} onChange={(e) => update("bizCity", e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Business Province">
              <input type="text" value={profile.bizProvince} onChange={(e) => update("bizProvince", e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Business ZIP">
              <input type="text" value={profile.bizZipCode} onChange={(e) => update("bizZipCode", e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Territorial Scope" hint="For DTI registration">
              <select value={profile.territorialScope} onChange={(e) => update("territorialScope", e.target.value)} className={selectClass}>
                <option value="barangay">Barangay (₱200)</option>
                <option value="city">City/Municipality (₱500)</option>
                <option value="regional">Regional (₱1,000)</option>
                <option value="national">National (₱2,000)</option>
              </select>
            </FormField>
            <FormField label="Capitalization (₱)">
              <input type="text" value={profile.capitalization} onChange={(e) => update("capitalization", e.target.value)} className={inputClass} placeholder="50,000" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Expected Annual Sales">
              <select value={profile.expectedAnnualSales} onChange={(e) => update("expectedAnnualSales", e.target.value)} className={selectClass}>
                <option value="">Select range</option>
                <option value="micro">Below ₱3M (Micro)</option>
                <option value="small">₱3M – ₱15M (Small)</option>
                <option value="medium">₱15M – ₱100M (Medium)</option>
              </select>
            </FormField>
            <FormField label="Number of Employees">
              <input type="number" value={profile.numberOfEmployees} onChange={(e) => update("numberOfEmployees", e.target.value)} className={inputClass} min="0" />
            </FormField>
          </div>
        </FormSection>

        {/* Tax Preference */}
        <FormSection title="Tax Preference" icon={FileText}>
          <FormField label="Preferred Tax Option" hint="8% flat tax is simpler for micro-entrepreneurs with gross sales ≤ ₱3M">
            <select value={profile.preferTaxOption} onChange={(e) => update("preferTaxOption", e.target.value)} className={selectClass}>
              <option value="graduated">Graduated Income Tax Rates</option>
              <option value="eight_percent">8% Flat Tax (if gross sales ≤ ₱3M)</option>
            </select>
          </FormField>
        </FormSection>

        {/* Save button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 pb-8">
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full bg-teal hover:bg-teal/90 text-white rounded-xl font-[var(--font-display)] py-4 text-base">
            {saveMutation.isPending ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Saving...</> : <><Save className="w-5 h-5 mr-2" />Save Profile & Enable Auto-fill</>}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            Your data is stored securely and only used for auto-filling government forms.
          </p>
        </motion.div>

        {/* Sign out */}
        <div className="pt-2 pb-12">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full rounded-xl min-h-11 font-[var(--font-display)] text-sm border-border text-earth-brown hover:bg-muted active:bg-muted"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
