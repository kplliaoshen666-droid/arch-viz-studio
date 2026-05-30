import { useMemo } from 'react';
import type { GraphFile, GraphNode } from '@arch-viz/shared';
import { useStore } from '../state/store';
import { KIND_GLYPH } from '../render/colors';

interface FileEntry {
  file: GraphNode;
  symbols: GraphNode[];
}
interface DirEntry {
  dir: string;
  files: FileEntry[];
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i) : '.';
}

function buildTree(graph: GraphFile): DirEntry[] {
  const symbolsByPath = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) {
    if (n.kind === 'file') continue;
    const arr = symbolsByPath.get(n.path);
    if (arr) arr.push(n);
    else symbolsByPath.set(n.path, [n]);
  }
  const byDir = new Map<string, FileEntry[]>();
  for (const f of graph.nodes.filter((n) => n.kind === 'file')) {
    const entry: FileEntry = {
      file: f,
      symbols: (symbolsByPath.get(f.path) ?? []).slice().sort((a, b) => a.span.startLine - b.span.startLine),
    };
    const d = dirOf(f.path);
    const arr = byDir.get(d);
    if (arr) arr.push(entry);
    else byDir.set(d, [entry]);
  }
  return [...byDir.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([dir, files]) => ({
      dir,
      files: files.sort((a, b) => (a.file.label < b.file.label ? -1 : 1)),
    }));
}

export function TreePane() {
  const graph = useStore((s) => s.graph);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const search = useStore((s) => s.search).trim().toLowerCase();

  const tree = useMemo(() => (graph ? buildTree(graph) : []), [graph]);
  const colorOf = useMemo(
    () => new Map((graph?.clusters ?? []).map((c) => [c.id, c.color])),
    [graph],
  );

  if (!graph) return null;

  const matches = (n: GraphNode) =>
    !search || n.label.toLowerCase().includes(search) || n.path.toLowerCase().includes(search);

  return (
    <div className="av-tree">
      {tree.map((d) => {
        const files = d.files
          .map((fe) => ({
            ...fe,
            symbols: fe.symbols.filter(matches),
          }))
          .filter((fe) => matches(fe.file) || fe.symbols.length > 0);
        if (files.length === 0) return null;
        return (
          <div className="av-tree-group" key={d.dir}>
            <div className="av-tree-dir">▾ {d.dir}</div>
            {files.map((fe) => (
              <div key={fe.file.id}>
                <div
                  className={`av-tree-row${selectedId === fe.file.id ? ' sel' : ''}`}
                  style={{ paddingLeft: 16 }}
                  onClick={() => select(fe.file.id)}
                >
                  <span className="av-dot" style={{ background: colorOf.get(fe.file.cluster) ?? '#ccc' }} />
                  <span className="av-tree-name">{fe.file.label}</span>
                </div>
                {fe.symbols.map((s) => (
                  <div
                    key={s.id}
                    className={`av-tree-row${selectedId === s.id ? ' sel' : ''}`}
                    onClick={() => select(s.id)}
                    title={s.qualifiedName}
                  >
                    <span className="av-kind">{KIND_GLYPH[s.kind]}</span>
                    <span className="av-tree-name">{s.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
