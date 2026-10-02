// Study telemetry (roadmap §5): ~5 Hz samples, posted in batches to /api/telemetry.
//
// Field sites have dead spots (stairwells, basements), so unsent batches are kept in
// localStorage and retried — including after a reload. Each batch has a client-made ID that
// the server uses as its doc ID, so a retry or a beacon resend can't create duplicates.
import { API_BASE } from "@/lib/api";
import type { OrientationSample } from "@/hooks/use-compass";

export interface SessionMeta {
  session_id: string;
  participant_id: string | null;
  condition: string | null;
  site_id: string | null;
  device_model: string | null;
  os_version: string | null;
  user_agent: string;
}

export type Sample = Record<string, string | number | boolean | null>;

interface Batch {
  batch_id: string;
  session: SessionMeta;
  samples: Sample[];
}

export interface TelemetryStats {
  sentBatches: number;
  sentSamples: number;
  queuedBatches: number;
  lastError: string | null;
}

const STORAGE_KEY = "telemetry-queue-v1";
const MAX_QUEUED_BATCHES = 1000; // ~3.5 MB of localStorage at 10 samples per batch
const ENDPOINT = `${API_BASE}/api/telemetry`;

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Telemetry columns that come straight from the latest orientation event. */
export function orientationFields(sample: OrientationSample | null, now = Date.now()): Sample {
  return {
    event_type: sample?.eventType ?? null,
    absolute_flag: sample?.absolute ?? null,
    raw_alpha: sample?.rawAlpha ?? null,
    raw_beta: sample?.rawBeta ?? null,
    raw_gamma: sample?.rawGamma ?? null,
    webkit_compass_heading: sample?.webkitCompassHeading ?? null,
    heading_source: sample?.headingSource ?? null,
    raw_heading: sample?.heading ?? null,
    // How old the latest reading is; large values mean the sensor stopped firing.
    sample_age_ms: sample ? now - sample.timestampMs : null,
  };
}

/** Device model and OS version, as far as the browser will say. iOS never reports the model. */
export async function getDeviceInfo(): Promise<{ device_model: string | null; os_version: string | null }> {
  const ua = navigator.userAgent;
  let model: string | null = null;
  let os: string | null = null;
  const uaData = (navigator as Navigator & {
    userAgentData?: { getHighEntropyValues(hints: string[]): Promise<{ model?: string; platform?: string; platformVersion?: string }> };
  }).userAgentData;
  if (uaData) {
    try {
      const v = await uaData.getHighEntropyValues(["model", "platformVersion"]);
      model = v.model || null;
      os = v.platform ? `${v.platform} ${v.platformVersion ?? ""}`.trim() : null;
    } catch {
      /* fall back to UA parsing */
    }
  }
  if (!os) {
    const ios = ua.match(/OS (\d+[_\d]*) like Mac OS X/);
    const android = ua.match(/Android ([\d.]+)/);
    os = ios ? `iOS ${ios[1].replace(/_/g, ".")}` : android ? `Android ${android[1]}` : null;
  }
  if (!model && /iPhone/.test(ua)) model = "iPhone";
  return { device_model: model, os_version: os };
}

export class TelemetryLogger {
  private buffer: Sample[] = [];
  private queue: Batch[] = [];
  private sending = false;
  private timer: number | undefined;
  private stats: TelemetryStats = { sentBatches: 0, sentSamples: 0, queuedBatches: 0, lastError: null };

  constructor(
    private session: SessionMeta,
    private onStats: (stats: TelemetryStats) => void = () => {},
    private batchSize = 10,
  ) {
    try {
      this.queue = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      this.queue = [];
    }
    this.emit();
  }

  updateSession(patch: Partial<SessionMeta>) {
    this.session = { ...this.session, ...patch };
  }

  record(sample: Sample) {
    this.buffer.push(sample);
    if (this.buffer.length >= this.batchSize) this.seal();
  }

  start(flushEveryMs = 2000) {
    this.timer = window.setInterval(() => void this.flush(), flushEveryMs);
    window.addEventListener("pagehide", this.beaconAll);
    void this.flush(); // retry anything left over from an earlier page load
  }

  stop() {
    window.clearInterval(this.timer);
    window.removeEventListener("pagehide", this.beaconAll);
    this.seal();
    void this.flush();
  }

  /** Send queued batches in order; stops at the first failure and retries on the next tick. */
  async flush() {
    this.seal();
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.queue.length) {
        const batch = this.queue[0];
        let res: Response;
        try {
          res = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          });
        } catch {
          this.stats.lastError = "offline";
          break;
        }
        if (res.status === 400) {
          // Malformed batch: retrying will never succeed, so drop it rather than block the queue.
          console.error("Telemetry batch rejected", await res.text());
        } else if (!res.ok) {
          this.stats.lastError = `server ${res.status}`;
          break;
        } else {
          this.stats.sentBatches++;
          this.stats.sentSamples += batch.samples.length;
          this.stats.lastError = null;
        }
        this.queue.shift();
        this.persist();
      }
    } finally {
      this.sending = false;
      this.emit();
    }
  }

  private seal() {
    if (!this.buffer.length) return;
    this.queue.push({ batch_id: newId(), session: { ...this.session }, samples: this.buffer });
    this.buffer = [];
    if (this.queue.length > MAX_QUEUED_BATCHES) {
      this.queue.splice(0, this.queue.length - MAX_QUEUED_BATCHES);
      this.stats.lastError = "queue full — oldest samples dropped";
    }
    this.persist();
    this.emit();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      this.stats.lastError = "could not save queue to storage";
    }
  }

  private emit() {
    this.stats.queuedBatches = this.queue.length;
    this.onStats({ ...this.stats });
  }

  // Last chance when the tab is closed or backgrounded. Batches stay queued in storage;
  // if the beacon did land, the resend on next load just overwrites the same doc.
  private beaconAll = () => {
    this.seal();
    for (const batch of this.queue) {
      navigator.sendBeacon?.(ENDPOINT, new Blob([JSON.stringify(batch)], { type: "text/plain" }));
    }
  };
}
