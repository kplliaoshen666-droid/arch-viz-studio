import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertValid, canonicalize, mergeAnnotations, validate } from '@arch-viz/shared';
import type { GraphFile } from '@arch-viz/shared';
import { ensureWithin } from '../security/paths';
import { toSvg } from '../export/toSvg';
import { toMarkdown } from '../export/toMarkdown';
import { toHtml } from '../export/toHtml';

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
  atomicWrite(outPath, text);
  return { outPath, merged };
}

function atomicWrite(path: string, text: string): void {
  // pid-suffixed tmp name so a maliciously pre-planted `<file>.tmp` symlink in the target
  // repo can't redirect the write; then atomic rename onto the final path.
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path); // atomic on the same volume
}

export interface BundleResult {
  outDir: string;
  merged: boolean;
  files: string[];
}

/**
 * Write the full committable bundle into the target's docs/architecture/ (path-fenced):
 * graph.json (annotations-merged + validated) + architecture.svg + ARCHITECTURE.md +
 * viz/index.html. Derived artifacts are built from the exact canonical on-disk graph so
 * the SVG / Markdown / HTML always agree with graph.json and re-export is byte-identical.
 */
export function writeBundle(graph: GraphFile, repoRoot: string, outDir: string): BundleResult {
  const safeDir = ensureWithin(repoRoot, outDir);
  const graphPath = join(safeDir, 'graph.json');

  let finalGraph = graph;
  let merged = false;
  if (existsSync(graphPath)) {
    try {
      const prev: unknown = JSON.parse(readFileSync(graphPath, 'utf8'));
      if (validate(prev).ok) {
        finalGraph = mergeAnnotations(prev as GraphFile, graph);
        merged = true;
      }
    } catch {
      // overwrite an unreadable / invalid prior file
    }
  }

  const graphText = canonicalize(finalGraph);
  assertValid(JSON.parse(graphText)); // emit gate
  const onDisk = JSON.parse(graphText) as GraphFile;

  const svgPath = join(safeDir, 'architecture.svg');
  const mdPath = join(safeDir, 'ARCHITECTURE.md');
  const vizDir = ensureWithin(repoRoot, join(safeDir, 'viz'));
  const htmlPath = join(vizDir, 'index.html');

  mkdirSync(safeDir, { recursive: true });
  mkdirSync(vizDir, { recursive: true });
  atomicWrite(graphPath, graphText);
  atomicWrite(svgPath, toSvg(onDisk));
  atomicWrite(mdPath, toMarkdown(onDisk));
  atomicWrite(htmlPath, toHtml(onDisk));

  return { outDir: safeDir, merged, files: [graphPath, svgPath, mdPath, htmlPath] };
}
