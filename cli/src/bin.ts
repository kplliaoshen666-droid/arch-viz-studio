#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { resolveRepoRoot } from './security/paths';
import { resolveCodegraph, syncOrIndex } from './scan/runCodegraph';
import { locateDb, readDb } from './normalize/readDb';
import { buildGraph } from './normalize/buildGraph';
import { layoutGraph } from './layout/dagreLayout';
import { writeBundle } from './emit/writeGraph';

const TOOL_VERSION = '0.1.0';
const pExecFile = promisify(execFile);

interface Args {
  repo: string;
  out: string | undefined;
  noSync: boolean;
}

const USAGE = 'Usage: arch-viz scan <repo> [--out <dir>] [--no-sync]';

function parseArgs(argv: string[]): Args {
  if (argv[0] !== 'scan') fail(`Unknown command "${argv[0] ?? ''}". ${USAGE}`);
  let repo: string | undefined;
  let out: string | undefined;
  let noSync = false;
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--no-sync') noSync = true;
    else if (a === '--out') {
      out = argv[i + 1];
      i += 1;
      if (!out) fail('--out requires a directory');
    } else if (a.startsWith('--')) fail(`Unknown flag ${a}. ${USAGE}`);
    else if (!repo) repo = a;
    else fail(`Unexpected argument "${a}". ${USAGE}`);
  }
  if (!repo) fail(USAGE);
  return { repo, out, noSync };
}

async function gitHead(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await pExecFile('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
      windowsHide: true,
    });
    const sha = stdout.trim();
    return sha ? `git:${sha}` : 'none';
  } catch {
    return 'none';
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot(args.repo);
  const outDir = args.out ?? join(repoRoot, 'docs', 'architecture');

  const runner = resolveCodegraph(repoRoot);
  process.stderr.write(`• CodeGraph ${runner.version} → ${args.noSync ? 'reading' : 'syncing'} ${repoRoot}\n`);
  await syncOrIndex(runner, repoRoot, args.noSync);

  const raw = readDb(locateDb(repoRoot));
  const repoHash = await gitHead(repoRoot);
  const graph = buildGraph(raw, {
    repoName: basename(repoRoot),
    repoHash,
    engineVersion: runner.version,
    toolVersion: TOOL_VERSION,
  });
  layoutGraph(graph.nodes, graph.edges, graph.meta.layout.rankdir);

  const { outDir: written, merged } = writeBundle(graph, repoRoot, outDir);
  process.stdout.write(
    `✓ bundle → ${written}\n  ${graph.nodes.length} nodes · ${graph.edges.length} edges · ` +
      `${graph.clusters.length} clusters${merged ? ' · annotations merged' : ''}\n` +
      '  files: graph.json · architecture.svg · ARCHITECTURE.md · viz/index.html\n',
  );
}

function fail(msg: string): never {
  process.stderr.write(`arch-viz: ${msg}\n`);
  process.exit(2);
}

main().catch((err: unknown) => {
  process.stderr.write(`arch-viz: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
