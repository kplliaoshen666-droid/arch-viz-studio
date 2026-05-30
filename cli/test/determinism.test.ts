import { describe, it, expect } from 'vitest';
import { canonicalize } from '@arch-viz/shared';
import { buildGraph } from '../src/normalize/buildGraph';
import { layoutGraph } from '../src/layout/dagreLayout';
import type { RawData, RawNode, RawEdge } from '../src/normalize/readDb';

// Regression for the cross-review determinism findings: graph.json must be byte-identical
// regardless of DB row order. Exercises a `contains` CYCLE (descendants cycle-guard) and an
// equal-confidence duplicate `calls` edge (dedupe resolvedBy tie-break) — the two spots that
// were order-dependent before the fix.

function node(id: string, name: string, file: string): RawNode {
  return {
    id,
    kind: id.startsWith('file:') ? 'file' : 'function',
    name,
    qualified_name: name,
    file_path: file,
    language: 'typescript',
    start_line: 1,
    end_line: 5,
    is_exported: 1,
    is_async: 0,
    is_static: 0,
    is_abstract: 0,
  };
}

function rawCycle(): RawData {
  const nodes: RawNode[] = [
    node('file:a.ts', 'a.ts', 'a.ts'),
    node('file:b.ts', 'b.ts', 'b.ts'),
    node('file:c.ts', 'c.ts', 'c.ts'),
    node('function:f', 'f', 'a.ts'),
    node('function:g', 'g', 'b.ts'),
  ];
  const edges: RawEdge[] = [
    { source: 'file:a.ts', target: 'file:b.ts', kind: 'contains', metadata: null },
    { source: 'file:b.ts', target: 'file:c.ts', kind: 'contains', metadata: null },
    { source: 'file:c.ts', target: 'file:a.ts', kind: 'contains', metadata: null }, // CYCLE
    { source: 'function:f', target: 'function:g', kind: 'calls', metadata: JSON.stringify({ confidence: 0.9, resolvedBy: 'import' }) },
    { source: 'function:f', target: 'function:g', kind: 'calls', metadata: JSON.stringify({ confidence: 0.9, resolvedBy: 'exact-match' }) }, // equal-confidence dup
  ];
  return { nodes, edges, codegraphSchema: 4, latestMtime: 1_700_000_000_000 };
}

const OPTS = { repoName: 'cyc', repoHash: 'none', engineVersion: 't', toolVersion: '0.1.0' };

function build(raw: RawData): string {
  const g = buildGraph(raw, OPTS);
  layoutGraph(g.nodes, g.edges, g.meta.layout.rankdir);
  return canonicalize(g);
}

describe('order-independence (determinism regression)', () => {
  it('shuffled raw nodes/edges yield byte-identical output', () => {
    const a = rawCycle();
    const b: RawData = { ...a, nodes: [...a.nodes].reverse(), edges: [...a.edges].reverse() };
    expect(build(b)).toBe(build(a));
  });

  it('descendants is stable and cycle-safe (no infinite loop, no double count)', () => {
    const g = buildGraph(rawCycle(), OPTS);
    // each file in the 3-cycle reaches the other two distinct files via `contains`
    expect(g.nodes.find((n) => n.id === 'file:a.ts')!.metrics.descendants).toBe(2);
  });

  it('equal-confidence duplicate calls pick a deterministic resolvedBy', () => {
    const g = buildGraph(rawCycle(), OPTS);
    const e = g.edges.find((x) => x.id === 'function:f->function:g:calls')!;
    expect(e.weight).toBe(2);
    expect(e.resolvedBy).toBe('exact-match'); // 'exact-match' < 'import'
  });
});
