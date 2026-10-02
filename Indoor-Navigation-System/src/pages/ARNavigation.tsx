import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Navigation, MapPin, ArrowRight, ArrowUp, RotateCcw, CheckCircle2, Compass, ScanLine, Crosshair, Footprints, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import QrScanner from 'qr-scanner';
import { API_BASE } from '@/lib/api';
import { useCompass, type CompassStatus } from '@/hooks/use-compass';
import { parseAnchor } from '@/lib/anchor';
import { angleDiff, mapBearing, wrap360 } from '@/lib/bearing';
import { useTelemetry } from '@/hooks/use-telemetry';
import { orientationFields } from '@/lib/telemetry';

// --- TYPES ---
interface PathNode {
  node_id: string;
  name: string;
  x: number;
  y: number;
  z?: number;
  floor?: number | null;
  type: string;
}

interface Destination {
  doc_id: string;
  name: string;
  type: string;
}

/**
 * Heading calibration: corrected heading = raw + correction, expressed in the "frame" —
 * true bearings when the site's north offset is known, otherwise map bearings.
 * - anchor: scanned facing a QR anchor whose facing bearing is surveyed (the absolute reset)
 * - manual: user said they face along the current route segment (fallback)
 */
interface Calibration {
  correction: number;
  source: 'anchor' | 'manual';
}

// --- HELPERS ---
const lerp = (start: number, end: number, factor: number) => wrap360(start + angleDiff(start, end) * factor);

const horizontalDist = (a: PathNode, b: PathNode) => Math.hypot(b.x - a.x, b.y - a.y);
const dist3d = (a: PathNode, b: PathNode) => Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0));

const numberOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Places worth naming to a user; corridor junctions are unnamed or named "... Node". */
const isPlace = (n: PathNode | undefined) => !!n?.name && !n.name.includes('Node');

const COMPASS_LABEL: Record<CompassStatus, string> = {
  'insecure': 'Unavailable — page must be served over HTTPS',
  'needs-gesture': 'Tap to enable',
  'waiting': 'Waiting for sensor…',
  'active': '',
  'denied': 'Permission denied — allow Motion & Orientation in Safari settings',
  'unsupported': 'Not supported on this device',
};

