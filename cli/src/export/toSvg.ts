import type { GraphFile, GraphNode } from '@arch-viz/shared';
import { escapeXml } from './escape';

const NODE_H = 36;
const MARGIN = 44;
const FALLBACK = '#9ca3af';

function nodeWidth(label: string): number {
  return Math.min(280, Math.max(82, Math.round(label.length * 7.2 + 26)));
}
function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const EDGE_STROKE: Record<string, string> = {
  calls: '#b7a8e6',
  imports: '#9bb8da',
  contains: '#d6d5d1',
};

/**
 * Deterministic, hand-rolled SVG built from graph.json coordinates + cluster colors.
 * Small, diff-friendly, faithful to the on-screen layout, and identical on re-export
 * (no timestamps, sorted iteration). All code-derived text is XML-escaped (EXPORT-04).
 * Node groups carry data-id so the self-contained HTML viewer can hook click-to-inspect.
 */
export function toSvg(graph: GraphFile): string {
  const nodes = [...graph.nodes].sort(byId);
  const edges = [...graph.edges].sort(byId);
  const colorOf = new Map(graph.clusters.map((c) => [c.id, c.color]));
  const center = new Map(nodes.map((n) => [n.id, n.position]));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const w = nodeWidth(n.label);
    minX = Math.min(minX, n.position.x - w / 2);
    maxX = Math.max(maxX, n.position.x + w / 2);
    minY = Math.min(minY, n.position.y - NODE_H / 2);
    maxY = Math.max(maxY, n.position.y + NODE_H / 2);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 200;
    maxY = 120;
  }

  const legendRows = Math.max(1, graph.clusters.length);
  const legendH = 14 + legendRows * 20;
  const ox = MARGIN - minX;
  const oy = MARGIN - minY;
  const width = Math.round(maxX - minX + MARGIN * 2);
  const graphH = Math.round(maxY - minY + MARGIN * 2);
  const height = graphH + legendH;

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`,
  );
  out.push(
    '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" ' +
      'orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#b3b2ae"/></marker></defs>',
  );
  out.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);

  // edges
  for (const e of edges) {
    const s = center.get(e.source);
    const t = center.get(e.target);
    if (!s || !t) continue;
    const x1 = round(s.x + ox);
    const y1 = round(s.y + oy);
    const x2 = round(t.x + ox);
    const y2 = round(t.y + oy);
    const stroke = EDGE_STROKE[e.kind] ?? FALLBACK;
    const dash = e.kind === 'contains' ? ' stroke-dasharray="3 4"' : '';
    out.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.3"${dash} marker-end="url(#arr)"/>`,
    );
  }

  // nodes
  for (const n of nodes) {
    const w = nodeWidth(n.label);
    const x = round(n.position.x + ox - w / 2);
    const y = round(n.position.y + oy - NODE_H / 2);
    const color = colorOf.get(n.cluster) ?? FALLBACK;
    const label = escapeXml(truncate(n.label, 30));
    out.push(`<g data-id="${escapeXml(n.id)}">`);
    out.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${NODE_H}" rx="8" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>`,
    );
    out.push(`<rect x="${x}" y="${y}" width="4" height="${NODE_H}" rx="2" fill="${color}"/>`);
    out.push(
      `<text x="${x + w / 2}" y="${y + NODE_H / 2 + 4}" text-anchor="middle" font-size="12" fill="#1c1c1f">${label}</text>`,
    );
    out.push('</g>');
  }

  // legend
  const ly0 = graphH + 4;
  out.push(`<line x1="0" y1="${graphH}" x2="${width}" y2="${graphH}" stroke="#eceae6"/>`);
  graph.clusters
    .slice()
    .sort((a, b) => a.id - b.id)
    .forEach((c, i) => {
      const ly = ly0 + 16 + i * 20;
      out.push(`<rect x="${MARGIN}" y="${ly - 9}" width="11" height="11" rx="3" fill="${c.color}"/>`);
      out.push(
        `<text x="${MARGIN + 18}" y="${ly}" font-size="11" fill="#45454b">${escapeXml(
          truncate(c.label, 40),
        )} · ${c.size}</text>`,
      );
    });

  out.push('</svg>');
  out.push('');
  return out.join('\n');
}

function round(n: number): number {
  const r = Math.round(n);
  return Object.is(r, -0) ? 0 : r;
}
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
