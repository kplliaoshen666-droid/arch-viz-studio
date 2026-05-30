import type { GraphFile } from '../src/index';

export const FILE_ID = 'file:1111111111111111111111111111111111111111';
export const ADD_ID = 'function:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const DOUBLE_ID = 'function:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export const LOG_ID = 'function:cccccccccccccccccccccccccccccccccccccccc';

/**
 * The same logical graph as fixtures/sample.graph.json, built in TS so canonicalize/
 * annotations tests can mutate a fresh copy without touching the on-disk artifact.
 * Returns a brand-new object graph on every call (no shared nested refs).
 */
export function makeSampleGraph(): GraphFile {
  return {
    meta: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-05-31T08:00:00.000Z',
      sourceRepo: 'fixtures/math',
      sourceRepoHash: 'none',
      generator: {
        name: 'arch-viz',
        version: '0.1.0',
        engine: 'codegraph',
        engineVersion: '0.9.4',
        codegraphSchema: 4,
        codegraphDbHash:
          'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      },
      counts: { nodes: 4, edges: 3, clusters: 2 },
      layout: { algo: 'dagre', rankdir: 'LR', version: 1 },
      clustering: { algo: 'louvain', seed: 42, resolution: 1 },
    },
    nodes: [
      {
        id: FILE_ID,
        kind: 'file',
        label: 'math.ts',
        qualifiedName: 'src/math.ts',
        path: 'src/math.ts',
        lang: 'typescript',
        span: { startLine: 1, endLine: 20 },
        cluster: 0,
        flags: { exported: false, async: false, static: false, abstract: false },
        metrics: { loc: 20, fanIn: 0, fanOut: 0, descendants: 2 },
        position: { x: 0, y: 0 },
        annotations: null,
      },
      {
        id: ADD_ID,
        kind: 'function',
        label: 'add',
        qualifiedName: 'add',
        path: 'src/math.ts',
        lang: 'typescript',
        span: { startLine: 1, endLine: 3 },
        cluster: 0,
        flags: { exported: true, async: false, static: false, abstract: false },
        metrics: { loc: 3, fanIn: 1, fanOut: 0, descendants: 0 },
        position: { x: 160, y: 0 },
        annotations: null,
      },
      {
        id: DOUBLE_ID,
        kind: 'function',
        label: 'double',
        qualifiedName: 'double',
        path: 'src/math.ts',
        lang: 'typescript',
        span: { startLine: 5, endLine: 7 },
        cluster: 0,
        flags: { exported: true, async: false, static: false, abstract: false },
        metrics: { loc: 3, fanIn: 0, fanOut: 1, descendants: 0 },
        position: { x: 320, y: 0 },
        annotations: null,
      },
      {
        id: LOG_ID,
        kind: 'function',
        label: 'log',
        qualifiedName: 'log',
        path: 'src/util.ts',
        lang: 'typescript',
        span: { startLine: 1, endLine: 2 },
        cluster: 1,
        flags: { exported: true, async: false, static: false, abstract: false },
        metrics: { loc: 2, fanIn: 0, fanOut: 0, descendants: 0 },
        position: { x: 0, y: 120 },
        annotations: null,
      },
    ],
    edges: [
      {
        id: `${FILE_ID}->${ADD_ID}:contains`,
        source: FILE_ID,
        target: ADD_ID,
        kind: 'contains',
        weight: 1,
        confidence: 1,
        resolvedBy: 'structural',
      },
      {
        id: `${FILE_ID}->${DOUBLE_ID}:contains`,
        source: FILE_ID,
        target: DOUBLE_ID,
        kind: 'contains',
        weight: 1,
        confidence: 1,
        resolvedBy: 'structural',
      },
      {
        id: `${DOUBLE_ID}->${ADD_ID}:calls`,
        source: DOUBLE_ID,
        target: ADD_ID,
        kind: 'calls',
        weight: 1,
        confidence: 0.9,
        resolvedBy: 'exact-match',
      },
    ],
    clusters: [
      {
        id: 0,
        label: 'math',
        color: '#4f8cff',
        nodeIds: [FILE_ID, ADD_ID, DOUBLE_ID],
        size: 3,
        annotations: null,
      },
      {
        id: 1,
        label: 'util',
        color: '#f59e0b',
        nodeIds: [LOG_ID],
        size: 1,
        annotations: null,
      },
    ],
  };
}
