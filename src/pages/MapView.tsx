import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Navigation,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  Train,
  Footprints, // <-- This is the fix
  ArrowRight,
} from "lucide-react";
import { Station, NearestStationResponse } from "@/types"; // Import our types

const MapView = () => {
  // --- State Management ---

  // Location & Nearest Station
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isFindingLocation, setIsFindingLocation] = useState(false);
  const [nearestStationResult, setNearestStationResult] =
    useState<NearestStationResponse | null>(null);

  // Station List (for dropdowns)
  const [stations, setStations] = useState<Station[]>([]);
  const [isStationsLoading, setIsStationsLoading] = useState(true);

  // Route Planning
  const [fromStationId, setFromStationId] = useState<string>("");
  const [toStationId, setToStationId] = useState<string>("");
  const [isFindingRoute, setIsFindingRoute] = useState(false);
  const [route, setRoute] = useState<Station[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);

  // --- Data Fetching Hooks ---

  // 1. Fetch all stations on component mount (for dropdowns)
  useEffect(() => {
    const fetchStations = async () => {
      try {
        setIsStationsLoading(true);
        const response = await fetch("http://localhost:3001/api/stations");
        if (!response.ok) throw new Error("Failed to fetch stations");
        const data: Station[] = await response.json();
        setStations(data);
      } catch (error) {
        console.error(error);
        // Handle error in UI if needed
      } finally {
        setIsStationsLoading(false);
      }
    };
    fetchStations();
  }, []);

  // --- Event Handlers ---

  /**
   * Tries to get the user's current GPS location.
   */
  const handleFindLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setIsFindingLocation(true);
    setLocationError(null);
    setNearestStationResult(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocation(position.coords);
        // Got location, now find the nearest station
        await fetchNearestStation(position.coords);
        setIsFindingLocation(false);
      },
      (error) => {
        setLocationError(`Error getting location: ${error.message}`);
        setIsFindingLocation(false);
      }
    );
  };

  /**
   * Calls our backend to find the nearest station and gate.
   */
  const fetchNearestStation = async (coords: GeolocationCoordinates) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/nearest-station?lat=${coords.latitude}&long=${coords.longitude}`
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to find nearest station");
      }
      const data: NearestStationResponse = await response.json();
      setNearestStationResult(data);
      // Auto-select the "From" station
      setFromStationId(data.station.station_id);
      // Clear old route
      setRoute([]);
      setRouteError(null);
    } catch (error: any) {
      setLocationError(error.message);
    }
  };

  /**
   * Calls our backend to get the station-to-station route.
   */
  const handleFindRoute = async () => {
    if (!fromStationId || !toStationId) {
      setRouteError("Please select a 'From' and 'To' station.");
      return;
    }
    if (fromStationId === toStationId) {
      setRouteError("'From' and 'To' stations cannot be the same.");
      return;
    }

    setIsFindingRoute(true);
    setRouteError(null);
    setRoute([]);

    try {
      const response = await fetch(
        `http://localhost:3001/api/route?from=${fromStationId}&to=${toStationId}`
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to find route");
      }
      const data: Station[] = await response.json();
      setRoute(data);
    } catch (error: any) {
      setRouteError(error.message);
    } finally {
      setIsFindingRoute(false);
    }
  };

  // --- Helper to get line color ---
  // (In a real app, you'd get this from the data)
  const getLineColor = (lines: string[]) => {
    if (lines.includes("Blue Line 1")) return "bg-blue-500";
    if (lines.includes("Red Line 7")) return "bg-red-500";
    if (lines.includes("Aqua Line 3")) return "bg-cyan-500";
    return "bg-gray-400";
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Plan Your Route</h2>
      </div>

      {/* --- Part 1: Your Location --- */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Footprints className="h-6 w-6 text-secondary" /> {/* <-- This is the fix */}
            Part 1: Your Location
          </CardTitle>
          <CardDescription>
            Find the closest metro station entry gate near you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="hero"
            size="lg"
            className="w-full"
            onClick={handleFindLocation}
            disabled={isFindingLocation}
          >
            {isFindingLocation ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Navigation className="h-5 w-5 mr-2" />
            )}
            {isFindingLocation ? "Finding..." : "Find My Location"}
          </Button>

          {locationError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">{locationError}</span>
            </div>
          )}

          {location && !isFindingLocation && (
            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
              <strong>Your Coords:</strong> {location.latitude.toFixed(4)},{" "}
              {location.longitude.toFixed(4)}
            </div>
          )}

          {nearestStationResult && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 text-green-700">
              <CheckCircle className="h-6 w-6" />
              <div className="flex-1">
                <span className="text-xs font-semibold">NEAREST STATION</span>
                <p className="text-lg font-bold text-foreground">
                  {nearestStationResult.station.name}
                </p>
                {nearestStationResult.gate && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Closest Gate:</strong>{" "}
                    {nearestStationResult.gate.name} (
                    {nearestStationResult.distance_km.toFixed(2)} km away)
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Part 2: Your Metro Route --- */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Train className="h-6 w-6 text-secondary" />
            Part 2: Your Metro Route
          </CardTitle>
          <CardDescription>
            Plan your station-to-station journey.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* --- Station Selectors --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <Select
                value={fromStationId}
                onValueChange={(value) => {
                  setFromStationId(value);
                  setRoute([]);
                  setRouteError(null);
                }}
                disabled={isStationsLoading}
              >
                <SelectTrigger className="w-full h-12 bg-background/50">
                  <SelectValue placeholder="Select starting station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((station) => (
                    <SelectItem
                      key={station.station_id}
                      value={station.station_id}
                    >
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Select
                value={toStationId}
                onValueChange={(value) => {
                  setToStationId(value);
                  setRoute([]);
                  setRouteError(null);
                }}
                disabled={isStationsLoading}
              >
                <SelectTrigger className="w-full h-12 bg-background/50">
                  <SelectValue placeholder="Select destination station" />
                </SelectTrigger> {/* <-- THIS WAS THE ERROR, NOW FIXED */}
                <SelectContent>
                  {stations.map((station) => (
                    <SelectItem
                      key={station.station_id}
                      value={station.station_id}
                    >
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            variant="hero"
            size="lg"
            className="w-full"
            onClick={handleFindRoute}
            disabled={isFindingRoute}
          >
            {isFindingRoute ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-5 w-5 mr-2" />
            )}
            Find Route
          </Button>

          {routeError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">{routeError}</span>
            </div>
          )}

          {/* --- Route Display --- */}
          {route.length > 0 && (
            <div className="space-y-4 pt-4">
              <h4 className="text-lg font-semibold">Your Route:</h4>
              <div className="relative flex flex-col items-start">
                {route.map((station, index) => {
                  const isFirst = index === 0;
                  const isLast = index === route.length - 1;
                  const lineChanged =
                    index > 0 &&
                    station.lines.join() !== route[index - 1].lines.join();

                  return (
                    <div
                      key={station.station_id}
                      className="flex items-center gap-4 w-full"
                    >
                      {/* --- Timeline Bar --- */}
                      <div className="flex flex-col items-center h-full">
                        <div
                          className={`w-0.5 h-6 ${
                            isFirst ? "bg-transparent" : "bg-muted"
                          }`}
                        />
                        <div
                          className={`w-4 h-4 rounded-full z-10 ${getLineColor(
                            station.lines
                          )}`}
                        />
                        <div
                          className={`flex-1 w-0.5 ${
                            isLast ? "bg-transparent" : "bg-muted"
                          }`}
                        />
                      </div>

                      {/* --- Station Info --- */}
                      <div className="flex-1 pb-8">
                        {lineChanged && (
                          <div className="mb-2 p-2 bg-yellow-500/10 text-yellow-700 rounded-lg text-sm font-medium">
                            Interchange: Change to{" "}
                            {station.lines.join(", ")}
                          </div>
                        )}
                        <p className="font-bold text-foreground">
                          {station.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {station.lines.join(", ")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Part 3: Your Destination --- */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-secondary" />
            Part 3: Your Destination
          </CardTitle>
          <CardDescription>
            Find the best exit gate for your final destination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            (Feature in progress: Once your route is planned, this section will
            show you the best exit gate at your destination station.)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapView;

