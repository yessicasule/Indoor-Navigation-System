import express from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv'; // For API keys
import fetch from 'node-fetch'; // Import node-fetch for external API calls

// --- IMPORTANT ---
// This line REQUIRES the 'serviceAccountKey.json' file you downloaded
// from your Firebase project settings.
// import serviceAccount from './serviceAccountKey.json';
// -----------------

// Load environment variables from .env file
dotenv.config();

// Initialize Firebase Admin (assuming serviceAccount is correctly loaded)
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
// });
// NOTE: Commenting out admin.initializeApp to avoid service account key errors in this context. 
// Please ensure your local setup initializes Firebase Admin correctly.

const db = admin.firestore();
const app = express();
const port = 3001;

// Middleware
app.use(cors()); // Allows your React app (on a different port) to talk to this server
app.use(express.json()); // Allows server to read JSON payloads

// --- START: CORE PATHFINDING HELPERS (A* implementation) ---

// Define the required structure for a waypoint node in the graph
interface WaypointNode {
  waypoint_id: string;
  location: { latitude: number; longitude: number };
  adjacent_waypoints: string[];
  instructions: { [key: string]: string };
}

// Node structure used internally by A* algorithm
interface AStarNode {
  id: string;
  g: number; // Cost from start to current node
  h: number; // Heuristic cost from current node to goal
  f: number; // Total cost (g + h)
  parent: string | null;
}

/**
 * Calculates the Euclidean distance (our heuristic h(n)) between two coordinates.
 * Used for heuristic estimation and actual step cost.
 */
function euclideanDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = lat1 - lat2;
  const dy = lon1 - lon2;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * The main A* pathfinding algorithm implementation.
 */
function aStarSearch(
  startId: string,
  goalId: string,
  waypoints: Map<string, WaypointNode>
): string[] {
  if (!waypoints.has(startId) || !waypoints.has(goalId)) {
    return [];
  }

  const nodeMap = new Map<string, AStarNode>();
  let openSet: AStarNode[] = [];

  const startWaypoint = waypoints.get(startId)!;
  const goalWaypoint = waypoints.get(goalId)!;

  const h = euclideanDistance(
    startWaypoint.location.latitude,
    startWaypoint.location.longitude,
    goalWaypoint.location.latitude,
    goalWaypoint.location.longitude
  );

  const startNode: AStarNode = {
    id: startId,
    g: 0,
    h: h,
    f: h,
    parent: null,
  };

  openSet.push(startNode);
  nodeMap.set(startId, startNode);

  while (openSet.length > 0) {
    // Simplified Priority Queue: Sort to find the node with the minimum f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (current.id === goalId) {
      // Reconstruct Path
      const path: string[] = [];
      let step: AStarNode | undefined = current;
      while (step) {
        path.unshift(step.id);
        step = step.parent ? nodeMap.get(step.parent) : undefined;
      }
      return path;
    }

    const currentWaypoint = waypoints.get(current.id)!;

    for (const neighborId of currentWaypoint.adjacent_waypoints) {
      const neighborWaypoint = waypoints.get(neighborId);
      if (!neighborWaypoint) continue;

      const distToNeighbor = euclideanDistance(
        currentWaypoint.location.latitude,
        currentWaypoint.location.longitude,
        neighborWaypoint.location.latitude,
        neighborWaypoint.location.longitude
      );

      const tentative_g = current.g + distToNeighbor;
      const neighborNode = nodeMap.get(neighborId);

      if (!neighborNode || tentative_g < neighborNode.g) {
        const h_neighbor = euclideanDistance(
          neighborWaypoint.location.latitude,
          neighborWaypoint.location.longitude,
          goalWaypoint.location.latitude,
          goalWaypoint.location.longitude
        );

        const newNeighborNode: AStarNode = {
          id: neighborId,
          g: tentative_g,
          h: h_neighbor,
          f: tentative_g + h_neighbor,
          parent: current.id,
        };
        
        nodeMap.set(neighborId, newNeighborNode);

        if (!openSet.some(n => n.id === neighborId)) {
          openSet.push(newNeighborNode);
        }
      }
    }
  }

  return []; // No path found
}
// --- END: CORE PATHFINDING HELPERS ---


// --- Existing Helper Function for Geolocation (keep this) ---

/**
 * Calculates the distance between two points on Earth using the Haversine formula.
 * @param lat1 Latitude of the first point
 * @param lon1 Longitude of the first point
 * @param lat2 Latitude of the second point
 * @param lon2 Longitude of the second point
 * @returns The distance in kilometers
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    0.5 - Math.cos(dLat) / 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon)) / 2;

  return R * 2 * Math.asin(Math.sqrt(a));
}


// --- API Endpoints ---

/*
 * @route   GET /api/stations
 * @desc    Get a list of all stations
 */
