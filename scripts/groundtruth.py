"""Ground-truth bearings for a site (roadmap section 6).

    python scripts/groundtruth.py <site_id> [--gps-error 3] [--write]

Reads data/sites/<site_id>/reference_lines.csv: long straight architectural features with a
GPS fix at each end and the feature's direction in map coordinates. For each line it computes
the true bearing (initial great-circle bearing, end 1 -> end 2) and the map rotation
    offset = true_bearing - map_bearing
then combines the lines into the site's north_offset_deg (true bearing of the map's +y axis).

Uncertainty: with independent horizontal GPS error sigma (m) at each end, the bearing error of a
line of length L is roughly sqrt(2) * sigma / L radians. Long baselines matter: 4 m error over
60 m is ~5 deg; over 150 m it is ~2 deg. Average several fixes per end to reduce sigma.

If handheld_compass_deg is filled in (magnetic bearing sighted along the feature, compass held
clear of steel), the script also reports compass + declination - true as a cross-check.

--write stores north_offset_deg in site.json.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
EARTH_RADIUS_M = 6_371_000


def wrap180(deg):
    return (deg + 180.0) % 360.0 - 180.0


def true_bearing(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return math.degrees(math.atan2(x, y)) % 360.0


def haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("site_id")
    ap.add_argument("--gps-error", type=float, default=3.0, help="1-sigma horizontal GPS error per end, metres (default 3)")
    ap.add_argument("--write", action="store_true", help="write north_offset_deg into site.json")
    args = ap.parse_args()

    site_dir = ROOT / "data" / "sites" / args.site_id
    site_path = site_dir / "site.json"
    site = json.loads(site_path.read_text(encoding="utf-8"))
    lines = pd.read_csv(site_dir / "reference_lines.csv")
    declination = site.get("magnetic_declination_deg")

    rows = []
    for ln in lines.itertuples():
        tb = true_bearing(ln.lat1, ln.lon1, ln.lat2, ln.lon2)
        length = haversine_m(ln.lat1, ln.lon1, ln.lat2, ln.lon2)
        sigma = math.degrees(math.sqrt(2) * args.gps_error / length)
        offset = (tb - ln.map_bearing_deg) % 360.0
        row = {"line": ln.line_id, "length_m": length, "true_bearing": tb, "map_bearing": ln.map_bearing_deg,
               "offset": offset, "sigma_deg": sigma}
        hc = getattr(ln, "handheld_compass_deg", float("nan"))
        if pd.notna(hc):
            row["compass_minus_true"] = wrap180(hc + (declination or 0.0) - tb)
        rows.append(row)
    df = pd.DataFrame(rows)

    # Inverse-variance weighted circular mean of the per-line offsets.
    w = 1.0 / df.sigma_deg ** 2
    rad = df.offset.map(math.radians)
    mean = math.degrees(math.atan2((w * rad.map(math.sin)).sum(), (w * rad.map(math.cos)).sum())) % 360.0
    combined_sigma = math.sqrt(1.0 / w.sum())
    df["residual"] = (df.offset - mean).map(wrap180)

    pd.set_option("display.float_format", lambda v: f"{v:.2f}")
    print(df.to_string(index=False))
    print(f"\nnorth_offset_deg = {mean:.2f}  (GPS-only 1-sigma ~ {combined_sigma:.2f} deg; "
          f"max line residual {df.residual.abs().max():.2f} deg)")
    for r in df.itertuples():
        if r.sigma_deg > 3:
            print(f"  ! {r.line}: {r.length_m:.0f} m baseline gives ~{r.sigma_deg:.1f} deg — use a longer feature or average more fixes")
    if "compass_minus_true" in df and declination is None:
        print("  ! compass check assumes 0 declination — set magnetic_declination_deg in site.json "
              "(NOAA calculator: https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml)")

    if args.write:
        site["north_offset_deg"] = round(mean, 2)
        site_path.write_text(json.dumps(site, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote north_offset_deg to {site_path.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
