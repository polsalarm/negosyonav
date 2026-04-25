# Track N — Map in Roadmap Steps Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed an interactive Google Map of the relevant office inside every Manila Lakad Roadmap step's expanded view, with on-demand directions (route polyline + step list) so the user plans without leaving the app. Step 2 (Barangay) renders a text-only card because Manila's 897 barangays have no static coordinate set.

**Spec:** `docs/superpowers/specs/2026-04-25-track-n-design.md`

**Tech stack:** React 19, wouter, framer-motion (already in deps), shadcn/ui, Tailwind v4, Google Maps JavaScript API (`maps`, `marker`, `routes`, `geometry` libs), Firestore-derived profile via tRPC.

**Mobile-first + design-system constraints (CLAUDE.md, mandatory):**
- 360×640 baseline. Tap targets ≥44px (`min-h-11`/`h-12`). Inputs `text-base`.
- Tokens only: `bg-warm-cream`, `bg-card`, `text-earth-brown`, `bg-teal`, `bg-mango`, `bg-jeepney-red`, `border-border`. No hex.
- Reuse shadcn `Button`, `Select`, `ToggleGroup`, `Collapsible`. No new lib.
- Fonts: `font-[var(--font-display)]`, `font-[var(--font-body)]`, `font-[var(--font-mono)]`.
- Map: `gestureHandling: "cooperative"` so single-finger scroll passes to the page on mobile.
- `BottomNav` clearance — Roadmap already has `pb-20`; do not break it.

**Decisions locked (from brainstorm 2026-04-25):**
- Map provider = Google Maps JS API with real key. Env var `VITE_GOOGLE_MAPS_API_KEY=AIzaSyBIa4UIqliEQhyauHb9KISgtHokYQIbT8o`.
- One office per step. Step 2 = text-only fallback. Step 5 RDO derived from `profile.bizBarangay` via `findDistrict()`; if unparseable, show `<RdoPicker>` and persist pick to `localStorage`.
- Mount-on-first-expand; subsequent collapses hide via `display:none` for instant re-expand.
- Travel modes: `DRIVING` default, `WALKING`, `TRANSIT`. Skip `BICYCLING`.
- Track 0 deferred — extend the flat `client/src/data/manilaData.ts` (no `lgu/` folder rename in this track).
- **Zero backend / tRPC changes.** Pure client work + data file.

---

## File Structure

### New files
- `client/src/lib/maps.ts` — singleton Google Maps script loader.
- `client/src/components/StepOfficeCard.tsx` — branch container; renders one of `<OfficeMapCard>` / `<BarangayTextCard>` / `<RdoPicker>` based on step.
- `client/src/components/OfficeMapCard.tsx` — office info + 180px mini-map + directions panel state machine.
- `client/src/components/BarangayTextCard.tsx` — Step 2 text-only fallback.
- `client/src/components/RdoPicker.tsx` — Step 5 fallback when `bizBarangay` unparseable.
- `client/src/data/manilaData.test.ts` — unit tests for `findDistrict` and `step.officeId` schema integrity.
- `.env.example` — first time created in this repo; document `VITE_GOOGLE_MAPS_API_KEY` + existing Firebase keys.

### Modified files
- `client/src/components/Map.tsx` — full rewrite. Drops dead Forge proxy, uses real key via `loadGoogleMaps()`, exposes `<MapView>` API with `center`/`zoom`/`onMapReady` props.
- `client/src/data/manilaData.ts` — add `id` to `Office`, `officeId?` to `RegistrationStep`, `lat`/`lng`/`bestTime`/`queueTip` to `BirRdo`, `bestTime`/`queueTip` to `Office`, two new `Office` entries (City Treasurer, City Hall main), `findDistrict` helper + barangay range table.
- `client/src/pages/Roadmap.tsx` — fetch profile via tRPC, track expanded steps, mount `<StepOfficeCard>` in expanded slot P2 (between "Where to Apply" and "Requirements").
- `client/src/pages/Places.tsx` — drop local `manilaOffices` array, derive list from `manilaData.offices` + `manilaData.bir_rdos`.
- `.env` — append `VITE_GOOGLE_MAPS_API_KEY=AIzaSyBIa4UIqliEQhyauHb9KISgtHokYQIbT8o` (gitignored, dev only).
- `CLAUDE.md` — add `VITE_GOOGLE_MAPS_API_KEY` to Required env section + Cloud Console restriction note.
- `docs/DEV_TASKS.md` — mark Track N items ✅ + add deviation notes.

---

## Out-of-band manual step (mandatory before merge)

Restrict the Google API key in Cloud Console to prevent quota theft from the public client bundle.

- [ ] **Manual: Restrict API key**
  - Open Google Cloud Console → APIs & Services → Credentials.
  - Find key `AIzaSyBIa4UIqliEQhyauHb9KISgtHokYQIbT8o`.
  - Under "Application restrictions": pick **HTTP referrers**, add `localhost:*/*`, `localhost:3000/*`, and the production hostname (`*.your-prod-domain/*`).
  - Under "API restrictions": pick **Restrict key**, allow only **Maps JavaScript API** and **Directions API**.
  - Save. (The key is already public in the client bundle by design — referrer + API restrictions are what actually prevent abuse.)

---

## Section 1 — Maps infrastructure (commit 1)

### 1.1 Env wiring

