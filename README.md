# Metro Mitra

QR-AR based indoor navigation for metro commuters: smart indoor wayfinding and optimal routes to access points, **with no app install**.

Mumbai Metro can be confusing for newcomers and tourists, especially when switching lines or finding exits. Metro Mitra uses printed QR anchors and the sensors already in a phone's web browser:

- **Scan a QR anchor:** the phone's normal camera app opens the web app at your location; nothing to install.
- **Pick a destination:** the route is computed with A\* over a surveyed waypoint graph (metres, multi-floor).
- **Follow the arrow:** the arrow is drawn over the camera view. It uses the browser compass, re-calibrated at every anchor you scan, because the compass drifts indoors.
- **Plan metro journeys:** nearest station and line-by-line route between stations (Home page).
- **Nearby attractions:** points of interest around stations.

The repository also contains the measurement tooling for the accompanying paper: heading-error telemetry, a magnetic survey mode, and the analysis that derives how densely anchors must be placed. See [roadmap.md](roadmap.md) and [PROGRESS.md](PROGRESS.md).

## Repository layout

| Path | What |
|---|---|
| `Indoor-Navigation-System/` | Web app: React + Vite + TypeScript, Tailwind / shadcn-ui |
| `backend/` | API: Express + Firebase Admin (Firestore); A\* routing; telemetry ingestion; site data scripts |
| `data/` | Site surveys (`sites/<site_id>/`), formats and field procedure — start with [data/README.md](data/README.md) |
| `scripts/` | Python: ground-truth bearings (`groundtruth.py`), paper figures and numbers (`analyse.py`) |
| `paper/` | Related-work draft, references and literature notes |

## Quick start (no Firebase needed)

Needs Node 20 or later.

```sh
cd Indoor-Navigation-System && npm install && npm run build
cd ../backend && npm install && npm run demo
```

Open <http://localhost:3001>. The demo server runs the real API on an in-memory copy of the example site (`data/sites/_template`) and prints its anchor links. For example, <http://localhost:3001/ar?site=_template&node=_template__A1> opens navigation at the entrance.

## Development

```sh
# terminal 1 — API on :3001 (Firestore via backend/serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT)
cd backend && npm install && npm run dev

# terminal 2 — web app on :5173, proxies /api to :3001
cd Indoor-Navigation-System && npm install && npm run dev
```

**Phones.** The camera and compass only work over HTTPS. For a quick test, run `npm run tunnel` (Cloudflare quick tunnel, needs `cloudflared`). For field work and printed anchors, use a stable deployed host instead (see next section).

Copy `backend/.env.example` to `backend/.env` for the Google Maps key (metro journey planner) and other settings.

## Deployment

The backend serves the built web app, so one Node process gives phones a single HTTPS origin for camera, compass and API:

```sh
cd Indoor-Navigation-System && npm ci && npm run build
cd ../backend && npm ci && npm start          # PORT, FIREBASE_SERVICE_ACCOUNT from the environment
```

## Tests and benchmarks

| Command | Covers |
|---|---|
| `cd backend && npm test` | Typecheck; A\* vs. Dijkstra on 4,000 random graphs; API tests against an in-memory Firestore (routing, site isolation, caching, telemetry validation, SPA serving) |
| `cd Indoor-Navigation-System && npm test` | Heading maths (incl. tilt compensation), bearings, anchor URL parsing |
| `cd Indoor-Navigation-System && npm run test:e2e` | Full app in a phone-sized browser with a simulated compass: anchor calibration, arrow direction, stairs, arrival, Study 1 capture rate, telemetry upload |
| `python -m unittest discover -s scripts/tests` | Analysis recovers planted effects (anchor distance bound, Study 1 bias, declination), held-out validation, data-quality checks, input validation |
| `cd backend && npm run bench` | A\* latency on building-like graphs |
| `python scripts/bench_analysis.py` | Analysis pipeline runtime |

CI (`.github/workflows/ci.yml`) runs all of the test commands above (not the benchmarks).

## Data and studies

[data/README.md](data/README.md) covers:
- surveying a site
- computing ground-truth bearings
- printing QR anchors
- running Study 1 (magnetic survey) and Study 2 (heading drift vs. distance)
- exporting telemetry and regenerating every figure

The printable field procedure is [data/FIELD-CHECKLIST.md](data/FIELD-CHECKLIST.md).
