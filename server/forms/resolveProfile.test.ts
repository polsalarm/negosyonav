import { describe, it, expect } from "vitest";
import { resolveProfileValue, AVAILABLE_PROFILE_KEYS } from "./resolveProfile";
import type { FirestoreProfile } from "../db";

const sample: FirestoreProfile = {
  userId: "u1",
  firstName: "Juan",
  middleName: "Reyes",
  lastName: "Dela Cruz",
  suffix: "Jr.",
  dateOfBirth: "1990-05-04",
  civilStatus: "single",
  citizenship: "Filipino",
  tin: "123-456-789-000",
  mobileNumber: "09171234567",
  emailAddress: "j@x.ph",
  homeBuilding: "Unit 4",
  homeStreet: "Aguinaldo St.",
  homeBarangay: "Sampaloc",
  homeCity: "Manila",
  homeProvince: "NCR",
  homeZipCode: "1008",
  bizBuilding: "Stall 3",
  bizStreet: "Quezon Ave.",
  bizBarangay: "Sampaloc",
  bizCity: "Manila",
  bizProvince: "NCR",
  bizZipCode: "1008",
  businessName: "Aling Nena Sari-sari",
  businessActivity: "Sari-sari retail",
  capitalization: 25000,
};

describe("resolveProfileValue", () => {
  it("returns literal field value", () => {
    expect(resolveProfileValue(sample, "firstName")).toBe("Juan");
    expect(resolveProfileValue(sample, "tin")).toBe("123-456-789-000");
  });

  it("composes synthetic fullName with all parts", () => {
    expect(resolveProfileValue(sample, "fullName")).toBe(
      "Juan Reyes Dela Cruz Jr.",
    );
  });

  it("composes fullName skipping missing parts", () => {
    expect(
      resolveProfileValue(
        { ...sample, middleName: undefined, suffix: undefined },
        "fullName",
      ),
    ).toBe("Juan Dela Cruz");
  });

  it("composes homeAddressLine and bizAddressLine", () => {
    expect(resolveProfileValue(sample, "homeAddressLine")).toBe(
      "Unit 4, Aguinaldo St., Sampaloc, Manila, NCR, 1008",
    );
    expect(resolveProfileValue(sample, "bizAddressLine")).toBe(
      "Stall 3, Quezon Ave., Sampaloc, Manila, NCR, 1008",
    );
  });

  it("coerces dateOfBirth to MM/DD/YYYY when type=date", () => {
    expect(
      resolveProfileValue(sample, "dateOfBirth", { type: "date" }),
    ).toBe("05/04/1990");
  });

  it("returns empty string for unknown key", () => {
    expect(resolveProfileValue(sample, "nonExistent")).toBe("");
  });

  it("returns empty string when profile is undefined", () => {
    expect(resolveProfileValue(undefined, "firstName")).toBe("");
  });

  it("AVAILABLE_PROFILE_KEYS includes literal + synthetic keys", () => {
    expect(AVAILABLE_PROFILE_KEYS).toContain("firstName");
    expect(AVAILABLE_PROFILE_KEYS).toContain("fullName");
    expect(AVAILABLE_PROFILE_KEYS).toContain("homeAddressLine");
    expect(AVAILABLE_PROFILE_KEYS).toContain("bizAddressLine");
  });
});
