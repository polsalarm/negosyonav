# Track N — Map Embedded Inside Roadmap Steps

**Status:** Design approved 2026-04-25
**Track:** N (HIGH priority per `docs/DEV_TASKS.md` Section 0)
**Owner:** TBD
**Estimate:** ~6–8 hours, 1 dev, 1–2 sessions

---

## 1. Goal

Every step of the Manila Lakad Roadmap renders, in its expanded view, an embedded interactive Google Map of the relevant office plus on-demand turn-by-turn directions, so the user plans their registration trip without leaving the app. Step 2 (Barangay) is a text-only fallback because Manila's 897 barangays have no static coordinate set.

## 2. Decisions log (brainstorm 2026-04-25)

| # | Decision | Rationale |
|---|---|---|
| Q1 | Google Maps JS API with real key | User explicitly wants in-app navigation; iframe/static cannot draw routes |
| Q2 | Preview map + on-demand directions (route polyline + textual step list) | Live turn-by-turn requires native SDK, infeasible in PWA. Inline route preview gives "stay in app" feel |
| Q3 | Land against flat `client/src/data/manilaData.ts` (defer Track 0) | Track 0 not merged; do not block Track N |
| Q4 | One office per step | User directive |
| Q5 | Build `barangay_to_district` lookup; derive RDO from `profile.bizBarangay` | Manila barangay numbering is range-stable; profile-aware UX |
| Q6 | Step 1 DTI → always City Hall Negosyo Center | Simplest, co-located with most other steps |
| Q7 | Step 2 Barangay → text-only card with "Find on Maps" external link | No static coords for 897 barangays; geocoding fragile + costs |
| Q8 | Mount on first expand, keep in DOM (`display:none` on collapse) | First expand pays init cost, subsequent toggles instant |
| Q8 | Mini-map slot P2 — between "Where to Apply" and "Requirements" | Context-grouped with location info |
| Q9 | Geolocation prompt: lazy on first "Get Directions" tap | Browser-cached permission, contextual ask |
| Q10 | Directions UX: inline expansion (polyline on same map + collapsible step list) | Anchored to step the user is working on |
| Q11 | Schema: add `id` to `Office`, `officeId?: string` to `RegistrationStep` | Single field, undefined for Step 2 |
| Q12 | Travel mode default: `DRIVING`, with `WALKING` / `TRANSIT` toggle (skip `BICYCLING`) | Google's own default; mode toggle gives control; Manila isn't bike-friendly |
| Q13 | Missing `bizBarangay` → `<RdoPicker>` (shadcn Select), persist pick to `localStorage` | One-office rule honored; banner links to Profile to fix permanently |
| Section 6 | `bestTime` + `queueTip` move into `Office`/`BirRdo` interfaces in `manilaData.ts` | Single source of truth |

## 3. Scope

**In scope:**

- Rewrite `client/src/components/Map.tsx` to use a real Google Maps key (current implementation uses dead Forge proxy and is non-functional).
- New `client/src/lib/maps.ts` — singleton script loader.
- New `client/src/components/StepOfficeCard.tsx` — branches on step number into `<OfficeMapCard>` / `<BarangayTextCard>` / `<RdoPicker>` + `<OfficeMapCard>`.
- New `client/src/components/RdoPicker.tsx` — Step 5 fallback when `bizBarangay` unparseable.
- Extend `client/src/data/manilaData.ts`:
  - Add `id` to `Office`; add `officeId?: string` to `RegistrationStep`.
  - Add `bestTime?: string` + `queueTip?: string` to both `Office` and `BirRdo`.
  - Add `lat`/`lng` to all `BirRdo` entries.
  - Add 2 missing offices: `manila_city_treasurer`, `manila_city_hall_main`.
  - Add `findDistrict(barangay: string): string | null` helper backed by Manila barangay number ranges.
- Edit `client/src/pages/Roadmap.tsx` — fetch profile once, pass to each `StepCard`, mount `StepOfficeCard` in expanded slot P2 with mount-on-first-expand cache.
- Edit `client/src/pages/Places.tsx` — drop local `manilaOffices` array, derive view from `manilaData`.
- Add `VITE_GOOGLE_MAPS_API_KEY` to `.env`, `.env.example`, `CLAUDE.md`.

