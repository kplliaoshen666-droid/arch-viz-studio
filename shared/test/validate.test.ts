import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  validate,
  assertValid,
  isCompatible,
  canonicalize,
  SCHEMA_VERSION,
} from '../src/index';
import type { GraphFile } from '../src/index';
import { makeSampleGraph } from './helpers';

const here = dirname(fileURLToPath(import.meta.url));
const diskSample = JSON.parse(
  readFileSync(join(here, '..', 'fixtures', 'sample.graph.json'), 'utf8'),
) as GraphFile;

describe('validate (SCHEMA-01)', () => {
  it('accepts the hand-written on-disk sample', () => {
    const res = validate(diskSample);
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it('the on-disk sample and the TS factory describe the same logical graph', () => {
    // canonicalize normalizes order/format, so this locks fixture <-> factory consistency.
    expect(canonicalize(diskSample)).toBe(canonicalize(makeSampleGraph()));
  });

  it('fails fast on a bad schemaVersion', () => {
    const bad = makeSampleGraph();
    bad.meta.schemaVersion = 'banana';
    const res = validate(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join(' ')).toMatch(/schemaVersion/);
  });

  it('fails fast on a missing required field', () => {
    const bad = makeSampleGraph() as unknown as { nodes: Array<Record<string, unknown>> };
    delete bad.nodes[0]!.path;
    const res = validate(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join(' ')).toMatch(/path/);
  });

  it('rejects unknown properties (additionalProperties:false)', () => {
    const bad = makeSampleGraph() as unknown as Record<string, unknown>;
    bad.surprise = true;
    expect(validate(bad).ok).toBe(false);
  });

  it('assertValid throws on invalid data', () => {
    expect(() => assertValid({})).toThrow(/schema validation/);
    expect(() => assertValid(makeSampleGraph())).not.toThrow();
  });
});

describe('isCompatible (SCHEMA-04)', () => {
  it('matches the lib major and exposes a semver SCHEMA_VERSION', () => {
    expect(isCompatible(diskSample)).toBe(true);
    expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('rejects a mismatched major', () => {
    const g = makeSampleGraph();
    g.meta.schemaVersion = '2.0.0';
    expect(isCompatible(g)).toBe(false);
  });
});
