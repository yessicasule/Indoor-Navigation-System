"""Regenerate every figure and number for the paper from the exported telemetry.

    python scripts/analyse.py --site <site_id> [--telemetry data/export/telemetry.csv]
                              [--threshold 30] [--bin 5] [--out figures] [--data-dir data]

Inputs
  data/export/telemetry.csv          one row per 5 Hz sample (backend: npm run export)
  data/sites/<site>/site.json        north_offset_deg (scripts/groundtruth.py), magnetic_declination_deg
  data/sites/<site>/waypoints.csv    node coordinates in metres
  data/sites/<site>/survey_points.csv  Study 1 points and alignment directions

Outputs (in --out)
  fig1_study1_error_map.png          heading error at each surveyed point, per device
  fig2_study1_error_by_device.png    |error| distribution per device
  fig3_study2_error_vs_distance.png  |error| vs metres since last anchor: anchor-reset vs raw compass
  fig4_study2_by_device.png          95th-percentile |error| vs distance, per device
  table_devices.csv                  device / browser / event-type table
  study1_points.csv, study2_bins.csv per-point and per-bin results
  summary.json                       every number quoted in the paper, the data-quality report,
                                     and the held-out validation of the anchor distance bound

Conventions (data/README.md): bearings clockwise from north; map bearing clockwise from map +y;
true = map + north_offset; true = magnetic + declination; errors wrapped to (-180, 180].
"""
import argparse
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FRESH_MS = 500  # samples older than this mean the sensor stopped firing
GAP_MS = 2000  # a pause this long between consecutive samples is reported as a gap

plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False,
                     "figure.dpi": 150, "savefig.bbox": "tight"})
MARKERS = ["o", "s", "^", "D", "v", "P", "X"]
LINESTYLES = ["-", "--", ":", "-."]


def wrap180(deg):
    return (np.asarray(deg, dtype=float) + 180.0) % 360.0 - 180.0


def circ_mean(deg):
    r = np.radians(np.asarray(deg, dtype=float))
    return np.degrees(np.arctan2(np.sin(r).mean(), np.cos(r).mean())) % 360.0


def circ_std(deg):
    r = np.radians(np.asarray(deg, dtype=float))
    R = min(1.0, np.hypot(np.sin(r).mean(), np.cos(r).mean()))
    return float(np.degrees(np.sqrt(-2 * np.log(max(R, 1e-12)))))


def map_bearing(dx, dy):
    return np.degrees(np.arctan2(dx, dy)) % 360.0


def as_bool(series):
    return series.astype(str).str.strip().str.lower().isin(["true", "1"])


def bootstrap_quantile(values, q, rng, n=500):
    values = np.asarray(values)
    if len(values) < 5:
        return (np.nan, np.nan)
    stats = [np.quantile(rng.choice(values, len(values)), q) for _ in range(n)]
    return tuple(np.quantile(stats, [0.025, 0.975]))


def device_label(df):
    model = df.device_model.fillna("unknown").astype(str)
    os_ = df.os_version.fillna("").astype(str)
    return (model + " (" + os_ + ")").str.replace(" ()", "", regex=False)


def validate_survey(survey):
    """Return a list of problems in survey_points.csv (empty if it is usable)."""
    required = ["point_id", "x", "y", "align_map_bearing_deg"]
    missing = [c for c in required if c not in survey]
    if missing:
        return [f"missing columns: {', '.join(missing)}"]
    problems = []
    if survey.point_id.duplicated().any():
        problems.append(f"duplicate point_id: {', '.join(survey.point_id[survey.point_id.duplicated()])}")
    for c in ["x", "y"]:
        bad = pd.to_numeric(survey[c], errors="coerce").isna()
        problems += [f"{p}: {c} must be a number" for p in survey.point_id[bad]]
    b = pd.to_numeric(survey.align_map_bearing_deg, errors="coerce")
    problems += [f"{p}: align_map_bearing_deg must be in [0, 360)" for p in survey.point_id[~((b >= 0) & (b < 360))]]
    return problems


