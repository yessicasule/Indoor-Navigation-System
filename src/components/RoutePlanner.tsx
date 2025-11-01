import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Navigation,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  Train,
  Footprints,
  ArrowRight,
  Building,
} from "lucide-react";
import { Input } from "@/components/ui/input";
// NEW: Import Tabs components
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Station, NearestStationResponse } from "../types";
import { useDebounce } from "use-debounce";

// --- Types ---
interface GeocodeResponse {
  lat: number;
  lng: number;
}
interface AutocompleteSuggestion {
  description: string;
  place_id: string;
}

const RoutePlanner = () => {
  // --- State Management ---
  const [stations, setStations] = useState<Station[]>([]);
  const [isStationsLoading, setIsStationsLoading] = useState(true);

  // NEW: State to track which "From" source is active
  const [sourceMode, setSourceMode] = useState<"gps" | "address">("gps");

  // "From" (GPS)
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isFindingLocation, setIsFindingLocation] = useState(false);

  // "From" (Address)
  const [fromAddress, setFromAddress] = useState<string>("");
  const [debouncedFromAddress] = useDebounce(fromAddress, 500);
  const [fromSuggestions, setFromSuggestions] = useState<
    AutocompleteSuggestion[]
  >([]);
  const [isFetchingFromSuggestions, setIsFetchingFromSuggestions] =
    useState(false);
  const [fromCoords, setFromCoords] = useState<GeocodeResponse | null>(null);

  // "To" (Address)
  const [toAddress, setToAddress] = useState<string>("");
  const [debouncedToAddress] = useDebounce(toAddress, 500);
  const [toSuggestions, setToSuggestions] = useState<AutocompleteSuggestion[]>(
    []
  );
  const [isFetchingToSuggestions, setIsFetchingToSuggestions] = useState(false);
  const [toCoords, setToCoords] = useState<GeocodeResponse | null>(null);

  // Journey
  const [isFindingJourney, setIsFindingJourney] = useState(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [startPoint, setStartPoint] = useState<NearestStationResponse | null>(
    null
  );
  const [metroRoute, setMetroRoute] = useState<Station[]>([]);
  const [endPoint, setEndPoint] = useState<NearestStationResponse | null>(null);

  // --- Data Fetching Hooks ---

  // 1. Fetch all stations on component mount
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
      } finally {
        setIsStationsLoading(false);
      }
    };
    fetchStations();
  }, []);

  // 2. Fetch Autocomplete for "From" address
  useEffect(() => {
    if (debouncedFromAddress.length < 3 || fromCoords) {
      setFromSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      setIsFetchingFromSuggestions(true);
      try {
        const response = await fetch(
          `http://localhost:3001/api/autocomplete?input=${encodeURIComponent(
            debouncedFromAddress
          )}`
        );
        if (!response.ok) throw new Error("Failed to fetch suggestions");
        const data: AutocompleteSuggestion[] = await response.json();
        setFromSuggestions(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetchingFromSuggestions(false);
      }
    };
    fetchSuggestions();
  }, [debouncedFromAddress, fromCoords]);

  // 3. Fetch Autocomplete for "To" address
  useEffect(() => {
    if (debouncedToAddress.length < 3 || toCoords) {
      setToSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      setIsFetchingToSuggestions(true);
      try {
        const response = await fetch(
          `http://localhost:3001/api/autocomplete?input=${encodeURIComponent(
            debouncedToAddress
          )}`
        );
        if (!response.ok) throw new Error("Failed to fetch suggestions");
        const data: AutocompleteSuggestion[] = await response.json();
        setToSuggestions(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetchingToSuggestions(false);
      }
    };
    fetchSuggestions();
  }, [debouncedToAddress, toCoords]);

  // --- Event Handlers ---

  const handleFindLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    setIsFindingLocation(true);
    setLocationError(null);
    setStartPoint(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords);
        setIsFindingLocation(false);
        setFromCoords(null); // Clear manual address
        setFromAddress(""); // Clear manual address
      },
      (error) => {
        setLocationError(`Error getting location: ${error.message}`);
        setIsFindingLocation(false);
      }
    );
  };

  const handleFindJourney = async () => {
    let startCoords: { lat: number; lng: number } | null = null;

    // 1. Determine Start Coords
    if (sourceMode === "gps") {
      if (!location) {
        setJourneyError("Please find your location first.");
        return;
      }
      startCoords = { lat: location.latitude, lng: location.longitude };
    } else {
      // sourceMode === 'address'
      if (!fromCoords) {
        setJourneyError(
          "Please select a valid 'From' address from the suggestions."
        );
        return;
      }
      startCoords = fromCoords;
    }

    // 2. Validate "To" Coords
    if (!toCoords) {
      setJourneyError(
        "Please select a valid 'To' address from the suggestions."
      );
      return;
    }

    setIsFindingJourney(true);
    setJourneyError(null);
    setStartPoint(null);
    setMetroRoute([]);
    setEndPoint(null);
    setFromSuggestions([]); // Hide suggestions
    setToSuggestions([]); // Hide suggestions

    try {
      // --- PART 1: Find Nearest "From" Station ---
      const startResponse = await fetch(
        `http://localhost:3001/api/nearest-station?lat=${startCoords.lat}&lon=${startCoords.lng}`
      );
      if (!startResponse.ok) {
        const err = await startResponse.json();
        throw new Error(err.error || "Could not find starting station.");
      }
      const startData: NearestStationResponse = await startResponse.json();
      setStartPoint(startData);

      // --- PART 2: Find Nearest "To" Station ---
      const endResponse = await fetch(
        `http://localhost:3001/api/nearest-station?lat=${toCoords.lat}&lon=${toCoords.lng}`
      );
      if (!endResponse.ok) {
        const err = await endResponse.json();
        throw new Error(err.error || "Could not find destination station.");
      }
      const endData: NearestStationResponse = await endResponse.json();
      setEndPoint(endData);

      // --- PART 3: Find Metro Route Between Stations ---
      if (startData.station.station_id === endData.station.station_id) {
        setMetroRoute([]); // No metro route needed
      } else {
        const routeResponse = await fetch(
          `http://localhost:3001/api/route?from=${startData.station.station_id}&to=${endData.station.station_id}`
        );
        if (!routeResponse.ok) {
          const err = await routeResponse.json();
          throw new Error(err.error || "Could not find a metro route.");
        }
        const routeData: Station[] = await routeResponse.json();
        setMetroRoute(routeData);
      }
    } catch (error: any) {
      setJourneyError(error.message);
    } finally {
      setIsFindingJourney(false);
    }
  };

  // --- Autocomplete Handlers ---

  const handleFromAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromAddress(e.target.value);
    setFromCoords(null);
    setLocation(null); // Clear GPS location
    setJourneyError(null);
  };

  const handleFromSuggestionClick = async (
    suggestion: AutocompleteSuggestion
  ) => {
    setFromAddress(suggestion.description);
    setFromSuggestions([]);
    setIsFetchingFromSuggestions(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/place-details?placeid=${suggestion.place_id}`
      );
      if (!response.ok) throw new Error("Failed to get place details");
      const coords: GeocodeResponse = await response.json();
      setFromCoords(coords);
    } catch (error) {
      console.error(error);
      setJourneyError("Could not get location for 'From' address.");
    } finally {
      setIsFetchingFromSuggestions(false);
    }
  };

  const handleToAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToAddress(e.target.value);
    setToCoords(null);
    setJourneyError(null);
  };

  const handleToSuggestionClick = async (
    suggestion: AutocompleteSuggestion
  ) => {
    setToAddress(suggestion.description);
    setToSuggestions([]);
    setIsFetchingToSuggestions(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/place-details?placeid=${suggestion.place_id}`
      );
      if (!response.ok) throw new Error("Failed to get place details");
      const coords: GeocodeResponse = await response.json();
      setToCoords(coords);
    } catch (error) {
      console.error(error);
      setJourneyError("Could not get location for 'To' address.");
    } finally {
      setIsFetchingToSuggestions(false);
    }
  };

  // --- Helper to get line color ---
  const getLineColor = (lines: string[] | undefined) => {
    if (Array.isArray(lines)) {
      if (lines.includes("Blue Line 1")) return "bg-blue-500";
      if (lines.includes("Red Line 7")) return "bg-red-500";
      if (lines.includes("Aqua Line 3")) return "bg-cyan-500";
    }
    return "bg-gray-400"; // Default color
  };

  // --- Render Function ---

  return (
    <div className="space-y-4">
      {/* --- Main Input Card --- */}
      <Card className="glass">
        <CardContent className="p-6 space-y-4">
          {/* --- "From" Section with Tabs --- */}
          <div className="space-y-2">
            <Label>From</Label>
            <Tabs
              defaultValue="gps"
              className="w-full"
              onValueChange={(value) =>
                setSourceMode(value as "gps" | "address")
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="gps">Current Location</TabsTrigger>
                <TabsTrigger value="address">Enter Address</TabsTrigger>
              </TabsList>
              {/* GPS Tab */}
              <TabsContent value="gps" className="space-y-2 pt-2">
                <Button
                  variant="hero"
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
                  <p className="text-sm text-destructive">{locationError}</p>
                )}
                {location && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Location Found: {location.latitude.toFixed(2)},{" "}
                      {location.longitude.toFixed(2)}
                    </span>
                  </div>
                )}
              </TabsContent>
              {/* Manual Address Tab */}
              <TabsContent value="address" className="space-y-2 pt-2">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="from-address"
                    placeholder="Enter starting address"
                    value={fromAddress}
                    onChange={handleFromAddressChange}
                    className="pl-10 h-12 bg-background/50"
                    autoComplete="off"
                  />
                  {(isFetchingFromSuggestions ||
                    fromSuggestions.length > 0) && (
                    <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {isFetchingFromSuggestions && (
                        <div className="p-3 text-sm text-muted-foreground flex items-center">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </div>
                      )}
                      {!isFetchingFromSuggestions &&
                        fromSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.place_id}
                            className="p-3 text-sm hover:bg-muted cursor-pointer"
                            onClick={() => handleFromSuggestionClick(suggestion)}
                          >
                            {suggestion.description}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                {fromCoords && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      'From' location set!
                    </span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* --- "To" Section with Autocomplete --- */}
          <div className="space-y-2 relative">
            <Label htmlFor="to-address">To</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="to-address"
                placeholder="Enter destination (e.g., Infinity Mall)"
                value={toAddress}
                onChange={handleToAddressChange}
                className="pl-10 h-12 bg-background/50"
                autoComplete="off"
              />
              {(isFetchingToSuggestions || toSuggestions.length > 0) && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {isFetchingToSuggestions && (
                    <div className="p-3 text-sm text-muted-foreground flex items-center">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </div>
                  )}
                  {!isFetchingToSuggestions &&
                    toSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.place_id}
                        className="p-3 text-sm hover:bg-muted cursor-pointer"
                        onClick={() => handleToSuggestionClick(suggestion)}
                      >
                        {suggestion.description}
                      </div>
                    ))}
                </div>
              )}
            </div>
            {toCoords && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-300">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Destination set!</span>
              </div>
            )}
          </div>

          {/* --- Find Journey Button --- */}
          <Button
            variant="hero"
            size="lg"
            className="w-full"
            onClick={handleFindJourney}
            disabled={isFindingJourney}
          >
            {isFindingJourney ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-5 w-5 mr-2" />
            )}
            Find Full Route
          </Button>

          {journeyError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">{journeyError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Combined Journey Results --- */}
      {(startPoint || metroRoute.length > 0 || endPoint) &&
        !isFindingJourney && (
          <Card className="glass animate-slide-up">
            <CardHeader>
              <CardTitle>Your Full Journey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative flex flex-col items-start">
                {/* --- 1. Walk to Station --- */}
                {startPoint && (
                  <div className="flex items-center gap-4 w-full">
                    {/* Timeline Bar */}
                    <div className="flex flex-col items-center self-stretch">
                      <div className="w-4 h-4 rounded-full z-10 bg-secondary border-4 border-background" />
                      <div className="flex-1 w-0.5 bg-muted" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 pb-8">
                      <p className="font-bold text-foreground">
                        Walk to {startPoint.station.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Enter via{" "}
                        <strong>
                          {startPoint.gate?.name || "main entrance"}
                        </strong>{" "}
                        ({startPoint.distance_km.toFixed(2)} km away)
                      </p>
                    </div>
                  </div>
                )}

                {/* --- 2. Metro Route --- */}
                {metroRoute.map((station, index) => {
                  const currentLines = Array.isArray(station.lines)
                    ? station.lines
                    : ["Unknown Line"];
                  const prevLines =
                    index > 0 && Array.isArray(metroRoute[index - 1].lines)
                      ? metroRoute[index - 1].lines
                      : [];

                  const isLast = index === metroRoute.length - 1;
                  const lineChanged =
                    index > 0 && currentLines.join() !== prevLines.join();

                  return (
                    <div
                      key={station.station_id}
                      className="flex items-center gap-4 w-full"
                    >
                      {/* Timeline Bar */}
                      <div className="flex flex-col items-center self-stretch">
                        <div className="w-0.5 h-6 bg-muted" />
                        <div
                          className={`w-4 h-4 rounded-full z-10 ${getLineColor(
                            currentLines
                          )} border-4 border-background`}
                        />
                        <div
                          className={`flex-1 w-0.5 ${
                            isLast ? "bg-transparent" : "bg-muted"
                          }`}
                        />
                      </div>
                      {/* Info */}
                      <div className="flex-1 pb-8">
                        {lineChanged && (
                          <div className="mb-2 p-2 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 rounded-lg text-sm font-medium">
                            Interchange: Change to {currentLines.join(", ")}
                          </div>
                        )}
                        <p className="font-bold text-foreground">
                          {station.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {currentLines.join(", ")}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* --- 3. Walk to Destination --- */}
                {endPoint && (
                  <div className="flex items-center gap-4 w-full">
                    {/* Timeline Bar */}
                    <div className="flex flex-col items-center self-stretch">
                      <div className="w-0.5 h-6 bg-muted" />
                      <div className="w-4 h-4 rounded-full z-10 bg-secondary border-4 border-background" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 pb-8">
                      <p className="font-bold text-foreground">
                        Walk to {toAddress}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Exit {endPoint.station.name} via{" "}
                        <strong>{endPoint.gate?.name || "main exit"}</strong> (
                        {endPoint.distance_km.toFixed(2)} km)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
};

export default RoutePlanner;