**Out of scope (deferred):**

- Track 0 (router split, `lgu/` folder rename, dead code purge).
- Multi-LGU map data (Track C — Taguig, Cavite, Sampaloc).
- Server-side geocoding of user's actual barangay hall.
- Persisting Step 5 RDO choice to Firestore.
- Backend / tRPC changes — **zero** server work this track.

## 4. Architecture

### 4.1 Map infrastructure

**`client/src/lib/maps.ts`** — promise-cached script loader. Single global script tag, single `window.google` instance.

```ts
let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve(window.google);
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) return reject(new Error("VITE_GOOGLE_MAPS_API_KEY missing"));
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&libraries=marker,routes,geometry`;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error("Maps script failed to load"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}
```

Libraries: `marker` (AdvancedMarkerElement), `routes` (DirectionsService + DirectionsRenderer), `geometry` (distance calcs). No `places`/`geocoding` — Step 2 uses external link.

**`client/src/components/Map.tsx`** — rewritten thin component:

```ts
interface MapViewProps {
  className?: string;
  center: google.maps.LatLngLiteral;
  zoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}
```

- Default 180px height (`h-[180px]`); caller can override via `className`.
- `gestureHandling: "cooperative"` — single-finger scroll passes to page on mobile, two-finger pinches the map. Critical inside scrolling roadmap card.
- `disableDefaultUI: true` + `zoomControl: true` only — strip street view / type / fullscreen for mobile.
- `mapId: "NEGOSYONAV_MAP"` to enable AdvancedMarkerElement.
- On script-load failure: render fallback box "Hindi ma-load ang map. [Open in Google Maps] →".

**API key handling:**

- `VITE_GOOGLE_MAPS_API_KEY=AIzaSyBIa4UIqliEQhyauHb9KISgtHokYQIbT8o` (provided by user 2026-04-25) goes in `.env`.
- `.env.example` gets the key with empty value + comment.
- `CLAUDE.md` "Required env" section gets the key.
- Cloud Console restriction (separate manual step, not code): restrict to Maps JS API + Directions API; HTTP referrer allowlist `localhost:*` + production hostname. Documented in DEV_TASKS.md.

### 4.2 Data shape changes (`manilaData.ts`)

```ts
export interface Office {
  id: string;             // NEW
  name: string;
  address: string;
  lat: number;
  lng: number;
  contact_phone?: string;
  contact_email?: string;
  hours: string;
  notes?: string;
  bestTime?: string;      // NEW (lifted from Places.tsx)
  queueTip?: string;      // NEW (lifted from Places.tsx)
}

export interface BirRdo {
  rdo_code: string;
  name: string;
  districts: string[];
  address?: string;
  lat: number;            // NEW
  lng: number;            // NEW
  bestTime?: string;      // NEW
  queueTip?: string;      // NEW
}

export interface RegistrationStep {
  // ...existing fields...
  officeId?: string;      // NEW — undefined for Step 2 (Barangay)
}

