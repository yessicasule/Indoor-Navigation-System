const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

// --- CONFIGURATION ---
const PORT = 3001;
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json'; // Ensure this file exists!

// --- INITIALIZE APP ---
const app = express();
app.use(cors());
app.use(express.json());

// --- FIREBASE SETUP ---
try {
  const serviceAccount = require(path.resolve(__dirname, SERVICE_ACCOUNT_PATH));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  console.log("✅ Firebase Initialized Successfully");
} catch (error) {
  console.error("❌ Firebase Init Error: ensure 'serviceAccountKey.json' is in backend folder.");
  console.error(error.message);
  process.exit(1);
}

const db = admin.firestore();

// --- HELPER FUNCTIONS (A* Logic) ---

// Euclidean Distance for X/Y coordinates
function calculateEuclidean(nodeA, nodeB) {
  return Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2));
}

// A* Search Algorithm
function aStarSearch(startNodeId, goalNodeId, nodeMap) {
  const openSet = [];
  const closedSet = new Set();
  const meta = new Map();

  if (!nodeMap.has(startNodeId) || !nodeMap.has(goalNodeId)) return [];

  const startData = nodeMap.get(startNodeId);
  const goalData = nodeMap.get(goalNodeId);

  const startNode = { 
    id: startNodeId, 
    g: 0, 
    h: calculateEuclidean(startData, goalData), 
    f: 0, 
    parent: null 
  };
  startNode.f = startNode.h;
  
  openSet.push(startNode);
  meta.set(startNodeId, startNode);

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();

    if (current.id === goalNodeId) {
      const path = [];
      let curr = current.id;
      while (curr) { 
        path.unshift(curr); 
        curr = meta.get(curr)?.parent || null; 
      }
      return path;
    }

    closedSet.add(current.id);
    const currentWaypoint = nodeMap.get(current.id);
    
    for (const neighborId of currentWaypoint.neighbors) {
      if (closedSet.has(neighborId)) continue;

      const neighborWaypoint = nodeMap.get(neighborId);
      if (!neighborWaypoint) continue;

      const gScore = current.g + calculateEuclidean(currentWaypoint, neighborWaypoint);
      let neighborNode = meta.get(neighborId);

      if (!neighborNode) {
        neighborNode = { 
          id: neighborId, 
          g: Infinity, 
          h: calculateEuclidean(neighborWaypoint, goalData), 
          f: Infinity, 
          parent: null 
        };
        meta.set(neighborId, neighborNode);
        openSet.push(neighborNode);
      }

      if (gScore < neighborNode.g) {
        neighborNode.parent = current.id;
        neighborNode.g = gScore;
        neighborNode.f = gScore + neighborNode.h;
      }
    }
  }
  return [];
}

// --- API ENDPOINTS ---

/* GET /api/destinations - Dropdown List */
app.get('/api/destinations', async (req, res) => {
  const { stationId } = req.query;
  console.log(`[API] Fetching destinations for station: ${stationId}`);
  
  try {
    // Make sure collection name matches your DB exactly!
    const snapshot = await db.collection('ar_waypoints').get(); 
    const destinations = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Filter logic: Match station ID and ensure it has a name (skip purely structural nodes)
      // Adjust logic if your station_id in DB is different (e.g. 'AZAD_NAGAR' vs 'azad_nagar')
      if (data.name && !data.name.includes("Node") && data.station_id === stationId) {
        destinations.push({ 
          doc_id: doc.id, 
          name: data.name, 
          type: data.type 
        });
      }
    });
    
    console.log(`[API] Found ${destinations.length} destinations`);
    res.json(destinations);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error fetching destinations" });
  }
});

/* GET /api/ar-path - Calculate Route */
app.get('/api/ar-path', async (req, res) => {
  const { from, to } = req.query; 
  console.log(`[API] Calculating path from ${from} to ${to}`);

  try {
    const snapshot = await db.collection('ar_waypoints').get();
    const nodeMap = new Map();
    const docIdToNodeId = new Map();

    snapshot.forEach(doc => {
      const data = doc.data();
      const node = {
        doc_id: doc.id, 
        node_id: data.node_id, 
        name: data.name,
        station_id: data.station_id, 
        x: Number(data.x), 
        y: Number(data.y),
        neighbors: data.neighbors || [], 
        type: data.type || 'path'
      };
      
      if (node.node_id) {
        nodeMap.set(node.node_id, node);
        docIdToNodeId.set(doc.id, node.node_id);
      }
    });

    const startNodeId = docIdToNodeId.get(from);
    const goalNodeId = docIdToNodeId.get(to);

    if (!startNodeId || !goalNodeId) {
      return res.status(404).json({ error: "Invalid Start or End Node ID" });
    }

    const pathIds = aStarSearch(startNodeId, goalNodeId, nodeMap);
    const fullPath = pathIds.map(id => nodeMap.get(id));
    
    console.log(`[API] Path found with ${fullPath.length} steps`);
    
    res.json({
      found: pathIds.length > 0,
      path: fullPath
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Pathfinding Error" });
  }
});

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n>>> REAL AR BACKEND RUNNING ON PORT ${PORT}`);
  console.log(`>>> Local:   http://localhost:${PORT}`);
  console.log(`>>> Network: http://<YOUR_LAPTOP_IP>:${PORT}`);
  console.log(`>>> Ctrl+C to stop\n`);
});