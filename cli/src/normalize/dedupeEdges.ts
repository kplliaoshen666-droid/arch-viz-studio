import type { EdgeKind, GraphEdge } from '@arch-viz/shared';

/** An edge before dedup/weighting — one row per CodeGraph relation. */
export interface PreEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  confidence: number;
  resolvedBy: string;
}

/**
 * Collapse duplicate `(source, target, kind)` relations into a single edge with a
 * `weight` (the count) and the maximum observed confidence. Deterministic: emission
 * order is normalized later by canonicalize().
 */
export function dedupeEdges(pre: PreEdge[]): GraphEdge[] {
  const byId = new Map<string, GraphEdge>();
  for (const e of pre) {
    const id = `${e.source}->${e.target}:${e.kind}`;
    const existing = byId.get(id);
    if (existing) {
      existing.weight += 1;
      // Deterministic tie-break: higher confidence wins; on equal confidence prefer the
      // lexicographically smaller resolvedBy so the result never depends on input order.
      if (
        e.confidence > existing.confidence ||
        (e.confidence === existing.confidence && e.resolvedBy < existing.resolvedBy)
      ) {
        existing.confidence = e.confidence;
        existing.resolvedBy = e.resolvedBy;
      }
    } else {
      byId.set(id, {
        id,
        source: e.source,
        target: e.target,
        kind: e.kind,
        weight: 1,
        confidence: e.confidence,
        resolvedBy: e.resolvedBy,
      });
    }
  }
  return [...byId.values()];
}