export function findDistrict(barangay: string): string | null;
```

**Office id assignments:**

| id | source |
|---|---|
| `manila_city_hall_bureau_permits` | existing entry |
| `negosyo_center_city_hall` | existing entry |
| `negosyo_center_lucky_chinatown` | existing entry |
| `manila_city_treasurer` | NEW — same building as City Hall, lat 14.5891, lng 120.981 |
| `manila_city_hall_main` | NEW — main entrance, lat 14.5896, lng 120.9820 (lifted from `Places.tsx`) |

**BIR RDO coords** lifted from `Places.tsx` `manilaOffices`:

| rdo_code | lat | lng | source |
|---|---|---|---|
| 029 | 14.6120 | 120.9680 | Places.tsx |
| 030 | 14.5994 | 120.9741 | Places.tsx |
| 031 | 14.6030 | 120.9830 | Places.tsx |
| 032 | 14.6060 | 120.9930 | **placeholder** (Sampaloc area, refine later — TODO) |
| 033 | 14.5890 | 120.9750 | Places.tsx |
| 034 | 14.5810 | 120.9920 | **placeholder** (Paco area, refine later — TODO) |

**Step → office mapping:**

| step | officeId | resolution |
|---|---|---|
| 1 DTI | `negosyo_center_city_hall` | static |
| 2 Barangay | `undefined` | renders `<BarangayTextCard>` |
| 3 Cedula | `manila_city_treasurer` | static |
| 4 Mayor's Permit | `manila_city_hall_bureau_permits` | static |
| 5 BIR | dynamic | `findDistrict(profile.bizBarangay)` → `bir_rdos.find(r => r.districts.includes(district))` |

**`findDistrict` implementation:**

Range-based, not 897-entry dict. Falls back to free-text district name match if user typed e.g. "Tondo" instead of "Brgy 123".

```ts
export function findDistrict(barangay: string): string | null {
  if (!barangay) return null;
  const num = parseBarangayNumber(barangay); // "Brgy 123" → 123, "Barangay 287" → 287
  if (num !== null) {
    if (num >= 1 && num <= 267) return "Tondo";
    if (num >= 268 && num <= 269) return "San Nicolas";
    if (num >= 287 && num <= 295) return "Binondo";
    // ... full Manila barangay numbering ranges (public record):
    // Sta. Cruz, Quiapo, Sampaloc, San Miguel, Sta. Mesa,
    // Intramuros, Ermita, Malate, Port Area,
    // Paco, Pandacan, Sta. Ana, San Andres
    return null;
  }
  // Free-text fallback: user typed "Tondo" or "Sampaloc" directly
  const known = ["Tondo", "San Nicolas", "Binondo", "Sta. Cruz", "Quiapo", "Sampaloc", "San Miguel", "Sta. Mesa", "Intramuros", "Ermita", "Malate", "Port Area", "Paco", "Pandacan", "Sta. Ana", "San Andres"];
  return known.find(d => barangay.toLowerCase().includes(d.toLowerCase())) ?? null;
}
```

### 4.3 Components

**`<StepOfficeCard>`** — single component, three render branches:

```
if (step.step_number === 2) → <BarangayTextCard />
else if (step.step_number === 5):
  district = findDistrict(profile?.bizBarangay)
  rdo = bir_rdos.find(r => r.districts.includes(district)) if district else null
  if (rdo) → <OfficeMapCard office={rdo} />
  else: <RdoPicker> + (after pick) <OfficeMapCard />
else → <OfficeMapCard office={offices.find(o => o.id === step.officeId)} />
```

**`<OfficeMapCard>`** — Steps 1, 3, 4, 5 (resolved):

```
┌──────────────────────────────────────┐
│ 🏢 Office name                        │
│ 📍 Address                            │
│ 🕐 Hours       📞 phone (tap to call) │
├──────────────────────────────────────┤
│      [ Google Map 180px h ]           │
├──────────────────────────────────────┤
│ [ 🧭 Get Directions ] [ Open Maps ]   │
│                                      │
│ (queue tip / best time pill if set)  │
└──────────────────────────────────────┘
```

- "Open Maps" → `https://www.google.com/maps/search/?api=1&query={lat},{lng}` (external).
- "Get Directions" → triggers inline directions panel (Section 4.4).

**`<BarangayTextCard>`** — Step 2 only:

```
┌──────────────────────────────────────┐
│ 🏘️ Your Barangay Hall                  │
│ Punta sa barangay hall ng inyong      │
│ business address.                     │
│                                      │
│ Address: { profile.bizBarangay        │
│   ?? "Set in Profile" }               │
│                                      │
│ [ 🗺️ Find on Maps ]                    │
└──────────────────────────────────────┘
```

- "Find on Maps" → `https://www.google.com/maps/search/?api=1&query={encodeURIComponent((bizBarangay || "") + " barangay hall manila")}`.
- If `profile.bizBarangay` empty → "Set your barangay sa Profile para mas accurate" link to `/profile`.

**`<RdoPicker>`** — Step 5 fallback:

- shadcn `Select` listing 6 RDOs.
- On pick → state lifted in `StepOfficeCard`, persisted to `localStorage["negosyonav_selected_rdo"]`.
- After pick, swaps in `<OfficeMapCard>` for that RDO.
- Banner: "Para auto-pick: i-set ang barangay mo sa Profile. → [Profile]"
- Reload restores from localStorage. If `profile.bizBarangay` later resolves, auto-pick takes over and clears localStorage.