const ARNavigation = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const compass = useCompass();
  const [searchParams] = useSearchParams();

  /** Latest raw heading if the sensor fired within the last second, else null. */
  const freshHeading = () => {
      const s = compass.sampleRef.current;
      return s && Date.now() - s.timestampMs < 1000 ? s.heading : null;
  };
  const waitForHeading = async (timeoutMs = 2000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
          const h = freshHeading();
          if (h !== null) return h;
          await new Promise(r => setTimeout(r, 100));
      }
      return null;
  };

  // --- APP STATES ---
  const [appState, setAppState] = useState<'SCAN' | 'SELECT' | 'NAVIGATE'>('SCAN');

  // --- DATA STATES ---
  const [siteId, setSiteId] = useState<string>("");
  const [startNodeId, setStartNodeId] = useState<string>("");
  const [startName, setStartName] = useState<string>("");
  const [siteName, setSiteName] = useState<string>("");
  const [anchorMapBearing, setAnchorMapBearing] = useState<number | null>(null);
  const [northOffset, setNorthOffset] = useState<number | null>(null);
  const scanAtRef = useRef(0);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDest, setSelectedDest] = useState<string>("");

  // --- NAVIGATION STATES ---
  const [path, setPath] = useState<PathNode[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  // SENSORS
  const [smoothHeading, setSmoothHeading] = useState(0);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const frameOffset = northOffset ?? 0;

  // ------------------------------------------------------------------
  // 1. CAMERA & QR SETUP
  // ------------------------------------------------------------------
  // The scanner is created once per appState; route its callback through a ref so it
  // always calls the latest handler instead of the one captured at creation.
  const scanHandlerRef = useRef<(data: string) => void>(() => {});

  useEffect(() => {
    let qrScanner: QrScanner | null = null;

    const startCamera = async () => {
        if (videoRef.current) {
            // Initialize QR Scanner
            qrScanner = new QrScanner(
                videoRef.current,
                (result) => {
                    if (result && result.data) {
                        scanHandlerRef.current(result.data);
                    }
                },
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    returnDetailedScanResult: true,
                    maxScansPerSecond: 5,
                }
            );

            try {
                await qrScanner.start();
            } catch (e) {
                console.error("Scanner error", e);
                // Fallback: Just try to open camera if scanner fails
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' }
                    });
                    videoRef.current.srcObject = stream;
                } catch (err) {
                    console.error("Camera fallback failed", err);
                    toast.error("Camera failed to start");
                }
            }
        }
    };

    // Only start camera in SCAN or NAVIGATE modes
    if (appState === 'SCAN' || appState === 'NAVIGATE') {
        startCamera();
    }

    return () => {
        qrScanner?.stop();
        qrScanner?.destroy();
    };
  }, [appState]); // Re-run when appState changes to ensure camera is active


  // ------------------------------------------------------------------
  // 2. COMPASS LOGIC
  // ------------------------------------------------------------------
  // Listener setup (iOS permission, absolute vs. relative events) lives in useCompass.
  useEffect(() => {
    if (!window.isSecureContext) {
      toast.error("Camera and compass need HTTPS — open this page via the tunnel URL.");
    }

    let animationFrameId: number;
    const updateLoop = () => {
      const sample = compass.sampleRef.current;
      if (sample) setSmoothHeading(prev => lerp(prev, sample.heading, 0.1));
      animationFrameId = requestAnimationFrame(updateLoop);
    };
    updateLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [compass.sampleRef]);


  // ------------------------------------------------------------------
  // 3. QR HANDLER
  // ------------------------------------------------------------------
  const busyRef = useRef(false); // the scanner fires ~5×/s; handle one anchor at a time

  const processCode = async (code: string) => {
      if (busyRef.current) return;
      const anchor = parseAnchor(code);
      if (!anchor) {
          toast.error("Not a navigation anchor QR code");
          return;
      }

      busyRef.current = true;
      try {
          // Read the heading now, while the user is still facing the anchor.
          const headingAtScan = freshHeading();
          const [waypointRes, destRes, siteRes] = await Promise.all([
              fetch(`${API_BASE}/api/waypoints/${encodeURIComponent(anchor.nodeId)}`),
              fetch(`${API_BASE}/api/destinations?stationId=${encodeURIComponent(anchor.siteId)}`),
              fetch(`${API_BASE}/api/sites/${encodeURIComponent(anchor.siteId)}`),
          ]);
          if (waypointRes.status === 404) {
              toast.error(`Unknown anchor: ${anchor.nodeId}`);
              return;
          }
          if (!waypointRes.ok || !destRes.ok) throw new Error("Network Error");

          const waypoint = await waypointRes.json();
          if (waypoint.station_id !== anchor.siteId) {
              toast.error(`Anchor ${anchor.nodeId} does not belong to site ${anchor.siteId}`);
              return;
          }

          const data: Destination[] = (await destRes.json()).filter((d: Destination) => d.doc_id !== anchor.nodeId);
          if (data.length === 0) {
              toast.warning("No destinations found for this site.");
              return;
          }
          const site = siteRes.ok ? await siteRes.json() : null;
          const offset = numberOrNull(site?.north_offset_deg);
          const facing = numberOrNull(waypoint.anchor_map_bearing_deg);
          // Opened from the camera app, the compass may not have fired yet; the user is still
          // facing the code they just scanned, so allow a short wait for the first reading.
          const heading = headingAtScan ?? (facing !== null ? await waitForHeading(1500) : null);

          setSiteId(anchor.siteId);
          setStartNodeId(anchor.nodeId);
          setStartName(waypoint.name || anchor.nodeId);
          setSiteName(typeof site?.name === 'string' ? site.name : anchor.siteId);
          setNorthOffset(offset);
          setAnchorMapBearing(facing);
          scanAtRef.current = Date.now();
          setCalibration(facing !== null && heading !== null
              ? { correction: angleDiff(heading, wrap360(facing + (offset ?? 0))), source: 'anchor' }
              : null);
          setDestinations(data);
          setSelectedDest("");
          setAppState('SELECT');
      } catch (e) {
          console.error(e);
          toast.error("Failed to connect to Backend");
      } finally {
          busyRef.current = false;
      }
  };

  const handleRealScan = (data: string) => {
      if (appState === 'SCAN') processCode(data);
  };
  scanHandlerRef.current = handleRealScan;

  // Opened from the phone's camera app via the anchor URL (?site=…&node=…): skip the scan step.
  useEffect(() => {
      if (searchParams.get('site') && searchParams.get('node')) processCode(window.location.href);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ------------------------------------------------------------------
  // 4. NAVIGATION LOGIC
  // ------------------------------------------------------------------
  /** Bearing of route segment i -> i+1 in the calibration frame, or null for stairs/lifts. */
  const segmentBearing = (nodes: PathNode[], i: number) => {
      const curr = nodes[i];
      const next = nodes[i + 1];
      if (!curr || !next || horizontalDist(curr, next) < 0.5) return null;
      return wrap360(mapBearing(next.x - curr.x, next.y - curr.y) + frameOffset);
  };

  /** "I'm facing along the current segment" — fallback when no anchor calibration exists. */
  const calibrateManually = (nodes: PathNode[], i: number, raw: number) => {
      const target = segmentBearing(nodes, i);
      if (target === null) return false;
      setCalibration({ correction: angleDiff(raw, target), source: 'manual' });
      return true;
  };

  // Tap handler: user faces the QR code they just scanned.
  const calibrateAtAnchor = async () => {
      if (anchorMapBearing === null) return;
      if (!(await compass.enable())) {
          toast.error("Compass unavailable");
          return;
      }
      const raw = await waitForHeading();
      if (raw === null) {
          toast.error("No compass reading — try again");
          return;
      }
      setCalibration({ correction: angleDiff(raw, wrap360(anchorMapBearing + frameOffset)), source: 'anchor' });
      toast.success("Heading calibrated at anchor");
  };

  const startNavigation = async () => {
      if (!selectedDest) return;
      // Request permission before any await, while still inside the tap's user activation.
      const compassReady = compass.enable();
      try {
          const res = await fetch(`${API_BASE}/api/ar-path?from=${encodeURIComponent(startNodeId)}&to=${encodeURIComponent(selectedDest)}`);
          const data = await res.json();

          if (data.found && data.path.length > 0) {
              setPath(data.path);
              setStepIndex(0);
              setAppState('NAVIGATE');
              if (!(await compassReady)) {
                  toast.warning("Compass unavailable — arrow will not track heading.");
              } else if (!calibration) {
                  const raw = await waitForHeading();
                  if (raw !== null && calibrateManually(data.path, 0, raw)) {
                      toast.info("Not calibrated at the QR code — assuming you face the first direction.");
                  }
              }
          } else {
              toast.error("No path found.");
          }
      } catch (e) {
          toast.error("Navigation Error");
      }
  };

  // Metres along the route from the anchor (path[0]) to each node.
  const cumulativeMetres = useMemo(() => {
      const out = [0];
      for (let i = 1; i < path.length; i++) out.push(out[i - 1] + dist3d(path[i - 1], path[i]));
      return out;
  }, [path]);

  const arrived = stepIndex >= path.length - 1;
  const currNode = path[stepIndex];
  const nextNode = path[stepIndex + 1];
  const targetBearing = appState === 'NAVIGATE' && !arrived ? segmentBearing(path, stepIndex) : null;
  // A segment with no horizontal length is a stair/lift change: show text, not an arrow.
  const floorChange = !arrived && targetBearing === null && currNode && nextNode
      ? (nextNode.floor ?? null)
      : undefined;
  const segmentMetres = currNode && nextNode ? Math.round(dist3d(currNode, nextNode)) : 0;

  // With no calibration, a north-referenced compass is still usable once the site's offset is known.
  const absolute = compass.sampleRef.current?.absolute ?? false;
  const correction = calibration?.correction ?? (absolute && northOffset !== null ? 0 : null);
  const correctedHeading = correction !== null ? wrap360(smoothHeading + correction) : null;
  const turnAngle = targetBearing !== null && correctedHeading !== null ? angleDiff(correctedHeading, targetBearing) : null;

  const destination = path[path.length - 1];
  const remainingMetres = Math.max(0, Math.round((cumulativeMetres[cumulativeMetres.length - 1] ?? 0) - (cumulativeMetres[stepIndex] ?? 0)));
  const nextTitle = arrived
      ? destination?.name ?? 'Destination'
      : isPlace(nextNode) ? nextNode!.name : floorChange !== undefined ? 'Stairs / lift' : 'Next turn';
  const instructionText = arrived
      ? "You have arrived!"
      : floorChange !== undefined
          ? `Take the stairs/lift${floorChange !== null ? ` to floor ${floorChange}` : ''}`
          : isPlace(nextNode)
              ? `Walk ${segmentMetres} m to ${nextNode!.name}`
              : `Walk ${segmentMetres} m, then follow the arrow`;

  // --- Study 2 telemetry: /ar?log=1&pid=E01&device=pixel7&cond=study2 ---
  const telemetry = useTelemetry({
      enabled: searchParams.get('log') === '1',
      recording: appState === 'NAVIGATE',
      participantId: searchParams.get('pid'),
      condition: searchParams.get('cond') ?? 'study2',
      siteId: siteId || null,
      deviceLabel: searchParams.get('device'),
      sample: () => ({
          ...orientationFields(compass.sampleRef.current),
          smoothed_heading: smoothHeading,
          heading_correction: correction,
          corrected_heading: correctedHeading,
          frame_offset_deg: northOffset,
          calibration_source: calibration?.source ?? null,
          last_anchor_id: startNodeId || null,
          ms_since_anchor: scanAtRef.current ? Date.now() - scanAtRef.current : null,
          metres_since_anchor: cumulativeMetres[stepIndex] ?? null,
          nodes_traversed: stepIndex,
          current_node: currNode?.node_id ?? null,
          current_target_node: nextNode?.node_id ?? null,
          survey_point_id: null,
      }),
  });


  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-zinc-950 overflow-hidden text-white font-sans select-none">

      <Link
        to="/"
        aria-label="Close navigation"
        className="absolute top-3 left-3 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 backdrop-blur border border-white/10"
      >
        <X className="h-5 w-5" />
      </Link>

      {/* --- CAMERA BACKGROUND --- */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: appState === 'SCAN' ? 1 : 0.5 }}
        playsInline
        muted
        // Note: autoPlay is removed here because QrScanner handles playing the video
      />

      {/* --- PHASE 1: SCAN --- */}
      {appState === 'SCAN' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-20">

              {/* Scan Frame UI */}
              <div className="relative w-64 h-64 mb-8">
                  <div className="absolute inset-0 border-2 border-white/30 rounded-3xl"></div>
                  <div className="absolute inset-0 border-2 border-transparent border-t-blue-500 border-r-blue-500 rounded-3xl rounded-bl-none rounded-br-none animate-pulse"></div>
                  <div className="absolute w-full h-1 bg-blue-500/80 shadow-[0_0_15px_#3b82f6] animate-[scan_2s_ease-in-out_infinite]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <ScanLine className="text-white/20 w-32 h-32" strokeWidth={0.5} />
                  </div>
              </div>

              <div className="bg-black/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 text-center shadow-2xl w-full max-w-xs">
                  <h2 className="text-2xl font-bold mb-2">Scan QR Code</h2>
                  <p className="text-sm text-gray-400">Point at a navigation marker</p>

                  {/* Compass status — iOS needs this tap before any heading arrives */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                     <button
                        onClick={() => void compass.enable()}
                        disabled={compass.status !== 'needs-gesture'}
                        className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 w-full text-left disabled:cursor-default"
                     >
                        <Compass className="h-3 w-3 text-gray-500 shrink-0" />
                        <span className="text-[10px] font-mono text-gray-400">
                            Compass: {compass.status === 'active'
                                ? `${Math.round(smoothHeading)}° · ${compass.sampleRef.current?.eventType}${compass.sampleRef.current?.absolute ? ' (absolute)' : ' (relative)'}`
                                : COMPASS_LABEL[compass.status]}
                        </span>
                     </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- PHASE 2: SELECT --- */}
      {appState === 'SELECT' && (
          <div className="absolute inset-0 flex items-end justify-center z-20 bg-black/40 backdrop-blur-sm">
             <div className="w-full bg-zinc-900 rounded-t-[40px] p-8 space-y-6 animate-in slide-in-from-bottom duration-500 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10">
                 <div className="flex flex-col items-center">
                     <div className="h-1 w-12 bg-zinc-700 rounded-full mb-6" />
                     <div className="bg-blue-500/10 text-blue-400 px-4 py-1.5 rounded-full text-xs font-bold mb-3 border border-blue-500/20 flex items-center gap-2">
                        <MapPin className="h-3 w-3" /> CURRENT LOCATION
                     </div>
                     <h2 className="text-3xl font-bold text-center mb-1">{startName}</h2>
                     <p className="text-zinc-400 text-sm">{siteName || siteId}</p>
                 </div>

                 <div className="space-y-4">
                     <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Navigate To</label>
                     <Select value={selectedDest} onValueChange={setSelectedDest}>
                        <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 text-white h-16 text-lg rounded-2xl px-4 focus:ring-2 focus:ring-blue-500/50">
                            <SelectValue placeholder="Select destination..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700 text-white rounded-xl max-h-[200px]">
                            {destinations.map((dest) => (
                                <SelectItem key={dest.doc_id} value={dest.doc_id} className="py-3 text-base focus:bg-zinc-700">
                                    {dest.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                     </Select>
                 </div>

                 {anchorMapBearing !== null && (
                     <button
                        onClick={calibrateAtAnchor}
                        className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm border ${calibration?.source === 'anchor' ? 'border-green-500/30 text-green-400' : 'border-amber-500/40 text-amber-300'}`}
                     >
                        <Crosshair className="h-4 w-4" />
                        {calibration?.source === 'anchor'
                            ? 'Heading calibrated at this marker · tap to redo'
                            : 'Face the QR marker and tap to calibrate'}
                     </button>
                 )}

                 <Button
                    onClick={startNavigation}
                    disabled={!selectedDest}
                    className="w-full h-16 text-lg font-bold bg-white text-black hover:bg-gray-200 rounded-2xl mt-4 shadow-xl disabled:opacity-50 transition-transform active:scale-95"
                 >
                    Start Navigation <ArrowRight className="ml-2 h-5 w-5" />
                 </Button>
             </div>
          </div>
      )}

      {/* --- PHASE 3: NAVIGATE (Older Clean UI) --- */}
      {appState === 'NAVIGATE' && (
          <div className="relative z-10 h-full flex flex-col">

              {/* Top HUD (Older Style) */}
              <div className="p-6 pt-12">
                  <div className="bg-black/70 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-2xl animate-in slide-in-from-top duration-500">
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-1 truncate">
                                  To {destination?.name ?? 'destination'}
                              </p>
                              <h2 className="text-2xl font-bold leading-tight">{nextTitle}</h2>
                          </div>
                          <div className="text-right shrink-0 pl-3">
                              <div className="text-3xl font-bold text-blue-400">{arrived ? 0 : segmentMetres}<span className="text-sm text-gray-500 ml-1">m</span></div>
                              {!arrived && <div className="text-[11px] text-gray-500">{remainingMetres} m left</div>}
                          </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(stepIndex / (path.length-1)) * 100}%` }}></div>
                      </div>

                      <p className="text-sm text-gray-300 mt-4 flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-blue-400" /> {instructionText}
                      </p>
                      {telemetry.ready && (
                          <p className="text-[10px] font-mono text-red-400 mt-2">
                              ● REC {telemetry.stats?.sentSamples ?? 0} sent · {telemetry.stats?.queuedBatches ?? 0} waiting
                              {telemetry.stats?.lastError ? ` · ${telemetry.stats.lastError}` : ''}
                          </p>
                      )}
                  </div>
              </div>

              {/* CENTER ARROW (3D Perspective) */}
              <div className="flex-1 flex items-center justify-center perspective-container">
                  {!arrived && turnAngle === null ? (
                      <div className="text-center px-8 text-gray-300">
                          <Footprints size={96} className="mx-auto mb-4 text-blue-400" />
                          <p className="text-lg">
                              {floorChange !== undefined
                                  ? instructionText
                                  : compass.status === 'active'
                                      ? 'Arrow not aligned yet — face along the corridor and tap "Arrow wrong?" below.'
                                      : 'No compass reading on this device — follow the directions above.'}
                          </p>
                      </div>
                  ) : !arrived ? (
                      <div className="relative w-64 h-64 flex items-center justify-center">

                          {/* Floor Circle */}
                          <div className="absolute w-48 h-48 rounded-full border-4 border-blue-500/20 transform rotate-x-60 bg-blue-500/5 animate-pulse-slow"></div>

                          {/* The Arrow */}
                          <div
                            style={{
                                transform: `rotate(${turnAngle ?? 0}deg)`, 
                                transition: 'transform 0.1s linear'
                            }}
                            className="w-full h-full flex items-center justify-center"
                          >
                              <ArrowUp
                                className="text-blue-500 drop-shadow-[0_0_30px_rgba(59,130,246,1)]" 
                                size={180}
                                strokeWidth={2}
                              />
                          </div>
                      </div>
                  ) : (
                      <div className="text-center animate-bounce">
                          <CheckCircle2 size={120} className="text-green-500 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]" />
                          <h1 className="text-4xl font-bold">Arrived!</h1>
                      </div>
                  )}
              </div>

              {/* Bottom Controls (Older Style - Recalibrate button + Next Step) */}
              <div className="pb-8 px-6">
                  {!arrived ? (
                      <div className="flex flex-col gap-3">
                          <Button
                            onClick={() => setStepIndex(prev => prev + 1)}
                            className="w-full h-16 text-xl font-bold bg-white text-black hover:bg-gray-200 shadow-lg rounded-2xl transition-transform active:scale-95"
                          >
                              I'm Here - Next Step
                          </Button>

                          {/* Subtle recalibrate button */}
                          <button
                             onClick={() => {
                                 const raw = freshHeading();
                                 if (raw !== null && calibrateManually(path, stepIndex, raw)) toast.success("Re-aligned");
                                 else toast.error("Can't re-align here");
                             }}
                             className="text-xs text-gray-500 underline opacity-50"
                          >
                             Arrow wrong? Face along the corridor towards {isPlace(nextNode) ? nextNode!.name : 'the next turn'} and tap to re-align.
                          </button>
                      </div>
                  ) : (
                      <Button onClick={() => setAppState('SCAN')} variant="outline" className="w-full h-14 border-white/10 text-white hover:bg-white/10 rounded-xl">
                         <RotateCcw className="mr-2 h-4 w-4" /> Start New Route
                      </Button>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default ARNavigation;