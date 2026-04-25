/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  MapPin,
  Clock,
  Phone,
  Navigation,
  ExternalLink,
  X,
  ChevronDown,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { MapView } from "@/components/Map";
import { loadGoogleMaps } from "@/lib/maps";
import { toast } from "sonner";

type TravelMode = "DRIVING" | "WALKING" | "TRANSIT";
type DirectionsState =
  | { kind: "idle" }
  | { kind: "requesting_geo" }
  | { kind: "geo_denied"; manualAddress: string }
  | { kind: "fetching_route"; origin: google.maps.LatLngLiteral | string; mode: TravelMode }
  | {
      kind: "showing_route";
      origin: google.maps.LatLngLiteral | string;
      mode: TravelMode;
      result: google.maps.DirectionsResult;
    };

// Module-level cache so the same browser geo permission is reused across all
// OfficeMapCard instances in a session.
let cachedOrigin: google.maps.LatLngLiteral | null = null;

function originKey(origin: google.maps.LatLngLiteral | string): string {
  if (typeof origin === "string") return `s:${origin.toLowerCase().trim()}`;
  // Round to ~10m precision so trivial geo jitter doesn't blow the cache.
  return `c:${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}`;
}

function cacheKey(origin: google.maps.LatLngLiteral | string, mode: TravelMode): string {
  return `${mode}|${originKey(origin)}`;
}

export interface OfficeLike {
  id?: string;
  rdo_code?: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  contact_phone?: string;
  hours?: string;
  bestTime?: string;
  queueTip?: string;
  notes?: string;
}

export interface OfficeMapCardProps {
  office: OfficeLike;
}

