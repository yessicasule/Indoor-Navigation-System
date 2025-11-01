// Defines the structure for a single Metro station
export interface Station {
  station_id: string;
  name: string;
  lines: string[];
  image_url: string;
  location: {
    latitude: number;
    longitude: number;
  };
  adjacent_stations: string[];
  // NEW: Add the gates array
  gates?: Gate[];
}

// Defines the structure for a Point of Interest (POI)
export interface POI {
  poi_id: string;
  name: string;
  description: string;
  image_url: string;
  station_id: string; // The station this POI is near
  location: {
    latitude: number;
    longitude: number;
  };
  // Added fields to match your UI
  distance: string;
  duration: string;
  category: string;
}

// NEW: Defines the structure for a station gate
export interface Gate {
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

// NEW: Defines the expected response from our /api/nearest-station endpoint
export interface NearestStationResponse {
  station: {
    station_id: string;
    name: string;
    lines: string[];
  };
  gate: Gate | null; // The closest gate, or null if none are defined
  distance_km: number;
}

