import { describe, it, expect } from 'vitest';
import { dedupeEdges, type PreEdge } from '../src/normalize/dedupeEdges';

describe('dedupeEdges', () => {
  it('collapses duplicate (source,target,kind) into a weight and keeps max confidence', () => {
    const pre: PreEdge[] = [
      { source: 'a', target: 'b', kind: 'calls', confidence: 0.8, resolvedBy: 'import' },
      { source: 'a', target: 'b', kind: 'calls', confidence: 0.95, resolvedBy: 'exact-match' },
      { source: 'a', target: 'b', kind: 'calls', confidence: 0.9, resolvedBy: 'import' },
    ];
    const out = dedupeEdges(pre);
    expect(out).toHaveLength(1);
    expect(out[0]!.weight).toBe(3);
    expect(out[0]!.confidence).toBe(0.95);
    expect(out[0]!.resolvedBy).toBe('exact-match');
    expect(out[0]!.id).toBe('a->b:calls');
  });

  it('keeps distinct kinds between the same pair separate', () => {
    const pre: PreEdge[] = [
      { source: 'a', target: 'b', kind: 'calls', confidence: 0.9, resolvedBy: 'x' },
      { source: 'a', target: 'b', kind: 'imports', confidence: 0.9, resolvedBy: 'x' },
    ];
    expect(dedupeEdges(pre)).toHaveLength(2);
  });
});
