# Metro Mitra — Publication Roadmap

**Target venue:** ICITSC 2027 — 4th International Conference on Intelligent Transportation and Smart Cities
**Location / dates:** Chengdu, China · 5–7 March 2027
**Paper deadline:** **30 November 2026**
**Revised version + registration:** 31 January 2027
**Proceedings:** SPIE Digital Library (Scopus-indexed)
**Length:** 4–10 pages incl. figures and references
**Submission:** by email to `contact@icitsc.org`

**Plan written:** 2 October 2026 · **Working window: 59 days / ~8.5 weeks**

---

## 0. Read this first

This plan is **not** the 19-week CONECCT plan rescoped. The 30 November deadline forces three structural decisions:

1. **The metro station is out of scope for this paper.** Operator permission (MMOPL/MMRDA) has a 3–6 week lead time, and you need the site for 2–3 weeks of data collection after that. It will not arrive in time. All studies run in a building you already have access to — your college.
2. **The user study is out of scope for this paper.** There is no time for ethics approval plus 20+ participants. It becomes the core of the follow-up paper.
3. **Writing starts in week 4, not week 13.** Roughly half the calendar is writing and review.

What remains is still a genuine contribution: a **measurement and methodology paper**. That fits 4–10 pages comfortably and is honest about what it is.

### Venue caveats to resolve in week 1

| Item | Why it matters | Action |
|---|---|---|
| Template only sent on acceptance | Can't pre-format | Write in neutral single-column; reformat during the 31 Jan revision window. Do not guess their template. |
| Registration fee not published | Budget unknown | Email `contact@icitsc.org` and ask outright |
| Travel to Chengdu | Chinese visa for Indian nationals is slow and variable | **Ask whether online/virtual presentation is permitted.** The organisers' sibling conference (CIDT) ran virtual sessions, so it likely is. Confirm in writing before committing. |
| Email submission, no stated review process | Light review is likely | Do not let this lower your own bar — the follow-up paper depends on this work being sound |

### Topic framing

Your paper is not an explicit topic match (the CFP lists no indoor positioning, wayfinding, or pedestrian navigation). Position it under these listed topics, in this order:

1. **Smart urban mobility and intelligent transportation systems**
2. **Livability and non-motorized transport** — pedestrians; your strongest hook
3. **Human–machine interactions**
4. **Spatial information technology** / **Urban informatics**

Lean into the transit and smart-city framing throughout. This audience cares about **deployment cost and scalability**, not algorithmic novelty — so the cost-comparison table is a headline element here, not an appendix.

---

## 1. The paper

**Title:** *Printed Anchors for Zero-Install Pedestrian Wayfinding: Quantifying Magnetometer Drift Bounds in Large Public Buildings*

**One-sentence claim:** Printed QR anchors plus commodity smartphone-browser sensors are sufficient for indoor pedestrian wayfinding without an app install, beacons, or SLAM — and we quantify how densely those anchors must be placed.

**Contributions — state explicitly in the introduction:**

| | Contribution | Evidence |
|---|---|---|
| **C1** | Zero-install browser-based wayfinding architecture using printed QR codes as absolute pose resets | Working system + architecture figure |
| **C2** | Empirical characterisation of browser-exposed magnetometer heading error across a large public building | Study 1: ~30 surveyed points × 3 devices |
| **C3** | Empirically derived QR anchor density bound for a stated usability threshold | Study 2: error-vs-distance-from-anchor curve |
| **C4** | Deployment cost analysis vs. BLE / Wi-Fi fingerprinting / SLAM | Cost table |
| **C5** | Open-source system + released waypoint and magnetic-survey datasets | Public repo + Zenodo DOI |

**C2 and C3 are the paper.** C1 alone is a project.

**Deferred to the follow-up paper:** metro station deployment, user study vs. signage, SUS/NASA-TLX, multi-station generalisation.

### Never claim

