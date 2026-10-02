import express from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv'; // For API keys
// fetch is global in Node 18+ — no node-fetch needed
import { initFirebase } from './firebase';
import { aStarSearch, GraphNode } from './astar';

// Load environment variables from .env file
dotenv.config();

// If Firebase can't be initialised, fall back to a harmless stub `db` so the server
// still starts for development (reads return empty, telemetry writes return 503).
const firestore = initFirebase();
const adminInitialized = firestore !== null;
const db: any = firestore ?? {
  collection: () => ({
    get: async () => ({ empty: true, docs: [], forEach: (_cb: any) => {} }),
    doc: (_id: any) => ({ get: async () => ({ exists: false }) }),
    where: () => ({ get: async () => ({ empty: true, forEach: (_cb: any) => {} }) }),
  }),
};
if (!adminInitialized) console.warn('Running with an empty stub database.');

const app = express();
const port = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors()); // Allows your React app (on a different port) to talk to this server
app.use(express.json({ limit: '1mb' })); // Allows server to read JSON payloads



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

    const stations = snapshot.docs.map((doc: any) => ({
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
    
    stationsSnapshot.forEach((doc: any) => {
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

    stationsSnapshot.forEach((doc: any) => {
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


// --- Indoor (AR) navigation ---
// All waypoints live in one collection, `ar_waypoints`. Each doc's `station_id` is the
// site/building it belongs to; x/y/z are metres from that site's origin.
// Site-level settings (e.g. map rotation from true north) live in `sites/{siteId}`.

interface Waypoint extends GraphNode {
  doc_id: string;
  name: string | null;
  station_id: string;
  type: string;
  floor: number | null;
  /** For QR anchors: map bearing (clockwise from map +y) a person faces while scanning the code. */
  anchor_map_bearing_deg: number | null;
}

const numberOrNull = (v: unknown) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

const toWaypoint = (doc: any): Waypoint => {
  const data = doc.data();
  return {
    doc_id: doc.id,
    node_id: data.node_id,
    name: data.name ?? null,
    station_id: data.station_id,
    x: Number(data.x),
    y: Number(data.y),
    z: numberOrNull(data.z) ?? 0,
    floor: numberOrNull(data.floor),
    neighbors: data.neighbors || [],
    type: data.type || 'path',
    anchor_map_bearing_deg: numberOrNull(data.anchor_map_bearing_deg),
  };
};

// Named nodes are destinations; purely structural nodes are named "... Node" or unnamed.
const isDestination = (w: Waypoint) => !!w.name && !w.name.includes('Node');

async function getSiteWaypoints(siteId: string): Promise<Waypoint[]> {
  const snapshot = await db.collection('ar_waypoints').where('station_id', '==', siteId).get();
  const waypoints: Waypoint[] = [];
  snapshot.forEach((doc: any) => waypoints.push(toWaypoint(doc)));
  return waypoints;
}

/*
 * @route   GET /api/waypoints/:docId
 * @desc    Look up a single waypoint (e.g. the QR anchor that was just scanned)
 */
app.get('/api/waypoints/:docId', async (req, res) => {
  try {
    const doc = await db.collection('ar_waypoints').doc(req.params.docId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Waypoint not found.' });
    }
    res.status(200).json(toWaypoint(doc));
  } catch (error) {
    console.error('Error fetching waypoint:', error);
    res.status(500).json({ error: 'Failed to fetch waypoint' });
  }
});

/*
 * @route   GET /api/destinations
 * @desc    Selectable destinations within one site
 * @query   stationId (string) - the site/building ID from the QR payload
 */
app.get('/api/destinations', async (req, res) => {
  const { stationId } = req.query;
  if (typeof stationId !== 'string' || !stationId) {
    return res.status(400).json({ error: 'Missing "stationId" query parameter.' });
  }

  try {
    const destinations = (await getSiteWaypoints(stationId))
      .filter(isDestination)
      .map(w => ({ doc_id: w.doc_id, name: w.name, type: w.type }));
    console.log(`Found ${destinations.length} destinations for ${stationId}`);
    res.status(200).json(destinations);
  } catch (error) {
    console.error('Error fetching destinations:', error);
    res.status(500).json({ error: 'Failed to fetch destinations' });
  }
});

/*
 * @route   GET /api/ar-path
 * @desc    Shortest path between two waypoints (by doc ID) in the same site, via A*
 */
app.get('/api/ar-path', async (req, res) => {
  const { from, to } = req.query;
  if (typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'Missing "from" or "to" query parameters.' });
  }

  try {
    const fromDoc = await db.collection('ar_waypoints').doc(from).get();
    if (!fromDoc.exists) {
      return res.status(404).json({ error: 'Starting waypoint not found.' });
    }
    const siteId = toWaypoint(fromDoc).station_id;

    const nodeMap = new Map<string, Waypoint>();
    const docIdToNodeId = new Map<string, string>();
    for (const w of await getSiteWaypoints(siteId)) {
      if (!w.node_id || !Number.isFinite(w.x) || !Number.isFinite(w.y)) {
        console.warn(`Skipping waypoint ${w.doc_id}: missing node_id or x/y`);
        continue;
      }
      nodeMap.set(w.node_id, w);
      docIdToNodeId.set(w.doc_id, w.node_id);
    }

    const startNodeId = docIdToNodeId.get(from);
    const goalNodeId = docIdToNodeId.get(to);
    if (!startNodeId || !goalNodeId) {
      return res.status(404).json({ error: `Start or destination is not a valid waypoint in site ${siteId}.` });
    }

    const pathIds = aStarSearch(startNodeId, goalNodeId, nodeMap);
    console.log(`Path ${from} -> ${to}: ${pathIds.length} nodes`);
    res.status(200).json({
      found: pathIds.length > 0,
      path: pathIds.map(id => nodeMap.get(id)),
    });
  } catch (error) {
    console.error('Error finding AR path:', error);
    res.status(500).json({ error: 'Pathfinding error' });
  }
});


/*
 * @route   GET /api/sites/:siteId
 * @desc    Site settings: display name and map rotation from true north
 */
app.get('/api/sites/:siteId', async (req, res) => {
  try {
    const doc = await db.collection('sites').doc(req.params.siteId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Site not found.' });
    }
    const data = doc.data();
    res.status(200).json({
      site_id: doc.id,
      name: data.name ?? doc.id,
      north_offset_deg: numberOrNull(data.north_offset_deg),
    });
  } catch (error) {
    console.error('Error fetching site:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});


// --- Study telemetry ---
// Clients post batches of ~5 Hz samples. One Firestore doc per batch (not per sample)
// keeps writes ~10x below the per-sample count; `npm run export` flattens to one row per sample.

const SESSION_FIELDS = ['session_id', 'participant_id', 'condition', 'site_id', 'device_model', 'os_version', 'user_agent'] as const;
const SAMPLE_FIELDS = [
  'timestamp_ms', 'event_type', 'absolute_flag', 'sample_age_ms',
  'raw_alpha', 'raw_beta', 'raw_gamma', 'webkit_compass_heading', 'heading_source', 'raw_heading', 'smoothed_heading',
  'heading_correction', 'corrected_heading', 'frame_offset_deg', 'calibration_source',
  'last_anchor_id', 'ms_since_anchor', 'metres_since_anchor',
  'nodes_traversed', 'current_node', 'current_target_node', 'survey_point_id',
] as const;

const pick = (obj: any, keys: readonly string[]) => {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj?.[k] ?? null;
  return out;
};

/*
 * @route   POST /api/telemetry
 * @desc    Store one batch of study telemetry samples
 * @body    { batch_id, session: {session_id, ...}, samples: [...] } — JSON, or text/plain JSON from sendBeacon
 *          batch_id is the doc ID, so a retried or beaconed duplicate overwrites instead of double-counting.
 */
app.post('/api/telemetry', express.text({ type: 'text/plain', limit: '1mb' }), async (req, res) => {
  let body: any = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON.' }); }
  }
  const { batch_id, session, samples } = body ?? {};
  if (
    typeof batch_id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(batch_id) ||
    typeof session?.session_id !== 'string' ||
    !Array.isArray(samples) || samples.length === 0 || samples.length > 500
  ) {
    return res.status(400).json({ error: 'Expected { batch_id, session: { session_id }, samples: [1..500] }.' });
  }
  if (!adminInitialized) {
    // 503 tells the client to keep the batch queued and retry.
    return res.status(503).json({ error: 'Telemetry storage unavailable (Firebase not initialized).' });
  }

  try {
    await db.collection('telemetry_batches').doc(batch_id).set({
      ...pick(session, SESSION_FIELDS),
      received_at: admin.firestore.FieldValue.serverTimestamp(),
      first_timestamp_ms: Number(samples[0]?.timestamp_ms) || null,
      samples: samples.map((s: any) => pick(s, SAMPLE_FIELDS)),
    });
    res.status(201).json({ stored: samples.length });
  } catch (error) {
    console.error('Error storing telemetry:', error);
    res.status(500).json({ error: 'Failed to store telemetry' });
  }
});


// --- Start Server ---
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});