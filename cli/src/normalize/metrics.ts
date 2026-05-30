import type { GraphEdge, GraphNode } from '@arch-viz/shared';

/**
 * Fill metrics.fanIn / fanOut (distinct `calls` neighbours) and metrics.descendants
 * (transitive `contains` closure) on each node. Mutates the freshly-built nodes.
 */
export function computeMetrics(nodes: GraphNode[], edges: readonly GraphEdge[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const containsChildren = new Map<string, string[]>();

  for (const e of edges) {
    if (e.kind === 'calls') {
      const src = byId.get(e.source);
      const tgt = byId.get(e.target);
      if (src) src.metrics.fanOut += 1;
      if (tgt) tgt.metrics.fanIn += 1;
    } else if (e.kind === 'contains') {
      const list = containsChildren.get(e.source);
      if (list) list.push(e.target);
      else containsChildren.set(e.source, [e.target]);
    }
  }

  // descendants = number of DISTINCT nodes reachable via `contains`, excluding self.
  // Per-node traversal over a fresh visited set: order-independent and cycle-safe by
  // construction (no cross-node memo, so a `contains` cycle can never make the result
  // depend on the order nodes are visited).
  for (const n of nodes) {
    const seen = new Set<string>();
    const stack = [n.id];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const child of containsChildren.get(cur) ?? []) {
        if (child === n.id || seen.has(child) || !byId.has(child)) continue;
        seen.add(child);
        stack.push(child);
      }
    }
    n.metrics.descendants = seen.size;
  }
}
