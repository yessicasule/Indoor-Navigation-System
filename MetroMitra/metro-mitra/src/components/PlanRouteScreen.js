import React, { useState, useEffect, useCallback } from 'react';

// --- DATA: Metro Stations (remains the same) ---
const stationData = [
    // --- Blue Line (Line 1) ---
    { name: "Versova", line: "Blue", lat: 19.1344, lon: 72.8143, exits: { "Gate 1": { desc: "JP Road", lat: 19.1346, lon: 72.8141 }}},
    { name: "D.N. Nagar", line: "Blue", interchangeWith: "Yellow", lat: 19.1245, lon: 72.8318, exits: { "Gate 1": { desc: "Link Road, towards Infinity Mall", lat: 19.1247, lon: 72.8316 }}},
    { name: "Azad Nagar", line: "Blue", lat: 19.1235, lon: 72.8384, exits: { "Gate 1": { desc: "Andheri Sports Complex", lat: 19.1233, lon: 72.8386 }}},
    { name: "Andheri", line: "Blue", lat: 19.1196, lon: 72.8464, exits: { "Gate 1": { desc: "Connects to Andheri Railway Station", lat: 19.1198, lon: 72.8462 }}},
    { name: "Western Express Highway", line: "Blue", interchangeWith: "Red", lat: 19.1165, lon: 72.8565, exits: { "Gate 1": { desc: "WEH Southbound", lat: 19.1167, lon: 72.8563 }}},
    { name: "Chakala (J.B. Nagar)", line: "Blue", lat: 19.1129, lon: 72.8643, exits: { "Gate 1": { desc: "Andheri-Kurla Road", lat: 19.1131, lon: 72.8641 }}},
    { name: "Airport Road", line: "Blue", lat: 19.1084, lon: 72.8728, exits: { "Gate 1": { desc: "Near International Airport", lat: 19.1086, lon: 72.8726 }}},
    { name: "Marol Naka", line: "Blue", lat: 19.1118, lon: 72.8839, exits: { "Gate 1": { desc: "Marol Maroshi Road", lat: 19.1120, lon: 72.8837 }}},
    { name: "Saki Naka", line: "Blue", lat: 19.0968, lon: 72.8925, exits: { "Gate 1": { desc: "Towards Powai", lat: 19.0970, lon: 72.8923 }}},
    { name: "Asalpha", line: "Blue", lat: 19.0886, lon: 72.8983, exits: { "Gate 1": { desc: "Asalpha Village", lat: 19.0888, lon: 72.8981 }}},
    { name: "Jagruti Nagar", line: "Blue", lat: 19.0817, lon: 72.9021, exits: { "Gate 1": { desc: "LBS Marg", lat: 19.0819, lon: 72.9019 }}},
    { name: "Ghatkopar", line: "Blue", lat: 19.0768, lon: 72.9051, exits: { "Gate 1": { desc: "Connects to Ghatkopar Railway Station", lat: 19.0770, lon: 72.9049 }}},
    
    // --- Yellow Line (Line 2A) ---
    { name: "Andheri (West)", line: "Yellow", interchangeWith: "Blue", lat: 19.1300, lon: 72.8260, exits: { "Gate 1": { desc: "Near Andheri RTO", lat: 19.1302, lon: 72.8258 }}},
    { name: "Lower Oshiwara", line: "Yellow", lat: 19.1375, lon: 72.8275, exits: { "Gate 1": { desc: "Link Road", lat: 19.1377, lon: 72.8273 }}},
    { name: "Oshiwara", line: "Yellow", lat: 19.1450, lon: 72.8290, exits: { "Gate 1": { desc: "Lokhandwala Complex", lat: 19.1452, lon: 72.8288 }}},
    { name: "Goregaon (West)", line: "Yellow", lat: 19.1620, lon: 72.8315, exits: { "Gate 1": { desc: "Near Goregaon Bus Depot", lat: 19.1622, lon: 72.8313 }}},
    { name: "Pahadi Goregaon", line: "Yellow", lat: 19.1685, lon: 72.8330, exits: { "Gate 1": { desc: "Bangur Nagar", lat: 19.1687, lon: 72.8328 }}},
    { name: "Lower Malad", line: "Yellow", lat: 19.1760, lon: 72.8345, exits: { "Gate 1": { desc: "Mith Chowky", lat: 19.1762, lon: 72.8343 }}},
    { name: "Malad (West)", line: "Yellow", lat: 19.1835, lon: 72.8360, exits: { "Gate 1": { desc: "Near Inorbit Mall", lat: 19.1837, lon: 72.8358 }}},
    { name: "Valnai", line: "Yellow", lat: 19.1895, lon: 72.8370, exits: { "Gate 1": { desc: "Malad Bus Depot", lat: 19.1897, lon: 72.8368 }}},
    { name: "Dahanukarwadi", line: "Yellow", lat: 19.2000, lon: 72.8395, exits: { "Gate 1": { desc: "Mahavir Nagar", lat: 19.2002, lon: 72.8393 }}},
    { name: "Kandivali (West)", line: "Yellow", lat: 19.2085, lon: 72.8410, exits: { "Gate 1": { desc: "Near Kandivali Railway Station", lat: 19.2087, lon: 72.8408 }}},
    { name: "Pahadi Eksar", line: "Yellow", lat: 19.2195, lon: 72.8430, exits: { "Gate 1": { desc: "Shimpoli", lat: 19.2197, lon: 72.8428 }}},
    { name: "Borivali (West)", line: "Yellow", lat: 19.2285, lon: 72.8450, exits: { "Gate 1": { desc: "Near Borivali Railway Station", lat: 19.2287, lon: 72.8448 }}},
    { name: "Eksar", line: "Yellow", lat: 19.2319, lon: 72.8465, exits: { "Gate 1": { desc: "Eksar Village", lat: 19.2321, lon: 72.8463 }}},
    { name: "Mandapeshwar", line: "Yellow", lat: 19.2370, lon: 72.8485, exits: { "Gate 1": { desc: "IC Colony", lat: 19.2372, lon: 72.8483 }}},
    { name: "Kandarpada", line: "Yellow", lat: 19.2435, lon: 72.8502, exits: { "Gate 1": { desc: "Kandarpada Colony", lat: 19.2437, lon: 72.8500 }}},
    { name: "Anand Nagar (Dahisar)", line: "Yellow", lat: 19.2505, lon: 72.8565, exits: { "Gate 1": { desc: "Anand Nagar", lat: 19.2507, lon: 72.8563 }}},
    { name: "Dahisar (East)", line: "Yellow", interchangeWith: "Red", lat: 19.2510, lon: 72.8659, exits: { "Gate 1": { desc: "Connects to Red Line", lat: 19.2512, lon: 72.8657 }}},
    // --- Red Line (Line 7) ---
    { name: "Gundavali", line: "Red", interchangeWith: "Blue", lat: 19.1175, lon: 72.8600, exits: { "Gate 1": { desc: "Connects to WEH Station", lat: 19.1177, lon: 72.8598 }}},
    { name: "Mogra", line: "Red", lat: 19.1260, lon: 72.8615, exits: { "Gate 1": { desc: "Near JVLR", lat: 19.1262, lon: 72.8613 }}},
    { name: "Jogeshwari (East)", line: "Red", lat: 19.1390, lon: 72.8630, exits: { "Gate 1": { desc: "Connects to Jogeshwari Railway Station", lat: 19.1392, lon: 72.8628 }}},
    { name: "Goregaon (East)", line: "Red", lat: 19.1600, lon: 72.8635, exits: { "Gate 1": { desc: "Near Oberoi Mall", lat: 19.1602, lon: 72.8633 }}},
    { name: "Aarey", line: "Red", lat: 19.1710, lon: 72.8640, exits: { "Gate 1": { desc: "Film City Road", lat: 19.1712, lon: 72.8638 }}},
    { name: "Dindoshi", line: "Red", lat: 19.1785, lon: 72.8645, exits: { "Gate 1": { desc: "Dindoshi Bus Depot", lat: 19.1787, lon: 72.8643 }}},
    { name: "Kurar", line: "Red", lat: 19.1880, lon: 72.8650, exits: { "Gate 1": { desc: "Kurar Village", lat: 19.1882, lon: 72.8648 }}},
    { name: "Akurli", line: "Red", lat: 19.2020, lon: 72.8655, exits: { "Gate 1": { desc: "Kandivali (East)", lat: 19.2022, lon: 72.8653 }}},
    { name: "Poisar", line: "Red", lat: 19.2130, lon: 72.8660, exits: { "Gate 1": { desc: "Poisar Bus Depot", lat: 19.2132, lon: 72.8658 }}},
    { name: "Magathane", line: "Red", lat: 19.2245, lon: 72.8665, exits: { "Gate 1": { desc: "Thakur Village", lat: 19.2247, lon: 72.8663 }}},
    { name: "Devipada", line: "Red", lat: 19.2320, lon: 72.8670, exits: { "Gate 1": { desc: "Sanjay Gandhi National Park", lat: 19.2322, lon: 72.8668 }}},
    { name: "Rashtriya Udyan", line: "Red", lat: 19.2395, lon: 72.8675, exits: { "Gate 1": { desc: "National Park Main Gate", lat: 19.2397, lon: 72.8673 }}},
    { name: "Ovaripada", line: "Red", lat: 19.2450, lon: 72.8680, exits: { "Gate 1": { desc: "Ovaripada", lat: 19.2452, lon: 72.8678 }}}
];

