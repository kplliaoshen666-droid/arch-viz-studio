import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertValid, canonicalize, mergeAnnotations, validate } from '@arch-viz/shared';
import type { GraphFile } from '@arch-viz/shared';
import { ensureWithin } from '../security/paths';

export interface EmitResult {
  outPath: string;
  /** true if annotations from a prior graph.json were carried forward. */
  merged: boolean;
}

/**
 * The only writer of graph.json. Confines the write to within the target repo
 * (CLI-05), carries forward annotations from any prior file (SCHEMA-03), runs the
 * canonical-then-validate emit gate, and writes atomically (tmp + rename).
 */
export function writeGraphFile(graph: GraphFile, repoRoot: string, outDir: string): EmitResult {
  const safeDir = ensureWithin(repoRoot, outDir);
  const outPath = join(safeDir, 'graph.json');

  let toWrite = graph;
  let merged = false;
  if (existsSync(outPath)) {
    try {
      const prev: unknown = JSON.parse(readFileSync(outPath, 'utf8'));
      if (validate(prev).ok) {
        toWrite = mergeAnnotations(prev as GraphFile, graph);
        merged = true;
      }
    } catch {
      // unreadable / invalid prior file — overwrite cleanly.
    }
  }

  const text = canonicalize(toWrite);
  assertValid(JSON.parse(text)); // never write an invalid artifact

  mkdirSync(safeDir, { recursive: true });
  const tmp = `${outPath}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, outPath); // atomic on the same volume
  return { outPath, merged };
}
