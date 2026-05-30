// Bundle the CLI into a single self-contained ESM file installable as a global `arch-viz` command.
//
// Strategy: inline everything pure-JS (@arch-viz/shared, @dagrejs/dagre, graphology*) into one
// file, and keep ONLY the native module (better-sqlite3) external. The generated cli/dist/package.json
// then declares better-sqlite3 as its single runtime dependency, so `npm install -g ./cli/dist`
// produces a clean global `arch-viz` command that pulls a prebuilt sqlite binary (no compiler needed).
import { build } from 'esbuild';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const cliEntry = join(repoRoot, 'cli', 'src', 'bin.ts');
const outDir = join(repoRoot, 'cli', 'dist');
const outFile = join(outDir, 'arch-viz.mjs');

// Native addon — must stay external (cannot be bundled; resolved from node_modules at runtime).
const EXTERNAL = ['better-sqlite3'];

// Node-ESM banner: require/__dirname/__filename shims so any bundled CJS dependency that expects
// them keeps working under `format: 'esm'`. esbuild preserves the entry file's own shebang at line 1,
// so the banner must NOT add a second one (a shebang is only valid on the first line).
const BANNER = [
  "import { createRequire as __createRequire } from 'node:module';",
  "import { fileURLToPath as __fileURLToPath } from 'node:url';",
  "import { dirname as __pathDirname } from 'node:path';",
  'const require = __createRequire(import.meta.url);',
  'const __filename = __fileURLToPath(import.meta.url);',
  'const __dirname = __pathDirname(__filename);',
].join('\n');

/**
 * Build the single-file CLI bundle + its clean install manifest.
 * Exported so the prompt-driven contract test can build the real shippable artifact before exercising it.
 */
export async function buildCli({ quiet = false } = {}) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  await build({
    entryPoints: [cliEntry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outfile: outFile,
    external: EXTERNAL,
    banner: { js: BANNER },
    legalComments: 'none',
    logLevel: quiet ? 'silent' : 'warning',
  });

  const pkg = {
    name: 'arch-viz-studio',
    version: '0.1.0',
    description:
      'Point at any repo → a committable architecture bundle (graph.json + SVG + ARCHITECTURE.md + offline viewer).',
    type: 'module',
    bin: { 'arch-viz': './arch-viz.mjs' },
    dependencies: { 'better-sqlite3': '^12.10.0' },
    engines: { node: '>=22.12' },
    license: 'MIT',
    files: ['arch-viz.mjs'],
  };
  writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

  if (!quiet) {
    const kb = (statSync(outFile).size / 1024).toFixed(0);
    process.stdout.write(
      `✓ built cli/dist/arch-viz.mjs (${kb} KB) — external: ${EXTERNAL.join(', ')}\n` +
        '  install globally:  npm run install:global   then:  arch-viz scan\n',
    );
  }
  return outFile;
}

// Direct invocation: `node scripts/build-cli.mjs`
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  buildCli().catch((err) => {
    process.stderr.write(`build-cli: ${err?.message ?? err}\n`);
    process.exit(1);
  });
}
