import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalizeGraph, validate } from '../src/index';
import type { GraphFile } from '../src/index';
import { makeSampleGraph } from './helpers';

describe('canonicalize (SCHEMA-02 determinism)', () => {
  it('is idempotent: canonicalize twice yields byte-identical text', () => {
    const s1 = canonicalize(makeSampleGraph());
    const s2 = canonicalize(JSON.parse(s1) as GraphFile);
    expect(s2).toBe(s1);
  });

  it('is order-independent: shuffled input yields identical output', () => {
    const g = makeSampleGraph();
    const shuffled: GraphFile = {
      ...g,
      nodes: [...g.nodes].reverse(),
      edges: [...g.edges].reverse(),
      clusters: [...g.clusters].reverse(),
    };
    expect(canonicalize(shuffled)).toBe(canonicalize(g));
  });

  it('ends with a trailing newline and uses 2-space indent', () => {
    const s = canonicalize(makeSampleGraph());
    expect(s.endsWith('}\n')).toBe(true);
    expect(s).toContain('\n  "meta": {');
  });

  it('rounds positions to 2dp and normalizes -0', () => {
    const g = makeSampleGraph();
    const id = g.nodes[0]!.id;
    g.nodes[0]!.position = { x: 12.3456789, y: -0 };
    const out = canonicalizeGraph(g);
    const n = out.nodes.find((x) => x.id === id)!;
    expect(n.position.x).toBe(12.35);
    expect(Object.is(n.position.y, 0)).toBe(true);
  });

  it('recomputes derived counts and cluster sizes', () => {
    const g = makeSampleGraph();
    g.meta.counts = { nodes: 999, edges: 999, clusters: 999 };
    g.clusters[0]!.size = 999;
    const out = canonicalizeGraph(g);
    expect(out.meta.counts).toEqual({ nodes: 4, edges: 3, clusters: 2 });
    expect(out.clusters.find((c) => c.id === 0)!.size).toBe(3);
  });

  it('canonical output still validates', () => {
    expect(validate(JSON.parse(canonicalize(makeSampleGraph()))).ok).toBe(true);
  });
});
