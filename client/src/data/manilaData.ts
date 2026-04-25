/*
 * NegosyoNav — Manila City LGU Seeded Data
 * Design: Jeepney Modernism (Filipino Vernacular Modernism)
 * This file contains the complete registration steps, offices, and grant programs
 * for the City of Manila, structured for the Lakad Roadmap feature.
 */

export interface CostBreakdown {
  item: string;
  amount?: number;
  amount_range?: string;
  note?: string;
}

export interface StepCost {
  min: number;
  max: number;
  breakdown: CostBreakdown[];
}

export interface RegistrationStep {
  step_number: number;
  title: string;
  title_tl: string;
  agency: string;
  where_to_apply: string;
  online_url?: string;
  requirements: string[];
  cost: StepCost;
  processing_time_days: number;
  validity_years: number | null;
  output_document: string;
  tips: string[];
  post_registration?: string[];
  renewal_deadline?: string;
  late_penalty?: string;
}

export interface BirRdo {
  rdo_code: string;
  name: string;
  districts: string[];
  address?: string;
}

export interface Office {
  name: string;
  address: string;
  lat: number;
  lng: number;
  contact_phone?: string;
  contact_email?: string;
  hours: string;
  notes?: string;
}

export interface GrantProgram {
  program_id: string;
  name: string;
  name_tl: string;
  agency: string;
  eligibility_summary: string;
  benefits: string[];
  where_to_apply: string;
  cost?: string;
}

export interface LguData {
  lgu_id: string;
  name: string;
  region: string;
  province: string;
  offices: Office[];
  bir_rdos: BirRdo[];
  registration_steps: RegistrationStep[];
  total_estimated_cost: { min: number; max: number };
  grants_and_programs: GrantProgram[];
}

