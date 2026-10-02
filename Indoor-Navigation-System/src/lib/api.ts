// Backend origin. Empty by default so requests go to same-origin `/api/...`, which the
// Vite dev server proxies to the backend — that keeps phones on a single HTTPS origin
// (required for camera and compass) when the dev server is exposed through a tunnel.
// Set VITE_API_BASE_URL only when the backend is deployed on a separate HTTPS origin.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
