import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import type { GraphEdge } from '@arch-viz/shared';

/** Deterministic PRNG (mulberry32) so seeded Louvain is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Assign each node to a community via seeded Louvain over the `calls` + `imports`
 * relations (contains is hierarchy, not a community signal). Returns a map node id →
 * canonical cluster index. Cluster ids are remapped so they are stable across re-scans:
 * communities are ordered by their minimum member id, then numbered 0..k.
 */
export function clusterNodes(
  nodeIds: readonly string[],
  edges: readonly GraphEdge[],
  seed: number,
  resolution: number,
): Map<string, number> {
  const sortedIds = [...nodeIds].sort();
  const graph = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false });
  for (const id of sortedIds) graph.addNode(id);

  let edgeCount = 0;
  for (const e of edges) {
    if (e.kind === 'contains') continue;
    if (e.source === e.target) continue;
    if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) continue;
    if (graph.hasEdge(e.source, e.target)) {
      graph.updateEdgeAttribute(e.source, e.target, 'weight', (w) => (Number(w) || 0) + e.weight);
    } else {
      graph.addEdge(e.source, e.target, { weight: e.weight });
      edgeCount += 1;
    }
  }

  // No community signal → one cluster holds everything (avoids singleton noise).
  if (edgeCount === 0) {
    return new Map(sortedIds.map((id) => [id, 0]));
  }

  const rng = mulberry32(seed);
  const raw = louvain(graph, { rng, resolution, getEdgeWeight: 'weight' }) as Record<
    string,
    number
  >;
  return canonicalizeCommunities(sortedIds, raw);
}

function canonicalizeCommunities(
  sortedIds: readonly string[],
  raw: Record<string, number>,
): Map<string, number> {
  // group members by raw community, tracking each community's min member id
  const minMember = new Map<number, string>();
  for (const id of sortedIds) {
    const c = raw[id] ?? -1;
    const cur = minMember.get(c);
    if (cur === undefined || id < cur) minMember.set(c, id);
  }
  const orderedCommunities = [...minMember.entries()].sort((a, b) =>
    a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0,
  );
  const remap = new Map<number, number>();
  orderedCommunities.forEach(([rawC], idx) => remap.set(rawC, idx));

  const result = new Map<string, number>();
  for (const id of sortedIds) result.set(id, remap.get(raw[id] ?? -1) ?? 0);
  return result;
}