### 4.4 Directions panel (inline expansion in `<OfficeMapCard>`)

**State machine:**

```
idle → requesting_geo → fetching_route → showing_route → idle
              ↓                                ↑
          geo_denied → fallback_address_input ─┘
```

**Behavior per state:**

- **idle:** single AdvancedMarker on office. "Get Directions" button visible.
- **requesting_geo:** spinner + "Hinihingi ang location..." `navigator.geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 })`. Result cached in `useRef` per session, reused across all steps + retries.
- **geo_denied:** inline `Input` for manual address. Submit → pass string as `origin` to DirectionsService (Google geocodes internally — no separate Geocoding API call).
- **fetching_route:** skeleton over directions panel. `DirectionsService.route({ origin, destination, travelMode })`.
- **showing_route:** `DirectionsRenderer` draws polyline on existing map (no new map instance), auto-fits bounds. Below map:
  - Mode toggle row: shadcn `ToggleGroup` — Drive / Walk / Transit.
  - Summary row: ⏱️ duration · 📏 distance.
  - Collapsible step-by-step list (`route.legs[0].steps`), collapsed by default.
  - "Hide route" button → `directionsRenderer.setMap(null)` → reverts to idle. Mode-cached results stay in memory.

**Travel mode caching:** `Map<TravelMode, DirectionsResult>` per component. Toggling back is instant.

**Step instructions HTML:** Google supplies sanitized HTML (`<b>` tags only). Use `dangerouslySetInnerHTML`. Trust-Google approach (industry standard for `DirectionsRenderer` text). DOMPurify not added.

**Error states:**

| Error | UX |
|---|---|
| Geo timeout | drop to `geo_denied` flow |
| `ZERO_RESULTS` | "Walang route nahanap." Mode toggle still active. |
| `OVER_QUERY_LIMIT` | toast "Maraming requests. Subukan mamaya." Reverts to idle. |
| Network fail | toast same as above. |

### 4.5 `Roadmap.tsx` integration

Three additive changes to existing `Roadmap.tsx`:

```ts
// 1. Fetch profile once at top
const { data: profile } = trpc.profile.get.useQuery();

// 2. Track expansion history
const [stepsEverExpanded, setStepsEverExpanded] = useState<Set<number>>(new Set());

// 3. In StepCard expanded view at slot P2:
{stepsEverExpanded.has(step.step_number) && (
  <div className={expanded ? "block" : "hidden"}>
    <StepOfficeCard step={step} profile={profile ?? null} />
  </div>
)}
```

`StepCard.setExpanded` adds the step number to `stepsEverExpanded` on first expand. Mount-on-first-expand + display-none-on-collapse gives instant re-expand without re-init.

No other Roadmap.tsx changes. Diff stays scoped — easy review, low merge conflict with Tracks B / E / O.

### 4.6 `Places.tsx` cleanup

Drop the local `manilaOffices` array (lines 29–118). Derived view:

```ts
const placesList = useMemo(() => [
  ...manilaData.offices.map(o => ({ ...o, type: inferType(o.id), step: stepsForOfficeId(o.id) })),
  ...manilaData.bir_rdos.map(r => ({
    id: r.rdo_code, name: r.name, type: "bir_rdo" as const,
    address: r.address ?? r.districts.join(", ") + ", Manila",
    lat: r.lat, lng: r.lng,
    hours: "Mon–Fri 8:00 AM – 5:00 PM",
    bestTime: r.bestTime ?? "—",
    queueTip: r.queueTip ?? "Use ORUS (orus.bir.gov.ph) for online registration.",
    step: [5],
  })),
], []);
```

Filter UI (`all` / `city_hall` / `negosyo_center` / `bir_rdo`) stays as-is. `/places` route remains in `App.tsx`.

## 5. Failure modes & perf

**Failure matrix:**

