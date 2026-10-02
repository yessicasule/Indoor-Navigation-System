# Progress Log

Running record of work done against [roadmap.md](roadmap.md). Newest entry first.
Update this file at the end of every work session.

---

## Current status

**Phase:** Week 4 — Data collection + start writing (24–30 Oct 2026).
- The Related Work draft is done (needs your full-text reading).
- Studies 1 and 2 are **blocked** until the Firebase key, a stable HTTPS host and the Week 3 fieldwork are in place.
- Field procedure: [data/FIELD-CHECKLIST.md](data/FIELD-CHECKLIST.md).
- **Codebase: complete for the paper's needs and fully tested** — see "Codebase health" below.

**Last updated:** 2 Oct 2026
**Uncommitted:** mostly.
- **Committed:** Weeks 1–3 core code (`e35e70e`, `4e3f8a8`), and `f7f688f` ("overall fixes"), which contains only the four deletions: `MapView.tsx`, `bun.lockb`, root `package-lock.json`, old Azad Nagar QR image.
- **Staged, not committed:** everything else from the Week 4 and codebase-completion sessions.

### Codebase health (all passing on 2 Oct 2026)

| Check | Result |
|---|---|
| Backend `npm test` (typecheck + A* fuzz + API tests on in-memory Firestore) | 14/14 |
| Frontend `npm run typecheck` (TS **strict**) / `npm run lint` | clean / 0 problems |
| Frontend `npm test` (heading maths, bearings, anchor parsing) | 12/12 |
| Frontend `npm run test:e2e` (real app in a phone browser, simulated compass) | 5/5 |
| Python `python -m unittest discover -s scripts/tests` | 19/19 |
| `npm run import-site -- _template --dry-run` | valid |
| A* benchmark (`npm run bench`) | 1.7 ms median at 4,900 nodes |
| Analysis benchmark (`python scripts/bench_analysis.py`) | 7 s for 65k samples |

### Next up

**Blocked on you — needed before any field test**
- [ ] **Rotate the Google Maps API key** — still exposed in git history (commit `3d24291`). Billing is also not enabled on that project.
- [ ] Put the Firebase service account JSON in `backend/serviceAccountKey.json` (file is currently 0 bytes). Telemetry uploads return 503 until this is done.
- [ ] Install cloudflared: `winget install Cloudflare.cloudflared`
- [ ] Fix git ownership error: `git config --global --add safe.directory D:/MiniProject/Indoor-Navigation-System`
- [ ] **Pick a stable HTTPS host** (named Cloudflare tunnel or deployed staging) **before printing anchors.** Printed QR codes embed the host.
- [ ] Email `contact@icitsc.org`; building permission; MMOPL letter; ethics filing

**Week 2 leftover**
- [ ] Pilot: 2 people, 3 devices incl. an iPhone, full flow over HTTPS. Also check:
  - `heading_source` values look right holding the phone flat vs. upright
  - iOS `webkitCompassHeading` is sensible when the phone is held upright (see Known gaps)

**Week 3 fieldwork (tools ready — see [data/README.md](data/README.md))**
- [ ] Copy `data/sites/_template/` → `data/sites/<site_id>/`. Survey the waypoint graph in metres from one origin corner. Validate with `npm run import-site -- <site_id> --dry-run`.
- [ ] Ground truth (§6):
  - fill `reference_lines.csv` with GPS fixes along long facades or corridors
  - run `python scripts/groundtruth.py <site_id> --write`
  - set `magnetic_declination_deg` from NOAA
- [ ] **Write the §6 ground-truth paragraph before collecting data.** Use the uncertainty that `groundtruth.py` reports.
- [ ] Fill `survey_points.csv` (~30 points, alignment direction, notes on steel/lifts/electrical rooms)
- [ ] `npm run import-site -- <site_id>`, then `npm run anchors -- <site_id> --base https://<stable-host>`. Print, laminate and mount.
- [ ] Choose and justify the usability threshold for `analyse.py --threshold` (default 30°)

**Week 4 — writing (yours)**
- [ ] Read the full text of every paper in `paper/references.bib`, starting with Bowers 2022 (closest to C2) and Feigl 2020. Check every number marked ⚠ in `paper/literature-notes.md`.
- [ ] Fill the `verified` gaps in `references.bib` (DOIs and pages marked "memory" or "add …")
- [ ] Add 2–3 transit wayfinding sources, ideally one Indian metro source
- [ ] **IPIN 2026 proceedings** (conference 5–8 Oct): search them for landmark/QR/marker/heading work before the draft hardens
- [ ] Rewrite `paper/related-work.md` in your own words. It's a starting draft; the paper's prose should be yours.

