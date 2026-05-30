import { describe, it, expect } from 'vitest';
import { mergeAnnotations, canonicalize, validate } from '../src/index';
import { makeSampleGraph, ADD_ID } from './helpers';

describe('mergeAnnotations (SCHEMA-03 agent round-trip)', () => {
  it('preserves a hand-edited annotation by id across a re-scan', () => {
    // Previous graph: an agent annotated the `add` node.
    const prev = makeSampleGraph();
    const i = prev.nodes.findIndex((n) => n.id === ADD_ID);
    prev.nodes[i] = { ...prev.nodes[i]!, annotations: 'Agent note: pure, no side effects.' };

    // Fresh scan: same ids, annotations reset to null.
    const next = makeSampleGraph();
    const merged = mergeAnnotations(prev, next);

    const node = merged.nodes.find((n) => n.id === ADD_ID)!;
    expect(node.annotations).toBe('Agent note: pure, no side effects.');
    expect(validate(merged).ok).toBe(true);
  });

  it('does not clobber an annotation the fresh scan already set', () => {
    const prev = makeSampleGraph();
    let i = prev.nodes.findIndex((n) => n.id === ADD_ID);
    prev.nodes[i] = { ...prev.nodes[i]!, annotations: 'old' };

    const next = makeSampleGraph();
    i = next.nodes.findIndex((n) => n.id === ADD_ID);
    next.nodes[i] = { ...next.nodes[i]!, annotations: 'new' };

    const merged = mergeAnnotations(prev, next);
    expect(merged.nodes.find((n) => n.id === ADD_ID)!.annotations).toBe('new');
  });

  it('does not mutate its inputs (immutability)', () => {
    const prev = makeSampleGraph();
    const i = prev.nodes.findIndex((n) => n.id === ADD_ID);
    prev.nodes[i] = { ...prev.nodes[i]!, annotations: 'note' };
    const next = makeSampleGraph();
    mergeAnnotations(prev, next);
    expect(next.nodes.find((n) => n.id === ADD_ID)!.annotations).toBeNull();
  });

  it('merged output is still canonical/stable', () => {
    const prev = makeSampleGraph();
    const i = prev.nodes.findIndex((n) => n.id === ADD_ID);
    prev.nodes[i] = { ...prev.nodes[i]!, annotations: 'note' };
    const merged = mergeAnnotations(prev, makeSampleGraph());
    expect(canonicalize(merged)).toBe(canonicalize(JSON.parse(canonicalize(merged))));
  });
});