- That A\* is a contribution. One sentence: *"routing uses standard A\* search over a hand-authored topological graph."* No novelty language.
- That QR-based indoor positioning is new. It isn't. Your delta is the **anchor density bound**.
- Anything "AI-powered", "revolutionary", or "novel framework". Reviewers at every tier punish this.

---

## 2. Critical path

Only two things can sink the 30 November date.

| Risk | Mitigation | Deadline |
|---|---|---|
| **Sensor bugs invalidate all data** (§4) | Fix before collecting a single data point | Week 1 |
| **No HTTPS origin** → camera and compass both silently fail on phones | Cloudflare Tunnel for testing, deployed URL for collection | Week 1 |

Site access is *not* a risk here — that is the entire reason the metro is deferred. Pick a building you can enter tomorrow: your own department block, the library, or a multi-floor academic building. Multi-floor with corridors and a stairwell is ideal.

---

## 3. Week-by-week plan

### Week 1 — 2–9 Oct · Unblock
- [ ] **Rotate the leaked Google Maps API key.** It has been in public git history for months.
- [ ] `git rm --cached backend/.env`; purge from history with `git filter-repo`; add to `.gitignore`
- [x] Rewrite `backend/.gitignore` — every comment line is currently missing its `#`, and the `!!` line parses as a negation pattern
- [x] Remove `node-fetch` + `@types/node-fetch`; use global `fetch`. Backend starts.
- [ ] Populate `serviceAccountKey.json` (currently 0 bytes); make the failure path soft instead of `exit(1)`
- [ ] **Fix the three sensor bugs — see §4**
- [ ] Stand up HTTPS (Cloudflare Tunnel) + deployed staging
- [ ] Choose and walk the study building; obtain written permission from the department
- [ ] Email `contact@icitsc.org`: template, fee, **online presentation option**, review process

### Week 2 — 10–16 Oct · One working system
- [x] Merge `test_backend.js` endpoints + its **correct** A\* into `index.ts`. One server, one port, one collection (`ar_waypoints`).
- [x] Delete the broken A\* and `euclideanDistance` from `index.ts`
- [x] Promote `ARtestMihit.tsx` → `ARNavigation.tsx`, route at `/ar`, add to nav. Delete `ARGuidance.tsx`.
- [x] Put the site/building ID in the QR payload; delete hardcoded `azad_nagar_metro` and the hardcoded `<h2>Azad Nagar</h2>`
- [x] Centralise `API_BASE` via `VITE_API_BASE_URL`; add an `ErrorBoundary`
- [x] Delete `metro-ar-app/`, `Profile.tsx`, `src/index.html`, Lovable meta tags, `react-qr-reader`, `lovable-tagger`
- [ ] Pilot: 2 people, 3 devices including **at least one iPhone**, full flow over HTTPS

### Week 3 — 17–23 Oct · Telemetry and instrumentation
- [ ] **Build the telemetry logger (§5).** Without it you will be transcribing compass readings by hand.
- [ ] Build `scripts/analyse.py` — reads the export, emits every figure
- [ ] Survey the building: waypoint graph in **metres**, x/y from one origin corner
- [ ] **Establish ground-truth bearings (§6)** — the methodological crux
- [ ] Print, laminate, and mount QR anchors; log exact position and mounting bearing of each

### Week 4 — 24–30 Oct · Data collection + start writing
- [ ] **Study 1:** ~30 grid points × 3 devices × 10 s capture. Note nearby steel, lifts, electrical rooms.
- [ ] **Study 2:** 5 fixed routes from each anchor, logging continuously → drift-vs-distance curve
- [ ] **Begin writing: Related Work** (§7). Runs in parallel — do not wait for analysis.

### Week 5 — 31 Oct – 6 Nov · Analysis
- [ ] All analysis scripted; **4 figures frozen**
- [ ] Draft Introduction, System Architecture, Methodology, Results
- [ ] Build the deployment cost table (C4)

