import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import type { ViewModel } from '../derive/viewModel';
import { toMermaid } from '../render/toMermaid';

// strict security + SVG <text> labels (no foreignObject HTML) → the rendered SVG is safe
// to inject, and our toMermaid() already escapes all repo-derived label text.
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', flowchart: { htmlLabels: false } });

let SEQ = 0;

export function DiagramPane({ vm }: { vm: ViewModel }) {
  const [open, setOpen] = useState(true);
  const src = useMemo(() => toMermaid(vm), [vm]);
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const id = `mmd-${SEQ++}`;
    mermaid
      .render(id, src)
      .then((r) => {
        if (alive) {
          setSvg(r.svg);
          setErr('');
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setErr(e instanceof Error ? e.message : String(e));
          setSvg('');
        }
      });
    return () => {
      alive = false;
    };
  }, [src, open]);

  return (
    <div>
      <div className="av-pane-head">
        Diagram · Mermaid
        <span className="count">{vm.nodes.length} shown</span>
        <span className="av-toggle" style={{ marginLeft: 10 }} onClick={() => setOpen((o) => !o)}>
          {open ? 'hide' : 'show'}
        </span>
      </div>
      {open && (
        <div className="av-diagram">
          <div className="av-diagram-src">{src}</div>
          <div className="av-diagram-preview">
            {err ? (
              <span className="av-empty">{err}</span>
            ) : (
              // mermaid-generated, securityLevel:strict, labels pre-escaped — safe to inject.
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
