/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { loadGoogleMaps } from "@/lib/maps";

export interface MapViewProps {
  className?: string;
  center: google.maps.LatLngLiteral;
  zoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  /** Aria label for the map div. Defaults to "Map". */
  ariaLabel?: string;
}

export function MapView({
  className,
  center,
  zoom = 16,
  onMapReady,
  ariaLabel = "Map",
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center,
          zoom,
          mapId: "NEGOSYONAV_MAP",
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        onMapReady?.(mapRef.current);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[MapView] failed to load:", err);
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
    // mount-once: callers re-center via the Map ref provided in onMapReady
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn(
        "relative w-full h-[180px] rounded-xl overflow-hidden bg-muted",
        className,
      )}
    >
      {loadState !== "error" && (
        <div
          ref={containerRef}
          className="w-full h-full"
          aria-label={ariaLabel}
          role="application"
        />
      )}
      {loadState === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-xs text-muted-foreground p-3 text-center">
          Hindi ma-load ang map.{" "}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal underline ml-1"
          >
            Open in Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
