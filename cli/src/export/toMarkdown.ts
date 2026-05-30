import type { GraphFile } from '@arch-viz/shared';
import { mdCell } from './escape';

/**
 * Human- and agent-readable ARCHITECTURE.md: provenance, a visible static-extraction
 * caveats block, the embedded SVG diagram, a cluster table, and the most-connected
 * nodes. Deterministic (generatedAt is mtime-derived) so re-export yields no diff.
 */
export function toMarkdown(graph: GraphFile): string {
  const m = graph.meta;
  const lines: string[] = [];

  lines.push(`# Architecture — ${mdCell(m.sourceRepo)}`);
  lines.push('');
  lines.push(
    `> \`${m.generator.name}\` v${m.generator.version} · engine ${mdCell(m.generator.engine)} ` +
      `${mdCell(m.generator.engineVersion)} · **${m.counts.nodes}** nodes · **${m.counts.edges}** edges · ` +
      `**${m.counts.clusters}** clusters · source \`${mdCell(m.sourceRepoHash)}\``,
  );
  lines.push('');
  lines.push('![Architecture diagram](./architecture.svg)');
  lines.push('');

  lines.push('## ⚠️ Static-extraction caveats');
  lines.push('');
  lines.push(
    '- Built by **static analysis** (tree-sitter via CodeGraph). It is an *over-approximation*: ' +
      'dynamic dispatch, reflection, and runtime wiring may be missing or imprecise.',
  );
  lines.push(
    '- `calls` edges and blast-radius are structural, not a runtime guarantee — verify in CodeGraph for critical decisions.',
  );
  lines.push('- Regenerate with `arch-viz scan` after code changes; do not hand-edit anything except `annotations`.');
  lines.push('');

  lines.push('## Clusters');
  lines.push('');
  lines.push('| # | Cluster | Nodes |');
  lines.push('|--:|---|--:|');
  for (const c of [...graph.clusters].sort((a, b) => a.id - b.id)) {
    lines.push(`| ${c.id} | ${mdCell(c.label)} | ${c.size} |`);
  }
  lines.push('');

  const hubs = [...graph.nodes]
    .sort(
      (a, b) =>
        b.metrics.fanIn + b.metrics.fanOut - (a.metrics.fanIn + a.metrics.fanOut) ||
        (a.id < b.id ? -1 : 1),
    )
    .slice(0, 12);
  lines.push('## Key nodes (by connectivity)');
  lines.push('');
  lines.push('| Symbol | Kind | Path | Fan-in | Fan-out |');
  lines.push('|---|---|---|--:|--:|');
  for (const n of hubs) {
    lines.push(
      `| \`${mdCell(n.label)}\` | ${n.kind} | \`${mdCell(n.path)}\` | ${n.metrics.fanIn} | ${n.metrics.fanOut} |`,
    );
  }
  lines.push('');
  lines.push(
    `*Schema ${m.schemaVersion} · generated ${mdCell(m.generatedAt)} · ` +
      `machine-readable graph in [graph.json](./graph.json) · open [viz/index.html](./viz/index.html) (no install).*`,
  );
  lines.push('');
  return lines.join('\n');
}