// --- Helper Functions (remain the same) ---
const stationMap = stationData.reduce((obj, station) => {
    obj[station.name] = station;
    return obj;
}, {});
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180; const a = 0.5 - Math.cos(dLat) / 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon)) / 2; return R * 2 * Math.asin(Math.sqrt(a));
};
const buildAdjacencyList = () => {
    const adj = {};
    const lines = {};
    stationData.forEach(s => {
        if (!lines[s.line]) lines[s.line] = [];
        lines[s.line].push(s.name);
        adj[s.name] = [];
    });
    for (const line in lines) {
        for (let i = 0; i < lines[line].length - 1; i++) {
            const station1 = lines[line][i];
            const station2 = lines[line][i + 1];
            adj[station1].push(station2);
            adj[station2].push(station1);
        }
    }
    stationData.forEach(s => {
        if (s.interchangeWith) {
            const partner = stationData.find(p => p.line === s.interchangeWith && p.interchangeWith === s.line);
            if (partner) {
                adj[s.name].push(partner.name);
                adj[partner.name].push(s.name);
            }
        }
    });
    return adj;
};
const findShortestPath = (startName, endName) => {
    if (!startName || !endName) return null;
    const adjacencyList = buildAdjacencyList();
    const queue = [[startName]];
    const visited = new Set([startName]);
    while (queue.length > 0) {
        const path = queue.shift();
        const node = path[path.length - 1];
        if (node === endName) return path;
        const neighbors = adjacencyList[node] || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                const newPath = [...path, neighbor];
                queue.push(newPath);
            }
        }
    }
    return null;
};

