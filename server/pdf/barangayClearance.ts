import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFTextField, PDFCheckBox } from "pdf-lib";

const TEMPLATE_PATH = path.resolve(process.cwd(), "server/templates/business_clearance.pdf");

export type FieldType = "text" | "checkbox";

export type BarangayFieldDef = {
  name: string;
  type: FieldType;
  label: string;
  group?: string;
  required?: boolean;
  placeholder?: string;
};

// Mirrors the AcroForm field names in template/Business_Clearance_Application_Form.pdf.
// Keep this list in sync with the template — `name` MUST match the PDF widget name exactly.
export const BARANGAY_FIELDS: BarangayFieldDef[] = [
  // Header / receiving
  { name: "or_number", type: "text", label: "OR Number", group: "Receiving (filled by Barangay)" },
  { name: "date_applied", type: "text", label: "Date Applied" },
  { name: "plate_number", type: "text", label: "Plate Number", group: "Receiving (filled by Barangay)" },

  // Application type — pick one
  { name: "app_new", type: "checkbox", label: "New", group: "Application Type", required: true },
  { name: "app_renewal", type: "checkbox", label: "Renewal", group: "Application Type", required: true },
  { name: "app_change_address", type: "checkbox", label: "Change of Address", group: "Application Type", required: true },

  // Business identity
  { name: "business_name", type: "text", label: "Registered Business Name", required: true },
  { name: "trade_name", type: "text", label: "Trade Name / Doing Business As" },

  // Business address (decomposed to match the AcroForm)
  { name: "unit_room", type: "text", label: "Unit / Room No.", group: "Business Address" },
  { name: "floor", type: "text", label: "Floor", group: "Business Address" },
  { name: "building", type: "text", label: "Building", group: "Business Address" },
  { name: "street_no", type: "text", label: "Street No.", group: "Business Address" },
  { name: "street", type: "text", label: "Street", group: "Business Address", required: true },
  { name: "locale", type: "text", label: "Barangay / Locale", group: "Business Address", required: true },

  // Ownership — pick one
  { name: "own_sole", type: "checkbox", label: "Sole Proprietorship", group: "Form of Ownership", required: true },
  { name: "own_corporation", type: "checkbox", label: "Corporation", group: "Form of Ownership", required: true },
  { name: "own_incorporated", type: "checkbox", label: "Incorporated", group: "Form of Ownership", required: true },
  { name: "own_partnership", type: "checkbox", label: "Partnership", group: "Form of Ownership", required: true },
  { name: "own_cooperative", type: "checkbox", label: "Cooperative", group: "Form of Ownership", required: true },
  { name: "own_foundation", type: "checkbox", label: "Foundation", group: "Form of Ownership", required: true },

  // Nature of business — multi-select
  { name: "nob_advertising", type: "checkbox", label: "Advertising", group: "Nature of Business" },
  { name: "nob_agricultural", type: "checkbox", label: "Agricultural", group: "Nature of Business" },
  { name: "nob_airlines", type: "checkbox", label: "Airlines", group: "Nature of Business" },
  { name: "nob_amusement_places", type: "checkbox", label: "Amusement Places", group: "Nature of Business" },
  { name: "nob_banks", type: "checkbox", label: "Banks", group: "Nature of Business" },
  { name: "nob_brokerage", type: "checkbox", label: "Brokerage", group: "Nature of Business" },
  { name: "nob_call_center", type: "checkbox", label: "Call Center", group: "Nature of Business" },
  { name: "nob_canteen", type: "checkbox", label: "Canteen", group: "Nature of Business" },
  { name: "nob_construction", type: "checkbox", label: "Construction", group: "Nature of Business" },
  { name: "nob_consultancy", type: "checkbox", label: "Consultancy", group: "Nature of Business" },
  { name: "nob_convenience_store", type: "checkbox", label: "Convenience Store", group: "Nature of Business" },
  { name: "nob_cooperative", type: "checkbox", label: "Cooperative", group: "Nature of Business" },
  { name: "nob_distributor", type: "checkbox", label: "Distributor", group: "Nature of Business" },
  { name: "nob_educational_institution", type: "checkbox", label: "Educational Institution", group: "Nature of Business" },
  { name: "nob_exporter", type: "checkbox", label: "Exporter", group: "Nature of Business" },
  { name: "nob_financing_institution", type: "checkbox", label: "Financing Institution", group: "Nature of Business" },
  { name: "nob_food_chain_kiosk", type: "checkbox", label: "Food Chain / Kiosk", group: "Nature of Business" },
  { name: "nob_foreign_exchange_dealer", type: "checkbox", label: "Foreign Exchange Dealer", group: "Nature of Business" },
  { name: "nob_forwarding", type: "checkbox", label: "Forwarding", group: "Nature of Business" },
  { name: "nob_foundation", type: "checkbox", label: "Foundation", group: "Nature of Business" },
  { name: "nob_holdings", type: "checkbox", label: "Holdings", group: "Nature of Business" },
  { name: "nob_hotels_apartelles", type: "checkbox", label: "Hotels / Apartelles", group: "Nature of Business" },
  { name: "nob_importer", type: "checkbox", label: "Importer", group: "Nature of Business" },
  { name: "nob_insurance_broker", type: "checkbox", label: "Insurance Broker", group: "Nature of Business" },
  { name: "nob_investment", type: "checkbox", label: "Investment", group: "Nature of Business" },
  { name: "nob_jollijeep", type: "checkbox", label: "Jollijeep", group: "Nature of Business" },
  { name: "nob_manufacturer", type: "checkbox", label: "Manufacturer", group: "Nature of Business" },
  { name: "nob_manpower", type: "checkbox", label: "Manpower", group: "Nature of Business" },
  { name: "nob_merchandise", type: "checkbox", label: "Merchandise", group: "Nature of Business" },
  { name: "nob_mining", type: "checkbox", label: "Mining", group: "Nature of Business" },
  { name: "nob_music_lounge_bar", type: "checkbox", label: "Music Lounge / Bar", group: "Nature of Business" },
  { name: "nob_non_stock_non_profit", type: "checkbox", label: "Non-stock / Non-profit", group: "Nature of Business" },
  { name: "nob_pawnshop", type: "checkbox", label: "Pawnshop", group: "Nature of Business" },
  { name: "nob_pre_need_company", type: "checkbox", label: "Pre-need Company", group: "Nature of Business" },
  { name: "nob_real_estate_dealer", type: "checkbox", label: "Real Estate Dealer", group: "Nature of Business" },
  { name: "nob_real_estate_developer", type: "checkbox", label: "Real Estate Developer", group: "Nature of Business" },
  { name: "nob_real_estate_lessor", type: "checkbox", label: "Real Estate Lessor", group: "Nature of Business" },
  { name: "nob_representative_regional_office", type: "checkbox", label: "Representative / Regional Office", group: "Nature of Business" },
  { name: "nob_restaurant", type: "checkbox", label: "Restaurant", group: "Nature of Business" },
  { name: "nob_retailer", type: "checkbox", label: "Retailer", group: "Nature of Business" },
  { name: "nob_security_agency", type: "checkbox", label: "Security Agency", group: "Nature of Business" },
  { name: "nob_services", type: "checkbox", label: "Services (specify below)", group: "Nature of Business" },
  { name: "nob_shopping_center", type: "checkbox", label: "Shopping Center", group: "Nature of Business" },
  { name: "nob_trading", type: "checkbox", label: "Trading", group: "Nature of Business" },
  { name: "nob_wholesale", type: "checkbox", label: "Wholesale", group: "Nature of Business" },
  { name: "nob_others", type: "checkbox", label: "Others (specify below)", group: "Nature of Business" },
  { name: "nob_services_specify", type: "text", label: "If Services, specify", group: "Nature of Business" },
  { name: "nob_others_specify", type: "text", label: "If Others, specify", group: "Nature of Business" },

  // Contact + financial
  { name: "business_tin", type: "text", label: "Business TIN" },
  { name: "contact_person", type: "text", label: "Contact Person", required: true },
  { name: "telephone_no", type: "text", label: "Telephone No." },
  { name: "fax_no", type: "text", label: "Fax No." },
  { name: "email", type: "text", label: "Email" },
  { name: "paid_up_capital", type: "text", label: "Paid-up Capital (₱)" },
  { name: "capitalization", type: "text", label: "Capitalization (₱)" },
  { name: "assessed_value", type: "text", label: "Assessed Value (₱)" },

  // Fees (filled by Barangay)
  { name: "barangay_clearance_fee", type: "text", label: "Barangay Clearance Fee (₱)", group: "Fees (filled by Barangay)" },
  { name: "business_plate_fee", type: "text", label: "Business Plate Fee (₱)", group: "Fees (filled by Barangay)" },
  { name: "business_sticker_fee", type: "text", label: "Business Sticker Fee (₱)", group: "Fees (filled by Barangay)" },
  { name: "total_amount", type: "text", label: "Total Amount (₱)", group: "Fees (filled by Barangay)" },
  { name: "received_by", type: "text", label: "Received By", group: "Fees (filled by Barangay)" },
];

export type BarangayValues = Record<string, string | boolean | undefined>;

export async function renderBarangayClearance(values: BarangayValues): Promise<Uint8Array> {
  const bytes = await readFile(TEMPLATE_PATH);
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();

  for (const def of BARANGAY_FIELDS) {
    const raw = values[def.name];
    if (raw === undefined || raw === null || raw === "") continue;
    const field = form.getFieldMaybe(def.name);
    if (!field) continue;

    if (def.type === "text" && field instanceof PDFTextField) {
      field.setText(String(raw));
    } else if (def.type === "checkbox" && field instanceof PDFCheckBox) {
      if (raw === true || raw === "true" || raw === "Yes" || raw === "/Yes") field.check();
      else field.uncheck();
    }
  }

  // Keep the form interactive so users can still edit before printing.
  return pdf.save();
}
