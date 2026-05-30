import type { Cluster, GraphFile, NodeKind } from '@arch-viz/shared';

const FALLBACK = '#9ca3af';

/** Map cluster id → color, straight from graph.json (CLI-assigned, so SVG and app agree). */
export function clusterColorMap(graph: GraphFile): Map<number, string> {
  const m = new Map<number, string>();
  for (const c of graph.clusters) m.set(c.id, c.color);
  return m;
}

export function clusterColor(map: Map<number, string>, clusterId: number): string {
  return map.get(clusterId) ?? FALLBACK;
}

/** Short kind glyph for compact node/tree badges. */
export const KIND_GLYPH: Record<NodeKind, string> = {
  module: 'M',
  file: 'F',
  class: 'C',
  function: 'ƒ',
};

export function clusterById(graph: GraphFile, id: number): Cluster | undefined {
  return graph.clusters.find((c) => c.id === id);
}