def load(site_id, data_dir, telemetry_path):
    site_dir = Path(data_dir) / "sites" / site_id
    site = json.loads((site_dir / "site.json").read_text(encoding="utf-8"))
    if site.get("north_offset_deg") is None:
        sys.exit("site.json north_offset_deg is not set — run scripts/groundtruth.py <site> --write first.")
    if site.get("magnetic_declination_deg") is None:
        print("! magnetic_declination_deg not set in site.json — assuming 0 (state this in the paper).")
    waypoints = pd.read_csv(site_dir / "waypoints.csv", dtype={"node_id": str})
    survey = pd.read_csv(site_dir / "survey_points.csv", dtype={"point_id": str}) \
        if (site_dir / "survey_points.csv").exists() else pd.DataFrame()
    if not survey.empty:
        problems = validate_survey(survey)
        if problems:
            sys.exit("survey_points.csv:\n  " + "\n  ".join(problems))

    t = pd.read_csv(telemetry_path, low_memory=False)
    t = t[t.site_id.astype(str) == site_id].copy()
    for col in ["timestamp_ms", "sample_age_ms", "raw_heading", "smoothed_heading", "corrected_heading",
                "frame_offset_deg", "metres_since_anchor", "nodes_traversed"]:
        if col in t:
            t[col] = pd.to_numeric(t[col], errors="coerce")
    t["absolute"] = as_bool(t.absolute_flag)
    t["fresh"] = t.sample_age_ms < FRESH_MS
    t["device"] = device_label(t)
    return site, waypoints, survey, t


# --------------------------------------------------------------------------- data quality

def validate_telemetry(t):
    """Count suspect rows. Nothing is silently fixed except exact duplicates, which are dropped."""
    issues = {}

    def flag(name, mask):
        n = int(np.asarray(mask).sum())
        if n:
            issues[name] = n

    flag("raw_heading_missing", t.raw_heading.isna())
    flag("raw_heading_out_of_range", t.raw_heading.notna() & ((t.raw_heading < 0) | (t.raw_heading >= 360)))
    flag("stale_sensor_reading", ~t.fresh)
    flag("relative_heading", ~t.absolute)
    flag("device_model_missing", t.device_model.isna())
    flag("timestamp_missing", t.timestamp_ms.isna())
    flag("duplicate_session_timestamp", t.duplicated(["session_id", "timestamp_ms"]))
    s1 = t[t.condition == "study1"]
    flag("study1_without_point_id", s1.survey_point_id.isna())
    s2 = t[t.condition == "study2"]
    if len(s2):
        flag("study2_corrected_out_of_range",
             s2.corrected_heading.notna() & ((s2.corrected_heading < 0) | (s2.corrected_heading >= 360)))
        flag("study2_negative_metres", s2.metres_since_anchor < 0)

    # Logging gaps: only count pauses inside one capture (Study 1 point) or one route segment
    # (Study 2); pauses between captures or routes are expected.
    ordered = t.sort_values(["session_id", "timestamp_ms"])
    key = ordered.session_id.astype(str) + "|" + ordered.survey_point_id.astype(str) + "|"         + ordered.current_node.astype(str) + "|" + ordered.nodes_traversed.astype(str)
    dt = ordered.timestamp_ms.diff()
    within = (key == key.shift()).values
    flag(f"gaps_over_{GAP_MS}ms", within & (dt > GAP_MS).values)
    dt = dt[within]
    return {
        "rows": int(len(t)),
        "sessions": int(t.session_id.nunique()),
        "median_sample_interval_ms": float(dt.median()) if dt.notna().any() else None,
        "issues": issues,
    }


# --------------------------------------------------------------------------- Study 1

