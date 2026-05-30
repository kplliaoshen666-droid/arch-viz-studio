import { describe, it, expect } from 'vitest';
import { canonicalize, validate } from '@arch-viz/shared';
import { buildGraph } from '../src/normalize/buildGraph';
import type { RawData, RawNode, RawEdge } from '../src/normalize/readDb';

function node(p: Partial<RawNode> & Pick<RawNode, 'id' | 'kind' | 'name' | 'file_path'>): RawNode {
  return {
    qualified_name: p.name,
    language: 'typescript',
    start_line: 1,
    end_line: 5,
    is_exported: 1,
    is_async: 0,
    is_static: 0,
    is_abstract: 0,
    ...p,
  } as RawNode;
}

const CONF = JSON.stringify({ confidence: 0.9, resolvedBy: 'exact-match' });

function cannedRaw(): RawData {
  const nodes: RawNode[] = [
    node({ id: 'file:a.ts', kind: 'file', name: 'a.ts', file_path: 'a.ts', is_exported: 0 }),
    node({ id: 'file:b.ts', kind: 'file', name: 'b.ts', file_path: 'b.ts', is_exported: 0 }),
    node({ id: 'function:f1', kind: 'function', name: 'f1', file_path: 'a.ts' }),
    node({ id: 'function:f2', kind: 'function', name: 'f2', file_path: 'a.ts' }),
    node({ id: 'function:f3', kind: 'function', name: 'f3', file_path: 'b.ts' }),
    node({ id: 'import:imp1', kind: 'import', name: './b', file_path: 'a.ts' }),
  ];
  const edges: RawEdge[] = [
    { source: 'file:a.ts', target: 'function:f1', kind: 'contains', metadata: null },
    { source: 'file:a.ts', target: 'function:f2', kind: 'contains', metadata: null },
    { source: 'file:a.ts', target: 'import:imp1', kind: 'contains', metadata: null }, // → dropped
    { source: 'file:b.ts', target: 'function:f3', kind: 'contains', metadata: null },
    { source: 'function:f1', target: 'function:f3', kind: 'calls', metadata: CONF },
    { source: 'function:f1', target: 'function:f3', kind: 'calls', metadata: CONF }, // dup → weight 2
    { source: 'function:f2', target: 'function:f3', kind: 'calls', metadata: CONF },
    { source: 'file:a.ts', target: 'import:imp1', kind: 'imports', metadata: JSON.stringify({ confidence: 0.95, resolvedBy: 'qualified-name' }) },
  ];
  return { nodes, edges, codegraphSchema: 4, latestMtime: 1_700_000_000_000 };
}

const OPTS = { repoName: 'canned', repoHash: 'none', engineVersion: 'test', toolVersion: '0.1.0' };

describe('buildGraph', () => {
  it('produces a schema-valid graph', () => {
    expect(validate(buildGraph(cannedRaw(), OPTS)).ok).toBe(true);
  });

  it('drops import-kind nodes and edges that dangle to them', () => {
    const g = buildGraph(cannedRaw(), OPTS);
    expect(g.nodes).toHaveLength(5);
    expect(g.nodes.every((n) => !n.id.startsWith('import:'))).toBe(true);
    expect(g.edges.some((e) => e.target.startsWith('import:'))).toBe(false);
  });

  it('resolves an intra-repo import to a file→file edge', () => {
    const g = buildGraph(cannedRaw(), OPTS);
    const imp = g.edges.find((e) => e.kind === 'imports');
    expect(imp).toBeDefined();
    expect(imp!.source).toBe('file:a.ts');
    expect(imp!.target).toBe('file:b.ts');
  });

  it('dedupes duplicate calls into weight 2 and computes fan-in', () => {
    const g = buildGraph(cannedRaw(), OPTS);
    const f1f3 = g.edges.find((e) => e.id === 'function:f1->function:f3:calls');
    expect(f1f3!.weight).toBe(2);
    expect(g.nodes.find((n) => n.id === 'function:f3')!.metrics.fanIn).toBe(2);
  });

  it('is deterministic (same raw → byte-identical canonical text)', () => {
    expect(canonicalize(buildGraph(cannedRaw(), OPTS))).toBe(
      canonicalize(buildGraph(cannedRaw(), OPTS)),
    );
  });

  it('stamps deterministic provenance from latestMtime, not wall-clock', () => {
    const g = buildGraph(cannedRaw(), OPTS);
    expect(g.meta.generatedAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(g.meta.generator.codegraphDbHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