### Week 6 — 7–13 Nov · Full draft
- [ ] Complete draft, all sections, within 4–10 pages
- [ ] Write the **Limitations** section (§8) — do not leave it to last
- [ ] Figures legible in greyscale at print size

### Week 7 — 14–20 Nov · Review
- [ ] Guide review + one reader outside the project
- [ ] Self-run similarity check. **Do not reuse prose from your project report** — unpublished self-overlap still flags.
- [ ] Public repo + Zenodo DOI + dataset release

### Week 8 — 21–27 Nov · Submit
- [ ] Final proofread; verify every number in the text matches the figures
- [ ] **Submit by 25 November** — five days of slack is the plan, not the luxury
- [ ] Keep the submission email and any acknowledgement

### Buffer — 28–30 Nov
Reserved. Do not plan work here.

---

## 4. The three sensor bugs — fix before collecting any data

These silently corrupt the exact measurements that constitute C2 and C3.

### Bug A — the compass is dead on every iPhone
`ARtestMihit.tsx` lines 107–127 attach the listener directly. iOS 13+ requires `DeviceOrientationEvent.requestPermission()` from inside a user gesture. Verified: **it is never called anywhere in the project.** On iOS, `webkitCompassHeading` never fires, `e.alpha` is null, `e.alpha || 0` yields `0`, and `360 - 0 = 360` — the arrow points at a **constant fixed heading** and looks plausible while being entirely fake.

### Bug B — on Android it is not a compass at all
The listener is on `'deviceorientation'`, whose `alpha` on Chrome/Android is **relative to an arbitrary reference captured at sensor start**, not true north. Absolute heading requires `'deviceorientationabsolute'`. The `setBaseHeading()` re-zero at scan time masks this well enough to demo, but it makes any measurement of "heading error vs. true bearing" meaningless.

### Bug C — HTTPS is mandatory
Both `deviceorientation` and `getUserMedia` require a secure context. The hardcoded `http://192.168.1.6:3001` cannot work from a phone.

### Correct implementation

```ts
// Must be called from a click handler, never from useEffect
async function enableCompass(): Promise<boolean> {
  const DOE = window.DeviceOrientationEvent as any;
  if (typeof DOE?.requestPermission === 'function') {
    if (await DOE.requestPermission() !== 'granted') return false;   // iOS 13+
  }
  const evt = 'ondeviceorientationabsolute' in window
    ? 'deviceorientationabsolute'   // Android: true north
    : 'deviceorientation';          // iOS: webkitCompassHeading
  window.addEventListener(evt, handleOrientation);
  return true;
}
```

Record per sample **which event type fired and the `absolute` flag**. You need this for the paper's device table, and it is the first thing a careful reviewer will ask about.

---

## 5. Telemetry logger

Log to Firestore at ~5 Hz, one row per sample:

```
session_id, participant_id, condition, device_model, os_version,
event_type ('deviceorientationabsolute' | 'deviceorientation'), absolute_flag,
timestamp_ms, raw_alpha, webkit_compass_heading, smoothed_heading,
last_anchor_id, ms_since_anchor, metres_since_anchor,
nodes_traversed, current_target_node,
survey_point_id        // Study 1 only
```

Add a `?study=1&point=P07` URL mode that freezes the UI into a labelled 10-second capture. Pair it with `scripts/analyse.py` so regenerating a figure after a review comment is one command, not a day.

---

## 6. Ground truth — the methodological crux

A reviewer will interrogate this. You do not need a theodolite.

1. Identify 2–3 long straight architectural features (corridor wall, building facade line).
2. Take GPS fixes at both ends of each, from outside or at the doorways.
3. Compute each feature's **true bearing** from those coordinates.
4. Use those as indoor angular reference lines; sight along them with a handheld compass held clear of steel.
5. State residual uncertainty. **±2–3° is honest and acceptable.**

**Write this paragraph before you collect data.** If you cannot write it, the method is not sound yet.

