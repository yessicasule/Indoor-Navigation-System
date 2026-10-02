# Literature notes — Related Work (roadmap §7)

Working notes behind [related-work.md](related-work.md) and [references.bib](references.bib). Compiled 2 Oct 2026 from publisher and indexing pages (IEEE Xplore, ACM DL, MDPI, Springer, ResearchGate, Semantic Scholar).

**Most full texts have not been read yet.** Each summary below comes from the abstract or the indexing page. Read the full text of every paper before citing a specific number from it. Numbers currently quoted in the draft are marked ⚠.

## Novelty check: is the anchor-density question open?

Searches covered QR, fiducial and landmark spacing; PDR reset intervals; and compass error in AR apps. Closest prior work:

| Work | What it does | Why it is not our contribution |
|---|---|---|
| Bach et al. 2023, IEEE Access | Localisation error vs. QR spacing (1, 2, 4 m) | **Mobile robots** with wheel odometry, not pedestrians with a magnetometer |
| Bowers 2022, SAI | Compass deviation curves on 17 devices using AR compass apps; typically 5–10° ⚠ | Device-level deviation, **not** spatial variation inside a building, and **no spacing requirement** derived. Our closest C2 neighbour — read in full and position precisely. |
| Ettlinger et al. 2024, NAVIGATION | Robust heading filter; anomalies cause up to 25° deviation; 17.4° RMS ⚠ | Algorithm paper (native sensor access, lab with laser tracker) |
| Chirakkal 2015; Nowicki 2016; Basiri 2014 | QR codes correct PDR / act as landmarks | Mechanism only; anchor spacing chosen ad hoc, not derived |
| UnLoc (Wang et al. 2012) | Organic landmarks reset dead reckoning | Landmark density not derived from heading error |

**Conclusion so far:** I found no published pedestrian anchor-spacing requirement derived from measured heading error as a function of distance since the last reset. I also found nothing on browser-exposed (W3C Device Orientation) heading in particular. The draft therefore says "we did not find" rather than "nobody has". Keep that wording.

**Still to check before the draft hardens:**
- **IPIN 2026 proceedings** (Rome, 5–8 Oct 2026). Not yet published at the time of writing; IEEE Xplore listing: <https://ieeexplore.ieee.org/xpl/conhome/11539021/proceeding>. Search them for "landmark", "QR", "marker", "heading", "magnetometer" and "browser".
- **IPIN 2024 and 2025 proceedings** — same terms.
- **"Augmented reality smartphone compasses"** (ACM UbiComp/ISWC Adjunct 2019, DOI 10.1145/3341162.3343777) appeared in search results and is probably related to Bowers 2022. Unverified; check it.

## Per block

### 2.1 Visual-inertial AR
- **Feigl et al. 2020 (GRAPP)** — ARCore/ARKit/HoloLens in a 1,600 m² dynamic hall; ≈17 m error per 120 m; "showstopper" ⚠. This is the strongest citation for "SLAM fails at building scale".
- **Morar et al. 2020 (RoEduNet)** — ARCore vs. HTC Vive, 0.16 m mean error ⚠, but only in a small tracked area. Use it to show SLAM works well locally.
- **Marino et al. 2022 (Sensors)** — benchmark of eight devices' built-in AR tracking.
- **Google Indoor Live View (2021)** — only a news source so far (CNBC). Find Google's own blog post or a paper on Google's global localisation / VPS to replace it.

### 2.2 Infrastructure
- **Faragher & Harle 2015 (JSAC)** — BLE, 19 beacons over ~600 m². 95th-percentile error < 2.6 m at 1 beacon per 30 m², < 4.8 m at 1 per 100 m², 8.5 m with existing Wi-Fi ⚠. **Use these densities to build the C4 cost table:** beacons needed = floor area ÷ density, × unit price, + installation, + battery cycles. That keeps the table grounded in a citable density instead of vendor claims.
- **Bahl & Padmanabhan 2000** — RADAR, the origin of Wi-Fi fingerprinting.
- **Zafari et al. 2019** — survey; cite it for the overview rather than citing many individual systems.
- **Alarifi et al. 2016** — UWB review.
- **Cost data gap.** The only cost figures found were vendor blogs (e.g. Mapsted, which sells a beacon-free product, so it's biased). Don't cite those as evidence. Options:
  - quote current retail prices yourself, with date and source, in the cost table
  - find an academic total-cost-of-ownership study (search "indoor positioning total cost of ownership", "beacon maintenance cost study")

### 2.3 Markers and magnetometer heading
- Covered in the novelty table above, plus Mulloni et al. 2009 (fiducials, camera phones) and Sood & Mahato 2022 (QR + AR, ICDCN). Check whether Sood & Mahato is a native app or a web app — if it's a web app, it is the closest system to C1.
- **Afzal et al. 2011 (IPIN)** — the standard citation for "man-made structures perturb indoor magnetic field".
- **W3C Device Orientation and Motion (CRD, 12 Feb 2025):**
  - `deviceorientationabsolute` alpha is relative to **magnetic** north. This supports the declination correction in `analyse.py`.
  - `requestPermission(absolute = false)`. We now call `requestPermission(true)` so the magnetometer is included.

### 2.4 Transit wayfinding — thin; needs 2–3 more sources
- **Hu & Xu 2023 (TRR)** — VR signage experiment; mixed vertical and horizontal signage performed best.
- Candidates seen in search but not yet verified:
  - a *Buildings* 2025 eye-tracking subway wayfinding study (MDPI, DOI 10.3390/buildings15101583)
  - a *Safety Science* 2023 VR + eye-tracker study of subway signage
  - a *Sustainability* 2020 study on legibility of metro wayfinding signs (DOI 10.3390/su12104133)
- Look for an **Indian metro** source (passenger information or accessibility) — it strengthens the motivation for this venue.

## Never-claim checklist (roadmap §1) — the draft complies
- A* is not mentioned as a contribution.
- QR-based positioning is explicitly conceded as established (§2.3, first sentence).
- No "novel framework", "AI-powered" or "revolutionary".