**Week 4 — data collection (yours, after the blockers)**
- [ ] Study 1: ~30 points × 3 devices × 10 s — follow `data/FIELD-CHECKLIST.md`
- [ ] Study 2: 5 routes from each anchor, logging continuously

**Code**
- [ ] Review and commit the working tree (nothing from these sessions is committed)
- [ ] Purge `backend/.env` from history (`git filter-repo` + force-push) — after key rotation; needs confirmation
- [ ] Choose a licence before the repo goes public (C5) — your call; none is set
- [ ] VS Code shows "Cannot find module numpy/matplotlib" in `scripts/` because its Python interpreter is 3.13 (no packages). Select the Python 3.10 interpreter, or `pip install -r scripts/requirements.txt` for 3.13.

### How to run

**Try it without Firebase:** `cd Indoor-Navigation-System && npm run build`, then `cd ../backend && npm run demo`. Open the anchor link it prints (template site, in-memory data).

**Development / field (HTTPS for phones):**

```sh
# terminal 1 — backend on :3001
cd backend && npm run dev

# terminal 2 — frontend on :5173, proxies /api → :3001
cd Indoor-Navigation-System && npm run dev

# terminal 3 — public HTTPS URL for the phone
cd Indoor-Navigation-System && npm run tunnel
```

| Mode | URL on the phone |
|---|---|
| Navigate | `/ar` (in-page scanner) or the anchor URL `/ar?site=<siteId>&node=<docId>` |
| Study 1 capture | `/ar?study=1&site=<siteId>&point=P01&device=<label>&pid=<operator>` |
| Study 2 logging | `/ar?log=1&device=<label>&pid=<operator>`, then scan an anchor in-page |

After collecting: `cd backend && npm run export`, then `python scripts/analyse.py --site <siteId>`. Figures and `summary.json` are written to `figures/`.

### Data model

- **`sites/{siteId}`:** `name`, `north_offset_deg`, `magnetic_declination_deg`
- **`ar_waypoints/{siteId}__{nodeId}`:** `station_id` (= site ID), `node_id`, `name`, `type`, `x`, `y`, `z`, `floor`, `neighbors`, `anchor_map_bearing_deg`. Named nodes without "Node" in the name are destinations.
- **`telemetry_batches/{batchId}`:** session fields plus `samples[]`. One doc per ~10 samples; the batch ID makes retries idempotent.
- **Source of truth:** `data/sites/<siteId>/*.csv`; `import-site` uploads them.

Full conventions and column definitions: [data/README.md](data/README.md).

### Known gaps

- **Old QR codes no longer work.** `AZAD_G1_ENT_QR.png` and the old Azad Nagar `ar_waypoints` docs predate the new format. Data imported via `import-site` is what the app now expects.
- **Upright iOS heading unverified.** On iOS the heading is Apple's `webkitCompassHeading`, whose behaviour when the phone is held upright hasn't been checked on a device. Android uses the tilt-compensated formula in `use-compass.ts`, which I've checked numerically. `raw_beta`/`raw_gamma` are logged so this can be analysed after the fact.
- **Portrait only.** Heading assumes portrait orientation; there is no landscape handling.
- **Position comes from taps.** Study 2 interpolates position between "I'm here" taps, assuming steady walking along straight segments. Say so in Methodology.
- **Analysis tested on synthetic data only.** `analyse.py` has been run on synthetic data, never real data. Expect to adjust plots once real data exists.
- **Tabs share one upload queue.** Two tabs logging at once could overwrite each other's unsent-batch queue in localStorage. Use one tab per phone.
- **Arrow tested with a simulated compass only.** The e2e tests drive the real event handler with synthetic `deviceorientationabsolute` events; a real-device pilot is still required.
- **Home/Nearby depend on Google Maps + station data.** The metro journey planner needs a working Maps key with billing, plus `stations`/`pois` in Firestore. Not part of the paper.

---

## Log

### 2 Oct 2026 — Completing the codebase (unattended session)

