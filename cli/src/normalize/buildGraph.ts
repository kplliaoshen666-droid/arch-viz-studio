import { createHash } from 'node:crypto';
import { SCHEMA_VERSION } from '@arch-viz/shared';
import type { Cluster, GraphEdge, GraphFile, GraphNode, Meta, NodeKind } from '@arch-viz/shared';
import type { RawData, RawNode } from './readDb';
import { dedupeEdges, type PreEdge } from './dedupeEdges';
import { resolveImportTarget, toPosix } from './resolveImports';
import { clusterNodes } from './cluster';
import { computeMetrics } from './metrics';

const KEPT_KINDS: ReadonlySet<string> = new Set(['file', 'class', 'function']);
const SEED = 42;
const RESOLUTION = 1;

// Stable, distinct, 6-digit-hex palette (schema requires ^#[0-9a-fA-F]{6}$).
const CLUSTER_PALETTE = [
  '#4f8cff', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7',
];

export interface BuildOptions {
  repoName: string;
  /** `git:<sha>` or `none`. */
  repoHash: string;
  engineVersion: string;
  toolVersion: string;
}

/**
 * Turn raw CodeGraph rows into a normalized (but un-laid-out) GraphFile:
 * keep file/class/function nodes, drop import nodes, resolve intra-repo imports to
 * file→file edges, dedupe, cluster (seeded Louvain), compute metrics. Positions are
 * left at {0,0} for the layout stage to fill. Pure — does not touch disk.
 */
export function buildGraph(raw: RawData, opts: BuildOptions): GraphFile {
  const keptRaw = raw.nodes.filter((n) => KEPT_KINDS.has(n.kind));
  const keptIds = new Set(keptRaw.map((n) => n.id));
  const filePaths = new Set(
    keptRaw.filter((n) => n.kind === 'file').map((n) => toPosix(n.file_path)),
  );
  const importById = new Map(
    raw.nodes.filter((n) => n.kind === 'import').map((n) => [n.id, n]),
  );

  const nodes: GraphNode[] = keptRaw.map(toNode);

  const pre: PreEdge[] = [];
  for (const e of raw.edges) {
    if (e.kind === 'calls' || e.kind === 'contains') {
      if (!keptIds.has(e.source) || !keptIds.has(e.target)) continue;
      const meta = parseMeta(e.metadata);
      pre.push({
        source: e.source,
        target: e.target,
        kind: e.kind,
        confidence: meta.confidence ?? (e.kind === 'contains' ? 1 : 0.9),
        resolvedBy: meta.resolvedBy ?? (e.kind === 'contains' ? 'structural' : 'unknown'),
      });
    } else if (e.kind === 'imports') {
      const imp = importById.get(e.target);
      if (!imp || !keptIds.has(e.source)) continue;
      const resolved = resolveImportTarget(imp.name, imp.file_path, filePaths);
      if (!resolved || !keptIds.has(resolved) || resolved === e.source) continue;
      const meta = parseMeta(e.metadata);
      pre.push({
        source: e.source,
        target: resolved,
        kind: 'imports',
        confidence: meta.confidence ?? 0.9,
        resolvedBy: meta.resolvedBy ?? 'path',
      });
    }
  }
  const edges = dedupeEdges(pre);

  computeMetrics(nodes, edges);

  const clusterOf = clusterNodes(nodes.map((n) => n.id), edges, SEED, RESOLUTION);
  for (const n of nodes) n.cluster = clusterOf.get(n.id) ?? -1;
  const clusters = buildClusters(nodes);

  const meta = buildMeta(raw, opts, nodes, edges, clusters);
  return { meta, nodes, edges, clusters };
}

function toNode(n: RawNode): GraphNode {
  const start = n.start_line || 0;
  const end = Math.max(start, n.end_line || start);
  return {
    id: n.id,
    kind: n.kind as NodeKind,
    label: n.name,
    qualifiedName: n.qualified_name,
    path: toPosix(n.file_path),
    lang: n.language,
    span: { startLine: start, endLine: end },
    cluster: -1,
    flags: {
      exported: !!n.is_exported,
      async: !!n.is_async,
      static: !!n.is_static,
      abstract: !!n.is_abstract,
    },
    metrics: { loc: Math.max(0, end - start + 1), fanIn: 0, fanOut: 0, descendants: 0 },
    position: { x: 0, y: 0 },
    annotations: null,
  };
}

function parseMeta(s: string | null): { confidence?: number; resolvedBy?: string } {
  if (!s) return {};
  try {
    const o = JSON.parse(s) as { confidence?: unknown; resolvedBy?: unknown };
    return {
      confidence: typeof o.confidence === 'number' ? o.confidence : undefined,
      resolvedBy: typeof o.resolvedBy === 'string' ? o.resolvedBy : undefined,
    };
  } catch {
    return {};
  }
}

function buildClusters(nodes: readonly GraphNode[]): Cluster[] {
  const members = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    if (n.cluster < 0) continue;
    const arr = members.get(n.cluster);
    if (arr) arr.push(n);
    else members.set(n.cluster, [n]);
  }
  return [...members.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, mem]) => ({
      id,
      label: clusterLabel(mem),
      color: CLUSTER_PALETTE[id % CLUSTER_PALETTE.length],
      nodeIds: mem.map((n) => n.id).sort(),
      size: mem.length,
      annotations: null,
    }));
}

/** Label a community by its most-common top-level directory, else its busiest node. */
function clusterLabel(members: readonly GraphNode[]): string {
  const dirCount = new Map<string, number>();
  for (const n of members) {
    const slash = n.path.indexOf('/');
    const dir = slash >= 0 ? n.path.slice(0, slash) : '.';
    dirCount.set(dir, (dirCount.get(dir) ?? 0) + 1);
  }
  let best = '';
  let bestN = -1;
  for (const [dir, count] of [...dirCount.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (count > bestN) {
      bestN = count;
      best = dir;
    }
  }
  if (best && best !== '.') return best;
  const top = [...members].sort(
    (a, b) =>
      b.metrics.fanIn + b.metrics.fanOut - (a.metrics.fanIn + a.metrics.fanOut) ||
      (a.id < b.id ? -1 : 1),
  )[0];
  return top ? top.label : 'cluster';
}

function buildMeta(
  raw: RawData,
  opts: BuildOptions,
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  clusters: readonly Cluster[],
): Meta {
  return {
    schemaVersion: SCHEMA_VERSION,
    // Deterministic: latest source mtime, not wall-clock, so re-scanning unchanged code
    // yields a byte-identical file (CLI-01).
    generatedAt: new Date(raw.latestMtime || 0).toISOString(),
    sourceRepo: opts.repoName,
    sourceRepoHash: opts.repoHash,
    generator: {
      name: 'arch-viz',
      version: opts.toolVersion,
      engine: 'codegraph',
      engineVersion: opts.engineVersion,
      codegraphSchema: raw.codegraphSchema,
      codegraphDbHash: 'sha256:' + contentHash(nodes, edges),
    },
    counts: { nodes: nodes.length, edges: edges.length, clusters: clusters.length },
    layout: { algo: 'dagre', rankdir: 'LR', version: 1 },
    clustering: { algo: 'louvain', seed: SEED, resolution: RESOLUTION },
  };
}

function contentHash(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): string {
  const h = createHash('sha256');
  h.update(
    JSON.stringify({
      n: nodes.map((n) => n.id).sort(),
      e: edges.map((e) => e.id).sort(),
    }),
  );
  return h.digest('hex');
}
