// Phase 1 proof that the CLI side compiles against the shared contract (SCHEMA-04).
// Phase 2 replaces this file with the real scan → normalize → layout → emit pipeline.
import { assertValid, canonicalize, SCHEMA_VERSION } from '@arch-viz/shared';
import type { GraphFile } from '@arch-viz/shared';

/** The CLI's emit gate, in miniature: validate, then write canonical bytes. */
export function emitGraphText(graph: GraphFile): string {
  graph.meta.schemaVersion = SCHEMA_VERSION;
  const text = canonicalize(graph);
  assertValid(JSON.parse(text));
  return text;
}
