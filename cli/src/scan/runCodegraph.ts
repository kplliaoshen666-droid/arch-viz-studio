import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const pExecFile = promisify(execFile);

export interface CodegraphRunner {
  /** absolute path to the node executable used to run CodeGraph (never a shell). */
  node: string;
  /** absolute path to CodeGraph's JS entrypoint. */
  entry: string;
  /** CodeGraph package version, stamped into graph.json meta. */
  version: string;
}

/**
 * Locate @colbymchenry/codegraph and return a runner that invokes it as
 * `node <entry> ...args` — never via a shell and never via the `.cmd`/`.bat` shim
 * (which would require shell:true and re-open command injection on Windows, per
 * CVE-2024-27980 / DEP0190). Resolution is target-first then global (REUSE-01).
 */
export function resolveCodegraph(repoRoot: string): CodegraphRunner {
  for (const dir of candidatePackageDirs(repoRoot)) {
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        version?: string;
        bin?: string | Record<string, string>;
      };
      const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.codegraph;
      if (!binRel) continue;
      const entry = join(dir, binRel);
      if (!existsSync(entry)) continue;
      return { node: process.execPath, entry, version: pkg.version ?? 'unknown' };
    } catch {
      // malformed package.json — try the next candidate.
    }
  }
  throw new Error(
    'Could not locate @colbymchenry/codegraph.\n' +
      'Install it globally:  npm i -g @colbymchenry/codegraph\n' +
      'or add it to the target repo.',
  );
}

function candidatePackageDirs(repoRoot: string): string[] {
  const scoped = ['@colbymchenry', 'codegraph'];
  const dirs = [
    join(repoRoot, 'node_modules', ...scoped), // target-first
    join(process.cwd(), 'node_modules', ...scoped), // our workspace
  ];
  const appdata = process.env.APPDATA;
  if (appdata) dirs.push(join(appdata, 'npm', 'node_modules', ...scoped)); // Windows global
  const prefix = process.env.npm_config_prefix;
  if (prefix) dirs.push(join(prefix, 'lib', 'node_modules', ...scoped)); // posix global
  dirs.push(join('/usr/local/lib/node_modules', ...scoped));
  dirs.push(join('/usr/lib/node_modules', ...scoped));
  return dirs;
}

function guardNodeVersion(): void {
  const major = Number(process.versions.node.split('.')[0]);
  if (major === 25) {
    throw new Error(
      'Node 25 has a V8 WASM JIT bug that hard-exits CodeGraph. Use Node 22 or 24 LTS.',
    );
  }
}

async function run(runner: CodegraphRunner, args: string[], cwd: string): Promise<void> {
  guardNodeVersion();
  await pExecFile(runner.node, [runner.entry, ...args], {
    cwd,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Make the index reflect current code before we read the DB (CLI-02 — never serve a
 * stale index). Fresh repo → `init` + `index`; otherwise `sync`.
 */
export async function syncOrIndex(
  runner: CodegraphRunner,
  repoRoot: string,
  noSync: boolean,
): Promise<void> {
  const initialized = existsSync(join(repoRoot, '.codegraph'));
  if (!initialized) {
    await run(runner, ['init', repoRoot], repoRoot);
    await run(runner, ['index', repoRoot], repoRoot);
  } else if (!noSync) {
    await run(runner, ['sync', repoRoot], repoRoot);
  }
}