export const manilaData: LguData = {
  lgu_id: "manila_city",
  name: "City of Manila",
  region: "NCR",
  province: "Metro Manila",
  offices: [
    {
      name: "Manila City Hall — Bureau of Permits",
      address: "Room 110, Padre Burgos Ave, Ermita, Manila 1000",
      lat: 14.5891,
      lng: 120.981,
      contact_phone: "+63 2 5310 4184",
      contact_email: "permits@manila.gov.ph",
      hours: "8:00 AM – 5:00 PM, Mon–Fri",
      notes: "E-BOSS Lounge available at Ground Floor for streamlined processing",
    },
    {
      name: "Negosyo Center Manila City — LGU",
      address: "Manila City Hall, Padre Burgos Ave, Ermita, Manila",
      lat: 14.5891,
      lng: 120.981,
      contact_email: "ncr@dti.gov.ph",
      hours: "8:00 AM – 5:00 PM, Mon–Fri",
      notes: "Free business name registration assistance and MSME support",
    },
    {
      name: "Negosyo Center Manila — Lucky Chinatown",
      address: "Lucky Chinatown Mall, Reina Regente St, Binondo, Manila",
      lat: 14.5994,
      lng: 120.9736,
      contact_phone: "7794-2147",
      contact_email: "cityofmanila.mall@negosyocenter.gov.ph",
      hours: "8:00 AM – 5:00 PM, Mon–Sat",
    },
  ],
  bir_rdos: [
    { rdo_code: "029", name: "RDO 029 — Tondo / San Nicolas", districts: ["Tondo", "San Nicolas"] },
    { rdo_code: "030", name: "RDO 030 — Binondo", districts: ["Binondo"] },
    { rdo_code: "031", name: "RDO 031 — Sta. Cruz", districts: ["Sta. Cruz", "Santa Cruz"] },
    { rdo_code: "032", name: "RDO 032 — Quiapo / Sampaloc / San Miguel / Sta. Mesa", districts: ["Quiapo", "Sampaloc", "San Miguel", "Sta. Mesa", "Santa Mesa"] },
    { rdo_code: "033", name: "RDO 033 — Intramuros / Ermita / Malate / Port Area", districts: ["Intramuros", "Ermita", "Malate", "Port Area"], address: "181 Natividad Lopez St, Ermita, Manila 1000" },
    { rdo_code: "034", name: "RDO 034 — Paco / Pandacan / Sta. Ana / San Andres", districts: ["Paco", "Pandacan", "Sta. Ana", "Santa Ana", "San Andres"] },
  ],
  registration_steps: [
    {
      step_number: 1,
      title: "DTI Business Name Registration",
      title_tl: "Pagpaparehistro ng Pangalan ng Negosyo sa DTI",
      agency: "Department of Trade and Industry (DTI)",
      where_to_apply: "Online via bnrs.dti.gov.ph OR Negosyo Center, Manila City Hall",
      online_url: "https://bnrs.dti.gov.ph",
      requirements: ["Accomplished DTI application form", "Valid government-issued ID"],
      cost: {
        min: 530,
        max: 530,
        breakdown: [
          { item: "Registration Fee (City Scope)", amount: 500 },
          { item: "Documentary Stamp Tax", amount: 30 },
        ],
      },
      processing_time_days: 1,
      validity_years: 5,
      output_document: "DTI Certificate of Business Name Registration",
      tips: [
        "Check name availability first at bnrs.dti.gov.ph before visiting the Negosyo Center.",
        "The business name must be unique — DTI may reject generic or similar names.",
        "Online registration is faster and can be done from home.",
      ],
    },
    {
      step_number: 2,
      title: "Barangay Business Clearance",
      title_tl: "Barangay Business Clearance",
      agency: "Barangay Hall",
      where_to_apply: "Your specific Barangay Hall in Manila (based on business address)",
      requirements: [
        "DTI Certificate of Registration",
        "Valid government-issued ID",
        "Proof of Address (Lease Contract or Land Title)",
      ],
      cost: {
        min: 200,
        max: 1000,
        breakdown: [{ item: "Barangay Clearance Fee", amount_range: "₱200–₱1,000" }],
      },
      processing_time_days: 1,
      validity_years: 1,
      output_document: "Barangay Business Clearance",
      tips: [
        "Fees vary between Manila's 897 barangays — ask your Barangay Hall for the exact amount.",
        "Bring original documents plus photocopies.",
        "Some barangays may require a brief interview with the Barangay Captain.",
      ],
    },
    {
      step_number: 3,
      title: "Community Tax Certificate (Cedula)",
      title_tl: "Community Tax Certificate (Sedula)",
      agency: "Manila City Treasurer's Office",
      where_to_apply: "Manila City Hall OR online via cedula.ctomanila.com",
      online_url: "https://cedula.ctomanila.com/apply",
      requirements: ["Valid government-issued ID", "Completed CTC form"],
      cost: {
        min: 59,
        max: 500,
        breakdown: [
          { item: "Basic CTC Fee", amount: 59.40 },
          { item: "Additional tax (income/property)", amount_range: "₱0–₱440" },
        ],
      },
      processing_time_days: 1,
      validity_years: 1,
      output_document: "Community Tax Certificate",
      tips: [
        "Manila offers online Cedula application — save time at cedula.ctomanila.com.",
        "The Cedula is valid for the calendar year and must be renewed annually.",
      ],
    },
    {
      step_number: 4,
      title: "Mayor's Permit / Business Permit",
      title_tl: "Mayor's Permit / Business Permit",
      agency: "Bureau of Permits, Manila City Hall",
      where_to_apply: "Room 110, Manila City Hall / E-BOSS Lounge, G/F Manila City Hall",
      requirements: [
        "DTI Certificate of Registration",
        "Barangay Business Clearance",
        "Community Tax Certificate (Cedula)",
        "Contract of Lease or Transfer Certificate of Title (TCT)",
        "Sanitary Permit",
        "Fire Safety Inspection Certificate (FSIC) from BFP",
      ],
      cost: {
        min: 2000,
        max: 5000,
        breakdown: [
          { item: "Mayor's Permit Fee", amount_range: "₱500–₱2,000" },
          { item: "Local Business Tax", amount_range: "₱500–₱2,000" },
          { item: "Sanitary Inspection Fee", amount_range: "₱200–₱500" },
          { item: "Fire Safety Inspection Certificate", amount_range: "₱200–₱500" },
          { item: "Garbage Fee", amount_range: "₱300–₱500" },
        ],
      },
      processing_time_days: 3,
      validity_years: 1,
      output_document: "Mayor's Permit / Business Permit",
      renewal_deadline: "January 20",
      late_penalty: "25% surcharge + 2% monthly interest",
      tips: [
        "Go to the E-BOSS Lounge at the Ground Floor for faster processing.",
        "The permit expires Dec 31 every year — renew between Jan 1–20 to avoid penalties.",
        "Prepare all documents in advance to get same-day or next-day issuance.",
      ],
    },
    {
      step_number: 5,
      title: "BIR Registration",
      title_tl: "Pagpaparehistro sa BIR",
      agency: "Bureau of Internal Revenue (BIR)",
      where_to_apply: "Online via ORUS (orus.bir.gov.ph) OR assigned RDO based on Manila district",
      online_url: "https://orus.bir.gov.ph",
      requirements: [
        "BIR Form 1901",
        "Tax Type Questionnaire (from NewBizReg portal)",
        "DTI Certificate of Registration",
        "Mayor's Permit / Business Permit",
        "Valid government-issued ID",
        "Proof of business address",
      ],
      cost: {
        min: 2730,
        max: 5530,
        breakdown: [
          { item: "Annual Registration Fee", amount: 0, note: "Abolished since Jan 2024" },
          { item: "Documentary Stamp Tax", amount: 30 },
          { item: "Books of Accounts", amount_range: "₱200–₱500" },
          { item: "Printing of Official Receipts/Invoices", amount_range: "₱2,500–₱5,000" },
        ],
      },
      processing_time_days: 3,
      validity_years: null,
      output_document: "TIN; BIR Certificate of Registration (Form 2303)",
      post_registration: [
        "Register Books of Accounts via ORUS",
        "Apply for Authority to Print Invoices (BIR Form 1906)",
        "Attend taxpayer briefing if required by RDO",
      ],
      tips: [
        "Register within 30 days of DTI registration to avoid penalties (₱5,000–₱20,000).",
        "Use ORUS (orus.bir.gov.ph) for faster online registration.",
        "Starting 2024, invoices are the primary document; Official Receipts are supplementary.",
        "The ₱500 Annual Registration Fee has been permanently abolished.",
      ],
    },
  ],
  total_estimated_cost: { min: 5519, max: 12560 },
  grants_and_programs: [
    {
      program_id: "bmbe",
      name: "BMBE Registration",
      name_tl: "Barangay Micro Business Enterprise (BMBE)",
      agency: "Manila City Treasurer's Office / DTI",
      eligibility_summary: "Total assets ≤ ₱3,000,000 (excluding land)",
      benefits: [
        "Income tax exemption on business income",
        "Minimum wage law exemption",
        "Local tax and permit fee reductions",
        "Priority access to credit from banks",
        "Free training from DTI, TESDA, DOST",
      ],
      where_to_apply: "Manila City Treasurer's Office, Manila City Hall",
      cost: "Free (up to ₱1,000 admin fee)",
    },
    {
      program_id: "dole_dilp",
      name: "DOLE Kabuhayan Program",
      name_tl: "DOLE Integrated Livelihood Program (DILP)",
      agency: "Department of Labor and Employment (DOLE)",
      eligibility_summary: "Self-employed, displaced workers, women, youth, PWDs, senior citizens",
      benefits: [
        "Individual Starter Kit / Nego-Kart up to ₱20,000",
        "Group grants from ₱250,000 to ₱1,000,000",
      ],
      where_to_apply: "DOLE NCR Field Office",
    },
    {
      program_id: "sbcorp_expansion",
      name: "SB Corp Micro-Financing",
      name_tl: "SB Corp Pautang para sa Pagpapalaki ng Negosyo",
      agency: "Small Business Corporation (DTI)",
      eligibility_summary: "Businesses with 3–11 months of operation",
      benefits: [
        "Loan from ₱50,000 to ₱3,000,000",
        "0% interest for the first 12 months",
        "Up to 3 years payable with 6-month grace period",
      ],
      where_to_apply: "SB Corp (sbcorp.gov.ph)",
    },
  ],
};

