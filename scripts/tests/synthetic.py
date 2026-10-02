"""Synthetic site + telemetry with KNOWN planted effects, for testing and benchmarking the
analysis pipeline. Never mix this with real data: everything is generated into a temp folder
and the site is named "_synthetic".
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

SITE = "_synthetic"
NORTH_OFFSET = 6.33
T0 = 1_760_000_000_000

WAYPOINTS = pd.DataFrame([
    # node_id, name, type, x, y, z, floor, neighbors, anchor_map_bearing_deg
    ("A1", "Entrance", "anchor", 0, 0, 0, 0, "C1", 0),
    ("C1", "", "path", 0, 15, 0, 0, "C2", None),
    ("C2", "", "path", 25, 15, 0, 0, "C3", None),
    ("C3", "", "path", 25, 40, 0, 0, "R1", None),
    ("R1", "Room 1", "room", 45, 40, 0, 0, "", None),
], columns=["node_id", "name", "type", "x", "y", "z", "floor", "neighbors", "anchor_map_bearing_deg"])
ROUTE = ["A1", "C1", "C2", "C3", "R1"]  # 15 + 25 + 25 + 20 = 85 m

SURVEY = pd.DataFrame([
    ("P01", 0, 5, 0, 0), ("P02", 0, 10, 0, 0), ("P03", 10, 15, 0, 90), ("P04", 20, 15, 0, 90),
    ("P05", 25, 25, 0, 0), ("P06", 25, 35, 0, 0), ("P07", 35, 40, 0, 90), ("P08", 40, 40, 0, 90),
], columns=["point_id", "x", "y", "floor", "align_map_bearing_deg"])

DEVICES = [("Pixel 7", "Android 15"), ("Galaxy A54", "Android 14"), ("iPhone", "iOS 18.1")]


def error_sd(metres):
    """Planted Study 2 error model: heading error sd grows linearly with distance since anchor."""
    return 3.0 + 0.9 * metres


def expected_bound(threshold=30.0, bin_m=5.0):
    """Bin where p95 |N(0, sd)| = 1.96 sd first exceeds the threshold, evaluated at bin centres."""
    left = 0.0
    while 1.96 * error_sd(left + bin_m / 2) <= threshold:
        left += bin_m
    return left


def write_site(root: Path, declination=0.0):
    site_dir = Path(root) / "sites" / SITE
    site_dir.mkdir(parents=True, exist_ok=True)
    (site_dir / "site.json").write_text(json.dumps({
        "site_id": SITE, "name": "Synthetic test site", "north_offset_deg": NORTH_OFFSET,
        "magnetic_declination_deg": declination}))
    WAYPOINTS.to_csv(site_dir / "waypoints.csv", index=False)
    SURVEY.to_csv(site_dir / "survey_points.csv", index=False)
    return site_dir


def make_telemetry(seed=1, runs_per_device=6, point_bias=None, declination=0.0, speed=1.2):
    """Returns (telemetry DataFrame, planted Study 1 bias per (device, point))."""
    rng = np.random.default_rng(seed)
    rows = []
    planted = {}
    nodes = WAYPOINTS.set_index("node_id")
    for d, (model, os_) in enumerate(DEVICES):
        base = dict(participant_id="E01", site_id=SITE, device_model=model, os_version=os_,
                    event_type="deviceorientationabsolute", absolute_flag="true", sample_age_ms=20)
        # Study 1: phone reports magnetic heading = true reference + bias - declination.
        for k, p in enumerate(SURVEY.itertuples()):
            bias = point_bias(d, k) if point_bias else rng.normal(0, 8)
            planted[(f"{model} ({os_})", p.point_id)] = bias
            ref_true = (p.align_map_bearing_deg + NORTH_OFFSET) % 360
            for i in range(50):
                rows.append(dict(base, session_id=f"s1-{d}", condition="study1", heading_source="top-edge",
                                 timestamp_ms=T0 + d * 10**7 + k * 60_000 + i * 200,
                                 raw_heading=(ref_true + bias - declination + rng.normal(0, 1)) % 360,
                                 survey_point_id=p.point_id))
        # Study 2: corrected heading = segment bearing + N(0, error_sd(metres)).
        for r in range(runs_per_device):
            t = T0 + 10**9 + d * 10**8 + r * 10**6
            cum = 0.0
            for k in range(len(ROUTE) - 1):
                a, b = nodes.loc[ROUTE[k]], nodes.loc[ROUTE[k + 1]]
                seg = float(np.hypot(b.x - a.x, b.y - a.y))
                seg_true = (np.degrees(np.arctan2(b.x - a.x, b.y - a.y)) + NORTH_OFFSET) % 360
                for i in range(int(seg / speed * 5)):
                    m = cum + i * speed / 5
                    err = rng.normal(0, error_sd(m))
                    raw = (seg_true + err - 4 + rng.normal(0, 15)) % 360
                    rows.append(dict(base, session_id=f"s2-{d}", condition="study2", heading_source="camera",
                                     timestamp_ms=t, raw_heading=raw, smoothed_heading=raw,
                                     corrected_heading=(seg_true + err) % 360, heading_correction=4.0,
                                     frame_offset_deg=NORTH_OFFSET, calibration_source="anchor",
                                     last_anchor_id=f"{SITE}__A1", ms_since_anchor=t - T0, metres_since_anchor=cum,
                                     nodes_traversed=k, current_node=ROUTE[k], current_target_node=ROUTE[k + 1]))
                    t += 200
                cum += seg
    return pd.DataFrame(rows), planted
