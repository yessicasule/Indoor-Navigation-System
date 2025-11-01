import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Clock, Loader2, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Station, POI } from "@/types"; // Import our new types

const Nearby = () => {
  // State for the list of stations (for the dropdown)
  const [stations, setStations] = useState<Station[]>([]);
  // NEW: selectedStation can be a station_id, "all", or "" (nothing selected)
  const [selectedStation, setSelectedStation] = useState<string>("");
  // State for the list of attractions (POIs)
  const [attractions, setAttractions] = useState<POI[]>([]);
  // State for loading indicators
  const [isStationsLoading, setIsStationsLoading] = useState(true);
  const [isPoisLoading, setIsPoisLoading] = useState(false);

  // --- Data Fetching ---

  // 1. Fetch all stations (No change)
  useEffect(() => {
    const fetchStations = async () => {
      try {
        setIsStationsLoading(true);
        const response = await fetch("http://localhost:3001/api/stations");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Station[] = await response.json();
        setStations(data);
      } catch (error) {
        console.error("Failed to fetch stations:", error);
      } finally {
        setIsStationsLoading(false);
      }
    };
    fetchStations();
  }, []);

  // 2. Fetch POIs *whenever* the 'selectedStation' state changes (UPDATED)
  useEffect(() => {
    // Don't fetch if no station is selected ("")
    if (!selectedStation) {
      setAttractions([]); // Clear any existing attractions
      return;
    }

    const fetchPois = async () => {
      try {
        setIsPoisLoading(true);
        // NEW: Check if we are fetching "all" or a specific station
        let apiUrl = "http://localhost:3001/api/pois";
        if (selectedStation !== "all") {
          apiUrl += `?stationId=${selectedStation}`;
        }
        // If selectedStation is "all", it will just call /api/pois

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: POI[] = await response.json();
        setAttractions(data);
      } catch (error) {
        console.error("Failed to fetch POIs:", error);
      } finally {
        setIsPoisLoading(false);
      }
    };
    fetchPois();
  }, [selectedStation]); // This effect re-runs every time selectedStation changes

  // --- NEW: Click Handlers for Buttons ---

  /**
   * Opens Google Maps centered on the attraction's coordinates.
   */
  const handleViewOnMap = (attraction: POI) => {
    if (!attraction.location) {
      console.error("No location data for this attraction");
      return;
    }
    const { latitude, longitude } = attraction.location;
    // This URL opens Google Maps centered on the pin
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(url, "_blank", "rel=noopener noreferrer");
  };

  /**
   * Opens Google Maps with directions from the nearest station to the attraction.
   */
  const handleGetDirections = (attraction: POI) => {
    if (!attraction.location) {
      console.error("No location data for this attraction");
      return;
    }

    // Find the station's location from our stations list
    const station = stations.find((s) => s.station_id === attraction.station_id);
    if (!station || !station.location) {
      console.error("Could not find station location");
      // Fallback: just open the destination
      handleViewOnMap(attraction);
      return;
    }

    const origin = `${station.location.latitude},${station.location.longitude}`;
    const destination = `${attraction.location.latitude},${attraction.location.longitude}`;

    // This URL opens Google Maps with directions
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    window.open(url, "_blank", "rel=noopener noreferrer");
  };

  /**
   * Sets the state to fetch all attractions.
   */
  const handleBrowseAll = () => {
    // This will trigger the useEffect hook to re-fetch POIs
    setSelectedStation("all");
  };

  // --- Helper Functions to render content ---

  const renderPoiContent = () => {
    // Case 1: Loading POIs
    if (isPoisLoading) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-muted/50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
          <p className="mt-2 text-muted-foreground">
            Loading attractions...
          </p>
        </div>
      );
    }

    // Case 2: No station selected (state is "")
    if (selectedStation === "") {
      return (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-muted/50 rounded-lg">
          <Info className="h-8 w-8 text-secondary" />
          <p className="mt-2 text-muted-foreground">
            Please select a station or browse all attractions.
          </p>
        </div>
      );
    }

    // Case 3: Station selected (or "all"), but no POIs found
    if (attractions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-muted/50 rounded-lg">
          <Info className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">
            No attractions found.
          </p>
        </div>
      );
    }

    // Case 4: We have attractions! Render the list.
    return attractions.map((attraction, index) => (
      <Card
        key={attraction.poi_id} // Use the unique poi_id as the key
        className="overflow-hidden hover:shadow-[var(--shadow-glow)] transition-all duration-300 hover:-translate-y-1 animate-scale-in"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div className="relative h-48 overflow-hidden">
          <img
            src={attraction.image_url} // Use image_url from our data
            alt={attraction.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
            // Simple placeholder on error
            onError={(e) => {
              e.currentTarget.src = `https://placehold.co/600x400/333/FFF?text=${attraction.name.replace(
                /\s/g,
                "+"
              )}`;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <Badge className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm">
            {attraction.category}
          </Badge>
        </div>

        <CardHeader>
          <CardTitle className="text-xl">{attraction.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {attraction.description}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{attraction.distance} away</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{attraction.duration}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Navigation className="h-4 w-4 text-secondary" />
            <div className="flex-1">
              <span className="text-xs text-muted-foreground">
                Nearest Station
              </span>
              <p className="text-sm font-medium">
                {/* Find the station name from our stations list */}
                {stations.find((s) => s.station_id === attraction.station_id)
                  ?.name || "Unknown"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* --- NEW: Added onClick Handlers --- */}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => handleViewOnMap(attraction)}
            >
              View on Map
            </Button>
            <Button
              variant="hero"
              className="w-full"
              onClick={() => handleGetDirections(attraction)}
            >
              Get Directions
            </Button>
          </div>
        </CardContent>
      </Card>
    ));
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Nearby Attractions</h2>
        {/* --- FIXED TYPO HERE --- */}
        <p className="text-muted-foreground">
          Discover popular spots near metro stations
        </p>
      </div>

      {/* --- Station Selector Dropdown --- */}
      <Card>
        <CardContent className="p-4">
          <Select
            // NEW: If state is "all", show placeholder. Otherwise, show selected value.
            value={selectedStation === "all" ? "" : selectedStation}
            // --- FIXED TYPO HERE ---
            onValueChange={(value) => setSelectedStation(value)}
            disabled={isStationsLoading}
          >
            {/* --- FIXED TYPO HERE --- */}
            <SelectTrigger className="w-full h-12 bg-background/50">
              <SelectValue
                placeholder={
                  isStationsLoading
                    ? "Loading stations..."
                    : "Select a station"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {stations.map((station) => (
                <SelectItem key={station.station_id} value={station.station_id}>
                  {station.name} ({station.lines.join(", ")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* --- Dynamic Content Area --- */}
      <div className="space-y-4">{renderPoiContent()}</div>

      {/* This "Browse All" card is now functional */}
      <Card className="glass">
        <CardContent className="p-6 text-center space-y-3">
          <h3 className="font-semibold">Discover More</h3>
          <p className="text-sm text-muted-foreground">
            Explore 100+ attractions across Mumbai Metro network
          </p>
          {/* --- NEW: Added onClick Handler --- */}
          <Button
            variant="hero"
            size="lg"
            className="w-full"
            onClick={handleBrowseAll}
          >
            Browse All Attractions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Nearby;