---

## 7. Related work — the section that decides the paper

Four blocks, each ending in an explicit statement of your delta:

1. **SLAM / visual AR navigation** — ARCore, ARKit, Google VPS / Live View. Delta: requires app install, device support, and relocalization that fails in crowded low-texture interiors.
2. **Infrastructure-based positioning** — BLE beacons, UWB, Wi-Fi fingerprinting. Delta: capex, battery maintenance, survey effort, per-site scaling cost.
3. **Marker/fiducial-based positioning** — the closest prior art. **Concede the mechanism is well-established**, then state your delta: nobody has published the anchor *density* requirement derived from measured magnetometer error.
4. **Transit passenger information systems** — venue-appropriate framing; cite transit wayfinding literature.

**Read the IPIN 2026 proceedings** (conference ran 5–8 Oct 2026, Rome; papers appear in IEEE Xplore shortly after). That is your literature review, and it will tell you quickly whether the anchor-density question is genuinely open. Do this in week 4, before the draft hardens.

---

## 8. Reviewer pre-mortem

Write a prepared answer to each of these **into the paper**, not into a rebuttal.

| Objection | Your answer |
|---|---|
| "Why not ARCore / Live View?" | A full paragraph: install friction for transient users, device/OS coverage, SLAM relocalization failure indoors, no VPS coverage of the target sites. Cite sources. |
| "Marker-based positioning isn't new." | Agree explicitly in the intro. Your delta is the density bound, not the mechanism. |
| "A\* is textbook." | Don't claim it. One descriptive sentence. |
| "Magnetometers are known to be unreliable indoors — so what?" | Sharpest threat. Everyone knows it *qualitatively*; you publish the magnitude and convert it into a **deployment parameter** (anchor spacing). The heatmap figure must carry this. |
| "Only one building, no users." | Own it in Limitations before they raise it. State explicitly that the metro deployment and user study are in progress. |

### Mandatory sections whose absence reads as carelessness
- **Limitations** — one building, daytime only, device mix, no user study, QR wear/vandalism
- **Deployment cost table** — QR vs. BLE vs. Wi-Fi fingerprinting: capex, opex, survey effort, per-site scaling
- **Data and code availability** — repo URL + Zenodo DOI

---

## 9. Master fix / remove / replace

### FIX
| Item | Location | Severity |
|---|---|---|
| iOS compass permission never requested | `ARtestMihit.tsx:107-127` | **Invalidates data** |
| `deviceorientation` → `deviceorientationabsolute` | same | **Invalidates data** |
| No HTTPS origin | `ARtestMihit.tsx:35` | **Blocks all field work** |
| `node-fetch` v3 ESM vs `commonjs` → server won't start | `backend/index.ts:5` | Blocker |
| `serviceAccountKey.json` is 0 bytes → `exit(1)` | `backend/` | Blocker |
| A\* leaves stale `f` in `openSet`, no closed set → suboptimal paths (fuzzed: 13/4000 wrong, worst case 32% longer) | `backend/index.ts:154-174` | Credibility |
| Leaked API key in git history | `backend/.env` | **Rotate before repo goes public** |
| Malformed `.gitignore` — comments missing `#`, `!!` parses as negation | `backend/.gitignore` | Risks service-account leak |
| `&long=` vs backend's `lon` → endpoint always 400s | `MapView.tsx:106` | Bug |
| Lucide icon called as a function → `TypeError`, whites out the app | `ARGuidance.tsx:108` | Moot once deleted |
| Hardcoded site ID and building name | `ARtestMihit.tsx:138`, `:285` | Generalisability |
| `/timings` dead link (route not registered) | `Home.tsx:28` | Polish |
| TS strict off (`strict`, `strictNullChecks`, `noImplicitAny` all false); 12 lint errors | tsconfigs | Repo credibility for C5 |