def study1(site, waypoints, survey, t, out, rng):
    s1 = t[(t.condition == "study1") & t.fresh & t.survey_point_id.notna()].copy()
    if s1.empty or survey.empty:
        print("Study 1: no data (need condition=study1 telemetry and survey_points.csv).")
        return None, None
    excluded = s1[~s1.absolute]
    if len(excluded):
        print(f"Study 1: excluding {len(excluded)} samples with relative (non-north-referenced) heading "
              f"from: {', '.join(sorted(excluded.device.unique()))}")
    s1 = s1[s1.absolute]

    offset = site["north_offset_deg"]
    decl = site.get("magnetic_declination_deg") or 0.0
    survey = survey.assign(reference_true=(survey.align_map_bearing_deg + offset) % 360.0)

    # One measurement per (session, point): the latest capture wins if a point was redone.
    rows = []
    for (session, point), g in s1.groupby(["session_id", "survey_point_id"]):
        last_capture = g[g.timestamp_ms >= g.timestamp_ms.max() - 15_000]
        rows.append({
            "session_id": session, "point_id": str(point), "device": g.device.iloc[0],
            "event_type": g.event_type.iloc[0], "heading_source": g.heading_source.iloc[0],
            "n_samples": len(last_capture),
            "measured_magnetic": circ_mean(last_capture.raw_heading),
            "capture_spread": circ_std(last_capture.raw_heading),
        })
    pts = pd.DataFrame(rows).merge(survey, on="point_id", how="left")
    missing = pts[pts.reference_true.isna()].point_id.unique()
    if len(missing):
        print(f"Study 1: {len(missing)} captured points not in survey_points.csv: {', '.join(missing)}")
    pts = pts.dropna(subset=["reference_true"])
    pts["error"] = wrap180(pts.measured_magnetic + decl - pts.reference_true)
    pts["abs_error"] = pts.error.abs()
    pts.to_csv(out / "study1_points.csv", index=False)

    devices = sorted(pts.device.unique())
    # Fig 1: error map per device. Sequential colormap on |error| (greyscale-safe), signed value labelled.
    fig, axes = plt.subplots(1, len(devices), figsize=(3.4 * len(devices), 3.4), squeeze=False)
    vmax = max(10.0, float(np.ceil(pts.abs_error.max() / 5) * 5))
    by_id = waypoints.set_index("node_id")
    sc = None
    for ax, dev in zip(axes[0], devices):
        for w in waypoints.itertuples():
            for n in str(w.neighbors).split(";") if pd.notna(w.neighbors) else []:
                if n in by_id.index:
                    ax.plot([w.x, by_id.at[n, "x"]], [w.y, by_id.at[n, "y"]], color="0.85", lw=1, zorder=0)
        d = pts[pts.device == dev]
        sc = ax.scatter(d.x, d.y, c=d.abs_error, cmap="viridis", vmin=0, vmax=vmax, s=60, edgecolor="k", lw=0.4)
        for r in d.itertuples():
            ax.annotate(f"{r.error:+.0f}°", (r.x, r.y), xytext=(4, 4), textcoords="offset points", fontsize=7)
        ax.set_title(dev, fontsize=9)
        ax.set_aspect("equal")
        ax.set_xlabel("x (m)")
    axes[0][0].set_ylabel("y (m)")
    fig.colorbar(sc, ax=axes[0].tolist(), label="|heading error| (°)", shrink=0.8)
    fig.savefig(out / "fig1_study1_error_map.png")
    plt.close(fig)

    # Fig 2: |error| per device.
    fig, ax = plt.subplots(figsize=(1.2 + 1.3 * len(devices), 3))
    data = [pts[pts.device == d].abs_error.values for d in devices]
    ax.boxplot(data, widths=0.5, showfliers=False)
    for i, vals in enumerate(data, start=1):
        ax.scatter(np.full(len(vals), i) + rng.uniform(-0.12, 0.12, len(vals)), vals, s=10, color="0.3", zorder=3)
    ax.set_xticks(range(1, len(devices) + 1), devices, rotation=20, ha="right")
    ax.set_ylabel("|heading error| (°)")
    fig.savefig(out / "fig2_study1_error_by_device.png")
    plt.close(fig)

    summary = {
        "n_points": int(pts.point_id.nunique()),
        "n_devices": len(devices),
        "median_abs_error_deg": round(float(pts.abs_error.median()), 1),
        "p95_abs_error_deg": round(float(pts.abs_error.quantile(0.95)), 1),
        "max_abs_error_deg": round(float(pts.abs_error.max()), 1),
        "worst_point": {k: (v if not isinstance(v, (np.floating, float)) else round(float(v), 1))
                        for k, v in pts.loc[pts.abs_error.idxmax(), ["point_id", "device", "error"]].items()},
        "per_device": {d: {"median_abs_error_deg": round(float(g.abs_error.median()), 1),
                           "p95_abs_error_deg": round(float(g.abs_error.quantile(0.95)), 1),
                           "n_points": int(len(g))} for d, g in pts.groupby("device")},
    }
    return summary, pts


# --------------------------------------------------------------------------- Study 2

