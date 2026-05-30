import { create } from 'zustand';
import type { GraphFile } from '@arch-viz/shared';
import { loadGraph } from '../load/loadGraph';

/** ≤ this many nodes → open fully expanded (small repo, readable). Above → start collapsed. */
export const DEFAULT_EXPAND_MAX = 80;
/** Visible member-node count above which we warn (VIEW-06 performance guardrail). */
export const WARN_THRESHOLD = 500;

export type KindKey = 'file' | 'class' | 'function';
export type KindFilter = Record<KindKey, boolean>;

interface Store {
  graph: GraphFile | null;
  status: 'loading' | 'ready' | 'error' | 'incompatible';
  error: string | null;

  selectedId: string | null;
  search: string;
  expanded: ReadonlySet<number>;
  kindFilter: KindFilter;

  init: () => Promise<void>;
  select: (id: string | null) => void;
  setSearch: (s: string) => void;
  toggleCluster: (id: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setKind: (k: KindKey, on: boolean) => void;
}

export const useStore = create<Store>((set, get) => ({
  graph: null,
  status: 'loading',
  error: null,
  selectedId: null,
  search: '',
  expanded: new Set<number>(),
  kindFilter: { file: true, class: true, function: true },

  init: async () => {
    set({ status: 'loading', error: null });
    const r = await loadGraph();
    if (r.status !== 'ready' || !r.graph) {
      set({ status: r.status, error: r.error ?? 'failed to load graph.json' });
      return;
    }
    const g = r.graph;
    const expanded =
      g.nodes.length <= DEFAULT_EXPAND_MAX
        ? new Set(g.clusters.map((c) => c.id))
        : new Set<number>();
    set({ graph: g, status: 'ready', expanded, error: null, selectedId: null });
  },

  select: (id) => {
    if (!id) {
      set({ selectedId: null });
      return;
    }
    const g = get().graph;
    const node = g?.nodes.find((n) => n.id === id);
    if (node) {
      const expanded = new Set(get().expanded);
      expanded.add(node.cluster); // reveal the selection
      set({ selectedId: id, expanded });
    } else {
      set({ selectedId: id });
    }
  },

  setSearch: (search) => set({ search }),
  toggleCluster: (id) => {
    const expanded = new Set(get().expanded);
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    set({ expanded });
  },
  expandAll: () => {
    const g = get().graph;
    if (g) set({ expanded: new Set(g.clusters.map((c) => c.id)) });
  },
  collapseAll: () => set({ expanded: new Set<number>() }),
  setKind: (k, on) => set({ kindFilter: { ...get().kindFilter, [k]: on } }),
}));
