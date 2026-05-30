import { isCompatible, validate } from '@arch-viz/shared';
import type { GraphFile } from '@arch-viz/shared';

declare global {
  interface Window {
    /** set by the self-contained bundle (Phase 4); absent in dev. */
    __ARCH_GRAPH__?: unknown;
  }
}

export type LoadStatus = 'ready' | 'error' | 'incompatible';

export interface LoadResult {
  status: LoadStatus;
  graph?: GraphFile;
  error?: string;
}

/**
 * Load graph.json. Prefers the inlined blob (self-contained viewer opened from file://),
 * falls back to fetching a sibling file in dev. Always validates and refuses an
 * incompatible schema major rather than rendering garbage.
 */
export async function loadGraph(): Promise<LoadResult> {
  let data: unknown;
  if (typeof window !== 'undefined' && window.__ARCH_GRAPH__ !== undefined) {
    data = window.__ARCH_GRAPH__;
  } else {
    try {
      const res = await fetch('./graph.json');
      if (!res.ok) return { status: 'error', error: `graph.json not found (HTTP ${res.status})` };
      data = await res.json();
    } catch (e) {
      return { status: 'error', error: e instanceof Error ? e.message : String(e) };
    }
  }

  const result = validate(data);
  if (!result.ok) {
    return { status: 'error', error: 'Invalid graph.json:\n' + result.errors.slice(0, 6).join('\n') };
  }
  if (!isCompatible(data as GraphFile)) {
    return {
      status: 'incompatible',
      error: 'graph.json was produced by an incompatible schema major — re-run `arch-viz scan`.',
    };
  }
  return { status: 'ready', graph: data as GraphFile };
}
