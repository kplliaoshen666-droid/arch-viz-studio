import type { GraphFile } from './types';

/**
 * Carry human/agent-authored `annotations` from a previous graph.json onto a freshly
 * scanned one, matched by stable id. This is what makes graph.json safely agent-updatable
 * (SCHEMA-03): an annotation an agent adds to a node survives the next `arch-viz scan`
 * instead of being clobbered. Pure — returns new objects, never mutates inputs.
 *
 * Node ids are content hashes (strong, survive re-scan). Cluster ids are community indices
 * and can shift between scans, so cluster-annotation carry-over is best-effort.
 */
export function mergeAnnotations(prev: GraphFile, next: GraphFile): GraphFile {
  const prevNodeAnn = new Map<string, string>();
  for (const n of prev.nodes) {
    if (n.annotations != null) prevNodeAnn.set(n.id, n.annotations);
  }
  const prevClusterAnn = new Map<number, string>();
  for (const c of prev.clusters) {
    if (c.annotations != null) prevClusterAnn.set(c.id, c.annotations);
  }

  const nodes = next.nodes.map((n) => {
    const carried = prevNodeAnn.get(n.id);
    return n.annotations == null && carried !== undefined ? { ...n, annotations: carried } : n;
  });

  const clusters = next.clusters.map((c) => {
    const carried = prevClusterAnn.get(c.id);
    return c.annotations == null && carried !== undefined ? { ...c, annotations: carried } : c;
  });

  return { ...next, nodes, clusters };
}
