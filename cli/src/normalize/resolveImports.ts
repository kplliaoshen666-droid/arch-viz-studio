import path from 'node:path';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Resolve a relative import specifier to an intra-repo file node id, or null for
 * external/bare specifiers (e.g. "react") and unresolved paths. We only emit edges
 * for imports we can actually point at a known file — never a dangling/guessed target
 * (honest "what IS there"). `filePaths` is the set of repo-relative POSIX file paths.
 */
export function resolveImportTarget(
  specifier: string,
  importerFilePath: string,
  filePaths: ReadonlySet<string>,
): string | null {
  if (!specifier.startsWith('.')) return null; // bare/external — out of repo scope

  const importerDir = path.posix.dirname(toPosix(importerFilePath));
  const base = path.posix.normalize(path.posix.join(importerDir, specifier));

  const candidates = [base, ...EXTENSIONS.map((e) => base + e)];
  for (const e of EXTENSIONS) candidates.push(path.posix.join(base, `index${e}`));

  for (const candidate of candidates) {
    if (filePaths.has(candidate)) return `file:${candidate}`;
  }
  return null;
}
