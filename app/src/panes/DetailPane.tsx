import { useMemo } from 'react';
import type { GraphFile, GraphNode } from '@arch-viz/shared';
import { useStore } from '../state/store';
import { KIND_GLYPH } from '../render/colors';

interface Rel {
  node: GraphNode;
  weight: number;
}

function relations(graph: GraphFile, id: string) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const callers: Rel[] = [];
  const callees: Rel[] = [];
  const imports: Rel[] = [];
  const contains: Rel[] = [];
  const reverseCalls = new Map<string, string[]>();

  for (const e of graph.edges) {
    if (e.kind === 'calls') {
      (reverseCalls.get(e.target) ?? reverseCalls.set(e.target, []).get(e.target)!).push(e.source);
      if (e.target === id) {
        const n = byId.get(e.source);
        if (n) callers.push({ node: n, weight: e.weight });
      }
      if (e.source === id) {
        const n = byId.get(e.target);
        if (n) callees.push({ node: n, weight: e.weight });
      }
    } else if (e.kind === 'imports' && e.source === id) {
      const n = byId.get(e.target);
      if (n) imports.push({ node: n, weight: e.weight });
    } else if (e.kind === 'contains' && e.source === id) {
      const n = byId.get(e.target);
      if (n) contains.push({ node: n, weight: e.weight });
    }
  }

  // transitive caller impact (reverse calls BFS)
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const src of reverseCalls.get(cur) ?? []) {
      if (!seen.has(src)) {
        seen.add(src);
        queue.push(src);
      }
    }
  }
  const impact = seen.size - 1;
  const sortRel = (r: Rel[]) => r.sort((a, b) => (a.node.label < b.node.label ? -1 : 1));
  return { callers: sortRel(callers), callees: sortRel(callees), imports: sortRel(imports), contains: sortRel(contains), impact };
}

function RelList({ title, items }: { title: string; items: Rel[] }) {
  const select = useStore((s) => s.select);
  if (items.length === 0) return null;
  return (
    <>
      <div className="av-section-h">{title} · {items.length}</div>
      {items.map((r) => (
        <div className="av-rel" key={r.node.id} onClick={() => select(r.node.id)} title={r.node.qualifiedName}>
          <span style={{ color: '#8a8a93', fontWeight: 700 }}>{KIND_GLYPH[r.node.kind]}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.node.label}</span>
          {r.weight > 1 && <span className="w">×{r.weight}</span>}
        </div>
      ))}
    </>
  );
}

export function DetailPane() {
  const graph = useStore((s) => s.graph);
  const selectedId = useStore((s) => s.selectedId);
  const sel = useMemo(
    () => (graph && selectedId ? graph.nodes.find((n) => n.id === selectedId) ?? null : null),
    [graph, selectedId],
  );
  const rel = useMemo(
    () => (graph && sel ? relations(graph, sel.id) : null),
    [graph, sel],
  );

  if (!graph) return null;
  if (!sel || !rel) {
    return <div className="av-empty">Select a node to inspect its signature, callers, callees, and blast radius.</div>;
  }

  const flags = (['exported', 'async', 'static', 'abstract'] as const).filter((f) => sel.flags[f]);
  const cluster = graph.clusters.find((c) => c.id === sel.cluster);

  return (
    <div className="av-detail">
      <div className="av-detail-title">
        <span style={{ color: cluster?.color ?? '#8a8a93' }}>{KIND_GLYPH[sel.kind]}</span>
        {sel.label}
      </div>
      <div className="av-detail-path">{sel.path}:{sel.span.startLine}</div>

      <div className="av-badges">
        <span className="av-badge">{sel.kind}</span>
        {cluster && <span className="av-badge" style={{ borderColor: cluster.color }}>◍ {cluster.label}</span>}
        {flags.map((f) => <span key={f} className="av-badge on">{f}</span>)}
      </div>

      <div className="av-metrics">
        <div className="av-metric"><div className="v">{sel.metrics.fanIn}</div><div className="k">callers (fan-in)</div></div>
        <div className="av-metric"><div className="v">{sel.metrics.fanOut}</div><div className="k">callees (fan-out)</div></div>
        <div className="av-metric"><div className="v">{sel.metrics.loc}</div><div className="k">lines</div></div>
        <div className="av-metric"><div className="v">{rel.impact}</div><div className="k">blast radius</div></div>
      </div>

      <RelList title="Called by" items={rel.callers} />
      <RelList title="Calls" items={rel.callees} />
      <RelList title="Imports" items={rel.imports} />
      <RelList title="Contains" items={rel.contains} />

      {sel.annotations && (
        <>
          <div className="av-section-h">Annotation</div>
          <div style={{ fontSize: 12.5, color: '#45454b', whiteSpace: 'pre-wrap' }}>{sel.annotations}</div>
        </>
      )}

      <div className="av-note">
        Static extraction — callers / callees / blast radius are an over-approximation. Verify against CodeGraph for runtime-dispatched calls.
      </div>
    </div>
  );
}
