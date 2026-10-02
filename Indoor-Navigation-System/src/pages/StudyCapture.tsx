import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Compass, Play, SkipForward, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompass } from "@/hooks/use-compass";
import { useTelemetry } from "@/hooks/use-telemetry";
import { orientationFields } from "@/lib/telemetry";
import { circularStats } from "@/lib/bearing";

// Study 1 (magnetic survey): /ar?study=1&site=<siteId>&point=P07&device=pixel7&pid=E01
// Phone lies flat at the surveyed point, top edge along the point's alignment direction.
// One tap: 3 s settle (so the tap doesn't disturb the phone), then a 10 s capture at 5 Hz.

const SETTLE_S = 3;
const CAPTURE_S = 10;

type Phase = "idle" | "settling" | "capturing" | "done";

interface Summary {
  n: number;
  mean: number;
  std: number;
  eventType: string | null;
  absolute: boolean;
}

/** "P07" -> "P08", "P9" -> "P10"; keeps zero padding. */
const nextPointId = (id: string) => {
  const m = id.match(/^(.*?)(\d+)$/);
  if (!m) return id;
  const n = String(Number(m[2]) + 1).padStart(m[2].length, "0");
  return m[1] + n;
};

const StudyCapture = () => {
  const [params, setParams] = useSearchParams();
  const siteId = params.get("site");
  const [pointId, setPointId] = useState(params.get("point") ?? "P01");
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const compass = useCompass();
  const captured = useRef<{ heading: number; eventType: string; absolute: boolean }[]>([]);

  const telemetry = useTelemetry({
    enabled: true,
    recording: phase === "capturing",
    participantId: params.get("pid"),
    condition: "study1",
    siteId,
    deviceLabel: params.get("device"),
    sample: () => {
      const s = compass.sampleRef.current;
      if (s) captured.current.push({ heading: s.heading, eventType: s.eventType, absolute: s.absolute });
      return { ...orientationFields(s), survey_point_id: pointId };
    },
  });

  // Keep the point in the URL so a reload resumes at the same point.
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("point", pointId);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointId]);

  const runCountdown = (seconds: number) =>
    new Promise<void>(resolve => {
      let left = seconds;
      setCountdown(left);
      const id = window.setInterval(() => {
        left -= 1;
        setCountdown(left);
        if (left <= 0) {
          window.clearInterval(id);
          resolve();
        }
      }, 1000);
    });

  const start = async () => {
    setError(null);
    setSummary(null);
    // Tap handler: iOS permission prompt must happen here.
    if (!(await compass.enable())) {
      setError("Compass unavailable — check HTTPS and Motion & Orientation permission.");
      return;
    }
    setPhase("settling");
    await runCountdown(SETTLE_S);
    if (!compass.sampleRef.current || Date.now() - compass.sampleRef.current.timestampMs > 1000) {
      setPhase("idle");
      setError("No compass readings arriving — this device/browser may not expose a magnetometer.");
      return;
    }
    captured.current = [];
    setPhase("capturing");
    await runCountdown(CAPTURE_S);
    setPhase("done");

    const samples = captured.current;
    const stats = circularStats(samples.map(s => s.heading));
    if (stats) {
      setSummary({
        n: samples.length,
        ...stats,
        eventType: samples[0]?.eventType ?? null,
        absolute: samples.every(s => s.absolute),
      });
    }
    void telemetry.flush();
  };

  const busy = phase === "settling" || phase === "capturing";

  return (
    <div className="container mx-auto max-w-md px-4 py-6 space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Study 1 · Magnetic survey</p>
        <p className="text-sm text-muted-foreground">
          Site <span className="font-mono">{siteId ?? "—"}</span> · device{" "}
          <span className="font-mono">{params.get("device") ?? "auto"}</span> · operator{" "}
          <span className="font-mono">{params.get("pid") ?? "—"}</span>
        </p>
        {!siteId && <p className="text-sm text-destructive mt-1">Add ?site=&lt;siteId&gt; to the URL so the analysis can match survey points.</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="point">Survey point</label>
        <Input
          id="point"
          value={pointId}
          onChange={e => setPointId(e.target.value.trim())}
          disabled={busy}
          className="text-3xl h-16 font-bold font-mono text-center"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Lay the phone flat at the marked point with its top edge along the point's alignment line, clear of your body and bag. Don't touch it during capture.
      </p>

      <Button onClick={start} disabled={busy || !pointId} className="w-full h-16 text-lg">
        {phase === "settling" && `Hands off… ${countdown}`}
        {phase === "capturing" && `Capturing… ${countdown}s`}
        {!busy && (<><Play className="mr-2 h-5 w-5" /> Capture {pointId}</>)}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {summary && phase === "done" && (
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p className="font-semibold">{pointId}: {summary.n} samples</p>
          <p className="font-mono">mean {summary.mean.toFixed(1)}° · spread ±{summary.std.toFixed(1)}°</p>
          <p className="font-mono text-muted-foreground">{summary.eventType} · {summary.absolute ? "absolute" : "relative"}</p>
          {!summary.absolute && <p className="text-destructive">Relative heading — not usable for Study 1 on this device/browser.</p>}
          {summary.n < CAPTURE_S * 4 && <p className="text-destructive">Fewer samples than expected — consider recapturing.</p>}
          {summary.std > 5 && <p className="text-amber-600">Heading moved during capture — check the phone was still.</p>}
          <Button variant="secondary" className="w-full mt-3" onClick={() => { setPointId(nextPointId(pointId)); setPhase("idle"); setSummary(null); }}>
            <SkipForward className="mr-2 h-4 w-4" /> Next point ({nextPointId(pointId)})
          </Button>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
        <p className="flex items-center gap-2">
          <Compass className="h-3 w-3" />
          Compass: {compass.status}
        </p>
        <p className="flex items-center gap-2">
          <UploadCloud className="h-3 w-3" />
          {telemetry.stats
            ? `${telemetry.stats.sentSamples} samples uploaded · ${telemetry.stats.queuedBatches} batches waiting${telemetry.stats.lastError ? ` · ${telemetry.stats.lastError}` : ""}`
            : "Starting logger…"}
        </p>
      </div>
    </div>
  );
};

export default StudyCapture;
