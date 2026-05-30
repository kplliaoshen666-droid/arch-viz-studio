import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCompatible, validate } from '@arch-viz/shared';
import type { GraphFile } from '@arch-viz/shared';
import { resolveCodegraph } from '../src/scan/runCodegraph';
// Build the REAL shippable bundle, then drive it as a subprocess — this exercises exactly what
// `npm i -g` ships and what an agent/user invokes, not the internal modules.
import { buildCli } from '../../scripts/build-cli.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const BUNDLE = join(repoRoot, 'cli', 'dist', 'arch-viz.mjs');

// A real `arch-viz scan` needs the CodeGraph CLI installed. Skip cleanly where it isn't (e.g. CI
// that hasn't installed it) rather than failing — the unit suites cover normalize/emit offline.
// Detect it exactly the way the CLI resolves it (locate the package + its JS bin), so this matches
// real-command behavior on every platform instead of probing the bare `.cmd` shim that Node's
// execFile cannot run on Windows.
function hasCodegraph(): boolean {
  try {
    resolveCodegraph(repoRoot, false);
    return true;
  } catch {
    return false;
  }
}
const CODEGRAPH = hasCodegraph();

/** Run the bundled CLI the way an agent/user would: a real `node arch-viz.mjs …` subprocess. */
function archViz(args: string[], cwd: string): string {
  return execFileSync('node', [BUNDLE, ...args], { cwd, encoding: 'utf8', windowsHide: true });
}

/** A minimal but non-trivial TS repo: two files, an import edge, and call edges. */
function writeFixture(dir: string): void {
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(
    join(dir, 'src', 'math.ts'),
    'export function add(a: number, b: number) {\n  return a + b\n}\n' +
      'export function mul(a: number, b: number) {\n  return a * b\n}\n',
  );
  writeFileSync(
    join(dir, 'src', 'index.ts'),
    "import { add, mul } from './math'\n\n" +
      'export function total() {\n  return add(mul(2, 3), 4)\n}\n\n' +
      'export const result = total()\n',
  );
}

function freshRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'archviz-contract-'));
  writeFixture(dir);
  return dir;
}

const bundleDir = (repo: string): string => join(repo, 'docs', 'architecture');
const readGraph = (repo: string): GraphFile =>
  JSON.parse(readFileSync(join(bundleDir(repo), 'graph.json'), 'utf8')) as GraphFile;

const SCAN_TIMEOUT = 90_000;

describe.skipIf(!CODEGRAPH)('prompt-driven CLI contract — real `arch-viz scan`', () => {
  beforeAll(async () => {
    await buildCli({ quiet: true });
  }, 60_000);

  it(
    'produces the full agent-readable bundle from a real command',
    () => {
      const repo = freshRepo();
      try {
        archViz(['scan', repo], repo);
        for (const f of ['graph.json', 'architecture.svg', 'ARCHITECTURE.md', join('viz', 'index.html')]) {
          expect(existsSync(join(bundleDir(repo), f)), `${f} written`).toBe(true);
        }
        const graph = readGraph(repo) as unknown;
        const res = validate(graph);
        expect(res.ok, res.ok ? '' : res.errors.join('\n')).toBe(true);
        expect(isCompatible(graph as GraphFile)).toBe(true);
        expect((graph as GraphFile).nodes.length).toBeGreaterThan(0);
        expect((graph as GraphFile).edges.length).toBeGreaterThan(0);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    },
    SCAN_TIMEOUT,
  );

  it(
    'is deterministic — re-running the command is byte-identical (CLI-01)',
    () => {
      const repo = freshRepo();
      try {
        const gp = join(bundleDir(repo), 'graph.json');
        archViz(['scan', repo], repo);
        const first = readFileSync(gp);
        archViz(['scan', repo], repo);
        const second = readFileSync(gp);
        expect(second.equals(first), 'graph.json must be byte-identical on re-scan').toBe(true);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    },
    SCAN_TIMEOUT,
  );

  it(
    'defaults the scan target to the current directory (cd into a repo, just `arch-viz scan`)',
    () => {
      const repo = freshRepo();
      try {
        archViz(['scan'], repo); // NO repo argument → scans cwd
        expect(existsSync(join(bundleDir(repo), 'graph.json'))).toBe(true);
        expect(readGraph(repo).nodes.length).toBeGreaterThan(0);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    },
    SCAN_TIMEOUT,
  );

  it(
    'carries an agent-authored annotation across a re-scan, matched by stable id (SCHEMA-03)',
    () => {
      const repo = freshRepo();
      try {
        const gp = join(bundleDir(repo), 'graph.json');
        archViz(['scan', repo], repo);

        // An agent opens graph.json and annotates a node by its stable (content-hash) id.
        const g1 = readGraph(repo);
        const targetId = g1.nodes[0].id;
        const note = 'agent-note: scanned entry point';
        g1.nodes[0] = { ...g1.nodes[0], annotations: note };
        writeFileSync(gp, JSON.stringify(g1, null, 2));

        // Re-scan: the annotation must survive (merged by id), not be clobbered.
        archViz(['scan', repo], repo);
        const carried = readGraph(repo).nodes.find((n) => n.id === targetId);
        expect(carried?.annotations).toBe(note);
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    },
    SCAN_TIMEOUT,
  );

  it(
    'emits a self-contained, dependency-free viewer that opens from file://',
    () => {
      const repo = freshRepo();
      try {
        archViz(['scan', repo], repo);
        const html = readFileSync(join(bundleDir(repo), 'viz', 'index.html'), 'utf8');
        expect(html).toContain('id="arch-graph"'); // graph.json inlined
        expect(html).not.toContain('fetch('); // no network round-trip
        expect(html).not.toMatch(/<script[^>]*\bsrc=/i); // no external script tag
        expect(html).toContain(readGraph(repo).meta.sourceRepo); // real data present
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    },
    SCAN_TIMEOUT,
  );
});
