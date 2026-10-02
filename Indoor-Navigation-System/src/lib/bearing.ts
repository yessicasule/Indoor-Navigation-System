// Angle conventions (same as data/README.md):
// - Compass/true bearings: degrees clockwise from north, in [0, 360).
// - Map bearings: degrees clockwise from the site map's +y axis.
// - true bearing = map bearing + site north_offset_deg.

export const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;

/** Signed smallest rotation from `from` to `to`, in (-180, 180]. Positive = clockwise. */
export const angleDiff = (from: number, to: number) => {
  const d = wrap360(to - from);
  return d > 180 ? d - 360 : d;
};

/** Map bearing of the vector (dx, dy), clockwise from map +y. */
export const mapBearing = (dx: number, dy: number) => wrap360((Math.atan2(dx, dy) * 180) / Math.PI);

/** Circular mean and circular standard deviation (degrees) of a set of bearings. */
export function circularStats(degs: number[]): { mean: number; std: number } | null {
  if (!degs.length) return null;
  let s = 0;
  let c = 0;
  for (const d of degs) {
    s += Math.sin((d * Math.PI) / 180);
    c += Math.cos((d * Math.PI) / 180);
  }
  const r = Math.min(1, Math.hypot(s, c) / degs.length);
  return {
    mean: wrap360((Math.atan2(s, c) * 180) / Math.PI),
    std: (Math.sqrt(-2 * Math.log(Math.max(r, 1e-12))) * 180) / Math.PI,
  };
}