### REMOVE
| Item | Why |
|---|---|
| `metro-ar-app/` entirely | Untouched Expo starter; `ARNavigation.tsx` never imported; Viro + `react-native-arkit` incompatible with New Architecture; no camera permission declared. Zero value. |
| `ARGuidance.tsx` | Fake AR (`bg-black/50` + an icon), crashes on render, superseded |
| `Profile.tsx` | 100% hardcoded. A reviewer opening your repo and finding "25 trips this month" is a credibility hit. |
| "Interactive Metro Map" claim; `MapView.tsx` or merge into `RoutePlanner` | Claims a feature that does not exist; ~70% duplicated logic |
| `backend/index.ts`'s `aStarSearch` + `euclideanDistance` | Keep `test_backend.js`'s correct version |
| `node-fetch`, `@types/node-fetch`, `react-qr-reader`, `lovable-tagger`, `@types/dotenv` | Broken, abandoned, or scaffold cruft |
| Lovable `og:image` / `twitter:site` meta tags | Social preview currently advertises Lovable |
| `src/index.html`; one of the two lockfiles; root orphan `package-lock.json` | Dead files |

### REPLACE
| Replace | With |
|---|---|
| Euclidean distance on raw lat/long | x/y in **metres** from a site-local origin |
| `test_backend.js` (name and split) | Merged into `index.ts` as the single server |
| `ar-waypoints` / `ar_waypoints` collection split | One collection: `ar_waypoints` |
| ~15 hardcoded `localhost:3001` + one LAN IP | `src/lib/api.ts` with `VITE_API_BASE_URL` |
| Hardcoded `EXIT_GATE_C_2` destination | User-selected from the destination list |
| Manual data collection | Telemetry logger → Firestore → `scripts/analyse.py` |
| Package name `vite_react_shadcn_ts` | A real name |

---

## 10. Dual-track plan — ICITSC then CONECCT

ICITSC is the fast, lower-bar venue. **IEEE CONECCT 2027 (deadline 15 Feb 2027) remains the stronger target.** Run both, sequentially, with genuinely different papers.

| | **Paper 1 → ICITSC 2027** | **Paper 2 → IEEE CONECCT 2027** |
|---|---|---|
| Deadline | 30 Nov 2026 | 15 Feb 2027 |
| Site | College building | **Mumbai Metro, Azad Nagar** |
| Studies | Magnetic survey + drift curve | + **user study vs. signage**, N≥20, SUS |
| Contribution | Methodology + anchor density bound | Operational validation + human performance |
| Proceedings | SPIE / Scopus | IEEE Xplore |

**Rules you must not break:**
- ICITSC's own terms forbid work "simultaneously submitted to a journal or another conference." Sequencing is clean because ICITSC's outcome is known before 15 Feb — but **never have both under review with the same content.**
- Paper 2 needs **≥30% new material** to be a legitimate extension. A new site, a user study, and a new contribution clear that bar. Copy-pasting Paper 1 with a new title does not.
- **Cite Paper 1 in Paper 2** and state the extension explicitly.

### Actions now that serve the CONECCT paper
- [ ] **Send the MMOPL / MMRDA permission letter this week**, on HOD letterhead. 3–6 week lead time; starting now means access by mid-November for a December–January metro campaign.
- [ ] **File ethics approval this week** for the user study.

Both are cheap to start and gate Paper 2 entirely. Starting them in week 1 costs nothing and buys the whole second track.

---

## 11. Three things to do today

1. **Rotate the Google Maps API key.** It has been publicly exposed in git history for months.
2. **Remove `node-fetch`, switch to global `fetch`, confirm the server starts.** One hour, and it gates everything else.
3. **Email `contact@icitsc.org`** asking the fee, the template, and whether **online presentation** is permitted — the answer determines whether a Chinese visa is on your critical path.

Then set **13 November** as the go/no-go checkpoint: if Studies 1 and 2 are not fully analysed by then, cut scope rather than the review week.
