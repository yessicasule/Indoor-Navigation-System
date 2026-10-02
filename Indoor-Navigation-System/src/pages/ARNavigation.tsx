import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navigation, MapPin, ArrowRight, RotateCcw, CheckCircle2, Compass, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import QrScanner from 'qr-scanner';
import { API_BASE } from '@/lib/api';
import { useCompass, type CompassStatus } from '@/hooks/use-compass';
import { parseAnchor } from '@/lib/anchor';

// --- TYPES ---
interface PathNode {
  node_id: string;
  name: string;
  x: number;
  y: number;
  type: string;
}

interface Destination {
  doc_id: string;
  name: string;
  type: string;
}

// --- HELPER: ANGLE SMOOTHING ---
const shortestAngleDist = (a0: number, a1: number) => {
  const max = 360;
  const da = (a1 - a0) % max;
  return (2 * da) % max - da;
};

const lerp = (start: number, end: number, factor: number) => {
  const dist = shortestAngleDist(start, end);
  return (((start + dist * factor) % 360) + 360) % 360;
};

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
  const rawHeading = () => compass.sampleRef.current?.heading ?? 0;
  
  // --- APP STATES ---
  const [appState, setAppState] = useState<'SCAN' | 'SELECT' | 'NAVIGATE'>('SCAN');
  
  // --- DATA STATES ---
  const [siteId, setSiteId] = useState<string>("");
  const [startNodeId, setStartNodeId] = useState<string>(""); 
  const [startName, setStartName] = useState<string>("");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDest, setSelectedDest] = useState<string>("");
  
  // --- NAVIGATION STATES ---
  const [path, setPath] = useState<PathNode[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  
  // SENSORS
  const [smoothHeading, setSmoothHeading] = useState(0);
  const [baseHeading, setBaseHeading] = useState(0); 

  // ------------------------------------------------------------------
  // 1. CAMERA & QR SETUP
  // ------------------------------------------------------------------
  useEffect(() => {
    let qrScanner: QrScanner | null = null;

    const startCamera = async () => {
        if (videoRef.current) {
            // Initialize QR Scanner
            qrScanner = new QrScanner(
                videoRef.current,
                (result) => {
                    if (result && result.data) {
                        handleRealScan(result.data);
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
          const [waypointRes, destRes] = await Promise.all([
              fetch(`${API_BASE}/api/waypoints/${encodeURIComponent(anchor.nodeId)}`),
              fetch(`${API_BASE}/api/destinations?stationId=${encodeURIComponent(anchor.siteId)}`),
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
          setSiteId(anchor.siteId);
          setStartNodeId(anchor.nodeId);
          setStartName(waypoint.name || anchor.nodeId);
          setDestinations(data);
          setSelectedDest("");
          setAppState('SELECT');
          toast.success(`${data.length} destinations loaded`);
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

  // Opened from the phone's camera app via the anchor URL (?site=…&node=…): skip the scan step.
  const [searchParams] = useSearchParams();
  useEffect(() => {
      if (searchParams.get('site') && searchParams.get('node')) processCode(window.location.href);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ------------------------------------------------------------------
  // 4. NAVIGATION LOGIC
  // ------------------------------------------------------------------
  const startNavigation = async () => {
      if (!selectedDest) return;
      // Request permission before any await, while still inside the tap's user activation.
      const compassReady = compass.enable();
      try {
          const res = await fetch(`${API_BASE}/api/ar-path?from=${startNodeId}&to=${selectedDest}`);
          const data = await res.json();
          
          if (data.found && data.path.length > 0) {
              setPath(data.path);
              setStepIndex(0);
              setAppState('NAVIGATE');
              if (!(await compassReady)) toast.warning("Compass unavailable — arrow will not track heading.");
              setBaseHeading(rawHeading()); 
              toast.info("Navigation Started");
          } else {
              toast.error("No path found.");
          }
      } catch (e) {
          toast.error("Navigation Error");
      }
  };

  // Math
  const getCurrentInstruction = () => {
      if (stepIndex >= path.length - 1) return { text: "You have arrived!", bearing: 0, dist: 0 };
      
      const curr = path[stepIndex];
      const next = path[stepIndex + 1];
      
      const dy = next.y - curr.y;
      const dx = next.x - curr.x;
      let mapAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      mapAngle = (mapAngle + 360) % 360; 
      
      const dist = Math.round(Math.sqrt(dx*dx + dy*dy));

      return {
          text: `Go to ${next.name}`,
          bearing: mapAngle,
          dist: dist
      };
  };

  const instruction = appState === 'NAVIGATE' ? getCurrentInstruction() : null;
  const targetBearing = instruction ? instruction.bearing : 0;
  const currentHeadingRel = (smoothHeading - baseHeading + 360) % 360;
  const turnAngle = shortestAngleDist(currentHeadingRel, targetBearing);


  return (
    <div className="relative h-screen w-full bg-zinc-950 overflow-hidden text-white font-sans select-none">
      
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
                     <p className="text-zinc-400 text-sm font-mono tracking-wide">{siteId} · {startNodeId}</p>
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
                              <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-1">Next Stop</p>
                              <h2 className="text-2xl font-bold leading-tight max-w-[80%]">
                                  {path[stepIndex + 1]?.name || "Destination"}
                              </h2>
                          </div>
                          <div className="text-right">
                              <div className="text-3xl font-bold text-blue-400">{instruction?.dist}<span className="text-sm text-gray-500 ml-1">m</span></div>
                          </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(stepIndex / (path.length-1)) * 100}%` }}></div>
                      </div>
                      
                      <p className="text-sm text-gray-300 mt-4 flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-blue-400" /> {instruction?.text}
                      </p>
                  </div>
              </div>

              {/* CENTER ARROW (3D Perspective) */}
              <div className="flex-1 flex items-center justify-center perspective-container">
                  {stepIndex < path.length - 1 ? (
                      <div className="relative w-64 h-64 flex items-center justify-center">
                          
                          {/* Floor Circle */}
                          <div className="absolute w-48 h-48 rounded-full border-4 border-blue-500/20 transform rotate-x-60 bg-blue-500/5 animate-pulse-slow"></div>
                          
                          {/* The Arrow */}
                          <div 
                            style={{ 
                                transform: `rotate(${turnAngle}deg)`, 
                                transition: 'transform 0.1s linear' 
                            }}
                            className="w-full h-full flex items-center justify-center"
                          >
                              <ArrowRight 
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
                  {stepIndex < path.length - 1 ? (
                      <div className="flex flex-col gap-3">
                          <Button 
                            onClick={() => setStepIndex(prev => prev + 1)} 
                            className="w-full h-16 text-xl font-bold bg-white text-black hover:bg-gray-200 shadow-lg rounded-2xl transition-transform active:scale-95"
                          >
                              I'm Here - Next Step
                          </Button>
                          
                          {/* Subtle recalibrate button */}
                          <button 
                             onClick={() => { setBaseHeading(rawHeading()); toast.success("Recalibrated"); }}
                             className="text-xs text-gray-500 underline opacity-50"
                          >
                             Arrow wrong? Tap to reset forward.
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