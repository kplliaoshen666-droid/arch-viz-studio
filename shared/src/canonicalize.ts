import type {
  Cluster,
  Counts,
  GraphEdge,
  GraphFile,
  GraphNode,
  Meta,
} from './types';

const COORD_PRECISION = 2;
const CONFIDENCE_PRECISION = 4;

/**
 * Return a canonical clone of a graph: arrays sorted by stable keys, derived counts/sizes
 * recomputed, floats rounded, -0 normalized. Pure — input is never mutated.
 */
export function canonicalizeGraph(graph: GraphFile): GraphFile {
  const nodes = graph.nodes.map(canonNode).sort((a, b) => cmp(a.id, b.id));
  const edges = graph.edges
    .map(canonEdge)
    .sort(
      (a, b) =>
        cmp(a.source, b.source) || cmp(a.target, b.target) || cmp(a.kind, b.kind) || cmp(a.id, b.id),
    );
  const clusters = graph.clusters.map(canonCluster).sort((a, b) => a.id - b.id);
  const counts: Counts = { nodes: nodes.length, edges: edges.length, clusters: clusters.length };
  return { meta: canonMeta(graph.meta, counts), nodes, edges, clusters };
}

/**
 * Canonical JSON text — the bytes the CLI writes to disk. Deterministic: the same logical
 * graph (in any input order) always produces byte-identical output (SCHEMA-02). 2-space
 * indent + trailing newline (POSIX-friendly, plays well with `additionalProperties:false`).
 */
export function canonicalize(graph: GraphFile): string {
  return JSON.stringify(canonicalizeGraph(graph), null, 2) + '\n';
}

function canonMeta(m: Meta, counts: Counts): Meta {
  return {
    schemaVersion: m.schemaVersion,
    generatedAt: m.generatedAt,
    sourceRepo: m.sourceRepo,
    sourceRepoHash: m.sourceRepoHash,
    generator: {
      name: m.generator.name,
      version: m.generator.version,
      engine: m.generator.engine,
      engineVersion: m.generator.engineVersion,
      codegraphSchema: m.generator.codegraphSchema,
      codegraphDbHash: m.generator.codegraphDbHash,
    },
    counts: { nodes: counts.nodes, edges: counts.edges, clusters: counts.clusters },
    layout: { algo: m.layout.algo, rankdir: m.layout.rankdir, version: m.layout.version },
    clustering: {
      algo: m.clustering.algo,
      seed: m.clustering.seed,
      resolution: m.clustering.resolution,
    },
  };
}

function canonNode(n: GraphNode): GraphNode {
  return {
    id: n.id,
    kind: n.kind,
    label: n.label,
    qualifiedName: n.qualifiedName,
    path: n.path,
    lang: n.lang,
    span: { startLine: n.span.startLine, endLine: n.span.endLine },
    cluster: n.cluster,
    flags: {
      exported: n.flags.exported,
      async: n.flags.async,
      static: n.flags.static,
      abstract: n.flags.abstract,
    },
    metrics: {
      loc: n.metrics.loc,
      fanIn: n.metrics.fanIn,
      fanOut: n.metrics.fanOut,
      descendants: n.metrics.descendants,
    },
    position: { x: round(n.position.x, COORD_PRECISION), y: round(n.position.y, COORD_PRECISION) },
    annotations: n.annotations ?? null,
  };
}

function canonEdge(e: GraphEdge): GraphEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    kind: e.kind,
    weight: e.weight,
    confidence: round(e.confidence, CONFIDENCE_PRECISION),
    resolvedBy: e.resolvedBy,
  };
}

function canonCluster(c: Cluster): Cluster {
  const nodeIds = [...c.nodeIds].sort(cmp);
  return {
    id: c.id,
    label: c.label,
    color: c.color,
    nodeIds,
    size: nodeIds.length,
    annotations: c.annotations ?? null,
  };
}

function round(n: number, precision: number): number {
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** precision;
  const r = Math.round(n * factor) / factor;
  return Object.is(r, -0) ? 0 : r;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
