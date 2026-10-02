# Site data and study pipeline

Everything that defines a study site lives in `data/sites/<site_id>/`. Copy `_template/` to start a new site; its values are illustrative, not a real survey.

## Conventions

| Quantity | Convention |
|---|---|
| Map coordinates | `x`, `y`, `z` in **metres** from one origin corner of the building; `z` is height (floor × storey height), so stair and lift edges have a real length |
| Map bearing | Degrees **clockwise from the map's +y axis**: 0 = +y, 90 = +x |
| True bearing | Degrees clockwise from true north |
| `north_offset_deg` | True bearing of the map's +y axis, so **true = map + north_offset** |
| `magnetic_declination_deg` | East positive, so **true = magnetic + declination**. Phone compasses report magnetic heading. Get the value for the site and date from the [NOAA calculator](https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml). |
| Errors | Measured − reference, wrapped to (−180°, 180°] |

## Files per site

### `site.json`

```json
{ "site_id": "college_main", "name": "Main Academic Block", "north_offset_deg": null, "magnetic_declination_deg": -0.4 }
```

`north_offset_deg` is filled in by `python scripts/groundtruth.py <site_id> --write`.

### `waypoints.csv` — the navigation graph

| Column | Meaning |
|---|---|
| `node_id` | Unique within the site; letters, digits, `_`, `-` |
| `name` | Shown to users. **Named nodes are destinations.** Leave blank (or include "Node") for corridor junctions. |
| `type` | `anchor` for QR anchors, otherwise free text (`path`, `room`, `stairs`, …) |
| `x`, `y`, `z` | Metres (see conventions) |
| `floor` | Floor number, shown in stair/lift instructions |
| `neighbors` | `;`-separated `node_id`s. Edges are made two-way on import. |
| `anchor_map_bearing_deg` | Anchors only: map bearing a person **faces** while scanning the mounted QR code. This is the absolute heading reset. |
| `notes` | Free text, e.g. "steel pillar 1 m east" |

Validate without uploading:

```sh
cd backend && npm run import-site -- <site_id> --dry-run
```

Upload with `npm run import-site -- <site_id>` (add `--prune` to delete nodes removed from the CSV). Waypoint doc IDs are `<site_id>__<node_id>`.

### `reference_lines.csv` — ground truth (roadmap §6)

Long straight architectural features (facade lines, long corridor walls), with GPS fixes at both ends.

| Column | Meaning |
|---|---|
| `line_id`, `description` | Free text |
| `lat1`, `lon1`, `lat2`, `lon2` | GPS fixes at end 1 and end 2. Average several fixes per end. |
| `map_bearing_deg` | Direction end 1 → end 2 in map coordinates |
| `handheld_compass_deg` | Optional cross-check: magnetic bearing sighted along the feature, compass held clear of steel |

`scripts/groundtruth.py` reports each line's true bearing, the per-line north offset, the residual between lines, and the GPS-limited uncertainty. That uncertainty is ≈ √2·σ/L, so use features of 100 m or more where possible.

### `survey_points.csv` — Study 1 points

| Column | Meaning |
|---|---|
| `point_id` | Matches `?point=` in the capture URL (e.g. `P07`) |
| `x`, `y`, `floor` | Position (metres) |
| `align_map_bearing_deg` | Direction the phone's **top edge** points during capture, in map coordinates. Usually 0/90/180/270 along a corridor wall. |
| `notes` | Nearby steel, lifts, electrical rooms, … |

## QR anchors

```sh
cd backend && npm run anchors -- <site_id> --base https://<stable-host>
```

This writes `data/sites/<site_id>/anchors.html` (git-ignored); print it at 100% scale. Each QR code encodes `<host>/ar?site=<site_id>&node=<doc_id>`.

Use a **stable** host. A phone's camera app opens that URL directly, and a quick-tunnel URL changes on every run.

## Running the studies

| Study | Open on the phone |
|---|---|
| 1 — magnetic survey | `/ar?study=1&site=<site_id>&point=P01&device=<label>&pid=<operator>` |
| 2 — drift vs. distance | `/ar?log=1&device=<label>&pid=<operator>`, then scan an anchor in-page, pick a destination and tap "I'm here" at each node |

- **`device`:** use a short label you'll recognise in the paper's device table. iOS never reports its model.
- **Study 2 navigation:** walk at a steady pace with the phone pointing along the direction of travel. The analysis interpolates position between "I'm here" taps.
- **Uploads:** telemetry is queued on the phone and uploaded in batches. The status line shows how many batches are still waiting; let it reach 0 before closing the tab.

## Export and analysis

```sh
cd backend && npm run export          # -> data/export/telemetry.csv (one row per sample)
cd .. && pip install -r scripts/requirements.txt
python scripts/analyse.py --site <site_id> --threshold 30
```

`analyse.py` writes the following to `figures/`:
- `fig1`–`fig4`
- `table_devices.csv`
- per-point and per-bin CSVs
- `summary.json`, which holds every number the paper quotes

### Telemetry columns

- **Session:** `session_id`, `participant_id`, `condition` (`study1` / `study2`), `site_id`, `device_model`, `os_version`, `user_agent`.
- **Sensor:**
  - `event_type`: `deviceorientationabsolute` or `deviceorientation`
  - `absolute_flag`
  - `sample_age_ms`: time since the sensor last fired
  - `raw_alpha`, `raw_beta`, `raw_gamma`
  - `webkit_compass_heading` (iOS)
  - `heading_source`: `webkit` (iOS), `top-edge` (phone flat) or `camera` (phone held up, tilt-compensated)
  - `raw_heading`, `smoothed_heading`
- **Calibration:**
  - `heading_correction`, `corrected_heading`
  - `frame_offset_deg`: north offset the phone used. Null means the corrected heading is in map bearings.
  - `calibration_source`: `anchor` or `manual`
- **Route (Study 2):** `last_anchor_id`, `ms_since_anchor`, `metres_since_anchor` (at the last confirmed node), `nodes_traversed`, `current_node`, `current_target_node`.
- **Study 1:** `survey_point_id`.
