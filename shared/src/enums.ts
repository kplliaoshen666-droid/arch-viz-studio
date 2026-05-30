/** Closed enumerations shared by the schema, the CLI producer, and the app consumer. */

/** Node granularity. `module` is CLI-synthesized (directory rollup); the rest map 1:1 from CodeGraph. */
export const NODE_KINDS = ['module', 'file', 'class', 'function'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** Edge semantics from CodeGraph (`imports` | `calls` | `contains`). */
export const EDGE_KINDS = ['imports', 'calls', 'contains'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

/** Layout algorithm that produced nodes[].position. */
export const LAYOUT_ALGOS = ['dagre'] as const;
export type LayoutAlgo = (typeof LAYOUT_ALGOS)[number];

/** Community-detection algorithm that produced clusters[]. */
export const CLUSTER_ALGOS = ['louvain'] as const;
export type ClusterAlgo = (typeof CLUSTER_ALGOS)[number];

/** dagre rank direction. */
export const RANK_DIRS = ['LR', 'TB', 'RL', 'BT'] as const;
export type RankDir = (typeof RANK_DIRS)[number];
