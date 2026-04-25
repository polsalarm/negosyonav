import { Building2, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export interface BarangayTextCardProps {
  bizBarangay?: string;
}

export function BarangayTextCard({ bizBarangay }: BarangayTextCardProps) {
  const query = encodeURIComponent(
    `${bizBarangay ?? ""} barangay hall manila`.trim() || "barangay hall manila",
  );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  const hasBarangay = Boolean(bizBarangay && bizBarangay.trim().length > 0);

  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Building2 className="w-4 h-4 text-teal mt-0.5 shrink-0" />
        <div>
          <h4 className="font-[var(--font-display)] text-sm text-earth-brown">
            Your Barangay Hall
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Punta sa barangay hall ng inyong business address.
          </p>
        </div>
      </div>

      <div className="text-xs text-earth-brown bg-muted/50 rounded-lg px-3 py-2 flex items-start gap-2">
        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <span>
          <span className="font-semibold">Address: </span>
          {hasBarangay ? bizBarangay : (
            <Link href="/profile" className="text-teal underline">
              Set sa Profile
            </Link>
          )}
        </span>
      </div>

      <Button
        asChild
        className="w-full bg-teal hover:bg-teal/90 text-white rounded-xl min-h-11"
      >
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-4 h-4 mr-2" />
          Find on Maps
        </a>
      </Button>

      {!hasBarangay && (
        <p className="text-[10px] text-muted-foreground text-center">
          Set your barangay sa Profile para mas accurate.
        </p>
      )}
    </div>
  );
}
