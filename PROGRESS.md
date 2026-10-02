# Progress Log

Running record of work done against [roadmap.md](roadmap.md). Newest entry first.
Update this file at the end of every work session.

---

## Current status

**Phase:** Week 2 — One working system (10–16 Oct 2026). Code done; only the pilot remains.
**Last updated:** 2 Oct 2026
**Uncommitted:** yes — Weeks 1–2 are all in the working tree. Deletions and the `ARNavigation.tsx` rename are staged.

### Next up

**Blocked on you (do these first)**
- [ ] **Rotate the Google Maps API key** — still exposed in git history (commit `3d24291`). The Geocode API also reports billing is not enabled on that project.
- [ ] Put the Firebase service account JSON in `backend/serviceAccountKey.json` (file is currently 0 bytes).
- [ ] Install cloudflared: `winget install Cloudflare.cloudflared`
- [ ] Fix git ownership error: `git config --global --add safe.directory D:/MiniProject/Indoor-Navigation-System`
- [ ] Email `contact@icitsc.org` — template, fee, online presentation option, review process
- [ ] Choose study building + written permission from the department
- [ ] Send MMOPL/MMRDA permission letter; file ethics approval (Paper 2 track)
- [ ] **Pilot (Week 2):** 2 people, 3 devices including at least one iPhone, full flow over HTTPS. Needs the Firebase key + tunnel.

**Ready to do (code)**
- [ ] Commit the Weeks 1–2 changes
- [ ] Purge `backend/.env` from git history with `git filter-repo` + force-push — **only after the key is rotated**; needs confirmation
- [ ] Week 3: telemetry logger (roadmap §5) — Firestore at ~5 Hz, reusing `useCompass().sampleRef`, plus the `?study=1&point=P07` capture mode
- [ ] Week 3: `scripts/analyse.py`
- [ ] Week 3: QR anchor generator script — prints `…/ar?site=<id>&node=<doc id>` QR codes for every anchor waypoint in a site
- [ ] Remaining §9 cleanup: one of the two frontend lockfiles (`bun.lockb` / `package-lock.json`), root orphan `package-lock.json`, `MapView.tsx` merge-or-remove, package name `vite_react_shadcn_ts`, TS strict mode

### How to run (HTTPS for phones)

```sh
# terminal 1 — backend on :3001 (single server; AR endpoints included)
cd backend && npm start          # npm test runs the A* fuzz test

# terminal 2 — frontend on :5173, proxies /api → :3001
cd Indoor-Navigation-System && npm run dev

# terminal 3 — public HTTPS URL for the phone
cd Indoor-Navigation-System && npm run tunnel
```

Open the anchor URL on the phone: `https://<tunnel>/ar?site=<siteId>&node=<waypoint doc ID>`, either by scanning the anchor QR with the camera app or by typing it in. A plain `/ar` opens the in-page scanner.

### Data model (`ar_waypoints` collection)

One doc per waypoint. Fields: `node_id`, `name`, `station_id` (= site/building ID), `x`, `y` (metres from the site origin), `neighbors` (list of `node_id`s), `type`.
Nodes with a `name` that doesn't contain "Node" are listed as destinations.
The old hyphenated `ar-waypoints` collection is no longer read.

### Known gaps

- **Old printed QR codes no longer work.** `AZAD_G1_ENT_QR.png` encodes a bare node ID; anchors must now encode the `/ar?site=…&node=…` URL. Reprint in Week 3.
- AR arrow still uses the "reset forward at navigation start" (`baseHeading`) model. Pointing along true bearings needs the map's north offset from the Week 3 survey.
- Pre-existing lint warning in `ARNavigation.tsx`: `handleRealScan` missing from the camera effect's dependencies.
- The new AR flow has only been checked against the empty stub db (no Firebase key here); it hasn't been run against real data.

---

## Log

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
