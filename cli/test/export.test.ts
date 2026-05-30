import { describe, it, expect } from 'vitest';
import { validate } from '@arch-viz/shared';
import type { GraphFile } from '@arch-viz/shared';
import { escapeJsonForScript, escapeXml, mdCell } from '../src/export/escape';
import { toSvg } from '../src/export/toSvg';
import { toMarkdown } from '../src/export/toMarkdown';
import { toHtml } from '../src/export/toHtml';

// A symbol/path/label that tries to break out of SVG text, an HTML script blob, and a
// Markdown cell all at once. Schema-valid data (arbitrary strings are allowed) — so the
// exporters MUST neutralize it (EXPORT-04), not the schema.
const XSS = '</script><svg onload=alert(1)>"\'&|`x';

function adversarialGraph(): GraphFile {
  return {
    meta: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-01-01T00:00:00.000Z',
      sourceRepo: XSS,
      sourceRepoHash: 'none',
      generator: {
        name: 'arch-viz',
        version: '0.1.0',
        engine: 'codegraph',
        engineVersion: '0.9.4',
        codegraphSchema: 4,
        codegraphDbHash: 'sha256:0',
      },
      counts: { nodes: 1, edges: 0, clusters: 1 },
      layout: { algo: 'dagre', rankdir: 'LR', version: 1 },
      clustering: { algo: 'louvain', seed: 42, resolution: 1 },
    },
    nodes: [
      {
        id: 'function:evil',
        kind: 'function',
        label: XSS,
        qualifiedName: XSS,
        path: XSS,
        lang: 'typescript',
        span: { startLine: 1, endLine: 1 },
        cluster: 0,
        flags: { exported: false, async: false, static: false, abstract: false },
        metrics: { loc: 1, fanIn: 0, fanOut: 0, descendants: 0 },
        position: { x: 0, y: 0 },
        annotations: XSS,
      },
    ],
    edges: [],
    clusters: [
      { id: 0, label: XSS, color: '#4f8cff', nodeIds: ['function:evil'], size: 1, annotations: null },
    ],
  };
}

describe('escape helpers', () => {
  it('escapeXml neutralizes angle brackets and quotes', () => {
    expect(escapeXml('</script>')).toBe('&lt;/script&gt;');
    expect(escapeXml(`a"b'c&d`)).toBe('a&quot;b&#39;c&amp;d');
  });

  it('escapeJsonForScript escapes every < but preserves spaces (regression)', () => {
    const out = escapeJsonForScript({ a: '</script> and a b c' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c/script>');
    expect(out).toContain('a b c'); // spaces MUST survive — guards the U+2028 regex bug
  });

  it('mdCell escapes pipes and strips backticks', () => {
    expect(mdCell('a|b`c')).toBe('a\\|bc');
  });
});

describe('toSvg (EXPORT-04 escaping + EXPORT-01 determinism)', () => {
  it('the adversarial graph is itself schema-valid', () => {
    expect(validate(adversarialGraph()).ok).toBe(true);
  });

  it('escapes code-derived text — no markup break-out', () => {
    const svg = toSvg(adversarialGraph());
    expect(svg).not.toContain('</script>');
    expect(svg).not.toContain('<svg onload'); // injected tag never forms
    expect(svg).toContain('&lt;'); // payload was escaped
    expect(svg.startsWith('<svg xmlns=')).toBe(true); // our own root tag is intact
  });

  it('is deterministic', () => {
    expect(toSvg(adversarialGraph())).toBe(toSvg(adversarialGraph()));
  });
});

describe('toHtml (EXPORT-03 self-contained + EXPORT-04 escaping)', () => {
  const html = toHtml(adversarialGraph());

  it('the inlined JSON blob contains no raw "<" (cannot break the script tag)', () => {
    const m = /<script type="application\/json" id="arch-graph">([\s\S]*?)<\/script>/.exec(html);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain('<'); // every < was escaped to <
    expect(m![1]).toContain('\\u003c');
  });

  it('never emits the raw injected markup', () => {
    // No executable tag can form: `<svg ...` only appears as our own root, never from data.
    expect(html).not.toContain('<svg onload');
    expect(html).not.toContain('</script><svg');
  });

  it('is self-contained and deterministic', () => {
    expect(html).toContain('<script type="application/json" id="arch-graph">');
    expect(html).not.toContain('fetch('); // no network dependency
    expect(toHtml(adversarialGraph())).toBe(html);
  });
});

describe('toMarkdown (EXPORT-02)', () => {
  it('renders without throwing on adversarial input and escapes the repo name', () => {
    const md = toMarkdown(adversarialGraph());
    expect(md).toContain('# Architecture —');
    expect(md).toContain('Static-extraction caveats');
    expect(md).not.toContain('<svg onload'); // angle markup escaped by mdText/mdCell
  });
});
