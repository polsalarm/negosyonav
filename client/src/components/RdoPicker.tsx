import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { manilaData, type BirRdo } from "@/data/manilaData";

const STORAGE_KEY = "negosyonav_selected_rdo";

export function readStoredRdo(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function writeStoredRdo(rdoCode: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, rdoCode);
}

export function clearStoredRdo(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export interface RdoPickerProps {
  onPick: (rdo: BirRdo) => void;
  initialRdoCode?: string | null;
}

export function RdoPicker({ onPick, initialRdoCode }: RdoPickerProps) {
  const [value, setValue] = useState<string>(initialRdoCode ?? "");

  return (
    <div className="rounded-xl border border-mango/30 bg-mango-light/40 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-mango mt-0.5 shrink-0" />
        <p className="text-xs text-earth-brown leading-relaxed">
          Hindi pa naka-set ang barangay mo. Pumili muna ng RDO, o{" "}
          <Link href="/profile" className="text-teal underline">
            i-set sa Profile
          </Link>{" "}
          para auto-pick.
        </p>
      </div>

      <Select
        value={value}
        onValueChange={(next) => {
          setValue(next);
          const rdo = manilaData.bir_rdos.find((r) => r.rdo_code === next);
          if (rdo) {
            writeStoredRdo(rdo.rdo_code);
            onPick(rdo);
          }
        }}
      >
        <SelectTrigger className="min-h-11 text-sm bg-white">
          <SelectValue placeholder="Pumili ng RDO" />
        </SelectTrigger>
        <SelectContent>
          {manilaData.bir_rdos.map((rdo) => (
            <SelectItem key={rdo.rdo_code} value={rdo.rdo_code}>
              {rdo.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
