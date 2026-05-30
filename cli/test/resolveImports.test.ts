import { describe, it, expect } from 'vitest';
import { resolveImportTarget, toPosix } from '../src/normalize/resolveImports';

const files = new Set(['index.ts', 'math.ts', 'util.ts', 'src/core/engine.ts', 'src/core/index.ts']);

describe('resolveImportTarget', () => {
  it('resolves a sibling relative import with extension guessing', () => {
    expect(resolveImportTarget('./math', 'index.ts', files)).toBe('file:math.ts');
  });

  it('resolves a parent-relative import', () => {
    // dirname('src/engine.ts') = 'src'; '../util' → 'util' → matches root 'util.ts'
    expect(resolveImportTarget('../util', 'src/engine.ts', files)).toBe('file:util.ts');
  });

  it('resolves a directory import to its index file', () => {
    expect(resolveImportTarget('./core', 'src/app.ts', files)).toBe('file:src/core/index.ts');
  });

  it('returns null for bare/external specifiers', () => {
    expect(resolveImportTarget('react', 'index.ts', files)).toBeNull();
    expect(resolveImportTarget('@scope/pkg', 'index.ts', files)).toBeNull();
  });

  it('returns null when nothing matches (no dangling/guessed edges)', () => {
    expect(resolveImportTarget('./missing', 'index.ts', files)).toBeNull();
  });

  it('normalizes Windows separators', () => {
    expect(toPosix('src\\core\\engine.ts')).toBe('src/core/engine.ts');
  });
});