- [ ] **Step 1.1.1: Append the key to `.env`** (gitignored).
  Run: `echo 'VITE_GOOGLE_MAPS_API_KEY=AIzaSyBIa4UIqliEQhyauHb9KISgtHokYQIbT8o' >> .env`
  Verify: `grep VITE_GOOGLE_MAPS_API_KEY .env` prints the line.

- [ ] **Step 1.1.2: Create `.env.example`** (does not exist yet).

  Create `.env.example` with this content:
  ```
  # Server
  GEMINI_API_KEY=
  FIREBASE_PROJECT_ID=
  NODE_ENV=development

  # Client (Vite, prefixed VITE_)
  VITE_FIREBASE_API_KEY=
  VITE_FIREBASE_AUTH_DOMAIN=
  VITE_FIREBASE_PROJECT_ID=
  VITE_FIREBASE_STORAGE_BUCKET=
  VITE_FIREBASE_MESSAGING_SENDER_ID=
  VITE_FIREBASE_APP_ID=
  VITE_FIREBASE_MEASUREMENT_ID=

  # Google Maps (client) — restrict in Cloud Console (HTTP referrer + API allowlist)
  VITE_GOOGLE_MAPS_API_KEY=
  ```

- [ ] **Step 1.1.3: Confirm `.env` is gitignored.**
  Run: `git check-ignore .env`
  Expected: prints `.env`. If not, add `.env` to `.gitignore` before continuing.

### 1.2 Singleton loader

- [ ] **Step 1.2.1: Create `client/src/lib/maps.ts`.**

  ```ts
  /// <reference types="@types/google.maps" />

  declare global {
    interface Window {
      google?: typeof google;
    }
  }

  let loaderPromise: Promise<typeof google> | null = null;

  export function loadGoogleMaps(): Promise<typeof google> {
    if (loaderPromise) return loaderPromise;
    loaderPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Google Maps cannot load on the server"));
        return;
      }
      if (window.google?.maps) {
        resolve(window.google);
        return;
      }
      const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!key) {
        reject(new Error("VITE_GOOGLE_MAPS_API_KEY missing"));
        return;
      }
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&libraries=marker,routes,geometry`;
      s.async = true;
      s.defer = true;
      s.onload = () => {
        if (window.google?.maps) resolve(window.google);
        else reject(new Error("Google Maps script loaded but window.google.maps missing"));
      };
      s.onerror = () => reject(new Error("Google Maps script failed to load"));
      document.head.appendChild(s);
    });
    return loaderPromise;
  }
  ```

- [ ] **Step 1.2.2: Verify `@types/google.maps` is installed.**
  Run: `pnpm ls @types/google.maps`
  Expected: a version is printed. If missing, run `pnpm add -D @types/google.maps`, then commit `package.json` + `pnpm-lock.yaml`.

- [ ] **Step 1.2.3: Type-check.**
  Run: `pnpm check`
  Expected: passes (no new errors). If `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` errors, add to `client/src/vite-env.d.ts` (or the existing `env.d.ts` — check `client/src/` for an existing env declaration file first; if none exists, add `interface ImportMetaEnv { readonly VITE_GOOGLE_MAPS_API_KEY: string }` to a new `client/src/vite-env.d.ts`).

### 1.3 `Map.tsx` rewrite

- [ ] **Step 1.3.1: Replace `client/src/components/Map.tsx` entirely** with the new implementation.

  ```ts
  /// <reference types="@types/google.maps" />

  import { useEffect, useRef } from "react";
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
    const errorRef = useRef<HTMLDivElement>(null);

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
        })
        .catch((err) => {
          console.error("[MapView] failed to load:", err);
          if (errorRef.current) errorRef.current.style.display = "flex";
        });
      return () => {
        cancelled = true;
      };
      // mount-once: callers re-center via the Map ref provided in onMapReady
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className={cn("relative w-full h-[180px] rounded-xl overflow-hidden bg-muted", className)}>
        <div ref={containerRef} className="w-full h-full" aria-label={ariaLabel} role="application" />
        <div
          ref={errorRef}
          style={{ display: "none" }}
          className="absolute inset-0 flex items-center justify-center bg-muted text-xs text-muted-foreground p-3 text-center"
        >
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
      </div>
    );
  }
  ```

- [ ] **Step 1.3.2: Run type-check.**
  Run: `pnpm check`
  Expected: passes.

- [ ] **Step 1.3.3: Manual smoke — temporary mount.**
  In `client/src/pages/Places.tsx`, at the top of the JSX (just under the `<header>`), temporarily add:
  ```tsx
  import { MapView } from "@/components/Map";
  // ... in JSX:
  <MapView center={{ lat: 14.5896, lng: 120.982 }} className="h-[200px] my-3" />
  ```
  Run: `pnpm dev`
  Open `http://localhost:3000/places` on a real mobile viewport (DevTools 360×640).
  Expected: Manila City Hall area renders; pinch-zoom works with two fingers; one-finger scroll passes to the page (does not trap inside the map).
  **Then revert this temporary edit** (the real integration happens in Section 4).

- [ ] **Step 1.3.4: Manual smoke — failure path.**
  Temporarily comment out the `VITE_GOOGLE_MAPS_API_KEY=` line in `.env`, restart `pnpm dev`, reload `/places`.
  Expected: fallback box shows "Hindi ma-load ang map. Open in Google Maps →" link.
  Restore `.env`. Restart dev server.

### 1.4 Commit infra

