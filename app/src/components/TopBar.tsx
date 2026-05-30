import type { GraphFile } from '@arch-viz/shared';
import { useStore, type KindKey } from '../state/store';

const KINDS: { key: KindKey; label: string }[] = [
  { key: 'file', label: 'files' },
  { key: 'function', label: 'fns' },
  { key: 'class', label: 'classes' },
];

export function TopBar({ graph }: { graph: GraphFile }) {
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const kindFilter = useStore((s) => s.kindFilter);
  const setKind = useStore((s) => s.setKind);
  const expandAll = useStore((s) => s.expandAll);
  const collapseAll = useStore((s) => s.collapseAll);

  const when = safeDate(graph.meta.generatedAt);

  return (
    <header className="av-topbar">
      <div className="av-brand">
        <span className="av-brand-mark">arch-viz<span className="av-brand-dot">.</span></span>
      </div>
      <span className="av-repo" title={graph.meta.sourceRepo}>{graph.meta.sourceRepo}</span>
      <div className="av-stats">
        <span><b>{graph.meta.counts.nodes}</b> nodes</span>
        <span><b>{graph.meta.counts.edges}</b> edges</span>
        <span><b>{graph.meta.counts.clusters}</b> clusters</span>
      </div>

      <div className="av-spacer" />

      <div className="av-chip-row">
        {KINDS.map((k) => (
          <span
            key={k.key}
            className={`av-toggle${kindFilter[k.key] ? ' on' : ''}`}
            onClick={() => setKind(k.key, !kindFilter[k.key])}
            title={`toggle ${k.label}`}
          >
            {k.label}
          </span>
        ))}
      </div>
      <button className="av-btn" onClick={collapseAll}>Collapse all</button>
      <button className="av-btn" onClick={expandAll}>Expand all</button>
      <input
        className="av-search"
        placeholder="search symbol / file…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        spellCheck={false}
      />
      <span className="av-stats" title={`${graph.meta.generator.engine} ${graph.meta.generator.engineVersion}`}>
        <span>{graph.meta.generator.engine} {graph.meta.generator.engineVersion}{when ? ` · ${when}` : ''}</span>
      </span>
    </header>
  );
}

function safeDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toISOString().slice(0, 10);
}
