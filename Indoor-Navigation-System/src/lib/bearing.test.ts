import { describe, expect, it } from "vitest";
import { angleDiff, circularStats, mapBearing, wrap360 } from "./bearing";

describe("wrap360", () => {
  it("maps any angle into [0, 360)", () => {
    expect(wrap360(0)).toBe(0);
    expect(wrap360(360)).toBe(0);
    expect(wrap360(-90)).toBe(270);
    expect(wrap360(725)).toBe(5);
  });
});

describe("angleDiff", () => {
  it("is the signed shortest rotation, clockwise positive", () => {
    expect(angleDiff(10, 30)).toBe(20);
    expect(angleDiff(30, 10)).toBe(-20);
    expect(angleDiff(350, 10)).toBe(20); // across north
    expect(angleDiff(10, 350)).toBe(-20);
    expect(angleDiff(0, 180)).toBe(180);
  });
});

describe("mapBearing", () => {
  it("is clockwise from map +y", () => {
    expect(mapBearing(0, 1)).toBeCloseTo(0);
    expect(mapBearing(1, 0)).toBeCloseTo(90);
    expect(mapBearing(0, -1)).toBeCloseTo(180);
    expect(mapBearing(-1, 0)).toBeCloseTo(270);
  });
});

describe("circularStats", () => {
  it("averages across the 0/360 seam", () => {
    const s = circularStats([358, 0, 2])!;
    expect(angleDiff(s.mean, 0)).toBeCloseTo(0, 6);
    expect(s.std).toBeGreaterThan(1);
    expect(s.std).toBeLessThan(2);
  });

  it("returns zero spread for identical readings and null for none", () => {
    expect(circularStats([90, 90, 90])!.std).toBeCloseTo(0, 3);
    expect(circularStats([])).toBeNull();
  });
});