def binned(df, col, bin_m, rng=None):
    """Median and 95th-percentile |error| per distance bin (bootstrap CI when rng is given)."""
    df = df.dropna(subset=[col])
    if df.empty:
        return pd.DataFrame(columns=["bin_start_m", "n", "median_abs_error", "p95_abs_error", "p95_ci_low", "p95_ci_high"])
    edges = np.arange(0, df.metres.max() + bin_m, bin_m)
    cats = pd.cut(df.metres, edges, right=False, labels=edges[:-1])
    rows = []
    for left, g in df.groupby(cats, observed=True):
        v = g[col].abs().values
        lo, hi = bootstrap_quantile(v, 0.95, rng) if rng is not None else (np.nan, np.nan)
        rows.append({"bin_start_m": float(left), "n": len(v), "median_abs_error": np.median(v),
                     "p95_abs_error": np.quantile(v, 0.95), "p95_ci_low": lo, "p95_ci_high": hi})
    return pd.DataFrame(rows)


def distance_bound(bins, threshold, bin_m):
    """Largest distance before the binned p95 |error| first exceeds the threshold."""
    over = bins[bins.p95_abs_error > threshold]
    if len(over):
        return float(over.bin_start_m.iloc[0]), True
    return float(bins.bin_start_m.max() + bin_m), False


def holdout(anchored, threshold, bin_m, group_col, rng, max_folds=10):
    """Train-test check of the bound: derive it without some groups, test it on them.

    Coverage = share of held-out samples within the bound whose |error| <= threshold. If the
    bound generalises, coverage stays near the 95% it was derived for.
    """
    groups = anchored[group_col].dropna().unique()
    if len(groups) < 2:
        return None
    groups = rng.permutation(groups)
    folds = [[g] for g in groups] if len(groups) <= max_folds else np.array_split(groups, max_folds)
    results = []
    for test_groups in folds:
        test_mask = anchored[group_col].isin(test_groups)
        train, test = anchored[~test_mask], anchored[test_mask]
        d, _ = distance_bound(binned(train, "err_anchor", bin_m), threshold, bin_m)
        within = test[test.metres < d]
        coverage = float((within.err_anchor.abs() <= threshold).mean()) if len(within) else None
        results.append({"held_out": [str(g) for g in test_groups], "bound_m": d,
                        "test_samples_within_bound": int(len(within)), "coverage": coverage})
    cov = [r["coverage"] for r in results if r["coverage"] is not None]
    return {
        "grouped_by": group_col,
        "folds": results,
        "mean_coverage": round(float(np.mean(cov)), 3) if cov else None,
        "min_coverage": round(float(np.min(cov)), 3) if cov else None,
        "bound_range_m": [min(r["bound_m"] for r in results), max(r["bound_m"] for r in results)],
    }


def prepare_study2(site, waypoints, t):
    s2 = t[(t.condition == "study2") & t.fresh & t.current_target_node.notna() & t.current_node.notna()].copy()
    if s2.empty:
        return s2
    offset = site["north_offset_deg"]
    decl = site.get("magnetic_declination_deg") or 0.0
    nodes = waypoints.set_index("node_id")
    z = nodes.z if "z" in nodes else pd.Series(0.0, index=nodes.index)

    s2 = s2.sort_values(["session_id", "timestamp_ms"])
    s2["current_node"] = s2.current_node.astype(str)
    s2["current_target_node"] = s2.current_target_node.astype(str)
    known = s2.current_node.isin(nodes.index) & s2.current_target_node.isin(nodes.index)
    if (~known).any():
        print(f"Study 2: {(~known).sum()} samples reference nodes not in waypoints.csv — dropped.")
    s2 = s2[known]

    a, b = nodes.loc[s2.current_node], nodes.loc[s2.current_target_node]
    dx, dy = b.x.values - a.x.values, b.y.values - a.y.values
    s2["seg_len"] = np.hypot(np.hypot(dx, dy), z.loc[s2.current_target_node].values - z.loc[s2.current_node].values)
    s2["horizontal"] = np.hypot(dx, dy) >= 0.5
    s2["segment_true"] = (map_bearing(dx, dy) + offset) % 360.0
    s2 = s2[s2.horizontal].copy()  # stairs/lifts have no walking direction

    # A run = continuous navigation from one anchor; a new run starts when the anchor changes or
    # the step counter goes back down (a new route).
    step = s2.nodes_traversed
    new_run = (s2.session_id != s2.session_id.shift()) | (s2.last_anchor_id != s2.last_anchor_id.shift()) \
        | (step < step.shift())
    s2["run"] = new_run.cumsum()

    # Interpolate position along each segment by time between the user's "I'm here" taps.
    s2["metres"] = np.nan
    for _, g in s2.groupby("run"):
        starts = g.groupby("nodes_traversed").timestamp_ms.min()
        for k, gk in g.groupby("nodes_traversed"):
            t0 = starts[k]
            t1 = starts.get(k + 1, gk.timestamp_ms.max())
            frac = ((gk.timestamp_ms - t0) / max(t1 - t0, 1)).clip(0, 1)
            s2.loc[gk.index, "metres"] = gk.metres_since_anchor + frac * gk.seg_len

    # Corrected heading -> true frame, whatever offset the phone had at the time.
    frame = s2.frame_offset_deg.fillna(0.0)
    uncalibrated = s2.calibration_source.isna()
    s2["corrected_true"] = s2.corrected_heading + offset - frame + np.where(uncalibrated, decl, 0.0)
    s2["err_anchor"] = wrap180(s2.corrected_true - s2.segment_true)
    s2["err_raw"] = np.where(s2.absolute, wrap180(s2.smoothed_heading + decl - s2.segment_true), np.nan)
    return s2


