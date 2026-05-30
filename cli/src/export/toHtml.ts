import type { GraphFile } from '@arch-viz/shared';
import { escapeJsonForScript, escapeXml } from './escape';
import { toSvg } from './toSvg';

// Static viewer JS. It reads the inlined JSON and renders ALL repo-derived text via
// textContent / setAttribute only — never innerHTML on code-derived strings — so a
// malicious symbol name cannot execute. (EXPORT-04 / Pitfall 6.)
const VIEWER_JS = String.raw`
(function () {
  var el = document.getElementById('arch-graph');
  if (!el) return;
  var data;
  try { data = JSON.parse(el.textContent || '{}'); } catch (e) { return; }
  var nodes = data.nodes || [];
  var edges = data.edges || [];
  var byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; });
  var detail = document.getElementById('detail');

  function row(label, onClick) {
    var d = document.createElement('div');
    d.className = 'rel';
    d.textContent = label;
    if (onClick) { d.style.cursor = 'pointer'; d.addEventListener('click', onClick); }
    return d;
  }
  function head(text) {
    var h = document.createElement('div'); h.className = 'sh'; h.textContent = text; return h;
  }

  function show(id) {
    var n = byId[id];
    if (!n) return;
    while (detail.firstChild) detail.removeChild(detail.firstChild);

    var title = document.createElement('div'); title.className = 'dt'; title.textContent = n.label;
    var path = document.createElement('div'); path.className = 'dp';
    path.textContent = n.path + ':' + (n.span ? n.span.startLine : '?') + '  ·  ' + n.kind;
    detail.appendChild(title); detail.appendChild(path);

    var mw = document.createElement('div'); mw.className = 'mw';
    [['fan-in', n.metrics.fanIn], ['fan-out', n.metrics.fanOut], ['lines', n.metrics.loc],
     ['contains', n.metrics.descendants]].forEach(function (p) {
      var m = document.createElement('div'); m.className = 'm';
      var v = document.createElement('div'); v.className = 'mv'; v.textContent = String(p[1]);
      var k = document.createElement('div'); k.className = 'mk'; k.textContent = p[0];
      m.appendChild(v); m.appendChild(k); mw.appendChild(m);
    });
    detail.appendChild(mw);

    var callers = [], callees = [], imports = [];
    edges.forEach(function (e) {
      if (e.kind === 'calls') {
        if (e.target === id && byId[e.source]) callers.push(byId[e.source]);
        if (e.source === id && byId[e.target]) callees.push(byId[e.target]);
      } else if (e.kind === 'imports' && e.source === id && byId[e.target]) imports.push(byId[e.target]);
    });
    function list(t, arr) {
      if (!arr.length) return;
      detail.appendChild(head(t + ' · ' + arr.length));
      arr.sort(function (a, b) { return a.label < b.label ? -1 : 1; }).forEach(function (m) {
        detail.appendChild(row(m.label, function () { highlight(m.id); show(m.id); }));
      });
    }
    list('Called by', callers); list('Calls', callees); list('Imports', imports);
  }

  function highlight(id) {
    document.querySelectorAll('#diagram g[data-id]').forEach(function (g) {
      var on = g.getAttribute('data-id') === id;
      g.querySelectorAll('rect').forEach(function (r, i) {
        if (i === 0) r.setAttribute('stroke-width', on ? '3' : '1.5');
      });
    });
  }

  document.querySelectorAll('#diagram g[data-id]').forEach(function (g) {
    g.style.cursor = 'pointer';
    g.addEventListener('click', function () { var id = g.getAttribute('data-id'); highlight(id); show(id); });
  });
})();
`;

/**
 * Self-contained, dependency-free, read-only viewer: the deterministic SVG + an inlined
 * graph.json blob + a tiny vanilla-JS inspector. Opens from file:// with no server, no
 * install, no arch-viz-studio present — the artifact you hand to a client or teammate.
 */
export function toHtml(graph: GraphFile): string {
  const m = graph.meta;
  const repo = escapeXml(m.sourceRepo);
  const prov = escapeXml(
    `${m.generator.engine} ${m.generator.engineVersion} · ${m.counts.nodes} nodes · ` +
      `${m.counts.edges} edges · ${m.counts.clusters} clusters · ${m.sourceRepoHash}`,
  );
  const svg = toSvg(graph);
  const json = escapeJsonForScript(graph);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>arch-viz · ${repo}</title>
<style>
  :root { --line:#e7e6e3; --ink:#1c1c1f; --muted:#8a8a93; --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:var(--ink); background:#f6f6f4; }
  header { display:flex; align-items:baseline; gap:14px; padding:12px 18px; background:#fff; border-bottom:1px solid var(--line); flex-wrap:wrap; }
  header .b { font-weight:700; letter-spacing:-.02em; } header .b span { color:#3b6fe0; }
  header .r { font-family:var(--mono); font-size:12.5px; background:#fbfbfa; border:1px solid var(--line); border-radius:7px; padding:2px 9px; }
  header .p { color:var(--muted); font-size:12px; }
  main { display:flex; height:calc(100vh - 52px); }
  #diagram { flex:1; overflow:auto; padding:20px; }
  #diagram svg { max-width:none; }
  aside { width:330px; border-left:1px solid var(--line); background:#fff; overflow:auto; padding:16px; }
  .dt { font-family:var(--mono); font-size:16px; font-weight:700; word-break:break-word; }
  .dp { font-family:var(--mono); font-size:11.5px; color:var(--muted); margin-top:3px; word-break:break-all; }
  .mw { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:14px 0; }
  .m { background:#fbfbfa; border:1px solid var(--line); border-radius:9px; padding:9px 11px; }
  .mv { font-size:19px; font-weight:700; } .mk { font-size:10.5px; color:var(--muted); }
  .sh { font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin:14px 0 6px; }
  .rel { font-family:var(--mono); font-size:12px; color:#45454b; padding:4px 8px; border-radius:7px; }
  .rel:hover { background:#fbfbfa; color:var(--ink); }
  .empty { color:var(--muted); font-size:12.5px; }
</style>
</head>
<body>
<header>
  <span class="b">arch-viz<span>.</span></span>
  <span class="r">${repo}</span>
  <span class="p">${prov}</span>
</header>
<main>
  <div id="diagram">${svg}</div>
  <aside id="detail"><div class="empty">Click any node in the diagram to inspect its callers, callees, and metrics.</div></aside>
</main>
<script type="application/json" id="arch-graph">${json}</script>
<script>${VIEWER_JS}</script>
</body>
</html>
`;
}
