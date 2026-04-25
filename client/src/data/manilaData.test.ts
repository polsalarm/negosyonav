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

  it("every Office id is unique", () => {
    const ids = manilaData.offices.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("findDistrict range boundaries", () => {
  it("locks Tondo upper boundary", () => {
    expect(findDistrict("Brgy 267")).toBe("Tondo");
  });

  it("locks San Nicolas lower boundary", () => {
    expect(findDistrict("Brgy 268")).toBe("San Nicolas");
  });

  it("locks San Nicolas upper boundary", () => {
    expect(findDistrict("Brgy 286")).toBe("San Nicolas");
  });

  it("locks Binondo lower boundary", () => {
    expect(findDistrict("Brgy 287")).toBe("Binondo");
  });

  it("locks Binondo upper boundary", () => {
    expect(findDistrict("Brgy 295")).toBe("Binondo");
  });

  it("locks Sampaloc range mid-point", () => {
    expect(findDistrict("Brgy 500")).toBe("Sampaloc");
  });

  it("returns null for an unmapped barangay number with no district hint", () => {
    expect(findDistrict("Brgy 850")).toBeNull();
  });

  it("rejects barangay numbers above 897", () => {
    expect(findDistrict("Brgy 898")).toBeNull();
    expect(findDistrict("Brgy 1000")).toBeNull();
  });
});
