import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { existsSync, realpathSync, statSync } from 'node:fs';

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

  // 1. Lexical check: reject `..` / absolute escape.
  const relLex = relative(realRoot, absTarget);
  if (relLex !== '' && (relLex.startsWith('..') || isAbsolute(relLex))) {
    throw outsideError(absTarget, realRoot);
  }

  // 2. Symlink check: realpath the deepest EXISTING ancestor of the target (the parts we
  //    won't create) and re-verify containment, so a symlinked directory component can't
  //    redirect the write outside the repo even though the lexical path looks contained.
  let probe = absTarget;
  while (!existsSync(probe)) {
    const parent = dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  if (existsSync(probe)) {
    const realProbe = realpathSync(probe);
    const relReal = relative(realRoot, realProbe);
    if (relReal !== '' && (relReal.startsWith('..') || isAbsolute(relReal))) {
      throw outsideError(absTarget, realRoot);
    }
  }
  return absTarget;
}

function outsideError(target: string, root: string): Error {
  return new Error(`Refusing to write outside the target repo:\n  ${target}\n  is not within ${root}`);
}
