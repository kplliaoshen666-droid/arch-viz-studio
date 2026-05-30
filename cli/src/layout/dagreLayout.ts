import dagre from '@dagrejs/dagre';
import type { GraphEdge, GraphNode, RankDir } from '@arch-viz/shared';

/**
 * Compute deterministic x/y per node with dagre and write them into nodes[].position,
 * so the committed SVG and the on-screen graph agree. Inputs are sorted before insertion
 * so the layout is reproducible. Mutates node.position.
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: readonly GraphEdge[],
  rankdir: RankDir,
): void {
  const g = new dagre.graphlib.Graph({ directed: true });
  g.setGraph({ rankdir, nodesep: 40, ranksep: 90, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of [...nodes].sort(byId)) {
    g.setNode(n.id, { width: nodeWidth(n.label), height: 40 });
  }
  for (const e of [...edges].sort(byId)) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  for (const n of nodes) {
    const laid = g.node(n.id) as { x?: number; y?: number } | undefined;
    n.position = { x: laid?.x ?? 0, y: laid?.y ?? 0 };
  }
}

function nodeWidth(label: string): number {
  return Math.min(280, Math.max(80, Math.round(label.length * 7.5 + 32)));
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
