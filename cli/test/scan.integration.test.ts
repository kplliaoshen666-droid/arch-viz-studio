import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { canonicalize, validate } from '@arch-viz/shared';
import { locateDb, readDb } from '../src/normalize/readDb';
import { buildGraph } from '../src/normalize/buildGraph';
import { layoutGraph } from '../src/layout/dagreLayout';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, 'fixtures', 'sample-repo');
const dbExists = existsSync(join(repo, '.codegraph', 'codegraph.db'));

const OPTS = { repoName: 'sample-repo', repoHash: 'none', engineVersion: 'test', toolVersion: '0.1.0' };

// Skipped on a fresh clone / CI where the fixture has not been CodeGraph-indexed.
// Run `codegraph init/index cli/test/fixtures/sample-repo` to enable locally.
describe.skipIf(!dbExists)('scan pipeline against the real CodeGraph DB', () => {
  it('builds a valid, deterministic graph from the fixture DB', () => {
    const raw = readDb(locateDb(repo));

    const g1 = buildGraph(raw, OPTS);
    layoutGraph(g1.nodes, g1.edges, g1.meta.layout.rankdir);
    const g2 = buildGraph(raw, OPTS);
    layoutGraph(g2.nodes, g2.edges, g2.meta.layout.rankdir);

    expect(validate(g1).ok).toBe(true);
    expect(canonicalize(g1)).toBe(canonicalize(g2)); // deterministic incl. layout
    expect(g1.nodes.every((n) => ['file', 'function', 'class'].includes(n.kind))).toBe(true);
    expect(g1.nodes.length).toBeGreaterThanOrEqual(5);
    // dedupe really fired on the real data (main calls log twice)
    expect(g1.edges.some((e) => e.kind === 'calls' && e.weight >= 2)).toBe(true);
  });
});
