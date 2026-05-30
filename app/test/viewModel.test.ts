import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { GraphFile } from '@arch-viz/shared';
import { computeView } from '../src/derive/viewModel';
import type { ArchNodeData } from '../src/derive/viewModel';

const here = dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(
  readFileSync(join(here, '..', 'public', 'graph.json'), 'utf8'),
) as GraphFile;

const ALL_KINDS = { file: true, class: true, function: true };
const ALL_CLUSTERS = new Set(graph.clusters.map((c) => c.id));

describe('computeView (anti-hairball)', () => {
  it('all collapsed → only cluster super-nodes, zero members', () => {
    const vm = computeView({ graph, expanded: new Set(), kindFilter: ALL_KINDS, selectedId: null });
    expect(vm.visibleMemberCount).toBe(0);
    expect(vm.nodes.length).toBe(graph.clusters.length);
    expect(vm.nodes.every((n) => n.type === 'cluster')).toBe(true);
  });

  it('all expanded → every member, no cluster nodes', () => {
    const vm = computeView({ graph, expanded: ALL_CLUSTERS, kindFilter: ALL_KINDS, selectedId: null });
    expect(vm.visibleMemberCount).toBe(graph.nodes.length);
    expect(vm.nodes.every((n) => n.type === 'arch')).toBe(true);
  });

  it('kind filter hides files within expanded clusters', () => {
    const fileCount = graph.nodes.filter((n) => n.kind === 'file').length;
    const vm = computeView({
      graph,
      expanded: ALL_CLUSTERS,
      kindFilter: { file: false, class: true, function: true },
      selectedId: null,
    });
    expect(vm.visibleMemberCount).toBe(graph.nodes.length - fileCount);
  });

  it('flags the selected node', () => {
    const id = graph.nodes[0]!.id;
    const vm = computeView({ graph, expanded: ALL_CLUSTERS, kindFilter: ALL_KINDS, selectedId: id });
    const sel = vm.nodes.find((n) => n.id === id);
    expect((sel!.data as ArchNodeData).selected).toBe(true);
  });

  it('never emits self-loop edges between representatives', () => {
    const collapsed = computeView({ graph, expanded: new Set(), kindFilter: ALL_KINDS, selectedId: null });
    expect(collapsed.edges.every((e) => e.source !== e.target)).toBe(true);
  });
});
