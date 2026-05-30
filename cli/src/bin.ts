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

interface ScanArgs {
  repo: string;
  out: string | undefined;
  noSync: boolean;
  useTargetCodegraph: boolean;
}

const HELP = `arch-viz ${TOOL_VERSION} — committable architecture pictures for any repo

Usage:
  arch-viz scan [repo] [options]     Scan a repo → docs/architecture/ bundle
  arch-viz --help                    Show this help
  arch-viz --version                 Print version

Arguments:
  repo                               Repo to scan (default: current directory)

Options:
  --out <dir>                        Output directory (default: <repo>/docs/architecture)
  --no-sync                          Read the existing CodeGraph index; skip re-index
  --use-target-codegraph             Allow the target repo's local CodeGraph binary
                                     (default: only a trusted global 'codegraph' is run)

Outputs (written into <repo>/docs/architecture/):
  graph.json          agent-readable graph contract (stable, versioned, deterministic)
  architecture.svg    rendered diagram
  ARCHITECTURE.md     narrative for humans
  viz/index.html      self-contained offline viewer (double-click to open)

Requires the CodeGraph CLI on PATH:  npm i -g @colbymchenry/codegraph`;

function parseScanArgs(argv: string[]): ScanArgs {
  let repo: string | undefined;
  let out: string | undefined;
  let noSync = false;
  let useTargetCodegraph = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--no-sync') noSync = true;
    else if (a === '--use-target-codegraph') useTargetCodegraph = true;
    else if (a === '--out') {
      out = argv[i + 1];
      i += 1;
      if (!out) fail('--out requires a directory');
    } else if (a.startsWith('--')) fail(`Unknown flag ${a}.\n\n${HELP}`);
    else if (!repo) repo = a;
    else fail(`Unexpected argument "${a}".\n\n${HELP}`);
  }
  // No positional repo → scan the current working directory (the "cd into a repo, just scan" path).
  return { repo: repo ?? process.cwd(), out, noSync, useTargetCodegraph };
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

async function scan(argv: string[]): Promise<void> {
  const args = parseScanArgs(argv);
  const repoRoot = resolveRepoRoot(args.repo);
  const outDir = args.out ?? join(repoRoot, 'docs', 'architecture');

  const runner = resolveCodegraph(repoRoot, args.useTargetCodegraph);
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (cmd === undefined || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') {
    process.stdout.write(`arch-viz ${TOOL_VERSION}\n`);
    return;
  }
  if (cmd !== 'scan') fail(`Unknown command "${cmd}".\n\n${HELP}`);

  await scan(argv.slice(1));
}

function fail(msg: string): never {
  process.stderr.write(`arch-viz: ${msg}\n`);
  process.exit(2);
}

main().catch((err: unknown) => {
  process.stderr.write(`arch-viz: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
