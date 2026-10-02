// Fuzz test: A* path cost must equal Dijkstra's optimum on random graphs.
// Run with `npm test`.
import assert from 'assert';
import { aStarSearch, GraphNode } from './astar';

// Small seeded PRNG (mulberry32) so failures are reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a: GraphNode, b: GraphNode) => Math.hypot(a.x - b.x, a.y - b.y);

function dijkstraCost(start: string, goal: string, nodes: Map<string, GraphNode>): number {
  const best = new Map<string, number>([[start, 0]]);
  const done = new Set<string>();
  for (;;) {
    let u: string | null = null;
    let du = Infinity;
    for (const [id, d] of best) if (!done.has(id) && d < du) [u, du] = [id, d];
    if (u === null) return Infinity;
    if (u === goal) return du;
    done.add(u);
    const nu = nodes.get(u)!;
    for (const v of nu.neighbors) {
      const nv = nodes.get(v);
      if (nv && du + dist(nu, nv) < (best.get(v) ?? Infinity)) best.set(v, du + dist(nu, nv));
    }
  }
}

const random = rng(42);
const TRIALS = 4000;

for (let trial = 0; trial < TRIALS; trial++) {
  const n = 5 + Math.floor(random() * 25);
  const nodes = new Map<string, GraphNode>();
  for (let i = 0; i < n; i++) {
    nodes.set(`n${i}`, { node_id: `n${i}`, x: random() * 100, y: random() * 100, neighbors: [] });
  }
  const edges = Math.floor(n * (1 + random() * 2));
  for (let e = 0; e < edges; e++) {
    const a = `n${Math.floor(random() * n)}`;
    const b = `n${Math.floor(random() * n)}`;
    if (a === b) continue;
    nodes.get(a)!.neighbors.push(b);
    nodes.get(b)!.neighbors.push(a);
  }

  const start = 'n0';
  const goal = `n${n - 1}`;
  const path = aStarSearch(start, goal, nodes);
  const optimum = dijkstraCost(start, goal, nodes);

  if (!Number.isFinite(optimum)) {
    assert.deepStrictEqual(path, [], `trial ${trial}: found a path where none exists`);
    continue;
  }
  assert.strictEqual(path[0], start, `trial ${trial}: path does not start at start`);
  assert.strictEqual(path[path.length - 1], goal, `trial ${trial}: path does not end at goal`);

  let cost = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = nodes.get(path[i])!;
    assert.ok(a.neighbors.includes(path[i + 1]), `trial ${trial}: ${path[i]} -> ${path[i + 1]} is not an edge`);
    cost += dist(a, nodes.get(path[i + 1])!);
  }
  assert.ok(Math.abs(cost - optimum) < 1e-9, `trial ${trial}: cost ${cost} != optimum ${optimum}`);
}

assert.deepStrictEqual(aStarSearch('missing', 'n0', new Map()), []);
console.log(`astar: ${TRIALS} random graphs, all paths optimal`);
