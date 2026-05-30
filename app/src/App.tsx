import { useEffect, useMemo } from 'react';
import { useStore } from './state/store';
import { computeView, type ViewModel } from './derive/viewModel';
import { TopBar } from './components/TopBar';
import { TreePane } from './panes/TreePane';
import { GraphPane } from './panes/GraphPane';
import { DetailPane } from './panes/DetailPane';
import { DiagramPane } from './panes/DiagramPane';

const EMPTY_VM: ViewModel = { nodes: [], edges: [], visibleMemberCount: 0 };

export function App() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const graph = useStore((s) => s.graph);
  const init = useStore((s) => s.init);
  const expanded = useStore((s) => s.expanded);
  const kindFilter = useStore((s) => s.kindFilter);
  const selectedId = useStore((s) => s.selectedId);

  useEffect(() => {
    void init();
  }, [init]);

  const vm = useMemo(
    () => (graph ? computeView({ graph, expanded, kindFilter, selectedId }) : EMPTY_VM),
    [graph, expanded, kindFilter, selectedId],
  );

  if (status === 'loading') {
    return <div className="av-center">Loading graph.json…</div>;
  }
  if (status !== 'ready' || !graph) {
    return (
      <div className="av-center" data-testid="app-error">
        <b>Could not load graph.json</b>
        <pre className="mono" style={{ fontSize: 12, color: '#8a8a93', maxWidth: 520, whiteSpace: 'pre-wrap' }}>
          {error}
        </pre>
        <span style={{ fontSize: 12, color: '#8a8a93' }}>
          Run <code className="mono">arch-viz scan &lt;repo&gt;</code> and serve its docs/architecture/graph.json.
        </span>
      </div>
    );
  }

  return (
    <div className="av-app" data-testid="app-shell">
      <TopBar graph={graph} />
      <div className="av-main">
        <aside className="av-col av-col-left" data-testid="pane-structure">
          <div className="av-pane-head">Structure</div>
          <div className="av-scroll">
            <TreePane />
          </div>
        </aside>
        <section className="av-col av-col-center" data-testid="pane-graph">
          <GraphPane vm={vm} />
        </section>
        <aside className="av-col av-col-right" data-testid="pane-inspector">
          <div className="av-pane-head">Inspector</div>
          <div className="av-scroll">
            <DetailPane />
          </div>
        </aside>
      </div>
      <div className="av-bottom" data-testid="pane-diagram">
        <DiagramPane vm={vm} />
      </div>
    </div>
  );
}