def study2(site, waypoints, t, out, threshold, bin_m, rng):
    s2 = prepare_study2(site, waypoints, t)
    if s2.empty:
        print("Study 2: no data (need condition=study2 telemetry while navigating).")
        return None
    anchored = s2[s2.calibration_source == "anchor"].dropna(subset=["metres", "err_anchor"])
    if anchored.empty:
        print("Study 2: no anchor-calibrated samples — check anchors have anchor_map_bearing_deg.")
        return None

    bins_anchor = binned(anchored, "err_anchor", bin_m, rng)
    bins_raw = binned(s2, "err_raw", bin_m, rng)
    pd.concat([bins_anchor.assign(method="anchor_reset"), bins_raw.assign(method="raw_compass")]) \
        .to_csv(out / "study2_bins.csv", index=False)

    d_star, exceeded = distance_bound(bins_anchor, threshold, bin_m)
    bound_note = (f"p95 |error| first exceeds {threshold}° in the {d_star:.0f}–{d_star + bin_m:.0f} m bin" if exceeded
                  else f"p95 |error| stays below {threshold}° up to the longest distance observed ({d_star:.0f} m)")

    # Fig 3: |error| vs distance, anchor reset vs raw compass.
    def mid(b):
        return b.bin_start_m + bin_m / 2

    fig, ax = plt.subplots(figsize=(5, 3.2))
    ax.scatter(anchored.metres, anchored.err_anchor.abs(), s=2, color="0.75", rasterized=True, label="samples (anchor reset)")
    ax.plot(mid(bins_anchor), bins_anchor.p95_abs_error, "k-o", ms=3, label="anchor reset, 95th pct")
    ax.fill_between(mid(bins_anchor), bins_anchor.p95_ci_low, bins_anchor.p95_ci_high, color="0.6", alpha=0.3, lw=0)
    ax.plot(mid(bins_anchor), bins_anchor.median_abs_error, "k--", label="anchor reset, median")
    if not bins_raw.empty:
        ax.plot(mid(bins_raw), bins_raw.p95_abs_error, "k:s", ms=3, label="raw compass, 95th pct")
    ax.axhline(threshold, color="k", lw=0.8, ls="-.")
    ax.annotate(f"{threshold:g}° threshold", xy=(1, threshold), xycoords=("axes fraction", "data"),
                xytext=(0, 3), textcoords="offset points", ha="right", va="bottom", fontsize=7)
    ax.axvline(d_star, color="k", lw=0.8)
    ax.set_xlabel("distance walked since last anchor (m)")
    ax.set_ylabel("|heading error| (°)")
    ax.legend(fontsize=7, frameon=False, loc="upper left")
    fig.savefig(out / "fig3_study2_error_vs_distance.png", dpi=300)
    plt.close(fig)

    # Fig 4: p95 curve per device.
    fig, ax = plt.subplots(figsize=(5, 3.2))
    for i, (dev, g) in enumerate(anchored.groupby("device")):
        b = binned(g, "err_anchor", bin_m)
        ax.plot(mid(b), b.p95_abs_error, color="k", ls=LINESTYLES[i % 4], marker=MARKERS[i % 7], ms=3, label=dev)
    ax.axhline(threshold, color="k", lw=0.8, ls="-.")
    ax.set_xlabel("distance walked since last anchor (m)")
    ax.set_ylabel("95th pct |heading error| (°)")
    ax.legend(fontsize=7, frameon=False)
    fig.savefig(out / "fig4_study2_by_device.png", dpi=300)
    plt.close(fig)

    return {
        "threshold_deg": threshold,
        "bin_m": bin_m,
        "anchor_distance_bound_m": d_star,
        "bound_exceeded_within_data": exceeded,
        "bound_note": bound_note,
        "n_runs": int(anchored.run.nunique()),
        "n_samples_anchor_calibrated": int(len(anchored)),
        "max_distance_observed_m": round(float(anchored.metres.max()), 1),
        "median_abs_error_first_bin_deg": round(float(bins_anchor.median_abs_error.iloc[0]), 1),
        "p95_abs_error_first_bin_deg": round(float(bins_anchor.p95_abs_error.iloc[0]), 1),
        "raw_compass_p95_abs_error_overall_deg":
            round(float(np.nanquantile(np.abs(s2.err_raw), 0.95)), 1) if s2.err_raw.notna().any() else None,
        # Train-test validation of the bound: by route run, and leave-one-device-out.
        "holdout_by_run": holdout(anchored, threshold, bin_m, "run", rng),
        "holdout_by_device": holdout(anchored, threshold, bin_m, "device", rng),
    }


