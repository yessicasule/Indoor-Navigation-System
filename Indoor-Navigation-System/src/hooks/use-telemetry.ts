import { useEffect, useRef, useState } from "react";
import { TelemetryLogger, getDeviceInfo, newId, type Sample, type TelemetryStats } from "@/lib/telemetry";

interface Options {
  /** Create the logger (and upload anything queued). */
  enabled: boolean;
  /** Take samples at `hz` while true. */
  recording: boolean;
  participantId: string | null;
  condition: string | null;
  siteId: string | null;
  /** Overrides the browser-reported model, e.g. ?device=pixel7 — iOS never reports one. */
  deviceLabel: string | null;
  /** Called at each tick; read refs here, not render state, to avoid stale values. */
  sample: () => Sample;
  hz?: number;
}

export function useTelemetry({ enabled, recording, participantId, condition, siteId, deviceLabel, sample, hz = 5 }: Options) {
  const [logger, setLogger] = useState<TelemetryLogger | null>(null);
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  // Session meta that is fixed for the logger's lifetime.
  const fixedMeta = useRef({ participantId, condition, deviceLabel });

  useEffect(() => {
    if (!enabled) return;
    let active: TelemetryLogger | null = null;
    let cancelled = false;
    getDeviceInfo().then(info => {
      if (cancelled) return;
      active = new TelemetryLogger(
        {
          session_id: newId(),
          participant_id: fixedMeta.current.participantId,
          condition: fixedMeta.current.condition,
          site_id: null,
          device_model: fixedMeta.current.deviceLabel ?? info.device_model,
          os_version: info.os_version,
          user_agent: navigator.userAgent,
        },
        setStats,
      );
      active.start();
      setLogger(active);
    });
    return () => {
      cancelled = true;
      active?.stop();
      setLogger(null);
    };
  }, [enabled]);

  useEffect(() => {
    logger?.updateSession({ site_id: siteId });
  }, [logger, siteId]);

  useEffect(() => {
    if (!logger || !recording) return;
    const id = window.setInterval(() => logger.record({ timestamp_ms: Date.now(), ...sampleRef.current() }), 1000 / hz);
    return () => window.clearInterval(id);
  }, [logger, recording, hz]);

  return { ready: logger !== null, stats, flush: () => logger?.flush() };
}