// Chat messages for the demo flow
export const demoMessages = [
  {
    role: "assistant" as const,
    content: "Kumusta! Ako si NegosyoNav, ang iyong gabay sa pag-register ng negosyo. 🏪\n\nSabihin mo lang sa akin:\n• Anong klaseng negosyo ang gusto mong simulan?\n• Saan mo ito itatayo? (city/municipality)\n\nHalimbawa: \"Gusto ko mag-open ng sari-sari store sa Tondo, Manila\"",
  },
];

export const sampleUserMessages = [
  "Gusto ko mag-register ng carinderia sa Sampaloc, Manila",
  "Sari-sari store po sa Tondo, Manila",
  "Home-based online selling po sa Ermita, Manila",
  "Ukay-ukay business sa Quiapo, Manila",
];

export function getAssistantResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  let businessType = "negosyo";
  let district = "Manila";

  if (msg.includes("carinderia") || msg.includes("karinderya")) businessType = "carinderia";
  else if (msg.includes("sari-sari") || msg.includes("sarisari")) businessType = "sari-sari store";
  else if (msg.includes("online") || msg.includes("home-based")) businessType = "home-based online selling business";
  else if (msg.includes("ukay")) businessType = "ukay-ukay business";

  const districts = ["tondo", "binondo", "sta. cruz", "santa cruz", "quiapo", "sampaloc", "san miguel", "sta. mesa", "santa mesa", "intramuros", "ermita", "malate", "port area", "paco", "pandacan", "sta. ana", "santa ana", "san andres", "san nicolas"];
  for (const d of districts) {
    if (msg.includes(d)) {
      district = d.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      break;
    }
  }

  const rdo = manilaData.bir_rdos.find(r =>
    r.districts.some(d => d.toLowerCase() === district.toLowerCase())
  );
  const rdoInfo = rdo ? `Your assigned BIR office is **${rdo.name}**.` : "Your BIR RDO will be assigned based on your exact district.";

  return `Maganda! Narito na ang iyong **Lakad Roadmap** para sa pag-register ng **${businessType}** sa **${district}, Manila**! 🎉\n\nNaka-generate na ang 5 steps mo — mula DTI hanggang BIR. ${rdoInfo}\n\n**Estimated total cost: ₱5,519 – ₱12,560**\n\nI-scroll mo pababa para makita ang bawat step, kasama ang mga kailangan mong documents, fees, at office locations. 👇\n\n💡 **Tip:** Baka eligible ka sa BMBE tax exemption! Check mo ang Grants section sa baba.`;
}
