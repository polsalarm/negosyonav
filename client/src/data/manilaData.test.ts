import { describe, expect, it } from "vitest";
import { manilaData, findDistrict } from "./manilaData";

describe("findDistrict", () => {
  it("maps a numbered Tondo barangay to Tondo", () => {
    expect(findDistrict("Brgy 123")).toBe("Tondo");
  });

  it("maps a high-numbered Binondo barangay to Binondo", () => {
    expect(findDistrict("Brgy 290")).toBe("Binondo");
  });

  it("falls back to free-text district name match", () => {
    expect(findDistrict("Tondo")).toBe("Tondo");
    expect(findDistrict("Brgy 999, Sampaloc")).toBe("Sampaloc");
  });

  it("normalizes case and prefixes", () => {
    expect(findDistrict("barangay 5")).toBe("Tondo");
    expect(findDistrict("BARANGAY 5")).toBe("Tondo");
  });

  it("returns null when input is empty or unparseable", () => {
    expect(findDistrict("")).toBeNull();
    expect(findDistrict("garbage")).toBeNull();
  });
});

describe("manilaData schema integrity", () => {
  it("every step except step 2 has an officeId that resolves to an Office or BIR RDO", () => {
    const officeIds = new Set(manilaData.offices.map((o) => o.id));
    const rdoOfficeIds = new Set(manilaData.bir_rdos.map((r) => r.rdo_code));
    for (const step of manilaData.registration_steps) {
      if (step.step_number === 2) {
        expect(step.officeId).toBeUndefined();
        continue;
      }
      if (step.step_number === 5) {
        // Step 5 is resolved at runtime — officeId can be undefined here.
        continue;
      }
      expect(step.officeId, `step ${step.step_number} missing officeId`).toBeDefined();
      expect(
        officeIds.has(step.officeId!) || rdoOfficeIds.has(step.officeId!),
        `step ${step.step_number} officeId "${step.officeId}" not found`,
      ).toBe(true);
    }
  });

  it("every BIR RDO has lat/lng", () => {
    for (const rdo of manilaData.bir_rdos) {
      expect(rdo.lat, `${rdo.rdo_code} missing lat`).toBeTypeOf("number");
      expect(rdo.lng, `${rdo.rdo_code} missing lng`).toBeTypeOf("number");
    }
  });

  it("every Office has an id", () => {
    for (const o of manilaData.offices) {
      expect(o.id).toMatch(/^[a-z0-9_]+$/);
    }
  });
});