You asked for a clean, functioning, fully tested codebase while away. Nothing was committed, pushed, or sent anywhere; no history was rewritten.

**Roadmap §9 cleanup**
- **Removed:** `MapView.tsx` and the `/map` route (duplicated `RoutePlanner`, unbacked "Interactive Metro Map" claim); `bun.lockb` (npm is used); root orphan `package-lock.json`; `public/AZAD_G1_ENT_QR.png` (old payload format).
- **Package names:** `metro-mitra` / `metro-mitra-backend`.
- **TypeScript strict mode** on (strict, noImplicitAny, strictNullChecks); it already compiled cleanly.
- **Lint:** all 6 errors fixed, and the old `handleRealScan` hook warning fixed via a ref. shadcn `ui/` is exempt from the fast-refresh rule. 0 problems.

**Backend**
- **App factory:** `app.ts` (`createApp({ db, storageAvailable, frontendDist, ... })`); `index.ts` just wires Firestore and listens.
- **Telemetry validation:** per-field types, ranges and enums. Bad values are stored as null and counted, not dropped wholesale; samples without a valid timestamp are dropped; unknown fields are stripped; per-batch validation counts are stored.
- **Site graph cache** (60 s). Each route request used to read the whole site from Firestore, which is billed per document.
- **Serving the app:** the backend serves the built frontend with an SPA fallback, plus a JSON 404 for unknown `/api` routes. One process can now be deployed.
- **Credentials:** `FIREBASE_SERVICE_ACCOUNT` env var supported (hosted deploys); an empty key file is treated as absent; `.env` is loaded for the scripts too.
- **Shared site helpers:** `makeUndirected`, `unreachableFrom` and `waypointDoc` moved to `scripts/site-data.ts`, shared by the importer, tests and demo server.
- **Demo server:** `npm run demo` runs the real API on an in-memory copy of a site, no Firebase needed.
- **Tests:** `app.test.ts`, 13 API tests. `npm test` = typecheck + A* fuzz + API tests.
- **Benchmark:** `npm run bench`. A* is fast enough, so no heap was added: 0.04 ms at 49 nodes, 1.7 ms median at 4,900.

**Frontend UI** — every screen reviewed via phone-sized screenshots
- **Navigation screen is full-screen.** Header, tab bar and floating button no longer cover the HUD and controls. Added a close button. Uses `100dvh`.
- **HUD:** shows "To <destination>", a readable step title ("Next turn" / place name / "Stairs / lift"), the segment distance and metres remaining. Raw corridor-node names are no longer shown.
- **Select sheet:** shows the site name instead of internal IDs.
- **Bug fix:** when opened from the camera app, the anchor calibration was skipped because the compass hadn't fired yet. It now waits up to 1.5 s for the first reading.
- **No-compass message:** distinguishes "no compass on this device" from "arrow not aligned".
- **Tab bar:** active indicator fixed (it always sat in the centre). "AR" renamed "Scan" with a QR icon; the redundant floating QR button is gone.
- **Toasts** moved to the top; two noise toasts removed.
- **Copy:** Nearby's unbacked "100+ attractions" claim replaced.
- **Accessibility:** aria-labels on the theme toggle and close button; `aria-current` on tabs.
- **Pages lazy-load** (entry bundle 434 kB → 321 kB). An anchor-link visitor downloads only the navigation screen.

**Frontend tests**
- **Vitest unit tests (12):** heading formula (flat, upright, gimbal lock, continuity at the 45° switch), bearings and circular stats, anchor URL parsing.
- **Playwright e2e (5),** on the demo server with a simulated compass:
  - anchor-link calibration
  - arrow at 0° / +90° / 0° as the user turns
  - stairs step, arrival, close
  - invalid anchor rejected
  - Study 2 telemetry reaches the server (~30 samples in 6 s)
  - Study 1 captures 45–55 samples in 10 s at 5 Hz

**Analysis (Python)**
- **Data-quality report** in `summary.json`: out-of-range/missing headings, stale sensor readings, relative-heading devices, missing device model, duplicates, logging gaps *within* a capture or segment, median sample interval. Exact duplicates are dropped.
- **Train-test validation of the anchor distance bound:**
  - the bound is derived without some runs and tested on the held-out runs
  - and leave-one-device-out
  - reports held-out coverage (should stay near 95%)
