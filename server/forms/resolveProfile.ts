import type { FirestoreProfile } from "../db";
import type { FieldType } from "./types";

const SYNTHETIC_KEYS = ["fullName", "homeAddressLine", "bizAddressLine"] as const;

const LITERAL_KEYS: (keyof FirestoreProfile)[] = [
  "firstName", "middleName", "lastName", "suffix",
  "dateOfBirth", "gender", "civilStatus", "citizenship",
  "placeOfBirth", "mothersName", "fathersName",
  "tin", "philsysId", "mobileNumber", "phoneNumber", "emailAddress",
  "homeBuilding", "homeStreet", "homeBarangay", "homeCity",
  "homeProvince", "homeRegion", "homeZipCode",
  "businessName", "businessNameOption2", "businessNameOption3",
  "businessType", "businessActivity", "territorialScope",
  "bizBuilding", "bizStreet", "bizBarangay", "bizCity",
  "bizProvince", "bizRegion", "bizZipCode",
  "capitalization", "expectedAnnualSales", "numberOfEmployees", "preferTaxOption",
];

export const AVAILABLE_PROFILE_KEYS: string[] = [
  ...LITERAL_KEYS.map(String),
  ...SYNTHETIC_KEYS,
];

export function resolveProfileValue(
  profile: FirestoreProfile | undefined,
  key: string,
  opts?: { type?: FieldType },
): string {
  if (!profile) return "";

  if (key === "fullName") {
    return [profile.firstName, profile.middleName, profile.lastName, profile.suffix]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (key === "homeAddressLine") {
    return [
      profile.homeBuilding, profile.homeStreet, profile.homeBarangay,
      profile.homeCity, profile.homeProvince, profile.homeZipCode,
    ].filter(Boolean).join(", ");
  }
  if (key === "bizAddressLine") {
    return [
      profile.bizBuilding, profile.bizStreet, profile.bizBarangay,
      profile.bizCity, profile.bizProvince, profile.bizZipCode,
    ].filter(Boolean).join(", ");
  }

  const raw = (profile as Record<string, unknown>)[key];
  if (raw == null) return "";
  let value = typeof raw === "number" ? raw.toString() : String(raw);

  if (opts?.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    value = `${m}/${d}/${y}`;
  }

  return value;
}