def device_table(t, out):
    g = t[t.fresh].groupby("device")
    table = pd.DataFrame({
        "sessions": g.session_id.nunique(),
        "samples": g.size(),
        "event_type": g.event_type.agg(lambda s: ", ".join(sorted(s.dropna().astype(str).unique()))),
        "absolute_share": g.absolute.mean().round(3),
        "heading_source": g.heading_source.agg(lambda s: ", ".join(sorted(s.dropna().astype(str).unique()))),
        "median_sample_age_ms": g.sample_age_ms.median(),
    })
    table.to_csv(out / "table_devices.csv")
    return table


def run(site_id, telemetry, out, data_dir=ROOT / "data", threshold=30.0, bin_m=5.0, seed=0):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    site, waypoints, survey, t = load(site_id, data_dir, telemetry)
    if t.empty:
        sys.exit(f"No telemetry rows for site {site_id} in {telemetry}")

    quality = validate_telemetry(t)
    t = t.drop_duplicates(["session_id", "timestamp_ms"])
    table = device_table(t, out)
    s1, _ = study1(site, waypoints, survey, t, out, rng)
    s2 = study2(site, waypoints, t, out, threshold, bin_m, rng)

    summary = {"site": site_id, "north_offset_deg": site["north_offset_deg"],
               "magnetic_declination_deg": site.get("magnetic_declination_deg"),
               "data_quality": quality,
               "devices": table.reset_index().to_dict(orient="records"),
               "study1": s1, "study2": s2}
    (out / "summary.json").write_text(json.dumps(summary, indent=2, default=float) + "\n", encoding="utf-8")
    return summary


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", required=True)
    ap.add_argument("--telemetry", type=Path, default=ROOT / "data" / "export" / "telemetry.csv")
    ap.add_argument("--threshold", type=float, default=30.0,
                    help="usability threshold on |heading error|, degrees (state and justify it in the paper)")
    ap.add_argument("--bin", type=float, default=5.0, help="distance bin width, metres")
    ap.add_argument("--out", type=Path, default=ROOT / "figures")
    ap.add_argument("--data-dir", type=Path, default=ROOT / "data", help="folder containing sites/<site_id>/")
    args = ap.parse_args(argv)

    summary = run(args.site, args.telemetry, args.out, args.data_dir, args.threshold, args.bin)
    if summary["data_quality"]["issues"]:
        print("Data quality issues:", json.dumps(summary["data_quality"]["issues"]))
    print(json.dumps({"study1": summary["study1"], "study2": summary["study2"]}, indent=2, default=float))
    print(f"\nWrote figures, tables and summary.json to {args.out}")


if __name__ == "__main__":
    main()
