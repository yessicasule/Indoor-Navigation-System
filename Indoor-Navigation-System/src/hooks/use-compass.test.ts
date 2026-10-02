import { describe, expect, it } from "vitest";
import { headingFromEuler } from "./use-compass";

// Euler angles follow the W3C Z-X'-Y' convention: alpha is counter-clockwise yaw,
// beta tilts the top edge up, gamma tilts sideways.
describe("headingFromEuler", () => {
  it("uses the top edge when the phone is flat", () => {
    expect(headingFromEuler(0, 0, 0)).toEqual({ heading: 0, source: "top-edge" });
    expect(headingFromEuler(270, 0, 0)).toEqual({ heading: 90, source: "top-edge" }); // top edge east
    expect(headingFromEuler(90, 30, 0).heading).toBeCloseTo(270); // still flat-ish below 45°
  });

  it("uses the back-camera direction when the phone is held up", () => {
    const cases: [number, number][] = [[0, 0], [270, 90], [180, 180], [90, 270]]; // alpha -> expected heading
    for (const [alpha, expected] of cases) {
      const r = headingFromEuler(alpha, 90, 0);
      expect(r.source).toBe("camera");
      expect(r.heading).toBeCloseTo(expected, 6);
    }
  });

  it("is unaffected by gimbal lock: the same pose expressed with gamma", () => {
    // Upright facing east can be reported as alpha=270,gamma=0 or alpha=0,gamma=-90.
    expect(headingFromEuler(0, 90, -90).heading).toBeCloseTo(90, 6);
  });

  it("switches regime at 45° of tilt without a jump for a forward-facing hold", () => {
    const below = headingFromEuler(300, 44, 0).heading;
    const above = headingFromEuler(300, 46, 0).heading;
    expect(Math.abs(below - above)).toBeLessThan(1e-6);
  });
});