| Failure | Surface | Behavior |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` missing | All MapView mounts | Fallback box + "Open in Google Maps" link |
| Maps script network fail / referrer rejected | All MapView mounts | Same fallback |
| Geolocation denied | `Get Directions` | Manual address input fallback |
| Geolocation timeout (>8s) | Same | Same |
| `ZERO_RESULTS` | Showing route | Inline message, mode toggle active |
| `OVER_QUERY_LIMIT` | Same | Toast, reverts to idle |
| Profile undefined (loading) | StepOfficeCard | Skeleton 180px box |
| `bizBarangay` set but unparseable | Step 5 lookup | RDO picker shown |

**Perf budget:**

- Maps JS bundle: ~150kb gzipped, single load via `loadGoogleMaps` singleton.
- First map mount: ~300–500ms script load (one-time) + ~100ms init.
- Worst case: all 5 steps expanded ≈ 5 maps mounted. Acceptable on mid-range Android.
- DirectionsService calls: lazy, user-initiated. Per-mode result cache prevents toggle thrash. Estimated <2 calls per session per user.
- `findDistrict`: O(1) on barangay number parse.

## 6. Tests

| Test | Location | Asserts |
|---|---|---|
| `findDistrict("Brgy 123")` → `"Tondo"` | `client/src/data/manilaData.test.ts` (new) | Number-range parser |
| `findDistrict("Tondo")` → `"Tondo"` | same | Free-text fallback |
| `findDistrict("garbage")` → `null` | same | Unparseable → null |
| `findDistrict("Brgy 295")` → `"Binondo"` | same | Range boundary |
| Every `step.officeId` resolves to existing `Office.id` for steps 1, 3, 4 | same | Schema integrity |

**Skipped:** map render tests (jsdom can't run Google Maps), DirectionsService interaction tests.

**Manual smoke (DoD per CLAUDE.md):**

- 360×640 viewport, expand each step, verify map renders, no horizontal overflow.
- Tap "Get Directions" on Step 4 → grant geo → polyline draws.
- Toggle Drive / Walk / Transit → polyline updates.
- Collapse step → expand again → instant map reveal.
- Step 2 → text-only card, "Find on Maps" opens external.
- Step 5 with `profile.bizBarangay = "Brgy 100"` → auto-picks RDO 029.
- Step 5 with `profile.bizBarangay` empty → RDO picker visible, pick → map renders, reload page → picker gone, picked RDO restored from localStorage.

## 7. Rollout — implementation order

5 commits, each independently reviewable:

1. **Infra commit** — `client/src/lib/maps.ts` + rewrite `Map.tsx` + `.env.example` + `CLAUDE.md` env section.
2. **Data commit** — extend `manilaData.ts` types + add offices + RDO coords + `findDistrict` + tests.
3. **Components commit** — `StepOfficeCard.tsx` + `RdoPicker.tsx`. Stand-alone, importable.
4. **Roadmap integration commit** — slot `StepOfficeCard` into `Roadmap.tsx` + profile query + `stepsEverExpanded`.
5. **Places cleanup commit** — drop duplicate `manilaOffices`, switch to derived view.

Each commit passes `pnpm check` + `pnpm test`. Order 1→2→3→4→5; 5 can swap with 4.

## 8. DEV_TASKS.md update (post-merge)

Mark Track N items ✅ done. Add note:

- Track 0 deferred — Track N landed against flat `manilaData.ts`. Future Track 0 commit handles rename to `data/lgu/manila.ts`.
- Spec said "reuse existing Map.tsx" — actually rewrote it (Forge proxy was broken).
- Added `RdoPicker` (not in original spec) for `bizBarangay` missing case.
- Added `findDistrict` lookup — Track C will refactor into per-LGU adapter.
- `bestTime` / `queueTip` lifted into `Office` / `BirRdo` interfaces (single source of truth).

Cross-track flags:

- **Track C (multi-LGU):** `findDistrict` is Manila-only. Refactor into per-LGU adapter when Taguig/Cavite/Sampaloc land.
- **Track O (per-step feedback):** `StepOfficeCard` doesn't conflict — Track O's `StepFeedbackButton` mounts in same expanded view but separate slot.
- **Track G (geolocation in Places):** Section 4.4's `useRef` geolocation cache can be promoted to a shared `useGeolocation` hook.

## 9. Estimate

~6–8 hours, 1 dev, 1–2 sessions. Heaviest part = Manila barangay range table seeding + Step 5 fallback flow + Cloud Console key restriction setup.
