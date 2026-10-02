// A* latency on building-like graphs: a corridor grid (degree <= 4, 5 m spacing) with
// some edges removed, like walls between parallel corridors. Run with `npm run bench`.
import { performance } from 'perf_hooks';
import { aStarSearch, GraphNode } from '../astar';

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function corridorGrid(side: number, random: () => number): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();
  const id = (i: number, j: number) => `n${i}_${j}`;
  for (let i = 0; i < side; i++)
    for (let j = 0; j < side; j++) nodes.set(id(i, j), { node_id: id(i, j), x: i * 5, y: j * 5, neighbors: [] });
  const link = (a: string, b: string) => { nodes.get(a)!.neighbors.push(b); nodes.get(b)!.neighbors.push(a); };
  for (let i = 0; i < side; i++)
    for (let j = 0; j < side; j++) {
      if (i + 1 < side && (j % 4 === 0 || random() < 0.3)) link(id(i, j), id(i + 1, j)); // cross-corridors
      if (j + 1 < side) link(id(i, j), id(i, j + 1)); // main corridors
    }
  return nodes;
}

const random = rng(7);
console.log('nodes   median ms   p95 ms   (100 random start/goal pairs)');
for (const side of [7, 15, 32, 70]) {
  const graph = corridorGrid(side, random);
  const ids = [...graph.keys()];
  const times: number[] = [];
  for (let q = 0; q < 100; q++) {
    const a = ids[Math.floor(random() * ids.length)];
    const b = ids[Math.floor(random() * ids.length)];
    const t = performance.now();
    aStarSearch(a, b, graph);
    times.push(performance.now() - t);
  }
  times.sort((x, y) => x - y);
  console.log(`${String(graph.size).padStart(5)}   ${times[50].toFixed(3).padStart(9)}   ${times[95].toFixed(3).padStart(6)}`);
}