export function OfficeMapCard({ office }: OfficeMapCardProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const rendererInitRef = useRef<Promise<google.maps.DirectionsRenderer> | null>(null);
  const resultsCacheRef = useRef<Map<string, google.maps.DirectionsResult>>(
    new Map(),
  );

  const [state, setState] = useState<DirectionsState>({ kind: "idle" });

  const center = { lat: office.lat, lng: office.lng };

  /**
   * Called by <MapView> after google.maps.Map is constructed. We create the
   * marker here (not in a separate effect) so we never race with map-ready —
   * by the time this fires, map is guaranteed to exist.
   */
  function handleMapReady(map: google.maps.Map) {
    mapRef.current = map;
    loadGoogleMaps().then((g) => {
      if (markerRef.current) {
        markerRef.current.map = null;
      }
      markerRef.current = new g.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: office.lat, lng: office.lng },
        title: office.name,
      });
    });
  }

  // If the office prop changes in-place (parent swap), refresh marker + recenter.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      if (cancelled || !mapRef.current) return;
      if (markerRef.current) {
        markerRef.current.map = null;
      }
      markerRef.current = new g.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: office.lat, lng: office.lng },
        title: office.name,
      });
      mapRef.current.setCenter({ lat: office.lat, lng: office.lng });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office.lat, office.lng]);

  async function ensureRenderer(): Promise<google.maps.DirectionsRenderer> {
    if (rendererRef.current) return rendererRef.current;
    if (rendererInitRef.current) return rendererInitRef.current;
    const map = mapRef.current!;
    rendererInitRef.current = loadGoogleMaps().then((g) => {
      const r = new g.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        preserveViewport: false,
      });
      rendererRef.current = r;
      return r;
    });
    return rendererInitRef.current;
  }

  async function requestRoute(
    origin: google.maps.LatLngLiteral | string,
    mode: TravelMode,
  ) {
    const map = mapRef.current;
    if (!map) return;
    const cached = resultsCacheRef.current.get(cacheKey(origin, mode));
    if (cached) {
      const renderer = await ensureRenderer();
      renderer.setDirections(cached);
      setState({ kind: "showing_route", origin, mode, result: cached });
      return;
    }
    setState({ kind: "fetching_route", origin, mode });
    try {
      const g = await loadGoogleMaps();
      const svc = new g.maps.DirectionsService();
      const result = await svc.route({
        origin,
        destination: { lat: office.lat, lng: office.lng },
        travelMode: g.maps.TravelMode[mode],
      });
      resultsCacheRef.current.set(cacheKey(origin, mode), result);
      const renderer = await ensureRenderer();
      renderer.setDirections(result);
      setState({ kind: "showing_route", origin, mode, result });
    } catch (err: unknown) {
      const status = (err as { code?: string })?.code ?? "";
      if (status === "ZERO_RESULTS") {
        toast.error("Walang route nahanap. Subukan ang ibang mode.");
      } else if (status === "OVER_QUERY_LIMIT") {
        toast.error("Maraming requests. Subukan mamaya.");
      } else {
        toast.error("Hindi ma-kuha ang directions. Subukan ulit.");
      }
      // If the failed origin was a manual address, return to the manual-input
      // state with the address preserved so the user doesn't have to retype.
      if (typeof origin === "string") {
        setState({ kind: "geo_denied", manualAddress: origin });
      } else {
        setState({ kind: "idle" });
      }
    }
  }

  function hideRoute() {
    rendererRef.current?.setMap(null);
    rendererRef.current = null;
    rendererInitRef.current = null;
    // Re-show our office marker (DirectionsRenderer hid it).
    const map = mapRef.current;
    if (map) {
      loadGoogleMaps().then((g) => {
        if (markerRef.current) {
          markerRef.current.map = null;
        }
        markerRef.current = new g.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: office.lat, lng: office.lng },
          title: office.name,
        });
        map.setCenter({ lat: office.lat, lng: office.lng });
        map.setZoom(16);
      });
    }
    setState({ kind: "idle" });
  }

  async function handleGetDirections() {
    if (state.kind !== "idle") return; // guard against rapid double-tap
    if (cachedOrigin) {
      await requestRoute(cachedOrigin, "DRIVING");
      return;
    }
    setState({ kind: "requesting_geo" });
    if (!("geolocation" in navigator)) {
      setState({ kind: "geo_denied", manualAddress: "" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedOrigin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        requestRoute(cachedOrigin, "DRIVING");
      },
      () => setState({ kind: "geo_denied", manualAddress: "" }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  function handleModeChange(next: TravelMode) {
    if (state.kind !== "showing_route" && state.kind !== "fetching_route") return;
    requestRoute(state.origin, next);
  }

  const externalMaps = `https://www.google.com/maps/search/?api=1&query=${office.lat},${office.lng}`;

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 space-y-1.5">
        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-teal mt-0.5 shrink-0" />
          <h4 className="font-[var(--font-display)] text-sm text-earth-brown leading-snug">
            {office.name}
          </h4>
        </div>
        {office.address && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 pl-6">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            {office.address}
          </p>
        )}
        <div className="flex items-center gap-3 pl-6 flex-wrap">
          {office.hours && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {office.hours}
            </span>
          )}
          {office.contact_phone && (
            <a
              href={`tel:${office.contact_phone}`}
              className="text-[10px] text-teal underline flex items-center gap-1"
            >
              <Phone className="w-3 h-3" />
              {office.contact_phone}
            </a>
          )}
        </div>
      </div>

      {/* Map */}
      <MapView
        center={center}
        zoom={16}
        onMapReady={handleMapReady}
        ariaLabel={`Map of ${office.name}`}
      />

      {/* Action bar */}
      <div className="p-4 space-y-3">
        {state.kind === "idle" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleGetDirections}
              disabled={state.kind !== "idle"}
              className="w-full sm:flex-1 bg-teal hover:bg-teal/90 text-white rounded-xl min-h-11"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Get Directions
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto rounded-xl border-teal/30 text-teal min-h-11"
            >
              <a href={externalMaps} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1" />
                Open Maps
              </a>
            </Button>
          </div>
        )}

        {state.kind === "requesting_geo" && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Hinihingi ang location…
          </p>
        )}

        {state.kind === "geo_denied" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Hindi ma-detect ang location. I-type ang panimulang address:
            </p>
            <div className="flex gap-2">
              <Input
                value={state.manualAddress}
                onChange={(e) =>
                  setState({ kind: "geo_denied", manualAddress: e.target.value })
                }
                placeholder="Hal: 123 Taft Ave, Manila"
                className="text-base"
              />
              <Button
                onClick={() =>
                  state.manualAddress.trim() &&
                  requestRoute(state.manualAddress.trim(), "DRIVING")
                }
                className="bg-teal hover:bg-teal/90 text-white rounded-xl"
                disabled={!state.manualAddress.trim()}
              >
                Go
              </Button>
            </div>
          </div>
        )}

        {state.kind === "fetching_route" && (
          <div className="h-16 rounded-lg bg-muted animate-pulse" />
        )}

        {state.kind === "showing_route" && (
          <DirectionsPanel
            result={state.result}
            mode={state.mode}
            onModeChange={handleModeChange}
            onHide={hideRoute}
          />
        )}

        {/* Queue tip / best time */}
        {(office.queueTip || office.bestTime) && state.kind === "idle" && (
          <div className="bg-mango-light/50 rounded-lg p-3 space-y-1">
            {office.bestTime && (
              <p className="text-[10px] text-earth-brown">
                <span className="font-semibold">Best Time: </span>
                {office.bestTime}
              </p>
            )}
            {office.queueTip && (
              <p className="text-[10px] text-earth-brown flex items-start gap-1.5">
                <Lightbulb className="w-3 h-3 text-mango mt-0.5 shrink-0" />
                {office.queueTip}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DirectionsPanel({
  result,
  mode,
  onModeChange,
  onHide,
}: {
  result: google.maps.DirectionsResult;
  mode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  onHide: () => void;
}) {
  const leg = result.routes[0]?.legs[0];
  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && onModeChange(v as TravelMode)}
        className="w-full"
      >
        <ToggleGroupItem value="DRIVING" className="flex-1 text-xs min-h-10">
          Drive
        </ToggleGroupItem>
        <ToggleGroupItem value="WALKING" className="flex-1 text-xs min-h-10">
          Walk
        </ToggleGroupItem>
        <ToggleGroupItem value="TRANSIT" className="flex-1 text-xs min-h-10">
          Transit
        </ToggleGroupItem>
      </ToggleGroup>

      {leg && (
        <p className="text-xs text-earth-brown text-center">
          <span className="font-semibold">{leg.duration?.text}</span> ·{" "}
          {leg.distance?.text}
        </p>
      )}

      <Collapsible>
        <CollapsibleTrigger className="w-full flex items-center justify-center gap-1 text-xs text-teal py-1">
          <ChevronDown className="w-3 h-3" /> Show step-by-step
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="space-y-2 mt-2 pl-4 list-decimal text-[11px] text-earth-brown">
            {leg?.steps.map((s, i) => (
              <li key={i}>
                {/* trusted: Google sanitizes their own instruction HTML */}
                <span dangerouslySetInnerHTML={{ __html: s.instructions }} />
                <span className="text-muted-foreground ml-1">
                  ({s.distance?.text}, {s.duration?.text})
                </span>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>

      <Button
        onClick={onHide}
        variant="ghost"
        className="w-full text-xs text-muted-foreground min-h-10"
      >
        <X className="w-3 h-3 mr-1" />
        Hide route
      </Button>
    </div>
  );
}