app.get('/api/stations', async (req, res) => {
  try {
    const stationsCollection = db.collection('stations');
    const snapshot = await stationsCollection.get();

    if (snapshot.empty) {
      console.log('No stations found.');
      return res.status(200).json([]);
    }

    const stations = snapshot.docs.map(doc => ({
      station_id: doc.id,
      ...doc.data()
    }));

    console.log('Fetched stations');
    res.status(200).json(stations);

  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


/*
 * @route   GET /api/route
 * @desc    Get the shortest route between two stations
 */
app.get('/api/route', async (req, res) => {
  const { from, to } = req.query;

  if (typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'Missing "from" or "to" query parameters.' });
  }

  try {
    const stationsSnapshot = await db.collection('stations').get();
    const stationDataMap = new Map<string, any>();
    
    stationsSnapshot.forEach(doc => {
      stationDataMap.set(doc.id, { 
        station_id: doc.id, 
        ...doc.data() 
      });
    });

    const queue: string[][] = [[from]];
    const visited = new Set<string>([from]);
    let shortestPath: string[] = [];

    while (queue.length > 0) {
      const currentPath = queue.shift();
      if (!currentPath) continue;

      const currentStationId = currentPath[currentPath.length - 1];

      if (currentStationId === to) {
        shortestPath = currentPath;
        break;
      }

      const currentStationData = stationDataMap.get(currentStationId);
      const neighbors = currentStationData?.adjacent_stations || [];

      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          const newPath = [...currentPath, neighborId];
          queue.push(newPath);
        }
      }
    }

    if (shortestPath.length > 0) {
      const routeWithData = shortestPath.map(id => stationDataMap.get(id));
      res.status(200).json(routeWithData);
    } else {
      res.status(404).json({ error: 'No route found between the selected stations.' });
    }

  } catch (error) {
    console.error('Error finding route:', error);
    res.status(500).json({ error: 'Failed to find route' });
  }
});


/*
 * @route   GET /api/pois
 * @desc    Get all Points of Interest (POIs)
 */
