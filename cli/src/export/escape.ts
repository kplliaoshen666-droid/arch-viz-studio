/**
 * Escaping for the handoff bundle. All code-derived text (labels, paths) flows from
 * arbitrary repos into committed SVG / Markdown / HTML files that get handed to clients,
 * so escaping here is a hard security boundary (EXPORT-04), not cosmetic.
 */

const LINE_SEP = new RegExp('\\u2028', 'g'); // U+2028 — kept ASCII in source on purpose
const PARA_SEP = new RegExp('\\u2029', 'g'); // U+2029

/** XML/SVG/HTML text-content escaping. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serialize a value for embedding inside `<script type="application/json">…</script>`.
 * Escaping every `<` makes a `</script>` (or `<!--`) break-out impossible while keeping
 * the text valid JSON (OWASP-recommended). Also neutralizes the JS line separators
 * U+2028 / U+2029.
 */
export function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEP, '\\u2028')
    .replace(PARA_SEP, '\\u2029');
}

/** Escape a value for a single Markdown table cell: no angle markup, no pipe break, no backtick break, single line. */
export function mdCell(s: string): string {
  return s
    .replace(/\r?\n/g, ' ')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([[\]()])/g, '\\$1') // neutralize markdown link / image syntax (![..](..) / [..](..))
    .replace(/\|/g, '\\|')
    .replace(/`/g, '');
}

/** Escape inline prose (headings, text) — not code spans or table cells. */
export function mdText(s: string): string {
  return s.replace(/\r?\n/g, ' ').replace(/([\\`*_[\]<>])/g, '\\$1');
}
