import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureWithin, resolveRepoRoot } from '../src/security/paths';

const here = dirname(fileURLToPath(import.meta.url));

describe('ensureWithin (CLI-05 path containment)', () => {
  it('allows a path inside the repo root', () => {
    const out = ensureWithin(here, join(here, 'docs', 'architecture'));
    expect(out).toContain('architecture');
  });

  it('allows the root itself', () => {
    expect(() => ensureWithin(here, here)).not.toThrow();
  });

  it('rejects a ../ traversal escape', () => {
    expect(() => ensureWithin(here, join(here, '..', '..', 'evil'))).toThrow(/outside the target repo/);
  });

  it('rejects an absolute path on another root', () => {
    const elsewhere = process.platform === 'win32' ? 'D:\\evil' : '/evil';
    expect(() => ensureWithin(here, elsewhere)).toThrow(/outside the target repo/);
  });
});

describe('resolveRepoRoot', () => {
  it('resolves an existing directory to its realpath', () => {
    expect(resolveRepoRoot(here)).toBeTruthy();
  });

  it('throws on a non-existent path', () => {
    expect(() => resolveRepoRoot(join(here, 'definitely-not-here-xyz'))).toThrow(/does not exist/);
  });
});
