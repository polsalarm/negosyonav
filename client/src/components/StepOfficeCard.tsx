import { useEffect, useState } from "react";
import {
  manilaData,
  findDistrict,
  type RegistrationStep,
  type BirRdo,
  type Office,
} from "@/data/manilaData";
import { OfficeMapCard, type OfficeLike } from "./OfficeMapCard";
import { BarangayTextCard } from "./BarangayTextCard";
import { RdoPicker, readStoredRdo, clearStoredRdo } from "./RdoPicker";

export interface StepOfficeCardProps {
  step: RegistrationStep;
  profile: { bizBarangay?: string | null } | null;
}

function rdoToOfficeLike(rdo: BirRdo): OfficeLike {
  return {
    rdo_code: rdo.rdo_code,
    name: rdo.name,
    address: rdo.address ?? `${rdo.districts.join(", ")}, Manila`,
    lat: rdo.lat,
    lng: rdo.lng,
    hours: "Mon–Fri 8:00 AM – 5:00 PM",
    bestTime: rdo.bestTime,
    queueTip: rdo.queueTip,
  };
}

function officeToOfficeLike(o: Office): OfficeLike {
  return {
    id: o.id,
    name: o.name,
    address: o.address,
    lat: o.lat,
    lng: o.lng,
    contact_phone: o.contact_phone,
    hours: o.hours,
    bestTime: o.bestTime,
    queueTip: o.queueTip,
    notes: o.notes,
  };
}

export function StepOfficeCard({ step, profile }: StepOfficeCardProps) {
  // Step 2 — Barangay (no static coords).
  if (step.step_number === 2) {
    return <BarangayTextCard bizBarangay={profile?.bizBarangay ?? undefined} />;
  }

  // Step 5 — BIR (resolve RDO from profile, else picker).
  if (step.step_number === 5) {
    return <Step5Bir profile={profile} />;
  }

  // Steps 1, 3, 4 — static officeId lookup.
  if (!step.officeId) return null;
  const office = manilaData.offices.find((o) => o.id === step.officeId);
  if (!office) return null;
  return <OfficeMapCard office={officeToOfficeLike(office)} />;
}

function Step5Bir({ profile }: { profile: StepOfficeCardProps["profile"] }) {
  const district = findDistrict(profile?.bizBarangay ?? "");
  const profileRdo = district
    ? manilaData.bir_rdos.find((r) => r.districts.includes(district))
    : null;

  const [pickedRdoCode, setPickedRdoCode] = useState<string | null>(() =>
    profileRdo ? null : readStoredRdo(),
  );

  // If profile resolved a district later, drop the manual override.
  useEffect(() => {
    if (profileRdo && pickedRdoCode) {
      clearStoredRdo();
      setPickedRdoCode(null);
    }
  }, [profileRdo, pickedRdoCode]);

  if (profileRdo) {
    return <OfficeMapCard office={rdoToOfficeLike(profileRdo)} />;
  }

  if (pickedRdoCode) {
    const picked = manilaData.bir_rdos.find((r) => r.rdo_code === pickedRdoCode);
    if (picked) return <OfficeMapCard office={rdoToOfficeLike(picked)} />;
  }

  return (
    <RdoPicker
      initialRdoCode={pickedRdoCode}
      onPick={(rdo) => setPickedRdoCode(rdo.rdo_code)}
    />
  );
}
