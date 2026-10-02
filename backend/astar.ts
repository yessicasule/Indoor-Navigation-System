// Standard A* over a hand-authored waypoint graph with x/y/z in metres (site-local origin).

export interface GraphNode {
  node_id: string;
  x: number;
  y: number;
  z?: number; // height, so stair/lift edges between floors have a real cost; 0 if absent
  neighbors: string[];
}

interface SearchEntry {
  id: string;
  g: number; // cost from start
  h: number; // straight-line estimate to goal
  f: number; // g + h
  parent: string | null;
}

const euclidean = (a: GraphNode, b: GraphNode) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

/** Returns the node IDs of a shortest path from start to goal, or [] if none exists. */
export function aStarSearch(startId: string, goalId: string, nodes: Map<string, GraphNode>): string[] {
  const start = nodes.get(startId);
  const goal = nodes.get(goalId);
  if (!start || !goal) return [];

  const openSet: SearchEntry[] = [];
  const closedSet = new Set<string>();
  const entries = new Map<string, SearchEntry>();

  const h0 = euclidean(start, goal);
  const startEntry: SearchEntry = { id: startId, g: 0, h: h0, f: h0, parent: null };
  openSet.push(startEntry);
  entries.set(startId, startEntry);

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (current.id === goalId) {
      const path: string[] = [];
      for (let id: string | null = current.id; id; id = entries.get(id)?.parent ?? null) path.unshift(id);
      return path;
    }

    closedSet.add(current.id);
    const currentNode = nodes.get(current.id)!;

    for (const neighborId of currentNode.neighbors) {
      if (closedSet.has(neighborId)) continue;
      const neighborNode = nodes.get(neighborId);
      if (!neighborNode) continue;

      const g = current.g + euclidean(currentNode, neighborNode);
      let entry = entries.get(neighborId);
      if (!entry) {
        entry = { id: neighborId, g: Infinity, h: euclidean(neighborNode, goal), f: Infinity, parent: null };
        entries.set(neighborId, entry);
        openSet.push(entry);
      }
      // Entries are updated in place, so the open set never holds a stale f.
      if (g < entry.g) {
        entry.parent = current.id;
        entry.g = g;
        entry.f = g + entry.h;
      }
    }
  }
  return [];
}
