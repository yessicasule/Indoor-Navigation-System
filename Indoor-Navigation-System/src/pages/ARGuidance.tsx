import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Camera, Navigation, ArrowRight, MapPin, Info, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// 1. Import the QR Scanner component (requires installation)
import { QrReader } from 'react-qr-reader'; 

// Define a type for the dynamic navigation instructions from the backend
interface NavigationInstruction {
  icon: typeof MapPin | typeof ArrowRight;
  text: string;
  distance: string;
}

// Hardcode a mock destination ID for testing the full journey
const DESTINATION_WAYPOINT_ID = "EXIT_GATE_C_2"; 

const ARGuidance = () => {
  const [arActive, setArActive] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null); // To hold the scanned QR data (Waypoint ID)
  const [instructions, setInstructions] = useState<NavigationInstruction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Function to fetch the AR route once a starting QR code (waypointId) is scanned
  const fetchARRoute = async (fromId: string, toId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Calls your A*-powered backend endpoint
      const response = await fetch(
        `http://localhost:3001/api/ar-route?from=${fromId}&to=${toId}`
      );
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to find AR route.");
      }

      const rawInstructions: string[] = await response.json();
      
      // Convert raw text instructions from backend into the UI display format
      const formattedInstructions: NavigationInstruction[] = rawInstructions.map(text => {
          // Simple parsing heuristic for UI visualization
          const isTurn = text.toLowerCase().includes("turn") || text.toLowerCase().includes("exit");
          const distanceMatch = text.match(/(\d+m)/);
          
          return {
              icon: isTurn ? ArrowRight : MapPin,
              text: text.replace(distanceMatch ? distanceMatch[0] : "", "").trim(),
              distance: distanceMatch ? distanceMatch[0] : "Next",
          };
      });

      setInstructions(formattedInstructions);
      // Keep arActive true to show the instructions over the camera view
      setArActive(true); 
    } catch (err: any) {
      setError(err.message);
      setInstructions([]);
    } finally {
      setIsLoading(false);
    }
  };


  // Function to handle the successful QR code scan result
  const handleScan = async (result: any, error: any) => {
    // Only proceed on a valid result and if we're actively scanning
    if (result && result.text && !isLoading) {
      const waypointId = result.text;
      setScanResult(waypointId);
      setArActive(false); // Temporarily hide scanner while fetching/displaying route

      // Fetch the AR route based on the scanned location
      await fetchARRoute(waypointId, DESTINATION_WAYPOINT_ID);
    }

    if (error) {
      // Common practice: ignore frequent, non-critical errors from the scanner during initialization
      if (!["NotAllowedError", "NotFoundError", "NotReadableError"].includes(error.name)) {
        // console.error("Scanner Error:", error); 
      }
    }
  };

  const renderARView = () => {
    if (arActive && instructions.length > 0) {
      // --- AR View: Displaying fetched instructions ---
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Simulated Camera Feed (Background Image or Live Stream placeholder) */}
          <div className="absolute inset-0 bg-black/50" /> 
          
          <div className="text-center space-y-4 relative z-10">
            <Camera className="h-20 w-20 mx-auto text-white/80" />
            <p className="text-white text-lg">AR Guidance Active</p>
            <p className="text-white/70 text-sm">Path from {scanResult}</p>
          </div>

          {/* AR Direction Overlays (Top Instruction) */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="bg-secondary/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-[var(--shadow-glow)] animate-float">
              <div className="flex items-center gap-2">
                {instructions[0].icon({className: "h-5 w-5"})}
                <span className="font-semibold">{instructions[0].text}</span>
                <Badge variant="secondary" className="bg-white text-primary">
                  {instructions[0].distance}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (arActive && !scanResult && !isLoading) {
        // --- QR Scanner View ---
        return (
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center space-y-4 relative z-10">
                        <QrCode className="h-20 w-20 mx-auto text-white/80 animate-pulse" />
                        <p className="text-white text-lg">Scanning for QR Code...</p>
                        <p className="text-white/70 text-sm">Please point at a station QR code.</p>
                    </div>
                </div>
                
                {/* The actual scanner component */}
                <QrReader
                    onResult={handleScan}
                    // Attempt to use the 'environment' (back) camera
                    constraints={{ facingMode: 'environment' }} 
                    scanDelay={500}
                    // Style to cover the whole container
                    containerStyle={{ width: '100%', height: '100%', position: 'absolute' }}
                    videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
        );
    }

    // --- Initial Landing View ---
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white">
            <QrCode className="h-24 w-24 mb-6 animate-pulse-glow" />
            <h2 className="text-3xl font-bold mb-3">AR Navigation</h2>
            <p className="text-white/80 mb-8 max-w-sm">
                Scan QR codes at the station to activate augmented reality guidance
            </p>
            <Button
                variant="hero"
                size="xl"
                onClick={() => {
                    setArActive(true); // Activate the scanner/camera view
                    setScanResult(null); // Reset previous scan
                    setInstructions([]); // Clear old instructions
                    setError(null);
                }}
                className="bg-white text-primary hover:bg-white/90"
            >
                <Camera className="mr-2 h-5 w-5" />
                Activate AR Camera
            </Button>
        </div>
    );
  };


  return (
    <div className="min-h-screen">
      {/* AR Camera View */}
      <div className="relative h-[60vh] bg-gradient-to-br from-[hsl(var(--metro-indigo))] to-[hsl(var(--metro-picton))] overflow-hidden">
        {renderARView()}
      </div>

      {/* Controls and Information */}
      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Loading/Error States */}
        {isLoading && (
            <div className="flex items-center justify-center p-4 rounded-lg bg-muted/50">
                <Loader2 className="h-5 w-5 mr-2 animate-spin text-secondary" />
                <p className="text-sm text-muted-foreground">Finding shortest AR path...</p>
            </div>
        )}
        {error && (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                Error: {error}
            </div>
        )}
        
        {/* Active Directions Card */}
        {(instructions.length > 0 && scanResult) && (
          <>
            <Card className="glass shadow-[var(--shadow-float)] animate-slide-up">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Active Directions (From {scanResult})</h3>
                  <Badge variant="secondary">Live</Badge>
                </div>
                <div className="space-y-3">
                  {instructions.map((direction, index) => {
                    const Icon = direction.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{direction.text}</p>
                          <p className="text-xs text-muted-foreground">
                            {direction.distance} {index === 0 ? "ahead" : "next step"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                setArActive(false);
                setScanResult(null);
                setInstructions([]);
              }}
            >
              Stop AR Navigation
            </Button>
          </>
        )}
        
        {/* Initial Info Card */}
        {!arActive && instructions.length === 0 && !isLoading && (
            <Card className="glass">
              <CardHeader className="flex flex-row items-start gap-4 p-6">
                <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Info className="h-6 w-6 text-secondary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">How AR Navigation Works</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-secondary">•</span>
                      <span>Scan QR codes placed throughout the station</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-secondary">•</span>
                      <span>Follow AR arrows and markers on your screen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-secondary">•</span>
                      <span>
                        Get real-time directions to exits, platforms, and facilities
                      </span>
                    </li>
                  </ul>
                </div>
              </CardHeader>
            </Card>
        )}
      </div>
    </div>
  );
};

export default ARGuidance;