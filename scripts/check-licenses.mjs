#!/usr/bin/env node
// SEC-01 — license-allowlist gate. Fails the build if any SHIPPED (non-dev) dependency
// is not permissive. The project's hard constraint: the client-facing chain is 100%
// MIT / ISC / BSD / Apache-2.0 / MPL-2.0, and GitNexus (PolyForm Noncommercial) never
// enters it. Reads the committed package-lock.json + node_modules — no network, no npm shell-out.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const ALLOW = [
  /^MIT$/i, /^MIT-0$/i, /^ISC$/i, /^BSD(-2-Clause|-3-Clause|-Source)?$/i,
  /^Apache-2\.0$/i, /^MPL-2\.0$/i, /^0BSD$/i, /^CC0-1\.0$/i, /^Unlicense$/i,
  /^Python-2\.0$/i, /^BlueOak-1\.0\.0$/i, /^WTFPL$/i, /^Zlib$/i, /^CC-BY-4\.0$/i,
];
const BLOCK = [/polyform/i, /noncommercial/i, /CC-BY-NC/i, /-NC(-|$)/i, /proprietary/i, /^UNLICENSED$/i, /^SEE LICENSE/i];
const COPYLEFT = [/^A?GPL/i, /^LGPL/i, /^EUPL/i, /^EPL/i, /^CDDL/i, /^OSL/i, /^SSPL/i];

function tokens(expr) {
  return String(expr).split(/\s+(?:OR|AND)\s+|[()]/i).map((s) => s.trim()).filter(Boolean);
}
function classify(expr) {
  if (!expr) return 'UNKNOWN';
  const toks = tokens(expr);
  if (toks.some((t) => BLOCK.some((r) => r.test(t)))) return 'BLOCK';
  if (toks.some((t) => COPYLEFT.some((r) => r.test(t)))) return 'COPYLEFT';
  if (toks.some((t) => ALLOW.some((r) => r.test(t)))) return 'OK'; // OR-semantics: one permissive token is enough
  return 'UNKNOWN';
}

// Some packages (e.g. khroma) declare their license only in a LICENSE file, not in
// package.json. Detect the common permissive licenses from the file header/body.
function licenseFromFile(absDir) {
  const names = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'LICENCE', 'COPYING'];
  for (const fn of names) {
    const fp = join(absDir, fn);
    if (!existsSync(fp)) continue;
    let txt;
    try {
      txt = readFileSync(fp, 'utf8').slice(0, 600);
    } catch {
      continue;
    }
    if (/MIT License/i.test(txt) || /Permission is hereby granted, free of charge/i.test(txt)) return 'MIT';
    if (/Apache License/i.test(txt) && /2\.0/.test(txt)) return 'Apache-2.0';
    if (/Mozilla Public License/i.test(txt) && /2\.0/.test(txt)) return 'MPL-2.0';
    if (/ISC License/i.test(txt)) return 'ISC';
    if (/BSD 3-Clause/i.test(txt)) return 'BSD-3-Clause';
    if (/BSD 2-Clause/i.test(txt)) return 'BSD-2-Clause';
    if (/Blue Oak/i.test(txt)) return 'BlueOak-1.0.0';
    return undefined; // a license file exists but is unrecognized → stay UNKNOWN (fail safe)
  }
  return undefined;
}

const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
const packages = lock.packages || {};
const violations = [];
let checked = 0;

for (const [p, meta] of Object.entries(packages)) {
  if (p === '' || meta.dev || meta.link) continue;
  const idx = p.lastIndexOf('node_modules/');
  if (idx < 0) continue; // workspace package (shared/cli/app), not a third-party dep
  const name = p.slice(idx + 'node_modules/'.length);
  if (name.startsWith('@arch-viz/')) continue;

  let license = meta.license;
  const absDir = join(ROOT, p);
  if (!license) {
    const pj = join(absDir, 'package.json');
    if (existsSync(pj)) {
      try {
        const j = JSON.parse(readFileSync(pj, 'utf8'));
        license = j.license || (Array.isArray(j.licenses) ? j.licenses[0]?.type : undefined);
      } catch {
        /* leave undefined */
      }
    }
  }
  if (!license) license = licenseFromFile(absDir); // fall back to the LICENSE file

  checked += 1;
  const key = `${name}@${meta.version || '?'}`;
  if (/gitnexus/i.test(name)) {
    violations.push({ key, license: license || '(none)', klass: 'BLOCK — GitNexus must never ship' });
    continue;
  }
  const klass = classify(license);
  if (klass !== 'OK') violations.push({ key, license: license || '(none)', klass });
}

console.log(`license-allowlist gate · checked ${checked} shipped (non-dev) dependencies`);
if (violations.length === 0) {
  console.log('✓ PASS — client-facing chain is 100% permissive (MIT / ISC / BSD / Apache-2.0 / MPL-2.0).');
  process.exit(0);
}
console.error('✗ FAIL — non-permissive shipped dependencies:');
for (const v of violations.sort((a, b) => (a.key < b.key ? -1 : 1))) {
  console.error(`  [${v.klass}] ${v.key} → ${v.license}`);
}
process.exit(1);