- **Input validation** for `reference_lines.csv` and `survey_points.csv`. `--data-dir` option; `run()` is callable from tests.
- **Tests:** `scripts/tests/` has 19 unittest cases on generated synthetic data with known planted effects:
  - the bound is recovered within one bin
  - held-out coverage ≥ 90%
  - Study 1 bias recovered within 0.6°
  - declination applied
  - relative-heading devices excluded
  - injected bad data is flagged
  - ground-truth bearing maths
- **Benchmark:** `scripts/bench_analysis.py` — 7 s for 65k samples.

**Repo**
- `README.md` rewritten: accurate features, quick start, dev, deployment, tests table.
- `.github/workflows/ci.yml` runs every test suite, the build and the e2e tests.
- `.gitignore` covers Playwright output.

### 2 Oct 2026 — Week 4: Related Work draft, field checklist

**Related Work (roadmap §7)** — `paper/`
- `related-work.md`: draft §2 in four blocks (visual-inertial AR, infrastructure, markers + magnetometer heading, transit wayfinding). Each block ends with its delta. QR positioning is conceded as established; the claimed gap is worded "we did not find".
- `references.bib`: 20 entries, each found and confirmed via publisher or indexing pages. A `verified` field records which details were confirmed and which (a few author lists, pages, DOIs) still need checking.
- `literature-notes.md`:
  - novelty check — closest prior work is Bach 2023 (robots, QR spacing), Bowers 2022 (device-level compass deviation) and Ettlinger 2024 (heading filter); none derives a pedestrian anchor-spacing bound
  - numbers that still need full-text confirmation (⚠)
  - plan for a citable C4 cost table, built from Faragher & Harle's beacon densities
  - gaps: transit sources, IPIN 2026
- Full texts have **not** been read yet; only abstracts and indexing pages.

**Code fix found during the literature search**
- The W3C Device Orientation spec (CRD, Feb 2025) defines `requestPermission(absolute = false)`, which omits the magnetometer, so spec-following browsers would never fire `deviceorientationabsolute`. `use-compass.ts` now calls `requestPermission(true)`. Safari currently ignores the argument. Frontend `tsc` passes.
- The same spec confirms that `deviceorientationabsolute` is relative to **magnetic** north, which supports the declination correction in `analyse.py`.

**Data collection support**
- `data/FIELD-CHECKLIST.md`: printable pre-flight, per-point (Study 1), per-route (Study 2) and end-of-day checks.

**Not done (blocked):** Studies 1 and 2. `serviceAccountKey.json` is still 0 bytes, `cloudflared` is not installed, and there is no site survey yet.

### 2 Oct 2026 — Week 3: telemetry and instrumentation

**Telemetry logger (roadmap §5)**
- `src/lib/telemetry.ts` — `TelemetryLogger`:
  - 10-sample batches, flushed every 2 s to `POST /api/telemetry`
  - unsent batches persisted in localStorage and retried, including after a reload
  - `sendBeacon` on `pagehide`
  - client-side `batch_id`, so retries are idempotent
  - also collects device model and OS version (UA-CH, falling back to user-agent parsing)
- `src/hooks/use-telemetry.ts`: samples at 5 Hz while `recording`; exposes upload stats.
- Backend: `POST /api/telemetry` whitelists session and sample fields and accepts JSON or text/plain (beacon). It stores to `telemetry_batches/{batch_id}` and returns 503 without Firebase so the client keeps the batch queued.
- Logged fields: everything in §5, plus `raw_beta`, `raw_gamma`, `heading_source`, `raw_heading`, `sample_age_ms`, `frame_offset_deg`, `calibration_source` and `current_node`.

**Study 1 capture mode:** `/ar?study=1&site=…&point=P07&device=…&pid=…` → `src/pages/StudyCapture.tsx`.
- One tap gives a 3 s hands-off settle, then a 10 s capture at 5 Hz.
- Summary shows the circular mean, spread and absolute/relative flag, with warnings for relative heading, too few samples or movement.
- "Next point" increments the point ID (P07 → P08); the point is kept in the URL.

**Compass**
- `use-compass.ts`: `headingFromEuler` computes the top-edge heading when the phone is flat, and the back-camera direction (tilt-compensated) when it's held up. 360 − alpha breaks down near upright because of gimbal lock.
- Checked numerically for flat, upright N/E/S, tilted, and the gimbal-lock case.