- [ ] **Step 1.4.1: Stage and commit.**
  ```bash
  git add .env.example client/src/lib/maps.ts client/src/components/Map.tsx
  # If you needed a new env declaration file:
  git add client/src/vite-env.d.ts
  # If you added @types/google.maps:
  git add package.json pnpm-lock.yaml
  git commit -m "$(cat <<'EOF'
  feat(maps): real Google Maps loader + MapView rewrite

  Drop dead Forge proxy. Add singleton script loader and a thin
  MapView wrapper with cooperative gestureHandling for mobile and
  a graceful fallback when the API key is missing.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Section 2 — Data shape + `findDistrict` (commit 2, TDD)

### 2.1 Write failing tests first

- [ ] **Step 2.1.1: Create `client/src/data/manilaData.test.ts`** with the following:

  ```ts
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
  ```

- [ ] **Step 2.1.2: Run tests, expect failure.**
  Run: `pnpm test -- client/src/data/manilaData.test.ts`
  Expected: all tests fail (`findDistrict` does not exist; new fields missing).

### 2.2 Extend types + add data + helper

- [ ] **Step 2.2.1: Edit `client/src/data/manilaData.ts` interfaces.**

  Replace the `Office`, `BirRdo`, and `RegistrationStep` interfaces (top of the file) with:

  ```ts
  export interface Office {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    contact_phone?: string;
    contact_email?: string;
    hours: string;
    notes?: string;
    bestTime?: string;
    queueTip?: string;
  }

  export interface BirRdo {
    rdo_code: string;
    name: string;
    districts: string[];
    address?: string;
    lat: number;
    lng: number;
    bestTime?: string;
    queueTip?: string;
  }

  export interface RegistrationStep {
    step_number: number;
    title: string;
    title_tl: string;
    agency: string;
    where_to_apply: string;
    online_url?: string;
    requirements: string[];
    cost: StepCost;
    processing_time_days: number;
    validity_years: number | null;
    output_document: string;
    tips: string[];
    post_registration?: string[];
    renewal_deadline?: string;
    late_penalty?: string;
    officeId?: string;
  }
  ```

- [ ] **Step 2.2.2: Add `id`, `bestTime`, `queueTip` to existing `manilaData.offices` entries** + add two new offices.

  Replace the `offices: [...]` block with:

  ```ts
  offices: [
    {
      id: "manila_city_hall_bureau_permits",
      name: "Manila City Hall — Bureau of Permits",
      address: "Room 110, Padre Burgos Ave, Ermita, Manila 1000",
      lat: 14.5891,
      lng: 120.981,
      contact_phone: "+63 2 5310 4184",
      contact_email: "permits@manila.gov.ph",
      hours: "8:00 AM – 5:00 PM, Mon–Fri",
      notes: "E-BOSS Lounge available at Ground Floor for streamlined processing",
      bestTime: "Tuesday–Thursday, 8:00–10:00 AM",
      queueTip: "Go to E-BOSS Lounge (G/F) for faster processing. Avoid Mondays — longest queue.",
    },
    {
      id: "manila_city_treasurer",
      name: "Manila City Treasurer's Office (Cedula)",
      address: "Manila City Hall, Padre Burgos Ave, Ermita, Manila 1000",
      lat: 14.5891,
      lng: 120.981,
      hours: "8:00 AM – 5:00 PM, Mon–Fri",
      notes: "Online Cedula application available at cedula.ctomanila.com",
      bestTime: "Weekday mornings",
      queueTip: "Apply online first at cedula.ctomanila.com; only visit if pickup is required.",
    },
    {
      id: "negosyo_center_city_hall",
      name: "Negosyo Center Manila City — LGU",
      address: "Manila City Hall, Padre Burgos Ave, Ermita, Manila",
      lat: 14.5891,
      lng: 120.981,
      contact_email: "ncr@dti.gov.ph",
      hours: "8:00 AM – 5:00 PM, Mon–Fri",
      notes: "Free business name registration assistance and MSME support",
      bestTime: "Weekday mornings, 9:00–11:00 AM",
      queueTip: "DTI registration can be done online at bnrs.dti.gov.ph — faster than in-person.",
    },
    {
      id: "negosyo_center_lucky_chinatown",
      name: "Negosyo Center Manila — Lucky Chinatown",
      address: "Lucky Chinatown Mall, Reina Regente St, Binondo, Manila",
      lat: 14.5994,
      lng: 120.9736,
      contact_phone: "7794-2147",
      contact_email: "cityofmanila.mall@negosyocenter.gov.ph",
      hours: "8:00 AM – 5:00 PM, Mon–Sat",
      bestTime: "Weekday afternoons, 2:00–4:00 PM",
      queueTip: "Less crowded than City Hall. Good for DTI registration and BMBE inquiries.",
    },
  ],
  ```

- [ ] **Step 2.2.3: Add `lat`/`lng`/`bestTime`/`queueTip` to every `bir_rdos` entry.**

  Replace the `bir_rdos: [...]` block with:

  ```ts
  bir_rdos: [
    {
      rdo_code: "029",
      name: "RDO 029 — Tondo / San Nicolas",
      districts: ["Tondo", "San Nicolas"],
      lat: 14.612,
      lng: 120.968,
      bestTime: "Early morning, 8:00–9:00 AM",
      queueTip: "Bring all requirements in a folder. BIR is strict on completeness.",
    },
    {
      rdo_code: "030",
      name: "RDO 030 — Binondo",
      districts: ["Binondo"],
      lat: 14.5994,
      lng: 120.9741,
      bestTime: "Tuesday–Thursday mornings",
      queueTip: "Use ORUS (orus.bir.gov.ph) for online registration to skip the queue.",
    },
    {
      rdo_code: "031",
      name: "RDO 031 — Sta. Cruz",
      districts: ["Sta. Cruz", "Santa Cruz"],
      lat: 14.603,
      lng: 120.983,
      bestTime: "Early morning",
      queueTip: "Prepare exact amounts for payments. Some RDOs don't accept large bills.",
    },
    {
      rdo_code: "032",
      name: "RDO 032 — Quiapo / Sampaloc / San Miguel / Sta. Mesa",
      districts: ["Quiapo", "Sampaloc", "San Miguel", "Sta. Mesa", "Santa Mesa"],
      // TODO: refine — placeholder near Sampaloc area
      lat: 14.606,
      lng: 120.993,
      bestTime: "Tuesday–Thursday, 8:00–10:00 AM",
      queueTip: "Largest RDO by population — go early. ORUS strongly recommended.",
    },
    {
      rdo_code: "033",
      name: "RDO 033 — Intramuros / Ermita / Malate / Port Area",
      districts: ["Intramuros", "Ermita", "Malate", "Port Area"],
      address: "181 Natividad Lopez St, Ermita, Manila 1000",
      lat: 14.589,
      lng: 120.975,
      bestTime: "Wednesday mornings",
      queueTip: "Covers Intramuros, Ermita, Malate, and Port Area. Bring 2 copies of each document.",
    },
    {
      rdo_code: "034",
      name: "RDO 034 — Paco / Pandacan / Sta. Ana / San Andres",
      districts: ["Paco", "Pandacan", "Sta. Ana", "Santa Ana", "San Andres"],
      // TODO: refine — placeholder near Paco area
      lat: 14.581,
      lng: 120.992,
      bestTime: "Early morning",
      queueTip: "Mixed residential + commercial RDO. Bring proof of business address.",
    },
  ],
  ```

- [ ] **Step 2.2.4: Add `officeId` to each registration step.**

  In the `registration_steps: [...]` block, add a single line to each step object:

  | step | line to add |
  |---|---|
  | 1 | `officeId: "negosyo_center_city_hall",` |
  | 2 | (do not add — leave officeId undefined) |
  | 3 | `officeId: "manila_city_treasurer",` |
  | 4 | `officeId: "manila_city_hall_bureau_permits",` |
  | 5 | (do not add — resolved at runtime in `StepOfficeCard`) |

- [ ] **Step 2.2.5: Add `findDistrict` + barangay range table at the bottom of `manilaData.ts`** (above `demoMessages`).

  ```ts
  /* ────────────────────────────────────────────────────────────────────────
   * Manila barangay → district lookup
   * Manila has 897 barangays grouped into 16 districts. The numbering
   * roughly follows district boundaries. Ranges below are SEED VALUES;
   * verify against the Manila City Government barangay registry before
   * shipping. Free-text district match is the fallback for any miss.
   * ──────────────────────────────────────────────────────────────────────── */

  type BarangayRange = { from: number; to: number; district: string };

  // TODO(track-c): refine ranges against authoritative source
  // (https://manila.gov.ph or City Council Resolution defining barangays).
  // These values are best-effort and intentionally err toward the
  // free-text fallback when uncertain.
  const BARANGAY_RANGES: BarangayRange[] = [
    { from: 1, to: 267, district: "Tondo" },
    { from: 268, to: 286, district: "San Nicolas" },
    { from: 287, to: 295, district: "Binondo" },
    { from: 296, to: 305, district: "Sta. Cruz" },
    { from: 306, to: 315, district: "Quiapo" },
    { from: 316, to: 394, district: "Sta. Cruz" },
    { from: 395, to: 586, district: "Sampaloc" },
    { from: 587, to: 635, district: "Sta. Mesa" },
    { from: 636, to: 648, district: "San Miguel" },
    { from: 649, to: 653, district: "Port Area" },
    { from: 654, to: 658, district: "Intramuros" },
    { from: 659, to: 670, district: "Ermita" },
    { from: 671, to: 760, district: "Malate" },
    { from: 761, to: 764, district: "San Andres" },
    { from: 765, to: 818, district: "Sta. Ana" },
    { from: 819, to: 831, district: "Paco" },
    { from: 832, to: 846, district: "Pandacan" },
    // 847–897 fall back to free-text matching.
  ];

  const KNOWN_DISTRICTS = [
    "Tondo",
    "San Nicolas",
    "Binondo",
    "Sta. Cruz",
    "Santa Cruz",
    "Quiapo",
    "Sampaloc",
    "San Miguel",
    "Sta. Mesa",
    "Santa Mesa",
    "Intramuros",
    "Ermita",
    "Malate",
    "Port Area",
    "Paco",
    "Pandacan",
    "Sta. Ana",
    "Santa Ana",
    "San Andres",
  ];

  function parseBarangayNumber(raw: string): number | null {
    // Matches "Brgy 123", "Barangay 123", "BRGY. 123", "123" — anywhere in the string.
    const m = raw.match(/(?:^|\s|brgy\.?|barangay)\s*(\d{1,3})\b/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 && n <= 897 ? n : null;
  }

  /**
   * Map a barangay reference (e.g. "Brgy 123, Tondo") to its Manila district
   * name as used in `manilaData.bir_rdos[].districts`. Returns null when the
   * input cannot be resolved — caller should render the RDO picker fallback.
   */
  export function findDistrict(barangay: string): string | null {
    if (!barangay) return null;
    const num = parseBarangayNumber(barangay);
    if (num !== null) {
      const hit = BARANGAY_RANGES.find((r) => num >= r.from && num <= r.to);
      if (hit) return hit.district;
    }
    const lower = barangay.toLowerCase();
    const free = KNOWN_DISTRICTS.find((d) => lower.includes(d.toLowerCase()));
    if (free) {
      // Normalize "Santa Cruz" → "Sta. Cruz" etc. for downstream matching.
      if (free === "Santa Cruz") return "Sta. Cruz";
      if (free === "Santa Mesa") return "Sta. Mesa";
      if (free === "Santa Ana") return "Sta. Ana";
      return free;
    }
    return null;
  }
  ```

- [ ] **Step 2.2.6: Run tests, expect pass.**
  Run: `pnpm test -- client/src/data/manilaData.test.ts`
  Expected: all tests pass. If a barangay-range test fails, the seed range is wrong — adjust ranges and rerun. Do not change the test to match wrong data.

- [ ] **Step 2.2.7: Type-check the whole project.**
  Run: `pnpm check`
  Expected: passes. (The unused `Office` import in `Places.tsx` may already pass; cleanup happens in Section 5.)

### 2.3 Commit data

- [ ] **Step 2.3.1: Stage and commit.**
  ```bash
  git add client/src/data/manilaData.ts client/src/data/manilaData.test.ts
  git commit -m "$(cat <<'EOF'
  feat(roadmap): step→office mapping + findDistrict for BIR RDO routing

  Extend Office/BirRdo/RegistrationStep types, seed coords for all six
  Manila BIR RDOs, add City Treasurer + ids to existing offices, and
  introduce findDistrict() so Step 5 can resolve a user's RDO from
  their bizBarangay. Range-based with free-text fallback.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Section 3 — Components (commit 3)

Build standalone, no Roadmap edits yet. Smoke each via the temporary mount in `Places.tsx` (revert after).

### 3.1 `BarangayTextCard`

- [ ] **Step 3.1.1: Create `client/src/components/BarangayTextCard.tsx`.**

  ```tsx
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
  ```

- [ ] **Step 3.1.2: Type-check.**
  Run: `pnpm check`
  Expected: passes.

### 3.2 `RdoPicker`

- [ ] **Step 3.2.1: Create `client/src/components/RdoPicker.tsx`.**

  ```tsx
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
  ```

- [ ] **Step 3.2.2: Confirm `select` shadcn primitive exists.**
  Run: `ls client/src/components/ui/select.tsx`
  Expected: file exists. If missing, run `npx shadcn@latest add select` first, then commit `client/src/components/ui/select.tsx`.

- [ ] **Step 3.2.3: Type-check.**
  Run: `pnpm check`
  Expected: passes.

### 3.3 `OfficeMapCard` — info + map + directions panel

This is the biggest single file. State machine matches the spec Section 4.4.

- [ ] **Step 3.3.1: Confirm shadcn primitives exist.**
  Run: `ls client/src/components/ui/{toggle-group,collapsible,input}.tsx`
  Expected: all three exist. If any missing, run `npx shadcn@latest add toggle-group collapsible input` and commit the missing files.

- [ ] **Step 3.3.2: Create `client/src/components/OfficeMapCard.tsx`.**

  ```tsx
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
    const resultsCacheRef = useRef<Map<TravelMode, google.maps.DirectionsResult>>(
      new Map(),
    );

    const [state, setState] = useState<DirectionsState>({ kind: "idle" });

    const center = { lat: office.lat, lng: office.lng };

    // Drop a marker on the office once the map is ready.
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      let cancelled = false;
      loadGoogleMaps().then((g) => {
        if (cancelled) return;
        markerRef.current?.map && (markerRef.current.map = null);
        markerRef.current = new g.maps.marker.AdvancedMarkerElement({
          map,
          position: center,
          title: office.name,
        });
      });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [office.lat, office.lng]);

    function handleMapReady(map: google.maps.Map) {
      mapRef.current = map;
    }

    async function requestRoute(
      origin: google.maps.LatLngLiteral | string,
      mode: TravelMode,
    ) {
      const map = mapRef.current;
      if (!map) return;
      const cached = resultsCacheRef.current.get(mode);
      if (cached) {
        renderRoute(cached);
        setState({ kind: "showing_route", origin, mode, result: cached });
        return;
      }
      setState({ kind: "fetching_route", origin, mode });
      try {
        const g = await loadGoogleMaps();
        const svc = new g.maps.DirectionsService();
        const result = await svc.route({
          origin,
          destination: center,
          travelMode: g.maps.TravelMode[mode],
        });
        resultsCacheRef.current.set(mode, result);
        renderRoute(result);
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
        setState({ kind: "idle" });
      }
    }

    async function renderRoute(result: google.maps.DirectionsResult) {
      const map = mapRef.current;
      if (!map) return;
      const g = await loadGoogleMaps();
      if (!rendererRef.current) {
        rendererRef.current = new g.maps.DirectionsRenderer({
          map,
          suppressMarkers: false,
          preserveViewport: false,
        });
      }
      rendererRef.current.setDirections(result);
    }

    function hideRoute() {
      rendererRef.current?.setMap(null);
      rendererRef.current = null;
      // Re-show our office marker (DirectionsRenderer hid it).
      const map = mapRef.current;
      if (map) {
        loadGoogleMaps().then((g) => {
          markerRef.current = new g.maps.marker.AdvancedMarkerElement({
            map,
            position: center,
            title: office.name,
          });
          map.setCenter(center);
          map.setZoom(16);
        });
      }
      setState({ kind: "idle" });
    }

    async function handleGetDirections() {
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
            <div className="flex gap-2">
              <Button
                onClick={handleGetDirections}
                className="flex-1 bg-teal hover:bg-teal/90 text-white rounded-xl min-h-11"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-teal/30 text-teal min-h-11"
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
  ```

- [ ] **Step 3.3.3: Type-check.**
  Run: `pnpm check`
  Expected: passes. (If `s.instructions` errors due to missing `@types/google.maps` member, confirm version is recent — `pnpm ls @types/google.maps`. The Directions step `instructions` field is on the type as of v3.55+.)

### 3.4 `StepOfficeCard` — branch container

- [ ] **Step 3.4.1: Create `client/src/components/StepOfficeCard.tsx`.**

  ```tsx
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
  ```

- [ ] **Step 3.4.2: Type-check.**
  Run: `pnpm check`
  Expected: passes.

### 3.5 Smoke the components in isolation

- [ ] **Step 3.5.1: Temporary mount in `Places.tsx`.**
  At the top of `Places.tsx`'s JSX (under `<header>`), add:
  ```tsx
  import { StepOfficeCard } from "@/components/StepOfficeCard";
  import { manilaData } from "@/data/manilaData";
  // ... in JSX, before existing content:
  <div className="container max-w-2xl mt-4 space-y-4 border-2 border-jeepney-red p-2">
    <p className="text-xs text-jeepney-red">SMOKE TEST — remove after</p>
    {manilaData.registration_steps.map((s) => (
      <div key={s.step_number}>
        <p className="text-xs font-semibold">Step {s.step_number}: {s.title}</p>
        <StepOfficeCard step={s} profile={{ bizBarangay: "Brgy 100" }} />
      </div>
    ))}
  </div>
  ```

- [ ] **Step 3.5.2: Run dev + verify each step renders.**
  Run: `pnpm dev`
  Open `http://localhost:3000/places` at 360×640.
  Expected:
  - Step 1: Negosyo Center map renders with marker.
  - Step 2: BarangayTextCard with "Brgy 100" address + "Find on Maps" button.
  - Step 3: City Treasurer map.
  - Step 4: Bureau of Permits map.
  - Step 5: RDO 029 (Tondo) map (because "Brgy 100" → Tondo).
  - Tap "Get Directions" on Step 4 → grant geo → polyline draws.
  - Toggle Drive / Walk / Transit → polyline updates.
  - Tap "Hide route" → reverts to single marker.

- [ ] **Step 3.5.3: Smoke the RDO picker fallback.**
  In the temporary mount, change `bizBarangay: "Brgy 100"` → `bizBarangay: ""`.
  Reload. Expected: Step 5 shows RDO picker. Pick RDO 030 → map renders. Reload page → picker is gone, RDO 030 map persists (localStorage).
  Then change back to a parseable barangay (`"Brgy 100"`). Reload. Expected: localStorage clears, profile-derived RDO 029 takes over.

- [ ] **Step 3.5.4: Revert the smoke mount in `Places.tsx`** (restore the file). Verify with `git diff client/src/pages/Places.tsx` that Places.tsx is back to its pre-smoke state.

### 3.6 Commit components

- [ ] **Step 3.6.1: Stage and commit.**
  ```bash
  git add client/src/components/StepOfficeCard.tsx \
          client/src/components/OfficeMapCard.tsx \
          client/src/components/BarangayTextCard.tsx \
          client/src/components/RdoPicker.tsx
  # If you added shadcn primitives in Step 3.3.1:
  git add client/src/components/ui/
  git commit -m "$(cat <<'EOF'
  feat(roadmap): step-office card with embedded map + on-demand directions

  Three-branch StepOfficeCard renders an OfficeMapCard for steps 1/3/4,
  a text-only BarangayTextCard for step 2, and a profile-aware
  Step5Bir that resolves the user's RDO via findDistrict(bizBarangay)
  with an RdoPicker fallback persisted to localStorage.

  OfficeMapCard mounts a 180px Google Map (cooperative gestures) and
  drives a state machine for geolocation → DirectionsService →
  DirectionsRenderer with a Drive/Walk/Transit toggle and per-mode
  result cache. Manual address input on geo denial.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Section 4 — Roadmap.tsx integration (commit 4)

### 4.1 Add profile + expansion tracking

- [ ] **Step 4.1.1: Edit `client/src/pages/Roadmap.tsx`.**

  At the top of the file, add the import:
  ```tsx
  import { StepOfficeCard } from "@/components/StepOfficeCard";
  ```

  Inside `Roadmap()` (the default export), near the existing `useState` declarations, add:
  ```ts
  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 min — profile rarely changes mid-session
  });
  const [stepsEverExpanded, setStepsEverExpanded] = useState<Set<number>>(new Set());
  ```

- [ ] **Step 4.1.2: Pass props into each `StepCard`.**
  In the existing `manilaData.registration_steps.map((step, i) => …)` block, add two new props:
  ```tsx
  <StepCard
    key={step.step_number}
    step={step}
    index={i}
    isCompleted={completedSteps.has(step.step_number)}
    isActive={firstIncomplete?.step_number === step.step_number}
    isLocked={!prevCompleted && !completedSteps.has(step.step_number)}
    checkedReqs={checkedReqs}
    onToggleReq={toggleReq}
    onMarkComplete={() => markStepComplete(step.step_number)}
    profile={profile ?? null}                      // NEW
    everExpanded={stepsEverExpanded.has(step.step_number)}  // NEW
    onFirstExpand={() =>                           // NEW
      setStepsEverExpanded((prev) => {
        if (prev.has(step.step_number)) return prev;
        const next = new Set(prev);
        next.add(step.step_number);
        return next;
      })
    }
  />
  ```

### 4.2 Wire into `StepCard`

- [ ] **Step 4.2.1: Extend the `StepCard` props interface.**

  In `Roadmap.tsx`, find the `function StepCard({ ... }: { ... })` signature near the top. Extend it:
  ```tsx
  function StepCard({
    step, index, isCompleted, isActive, isLocked, checkedReqs,
    onToggleReq, onMarkComplete,
    profile, everExpanded, onFirstExpand,
  }: {
    step: RegistrationStep;
    index: number;
    isCompleted: boolean;
    isActive: boolean;
    isLocked: boolean;
    checkedReqs: Set<string>;
    onToggleReq: (key: string) => void;
    onMarkComplete: () => void;
    profile: { bizBarangay?: string | null } | null;
    everExpanded: boolean;
    onFirstExpand: () => void;
  }) {
  ```

- [ ] **Step 4.2.2: Hook `setExpanded` to mark the step as ever-expanded on first open.**

  Find the existing `<button onClick={() => setExpanded(!expanded)} …>` line. Replace `() => setExpanded(!expanded)` with:
  ```tsx
  () => {
    const next = !expanded;
    setExpanded(next);
    if (next) onFirstExpand();
  }
  ```

- [ ] **Step 4.2.3: Slot `<StepOfficeCard>` in expanded content at slot P2.**

  Find this existing block in the expanded content (inside the `<AnimatePresence>` body):
  ```tsx
  {/* Where to apply */}
  <div className="pt-3">
    …
  </div>

  {/* ★ Inline Requirement Tasks ★ */}
  ```

  Insert between them:
  ```tsx
  {/* Office card + map (Track N) */}
  {everExpanded && (
    <div className={expanded ? "block" : "hidden"}>
      <StepOfficeCard step={step} profile={profile} />
    </div>
  )}
  ```

  The `everExpanded` gate ensures the map is only mounted into the DOM after the user has expanded the step at least once. The `expanded` className gate means subsequent collapses keep the map in the DOM (just hidden), so re-expanding is instant.

### 4.3 Smoke the integration

- [ ] **Step 4.3.1: Type-check.**
  Run: `pnpm check`
  Expected: passes.

- [ ] **Step 4.3.2: Manual smoke at `/roadmap`.**
  Run: `pnpm dev`. Open `http://localhost:3000/roadmap` at 360×640. Sign in if needed (Track M auth gate).
  Expected:
  - Each step expands; map renders below "Where to Apply", before "Requirements".
  - Step 2 shows BarangayTextCard.
  - Step 5 behavior depends on the signed-in user's `profile.bizBarangay` — a parseable value picks a RDO; empty/unparseable shows RDO picker.
  - Collapse a step → expand again → map shows instantly (no re-init flash).
  - No horizontal overflow at 360px.
  - `BottomNav` still visible; content not hidden behind it (existing `pb-20` preserved).
  - Tap "Get Directions" → grant geolocation → polyline renders → mode toggle works.

- [ ] **Step 4.3.3: Smoke the empty-profile path.**
  In another browser (or after signing out and creating a fresh account), open `/roadmap` without filling Profile.
  Expected: Step 5 shows RDO picker with the "i-set sa Profile" link. Step 2 shows BarangayTextCard with "Set sa Profile" link. Both `/profile` links navigate correctly.

### 4.4 Commit integration

- [ ] **Step 4.4.1: Stage and commit.**
  ```bash
  git add client/src/pages/Roadmap.tsx
  git commit -m "$(cat <<'EOF'
  feat(roadmap): mount StepOfficeCard inside expanded step view

  Fetches profile once at the page level and passes it through to each
  StepCard. Tracks which steps have ever been expanded and mounts the
  office card lazily on first expand, then keeps it in the DOM
  (display:none) so subsequent toggles are instant.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Section 5 — Places.tsx cleanup (commit 5)

### 5.1 Drop the local data array, derive from `manilaData`

- [ ] **Step 5.1.1: Edit `client/src/pages/Places.tsx`.**

  Delete the local `OfficeInfo` interface and the entire `manilaOffices` array (currently lines ~15–118). Replace with a derivation block at the top of the `Places()` component body:

  ```tsx
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
  ```

  Inside `Places()`, replace the previous `manilaOffices`/`filtered` lines with:
  ```ts
  const places = useMemo<PlaceItem[]>(
    () => [
      ...manilaData.offices.map(officeToPlace),
      ...manilaData.bir_rdos.map(rdoToPlace),
    ],
    [],
  );

  const filtered = filter === "all" ? places : places.filter((o) => o.type === filter);
  ```

  Also import `useMemo` if not already imported.

- [ ] **Step 5.1.2: Update field references in the JSX.**
  All references to `office.id`, `office.name`, `office.address`, `office.phone`, `office.bestTime`, `office.queueTip`, `office.step` continue to work because `PlaceItem` matches the prior local-array shape.

- [ ] **Step 5.1.3: Type-check.**
  Run: `pnpm check`
  Expected: passes.

### 5.2 Smoke `/places`

- [ ] **Step 5.2.1: Manual smoke.**
  Run: `pnpm dev`. Open `/places` at 360×640.
  Expected:
  - All four filter pills work (All, City Hall, Negosyo Center, BIR RDO).
  - Office cards expand to show hours/best-time/queue-tip/phone exactly as before.
  - "Open in Google Maps" deep-link still works.
  - Both Negosyo Centers visible. All 6 RDOs visible under "BIR RDO" filter.
  - Manila City Treasurer + Bureau of Permits both appear under "City Hall" filter.

### 5.3 Commit cleanup

- [ ] **Step 5.3.1: Stage and commit.**
  ```bash
  git add client/src/pages/Places.tsx
  git commit -m "$(cat <<'EOF'
  refactor(places): derive office list from manilaData (single source of truth)

  Drop the duplicated manilaOffices array; build the Places page list
  from manilaData.offices + manilaData.bir_rdos via small adapters.
  Future LGU additions only need to touch the data file.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Section 6 — Docs (commit 6)

### 6.1 CLAUDE.md env section

- [ ] **Step 6.1.1: Edit `CLAUDE.md` "Required env" subsection.**
  In the bullet list under "Active runtime env", add nothing (server vars unchanged).
  In the "Client env" sentence, append a second sentence:
  > Maps env: `VITE_GOOGLE_MAPS_API_KEY` (used by `client/src/components/Map.tsx`). Restrict the key in Google Cloud Console — HTTP referrer allowlist + Maps JS + Directions API only — before any non-localhost deploy.

### 6.2 DEV_TASKS.md update

- [ ] **Step 6.2.1: Edit `docs/DEV_TASKS.md` Track N section.**
  Mark each Track N item ✅ done. Append a deviation block:
  ```markdown
  ### Track N — Map embedded inside roadmap steps — ✅ done 2026-04-25
  …(existing item descriptions, each with ✅ done)…

  > Deviations from spec:
  > - Track 0 deferred — landed against flat `client/src/data/manilaData.ts` instead of `lgu/manila.ts`. Future Track 0 commit handles the rename.
  > - `components/Map.tsx` was rewritten (not "reused") because the prior implementation pointed at the dead Forge proxy.
  > - Added `RdoPicker` (not in original spec) for the `bizBarangay` missing case; choice persists to `localStorage`.
  > - Added `findDistrict()` + `BARANGAY_RANGES` table to `manilaData.ts`. Track C should refactor into a per-LGU adapter when adding Taguig/Cavite/Sampaloc.
  > - `bestTime` / `queueTip` lifted into the `Office` / `BirRdo` interfaces (single source of truth for `/places` and the in-step office card).
  > - Out-of-band: API key restricted in Google Cloud Console (HTTP referrer + API allowlist).
  ```

  Update Section 5 (Suggested order + parallelism) so the Phase 2 row reads:
  ```
  | 2 (HIGH) | Track L (chatbot E2E) | Track N (map in steps) — ✅ done |
  ```

### 6.3 Commit docs

- [ ] **Step 6.3.1: Stage and commit.**
  ```bash
  git add CLAUDE.md docs/DEV_TASKS.md
  git commit -m "$(cat <<'EOF'
  docs(track-n): mark Track N done + record deviations

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Final acceptance gate

- [ ] **Step 7.1: All checks green.**
  Run: `pnpm check && pnpm test`
  Expected: both pass.

- [ ] **Step 7.2: Cold-load smoke at `/roadmap`.**
  Stop dev server. Clear browser cache. Re-run `pnpm dev`. Open `/roadmap` in a fresh incognito window at 360×640.
  Expected: page renders, no console errors. Expand each of 5 steps in turn. Maps render on steps 1/3/4/5 (5 may show RDO picker depending on profile). Step 2 shows BarangayTextCard.

- [ ] **Step 7.3: Verify mount-on-first-expand cache.**
  Expand Step 1 → collapse → expand again. Observe: second expand is instant (no map load flash). Confirms the `everExpanded` + `display:none` strategy works.

- [ ] **Step 7.4: Verify directions flow on a real device** (or DevTools mobile emulator with location override).
  Tap "Get Directions" on Step 4 → grant location → polyline draws → toggle Drive/Walk/Transit → each mode renders a different polyline. Tap "Hide route" → reverts to single marker.

- [ ] **Step 7.5: Verify the API key restriction is in place.**
  Confirm in Google Cloud Console that the key is restricted (HTTP referrers + API allowlist). If not done yet, complete the **Manual** out-of-band step at the top of this plan before merging.

- [ ] **Step 7.6: PR description checklist** (when opening the PR):
  - [ ] All 6 commits present in chronological order.
  - [ ] Smoke video / GIF at 360×640 attached.
  - [ ] Cloud Console restriction screenshot attached or linked.
  - [ ] DEV_TASKS.md Track N marked ✅.
