// A printed QR anchor identifies one waypoint in one site (building/station).
//
// Payload format is a URL:  https://<host>/ar?site=<siteId>&node=<waypoint doc ID>
// Scanning it with the phone's own camera app opens the page directly (zero install);
// the in-page scanner parses the same URL. The host is ignored, so anchors printed
// against one deployment keep working on another.

export interface Anchor {
  siteId: string;
  nodeId: string;
}

export function parseAnchor(payload: string): Anchor | null {
  try {
    const url = new URL(payload, window.location.origin);
    const siteId = url.searchParams.get("site");
    const nodeId = url.searchParams.get("node");
    return siteId && nodeId ? { siteId, nodeId } : null;
  } catch {
    return null;
  }
}

export const anchorUrl = ({ siteId, nodeId }: Anchor, origin = window.location.origin) =>
  `${origin}/ar?site=${encodeURIComponent(siteId)}&node=${encodeURIComponent(nodeId)}`;