**Navigation (`ARNavigation.tsx`)**
- **Anchor heading reset:** on scan, correction = (anchor's surveyed facing bearing) − (measured heading). An amber "Face the QR marker and tap to calibrate" button appears if no heading was available at scan time (iOS before permission, camera-app flow).
- **Fallback:** "assume facing the first segment".
- **Arrow:** `ArrowUp` rotated by `angleDiff(corrected heading, segment bearing)`, in true bearings when the site's north offset is known.
  - This replaces the old `baseHeading` logic, which mixed counter-clockwise and clockwise angle conventions.
- **Re-align button:** now "face the next point and tap".
- **Stairs and lifts:** segments with no horizontal length show "Take the stairs/lift to floor N" instead of an arrow.
- **Study 2 logging:** `?log=1` (plus `pid`, `device`, `cond`) records while navigating, with a REC/upload status line in the HUD.
- **New endpoint:** `GET /api/sites/:siteId` (name, north offset).

**Backend**
- `firebase.ts`: shared Firebase init, used by the server and the scripts.
- A*: optional `z` (height), so stair edges have a real cost. Fuzz test still passes.
- Waypoints now carry `z`, `floor` and `anchor_map_bearing_deg`.

**Site data tooling** — formats documented in `data/README.md`:
- `npm run import-site -- <site> [--dry-run] [--prune] [--directed]`:
  - validates IDs, numbers, neighbours and anchor bearings, and checks every node is reachable
  - makes edges two-way
  - uploads `sites/{site}` and `ar_waypoints/{site}__{node}`
- `npm run anchors -- <site> --base https://…`: printable A4 sheet of QR anchors (error correction Q), showing name, node ID, facing bearing and position.
- `npm run export`: Firestore → `data/export/telemetry.csv`, one row per sample.
- `data/sites/_template/`: example site with waypoints, survey points and reference lines. Illustrative only.

**Python** (`scripts/`, `requirements.txt`)
- `groundtruth.py`: true bearings of reference lines from GPS, per-line north offset, inverse-variance circular mean, GPS-limited uncertainty (√2·σ/L) with short-baseline warnings, optional handheld-compass cross-check; `--write` updates `site.json`.
- `analyse.py`: Study 1 error per point/device, Study 2 error vs. distance since anchor (time-interpolated between taps, anchor reset vs. raw compass, bootstrap CI on the 95th percentile), anchor distance bound at `--threshold`.
  - Writes `fig1`–`fig4` (greyscale-safe), `table_devices.csv`, per-point and per-bin CSVs and `summary.json`.
- Verified on synthetic data in a throwaway folder (deleted afterwards). It recovered the planted effect: error crosses 30° in the 15–20 m bin, as generated.

**Verified:** backend `tsc` and `npm test`; frontend `tsc`, lint (only the old warning) and `vite build`; `import-site --dry-run` and `anchors` on the template; `groundtruth.py` on the template (6.33° offset, matches hand calculation); telemetry endpoint returns 503 without Firebase and 400 on bad input, `/api/sites` returns 404.

### 2 Oct 2026 — Week 2: one working system

**Backend — one server, one collection**
- New `backend/astar.ts`: the correct A* from `test_backend.js` (closed set, entries updated in place), ported to TypeScript.
- New `backend/astar.test.ts` (`npm test`): seeded fuzz test vs. Dijkstra, 4000 random graphs, 0 suboptimal paths.
- `backend/index.ts`:
  - Removed the broken `aStarSearch`, `euclideanDistance`, `WaypointNode` and the `/api/ar-route` endpoint (it read the hyphenated `ar-waypoints` collection).
  - Added `GET /api/waypoints/:docId`, `GET /api/destinations?stationId=` and `GET /api/ar-path?from=&to=`, all on `ar_waypoints`.
  - Queries are scoped by `station_id`: destinations and paths only load the relevant site, not the whole collection.
  - `ar-path` skips waypoints missing `node_id` or x/y (logs a warning) instead of producing NaN costs.
  - Port is now `process.env.PORT || 3001`.
- Deleted `backend/test_backend.js`.
- `package.json`: `npm start`, `npm run dev` and `npm test`; `main` → `index.ts`.
- Verified: `tsc` passes. Through the Vite proxy (stub db): destinations 400 without `stationId` and 200 with it; unknown waypoint / ar-path → 404; old `/api/ar-route` → 404.

**Frontend**
- `ARtestMihit.tsx` → `ARNavigation.tsx` (git rename), component `ARNavigation`, routed at `/ar`. The `/ARtest` route is gone. Nav and the floating QR button already point at `/ar`.
- New `src/lib/anchor.ts`: QR payload is the URL `/ar?site=<siteId>&node=<docId>`.
  - Scanning with the phone's own camera opens the page directly.
  - The in-page scanner parses the same URL.
- `ARNavigation.tsx`:
  - Removed hardcoded `azad_nagar_metro`, the `Azad Nagar` heading and the "Simulate" button. To simulate, open `/ar?site=…&node=…`.
  - On scan, fetches the anchor waypoint and the site's destinations in parallel and checks the anchor belongs to the site.
  - Shows the anchor's name plus `siteId · nodeId`.
  - Excludes the start node from destinations.
  - Scan lock (`busyRef`) stops repeat scans from firing parallel requests.
  - Destination select is now controlled; added a typed `Destination`, which fixes the old `any[]` lint error.
- New `src/components/ErrorBoundary.tsx`, wrapping all routes and keyed on path so navigating away clears the error.
- Deleted `ARGuidance.tsx`, `Profile.tsx`, `src/index.html` and `metro-ar-app/`.
- Removed the Profile nav item and Home's dead "My Trips" (`/profile`) and "Find Trains" (`/timings`) actions.
- `index.html`: removed the Lovable `og:image` / `twitter:site` / `twitter:image` meta tags.
- Uninstalled `react-qr-reader` and `lovable-tagger`; dropped `componentTagger` from `vite.config.ts`.
- Verified: `tsc` passes; `vite build` passes; `/ar?site=x&node=y` serves the SPA.
- Ticked six of the seven Week 2 items in `roadmap.md` (the pilot is still open).

### 2 Oct 2026 — Week 1 code tasks

**Backend**
- `backend/.gitignore` rewritten: real `#` comments; ignores `.env`, `.env.*` (except `.env.example`) and `serviceAccountKey.json`.
- `git rm --cached backend/.env` (staged). `serviceAccountKey.json` was never committed.
- Added `backend/.env.example`.
- Removed `node-fetch`, `@types/node-fetch` and `@types/dotenv`; `index.ts` uses Node's global `fetch`.
- Kept the pre-existing uncommitted soft Firebase init in `index.ts`. A bad or empty key file now logs a one-line warning and falls back to an empty stub db (the stub gained `docs: []`).
- Verified: `tsc --noEmit` passes, server starts, `/api/stations` returns `[]`, outbound `fetch` reaches Google.

**Sensor bugs (roadmap §4)**
- New `src/hooks/use-compass.ts`:
  - **Bug A (iOS):** `DeviceOrientationEvent.requestPermission()` via `enable()`, called from tap handlers.
  - **Bug B (Android):** listens on `deviceorientationabsolute` when available.
  - Null readings are ignored instead of becoming 0°.
  - Each sample records `eventType`, `absolute`, `rawAlpha`, `webkitCompassHeading`, `heading` and `timestampMs` for the Week 3 telemetry logger.
- `ARtestMihit.tsx` now uses the hook:
  - `enable()` runs from "Simulate" and "Start Navigation".
  - The compass status line on the scan screen doubles as the enable button.
  - A toast warns when the page isn't in a secure context.
  - Smoothed heading is normalised to 0–360.
  - The backend URL text box and `192.168.1.6` default are removed.

**HTTPS / API base (Bug C)**
- New `src/lib/api.ts` with `API_BASE` from `VITE_API_BASE_URL`, empty by default so requests stay same-origin.
- `vite.config.ts` proxies `/api` → `http://localhost:3001`. Through the tunnel, the phone uses one HTTPS origin for camera, compass and API.
- All hardcoded `http://localhost:3001` URLs replaced in `RoutePlanner.tsx`, `MapView.tsx`, `Nearby.tsx` and `ARGuidance.tsx`.
- Added the `npm run tunnel` script (cloudflared quick tunnel → :5173).
- Verified: `/api/stations` through the Vite proxy on :5173 returns `[]`.

**Other**
- Fixed the `&long=` → `&lon=` bug in `MapView.tsx` (roadmap §9).
- Frontend `tsc` and `vite build` pass.
- Ticked the `.gitignore` and `node-fetch` items in `roadmap.md`.
