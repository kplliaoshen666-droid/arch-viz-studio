import type {
  NodeKind,
  EdgeKind,
  LayoutAlgo,
  ClusterAlgo,
  RankDir,
} from './enums';

/**
 * The graph.json contract. Interface field order below is the CANONICAL key order
 * that canonicalize() emits — keep them in sync (the README documents the same order).
 */

export interface Span {
  startLine: number;
  endLine: number;
}

export interface NodeFlags {
  exported: boolean;
  async: boolean;
  static: boolean;
  abstract: boolean;
}

export interface NodeMetrics {
  /** end-start+1 */
  loc: number;
  /** incoming `calls` edges */
  fanIn: number;
  /** outgoing `calls` edges */
  fanOut: number;
  /** contained nodes (module/file/class) */
  descendants: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface GraphNode {
  /** CodeGraph stable id (`<kind>:<hash>`) — survives a re-scan, so annotations can be merged by id. */
  id: string;
  kind: NodeKind;
  /** display name; ESCAPE at render — comes from arbitrary repos. */
  label: string;
  qualifiedName: string;
  /** POSIX, repo-relative. */
  path: string;
  lang: string;
  span: Span;
  /** index into clusters[]; -1 if unclustered. */
  cluster: number;
  flags: NodeFlags;
  metrics: NodeMetrics;
  /** dagre coordinates, rounded. */
  position: Position;
  /** free text, PRESERVED across re-scans by id (human/agent authored). null = none. */
  annotations: string | null;
}

export interface GraphEdge {
  /** derived stable id: `<source>-><target>:<kind>`. */
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  /** count of collapsed duplicate edges. */
  weight: number;
  /** CodeGraph metadata.confidence (max across deduped). */
  confidence: number;
  /** CodeGraph metadata.resolvedBy. */
  resolvedBy: string;
}

export interface Cluster {
  /** community id; also the index in clusters[]. */
  id: number;
  /** auto-derived (most-common dir / top node); human-editable. */
  label: string;
  /** assigned in the CLI so the committed SVG and the on-screen graph agree. */
  color: string;
  nodeIds: string[];
  size: number;
  annotations: string | null;
}

export interface Generator {
  name: string;
  version: string;
  engine: string;
  /** CodeGraph CLI version. */
  engineVersion: string;
  /** CodeGraph's internal schema_versions max. */
  codegraphSchema: number;
  /** sha256 of codegraph.db — repro / cache key. */
  codegraphDbHash: string;
}

export interface Counts {
  nodes: number;
  edges: number;
  clusters: number;
}

export interface LayoutMeta {
  algo: LayoutAlgo;
  rankdir: RankDir;
  version: number;
}

export interface ClusteringMeta {
  algo: ClusterAlgo;
  seed: number;
  resolution: number;
}

export interface Meta {
  /** OUR contract version (semver). */
  schemaVersion: string;
  /** ISO-8601; the one intentionally-volatile field, isolated here so the diffed body stays stable. */
  generatedAt: string;
  sourceRepo: string;
  /** `git:<sha>` if available, else `none`. */
  sourceRepoHash: string;
  generator: Generator;
  counts: Counts;
  layout: LayoutMeta;
  clustering: ClusteringMeta;
}

export interface GraphFile {
  meta: Meta;
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
}