// --- PlanRouteScreen Component ---
const PlanRouteScreen = () => {
    const [startQuery, setStartQuery] = useState('');
    const [startSearchResults, setStartSearchResults] = useState([]);
    const [startCoordinates, setStartCoordinates] = useState(null);
    const [startStation, setStartStation] = useState(null);

    const [destinationQuery, setDestinationQuery] = useState('');
    const [destinationSearchResults, setDestinationSearchResults] = useState([]);
    const [destinationStation, setDestinationStation] = useState(null);
    
    const [finalRoute, setFinalRoute] = useState(null);

    // --- Search Logic with Nominatim (No API Key needed) ---
    const handleSearch = useCallback(async (query, setSearchResults) => {
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }
        const viewbox = '72.7,18.8,73.0,19.3'; // Mumbai area
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&viewbox=${viewbox}&bounded=1&limit=5`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            setSearchResults(data || []);
        } catch (error) {
            console.error("Search failed:", error);
            setSearchResults([]);
        }
    }, []);

    // Effect for start location search
    useEffect(() => {
        const handler = setTimeout(() => {
            handleSearch(startQuery, setStartSearchResults);
        }, 300);
        return () => clearTimeout(handler);
    }, [startQuery, handleSearch]);

    // Effect for destination location search
    useEffect(() => {
        const handler = setTimeout(() => {
            handleSearch(destinationQuery, setDestinationSearchResults);
        }, 300);
        return () => clearTimeout(handler);
    }, [destinationQuery, handleSearch]);

    // --- Selection Logic ---
    const handleSelectStart = (place) => {
        setStartQuery(place.display_name);
        setStartSearchResults([]);
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);
        setStartCoordinates({ lat, lon });
        // We will calculate the optimal start station only when the destination is also known.
    };

    const handleSelectDestination = (place) => {
        setDestinationQuery(place.display_name);
        setDestinationSearchResults([]);
        const destLat = parseFloat(place.lat);
        const destLon = parseFloat(place.lon);

        if (!startCoordinates) {
            alert("Please select a starting location first.");
            return;
        }

        // --- NEW SMART ALGORITHM ---
        
        // 1. Find nearest station to the destination (this is likely fixed)
        let nearestDestStation = null;
        let minDestDistance = Infinity;
        stationData.forEach(station => {
            const distance = haversineDistance(destLat, destLon, station.lat, station.lon);
            if (distance < minDestDistance) {
                minDestDistance = distance;
                nearestDestStation = station;
            }
        });
        setDestinationStation(nearestDestStation);

        // 2. Find top 3 candidate stations for the start
        const candidateStartStations = stationData
            .map(station => ({
                ...station,
                walkDistance: haversineDistance(startCoordinates.lat, startCoordinates.lon, station.lat, station.lon)
            }))
            .sort((a, b) => a.walkDistance - b.walkDistance)
            .slice(0, 3);

        // 3. Calculate total journey cost for each candidate
        let bestRoute = { totalCost: Infinity, startStation: null, path: null };
        const WALK_VS_METRO_WEIGHT = 4; // Assume 1km of walking is as "costly" as 4 metro stops

        candidateStartStations.forEach(candidate => {
            const path = findShortestPath(candidate.name, nearestDestStation.name);
            if (path) {
                const walkCost = candidate.walkDistance * WALK_VS_METRO_WEIGHT;
                const metroCost = path.length;
                const totalCost = walkCost + metroCost;
                
                if (totalCost < bestRoute.totalCost) {
                    bestRoute = { totalCost, startStation: candidate, path };
                }
            }
        });
        
        // 4. Set the optimal start station
        setStartStation(bestRoute.startStation);

        // 5. Calculate best entry and exit gates based on the optimal route
        let bestExit = null;
        if (nearestDestStation.exits) {
            let minExitDist = Infinity;
            for (const [gate, details] of Object.entries(nearestDestStation.exits)) {
                const dist = haversineDistance(destLat, destLon, details.lat, details.lon);
                if (dist < minExitDist) {
                    minExitDist = dist;
                    bestExit = { gate, ...details };
                }
            }
        }
        
        let bestEntry = null;
        if (bestRoute.startStation && bestRoute.startStation.exits) {
            let minEntryDist = Infinity;
            for (const [gate, details] of Object.entries(bestRoute.startStation.exits)) {
                const dist = haversineDistance(startCoordinates.lat, startCoordinates.lon, details.lat, details.lon);
                if (dist < minEntryDist) {
                    minEntryDist = dist;
                    bestEntry = { gate, ...details };
                }
            }
        }

        setFinalRoute({ path: bestRoute.path, bestExit, bestEntry });
    };

    // --- Route Instructions Logic ---
    const getRouteInstructions = (path) => {
        if (!path || path.length <= 1) return <div style={{...styles.routeStep}}><p>Your start and end stations are the same.</p></div>;
        let instructions = [];
        let currentLine = stationMap[path[0]].line;
        let rideStartStation = path[0];

        for (let i = 1; i < path.length; i++) {
            const nextStation = stationMap[path[i]];
            if (nextStation.line !== currentLine) {
                const interchangeStation = stationMap[path[i-1]];
                instructions.push(<div key={`instr-${i}-a`} style={styles.routeStep}><p>Take the <strong>{currentLine} Line</strong> from <strong>{rideStartStation}</strong> to <strong>{interchangeStation.name}</strong>.</p></div>);
                instructions.push(<div key={`instr-${i}-b`} style={styles.routeStep}><p>Change to the <strong>{nextStation.line} Line</strong> at <strong>{interchangeStation.name}</strong>.</p></div>);
                currentLine = nextStation.line;
                rideStartStation = interchangeStation.name;
            }
        }
        instructions.push(<div key="instr-final" style={styles.routeStep}><p>Ride the <strong>{currentLine} Line</strong> from <strong>{rideStartStation}</strong> to your destination, <strong>{stationMap[path[path.length-1]].name}</strong>.</p></div>);
        return instructions;
    };

    // --- Render Logic ---
    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '30px', fontWeight: 'bold', color: '#13293d', margin: 0 }}>Plan Your Route</h2>

            {/* --- Start Location Input --- */}
            <div style={styles.card}>
                <h3 style={styles.stepTitle}>Step 1: Where are you starting from?</h3>
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        value={startQuery}
                        onChange={(e) => {
                            setStartQuery(e.target.value);
                            setStartCoordinates(null);
                            setStartStation(null);
                            setFinalRoute(null);
                        }}
                        placeholder="Search for a starting address or place..."
                        style={styles.searchInput}
                    />
                    {startSearchResults.length > 0 && !startCoordinates && (
                        <div style={styles.searchResultsContainer}>
                            {startSearchResults.map((place) => (
                                <div key={place.place_id} onClick={() => handleSelectStart(place)} style={styles.searchResultItem}>
                                    {place.display_name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* --- Destination Location Input --- */}
            {startCoordinates && (
                 <div style={styles.card}>
                    <h3 style={styles.stepTitle}>Step 2: Where do you want to go?</h3>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            value={destinationQuery}
                            onChange={(e) => {
                                setDestinationQuery(e.target.value);
                                setDestinationStation(null);
                                setFinalRoute(null);
                            }}
                            placeholder="Search for a destination address or place..."
                            style={styles.searchInput}
                        />
                        {destinationSearchResults.length > 0 && !finalRoute && (
                            <div style={styles.searchResultsContainer}>
                                {destinationSearchResults.map((place) => (
                                    <div key={place.place_id} onClick={() => handleSelectDestination(place)} style={styles.searchResultItem}>
                                        {place.display_name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- Final Route Display --- */}
            {startStation && destinationStation && finalRoute && (
                <div style={styles.card}>
                    <h3 style={styles.stepTitle}>Your Full Journey Plan</h3>
                    
                    <h4 style={{fontWeight: '600', color: '#13293d', marginBottom: '8px'}}>Recommended Entry:</h4>
                    <div style={{marginBottom: '16px'}}>
                        {finalRoute.bestEntry ? (
                            <p style={{fontSize: '18px', margin: 0}}>➡️ At <strong>{startStation.name}</strong>, use <strong>{finalRoute.bestEntry.gate}:</strong> {finalRoute.bestEntry.desc}</p>
                        ) : ( <p style={{margin: 0}}>No specific entry gate recommendation.</p> )}
                    </div>

                    <h4 style={{fontWeight: '600', color: '#13293d', marginBottom: '8px'}}>Metro Journey:</h4>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px'}}>
                        {getRouteInstructions(finalRoute.path)}
                    </div>
                    
                    <h4 style={{fontWeight: '600', color: '#13293d', marginBottom: '8px'}}>Recommended Exit:</h4>
                    <div>
                        {finalRoute.bestExit ? (
                            <p style={{fontSize: '18px', margin: 0}}>➡️ At <strong>{destinationStation.name}</strong>, use <strong>{finalRoute.bestExit.gate}:</strong> {finalRoute.bestExit.desc}</p>
                        ) : ( <p style={{margin: 0}}>No exit information available.</p> )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Styles Object ---
const styles = {
    card: { backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    stepTitle: { fontWeight: 'bold', fontSize: '18px', color: '#13293d', margin: 0, marginBottom: '16px' },
    searchInput: { width: '100%', padding: '16px', border: '1px solid #e8f1f2', borderRadius: '8px', fontSize: '16px', outline: 'none' },
    searchResultsContainer: { position: 'absolute', zIndex: 10, width: '100%', marginTop: '4px', backgroundColor: 'white', border: '1px solid #e8f1f2', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '240px', overflowY: 'auto' },
    searchResultItem: { padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #e8f1f2' },
    routeStep: { paddingLeft: '24px', borderLeft: '3px solid #1b98e0', position: 'relative' },
};

export default PlanRouteScreen;