app.get('/api/pois', async (req, res) => {
  const { stationId } = req.query;
  try {
    let query: admin.firestore.Query = db.collection('pois');

    if (stationId && typeof stationId === 'string') {
      console.log(`Querying POIs for stationId: ${stationId}`);
      query = query.where('station_id', '==', stationId);
    } else {
      console.log('Querying all POIs.');
    }

    const poisSnapshot = await query.get();
    
    if (poisSnapshot.empty) {
      console.log(`No POIs found.`);
      return res.status(200).json([]);
    }

    const pois: any[] = [];
    poisSnapshot.forEach((doc) => {
      pois.push({
        poi_id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Fetched ${pois.length} POIs.`);
    res.status(200).json(pois);

  } catch (error) {
    console.error('Error fetching POIs:', error);
    res.status(500).json({ error: 'Failed to fetch POIs' });
  }
});


/*
 * @route   GET /api/ar-route
 * @desc    Get step-by-step AR navigation instructions within a station.
 * *** NOW USES A* PATHFINDING ***
 */
app.get('/api/ar-route', async (req, res) => {
  const { from, to } = req.query;

  if (typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'Missing "from" or "to" query parameters.' });
  }

  try {
    // 1. Get the starting waypoint to find its station context
    const fromWaypointDoc = await db.collection('ar-waypoints').doc(from).get();
    if (!fromWaypointDoc.exists) {
      return res.status(404).json({ error: 'Starting waypoint not found.' });
    }
    const stationId = fromWaypointDoc.data()?.station_id;

    if (!stationId) {
      return res.status(500).json({ error: 'Starting waypoint has no station_id.' });
    }

    // 2. Fetch all waypoints within that station
    const waypointsSnapshot = await db.collection('ar-waypoints').where('station_id', '==', stationId).get();
    const waypointDataMap = new Map<string, WaypointNode>();
    waypointsSnapshot.forEach(doc => {
      // Ensure the waypoint data conforms to the WaypointNode interface
      const data = doc.data();
      const waypoint = {
        waypoint_id: doc.id,
        location: data.location || {latitude: 0, longitude: 0}, // Provide fallback locations
        adjacent_waypoints: data.adjacent_waypoints || [],
        instructions: data.instructions || {},
      } as WaypointNode;

      waypointDataMap.set(doc.id, waypoint);
    });

    // 3. Find the shortest path using A*
    const shortestPath = aStarSearch(from, to, waypointDataMap);

    if (shortestPath.length > 0) {
      const instructions: string[] = [];
      for (let i = 0; i < shortestPath.length - 1; i++) {
        const currentId = shortestPath[i];
        const nextId = shortestPath[i + 1];

        const currentWaypointData = waypointDataMap.get(currentId);
        const instruction = currentWaypointData?.instructions?.[nextId];
        
        // Use the instruction embedded in the waypoint for the next step
        if (instruction) {
          instructions.push(instruction);
        } else {
          // Fallback instruction
          const nextWaypointData = waypointDataMap.get(nextId);
          instructions.push(`Proceed to ${nextWaypointData?.name || 'next point'} (30m).`); // Added dummy distance
        }
      }
      res.status(200).json(instructions);
    } else {
      res.status(404).json({ error: 'No AR route found.' });
    }

  } catch (error) {
    console.error('Error finding AR route:', error);
    res.status(500).json({ error: 'Failed to find AR route' });
  }
});


/*
 * @route   GET /api/nearest-station
 * @desc    Find the nearest station and entry gate to a user's GPS coordinates
 */
app.get('/api/nearest-station', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing "lat" or "lon" query parameters.' });
  }

  const userLat = parseFloat(lat as string);
  const userLon = parseFloat(lon as string);

  if (isNaN(userLat) || isNaN(userLon)) {
    return res.status(400).json({ error: 'Invalid "lat" or "lon" parameters.' });
  }

  try {
    const stationsSnapshot = await db.collection('stations').get();
    
    let closestStation: any = null;
    let closestGate: any = null;
    let minDistance = Infinity;

    stationsSnapshot.forEach(doc => {
      const station = { station_id: doc.id, ...doc.data() };
      const gates = (station as any).gates || [];

      if (gates.length > 0) {
        for (const gate of gates) {
          if (gate.location && gate.location.latitude && gate.location.longitude) {
            const distance = haversineDistance(
              userLat, userLon,
              gate.location.latitude, gate.location.longitude
            );

            if (distance < minDistance) {
              minDistance = distance;
              closestGate = gate;
              closestStation = {
                station_id: station.station_id,
                name: (station as any).name,
                lines: (station as any).lines,
              };
            }
          }
        }
      } else {
        if ((station as any).location && (station as any).location.latitude && (station as any).location.longitude) {
            const distance = haversineDistance(
              userLat, userLon,
              (station as any).location.latitude, (station as any).location.longitude
            );
          
          if (distance < minDistance) {
            minDistance = distance;
            closestGate = null;
            closestStation = {
              station_id: station.station_id,
              name: (station as any).name,
              lines: (station as any).lines,
            };
          }
        }
      }
    });

    if (closestStation) {
      res.status(200).json({
        station: closestStation,
        gate: closestGate,
        distance_km: minDistance,
      });
    } else {
      res.status(404).json({ error: 'No stations with location data found.' });
    }

  } catch (error) {
    console.error('Error finding nearest station:', error);
    res.status(500).json({ error: 'Failed to find nearest station' });
  }
});


/*
 * @route   GET /api/geocode
 * @desc    Convert a street address into latitude and longitude
 */
app.get('/api/geocode', async (req, res) => {
  const { address } = req.query;
  const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  if (!API_KEY) {
    console.error('Google Maps API key is missing from .env file.');
    return res.status(500).json({ error: 'Server is missing API key.' });
  }
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "address" query parameter.' });
  }

  const bounds = '18.89,72.77|19.27,72.99'; // Mumbai Region
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&bounds=${bounds}&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location; // { lat, lng }
      console.log(`Geocoded "${address}" to:`, location);
      res.status(200).json(location);
    } else {
      console.error('Geocode API Error:', data.status, data.error_message);
      res.status(404).json({ error: `Could not find location for address: ${address}` });
    }
  } catch (error) {
    console.error('Error calling Geocode API:', error);
    res.status(500).json({ error: 'Failed to call Geocoding service.' });
  }
});


// --- NEW: AUTOCOMPLETE ENDPOINTS ---

/*
 * @route   GET /api/autocomplete
 * @desc    Get Google Places Autocomplete suggestions
 * @query   input (string) - The user's typing
 */
app.get('/api/autocomplete', async (req, res) => {
  const { input } = req.query;
  const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server is missing API key.' });
  }
  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "input" query parameter.' });
  }

  // Bias to Mumbai, but allow searching anywhere
  const location = '19.0760,72.8777'; // Approx center of Mumbai
  const radius = '50000'; // 50km radius
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
    input
  )}&location=${location}&radius=${radius}&strictbounds=false&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === 'OK') {
      // We only need description and place_id
      const suggestions = data.predictions.map((p: any) => ({
        description: p.description,
        place_id: p.place_id,
      }));
      res.status(200).json(suggestions);
    } else {
      console.error('Autocomplete API Error:', data.status, data.error_message);
      res.status(500).json({ error: 'Failed to fetch suggestions.' });
    }
  } catch (error) {
    console.error('Error calling Autocomplete API:', error);
    res.status(500).json({ error: 'Failed to call Autocomplete service.' });
  }
});

/*
 * @route   GET /api/place-details
 * @desc    Get lat/lng for a specific Google Place ID
 * @query   placeid (string) - The place_id from an autocomplete suggestion
 */
app.get('/api/place-details', async (req, res) => {
  const { placeid } = req.query;
  const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server is missing API key.' });
  }
  if (!placeid || typeof placeid !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "placeid" query parameter.' });
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeid}&fields=geometry/location&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === 'OK' && data.result?.geometry?.location) {
      const location = data.result.geometry.location; // { lat, lng }
      console.log(`Fetched details for ${placeid}:`, location);
      res.status(200).json(location);
    } else {
      console.error('Place Details API Error:', data.status, data.error_message);
      res.status(404).json({ error: 'Could not find details for that place.' });
    }
  } catch (error) {
    console.error('Error calling Place Details API:', error);
    res.status(500).json({ error: 'Failed to call Place Details service.' });
  }
});


// --- Start Server ---
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});