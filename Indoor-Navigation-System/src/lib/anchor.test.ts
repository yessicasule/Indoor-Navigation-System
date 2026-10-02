import { beforeAll, describe, expect, it } from "vitest";
import { anchorUrl, parseAnchor } from "./anchor";

beforeAll(() => {
  // parseAnchor resolves relative payloads against the page origin.
  (globalThis as { window?: unknown }).window = { location: { origin: "https://app.example" } };
});

describe("parseAnchor", () => {
  it("reads site and node from an anchor URL on any host", () => {
    expect(parseAnchor("https://other.host/ar?site=college_main&node=college_main__A1")).toEqual({
      siteId: "college_main",
      nodeId: "college_main__A1",
    });
  });

  it("rejects payloads without both parameters", () => {
    expect(parseAnchor("AZAD_G1_ENT")).toBeNull(); // old bare-ID format
    expect(parseAnchor("https://x.example/ar?site=only")).toBeNull();
    expect(parseAnchor("")).toBeNull();
  });

  it("round-trips through anchorUrl, including characters that need escaping", () => {
    const anchor = { siteId: "site one", nodeId: "a&b" };
    expect(parseAnchor(anchorUrl(anchor, "https://app.example"))).toEqual(anchor);
  });
});
