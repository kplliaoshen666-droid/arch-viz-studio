import { isAbsolute, relative, resolve } from 'node:path';
import { realpathSync, statSync } from 'node:fs';

/**
 * Resolve a target repo path and assert it is an existing directory.
 * Returns the realpath (symlinks resolved) so all downstream containment checks
 * compare canonical paths (CLI-05: no traversal, no symlink escape).
 */
export function resolveRepoRoot(input: string): string {
  const abs = resolve(input);
  let real: string;
  try {
    real = realpathSync(abs);
  } catch {
    throw new Error(`Target repo does not exist: ${input}`);
  }
  if (!statSync(real).isDirectory()) {
    throw new Error(`Target repo is not a directory: ${input}`);
  }
  return real;
}

/**
 * Confine an output path to within `root`. The target may not exist yet (we are about
 * to create it), so we resolve lexically and reject any path that escapes the realpath'd
 * root via `..` or an absolute jump. Returns the safe absolute path.
 */
export function ensureWithin(root: string, target: string): string {
  const realRoot = realpathSync(resolve(root));
  const absTarget = resolve(target);
  const rel = relative(realRoot, absTarget);
  if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) {
    throw new Error(`Refusing to write outside the target repo:\n  ${absTarget}\n  is not within ${realRoot}`);
  }
  return absTarget;
}
