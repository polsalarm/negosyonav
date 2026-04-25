/*
 * NegosyoNav — Smart Place Finder (Feature 07)
 * Shows nearest Negosyo Center, BIR RDO, City Hall on Google Maps.
 * With community-sourced queue tips and best times to visit.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Clock, Users, Navigation, Phone, ExternalLink,
  Building2, FileText, Landmark,
} from "lucide-react";
import { manilaData, type Office, type BirRdo } from "@/data/manilaData";

type PlaceType = "city_hall" | "negosyo_center" | "bir_rdo" | "barangay";

interface PlaceItem {
  id: string;
  name: string;
  type: PlaceType;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  hours: string;
  bestTime: string;
  queueTip: string;
  step: number[];
}

function inferType(officeId: string): PlaceType {
  if (officeId.startsWith("negosyo_center")) return "negosyo_center";
  if (officeId.startsWith("manila_city_hall") || officeId.startsWith("manila_city_treasurer"))
    return "city_hall";
  return "city_hall";
}

function stepsForOfficeId(officeId: string): number[] {
  return manilaData.registration_steps
    .filter((s) => s.officeId === officeId)
    .map((s) => s.step_number);
}

function officeToPlace(o: Office): PlaceItem {
  return {
    id: o.id,
    name: o.name,
    type: inferType(o.id),
    address: o.address,
    lat: o.lat,
    lng: o.lng,
    phone: o.contact_phone,
    hours: o.hours,
    bestTime: o.bestTime ?? "Weekday mornings",
    queueTip: o.queueTip ?? o.notes ?? "",
    step: stepsForOfficeId(o.id),
  };
}

function rdoToPlace(r: BirRdo): PlaceItem {
  return {
    id: r.rdo_code,
    name: r.name,
    type: "bir_rdo",
    address: r.address ?? `${r.districts.join(", ")}, Manila`,
    lat: r.lat,
    lng: r.lng,
    hours: "Mon–Fri 8:00 AM – 5:00 PM",
    bestTime: r.bestTime ?? "Early morning",
    queueTip: r.queueTip ?? "Use ORUS (orus.bir.gov.ph) for online registration.",
    step: [5],
  };
}

const typeIcons: Record<string, React.ElementType> = {
  city_hall: Landmark,
  negosyo_center: Building2,
  bir_rdo: FileText,
  barangay: MapPin,
};

const typeColors: Record<string, string> = {
  city_hall: "bg-jeepney-red/10 text-jeepney-red",
  negosyo_center: "bg-teal/10 text-teal",
  bir_rdo: "bg-mango/80 text-earth-brown",
  barangay: "bg-purple-100 text-purple-700",
};

const typeLabels: Record<string, string> = {
  city_hall: "City Hall",
  negosyo_center: "Negosyo Center",
  bir_rdo: "BIR RDO",
  barangay: "Barangay",
};

export default function Places() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<string>("all");
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);

  const places = useMemo<PlaceItem[]>(
    () => [
      ...manilaData.offices.map(officeToPlace),
      ...manilaData.bir_rdos.map(rdoToPlace),
    ],
    [],
  );

  const filtered = filter === "all" ? places : places.filter((o) => o.type === filter);

  return (
    <div className="min-h-screen bg-warm-cream pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button onClick={() => navigate("/roadmap")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-earth-brown" />
          </button>
          <div className="flex-1">
            <h1 className="font-[var(--font-display)] text-sm text-earth-brown">Smart Place Finder</h1>
            <p className="text-[10px] text-muted-foreground font-[var(--font-mono)]">Manila City offices & registration centers</p>
          </div>
          <MapPin className="w-5 h-5 text-teal" />
        </div>
      </header>

      <div className="container max-w-2xl mt-4 space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { key: "all", label: "All" },
            { key: "city_hall", label: "City Hall" },
            { key: "negosyo_center", label: "Negosyo Center" },
            { key: "bir_rdo", label: "BIR RDO" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`shrink-0 text-xs font-medium px-3 py-2 rounded-full transition-colors ${
                filter === key
                  ? "bg-teal text-white"
                  : "bg-white border border-border text-earth-brown hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Office cards */}
        {filtered.map((office, i) => {
          const Icon = typeIcons[office.type] || MapPin;
          const isSelected = selectedOffice === office.id;

          return (
            <motion.div
              key={office.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
            >
              <button onClick={() => setSelectedOffice(isSelected ? null : office.id)} className="w-full text-left p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColors[office.type]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-[var(--font-mono)] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeColors[office.type]}`}>
                        {typeLabels[office.type]}
                      </span>
                      {office.step.map(s => (
                        <span key={s} className="text-[10px] font-[var(--font-mono)] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          Step {s}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-[var(--font-display)] text-sm text-earth-brown leading-snug">{office.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{office.address}
                    </p>
                  </div>
                </div>
              </button>

              {isSelected && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden">
                  <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                    {/* Hours */}
                    <div className="flex items-center gap-2 text-xs text-earth-brown">
                      <Clock className="w-4 h-4 text-teal" />
                      <span className="font-medium">Hours:</span> {office.hours}
                    </div>

                    {/* Best time */}
                    <div className="bg-teal-light rounded-xl p-3">
                      <p className="text-xs text-earth-brown">
                        <span className="font-semibold">Best Time to Visit: </span>{office.bestTime}
                      </p>
                    </div>

                    {/* Queue tip */}
                    <div className="bg-mango-light rounded-xl p-3">
                      <p className="text-xs text-earth-brown flex items-start gap-2">
                        <Users className="w-4 h-4 text-mango shrink-0 mt-0.5" />
                        <span><span className="font-semibold">Queue Tip: </span>{office.queueTip}</span>
                      </p>
                    </div>

                    {/* Phone */}
                    {office.phone && (
                      <div className="flex items-center gap-2 text-xs text-earth-brown">
                        <Phone className="w-4 h-4 text-teal" />
                        <span>{office.phone}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${office.lat},${office.lng}`, "_blank")}
                        size="sm"
                        className="flex-1 bg-teal hover:bg-teal/90 text-white rounded-xl text-xs"
                      >
                        <Navigation className="w-3 h-3 mr-1" />Open in Google Maps
                      </Button>
                      {office.phone && (
                        <Button
                          onClick={() => window.open(`tel:${office.phone}`, "_self")}
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-teal/30 text-teal text-xs"
                        >
                          <Phone className="w-3 h-3 mr-1" />Call
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}

        {/* Back nav */}
        <div className="flex justify-center pt-4">
          <Button onClick={() => navigate("/roadmap")} variant="outline" className="rounded-xl border-mango/30 text-earth-brown hover:bg-mango-light">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Roadmap
          </Button>
        </div>
      </div>
    </div>
  );
}
