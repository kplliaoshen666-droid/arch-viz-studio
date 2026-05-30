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

  const memo = new Map<string, number>();
  const descendants = (id: string, seen: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 0; // cycle guard
    seen.add(id);
    let count = 0;
    for (const child of containsChildren.get(id) ?? []) {
      if (!byId.has(child)) continue;
      count += 1 + descendants(child, seen);
    }
    seen.delete(id);
    memo.set(id, count);
    return count;
  };

  for (const n of nodes) n.metrics.descendants = descendants(n.id, new Set());
}
