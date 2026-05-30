import Ajv from 'ajv';
import type { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { graphFileSchema } from './jsonSchema';
import type { GraphFile, Meta } from './types';
import { SCHEMA_VERSION } from './version';

// strict:false → never throw on schema-authoring quirks; runtime data validation is unaffected.
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);
const validateFn = ajv.compile(graphFileSchema);

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validate arbitrary data against the graph.json schema. Never throws. */
export function validate(data: unknown): ValidationResult {
  const ok = validateFn(data) as boolean;
  if (ok) return { ok: true, errors: [] };
  const errors = (validateFn.errors ?? []).map(formatError);
  return { ok: false, errors: errors.length ? errors : ['unknown validation error'] };
}

/** Throwing variant — narrows to GraphFile. Used by the CLI emit gate. */
export function assertValid(data: unknown): asserts data is GraphFile {
  const res = validate(data);
  if (!res.ok) {
    throw new Error('graph.json failed schema validation:\n  - ' + res.errors.join('\n  - '));
  }
}

function formatError(e: ErrorObject): string {
  const path = e.instancePath && e.instancePath.length > 0 ? e.instancePath : '(root)';
  const extra =
    e.keyword === 'additionalProperties' && e.params && 'additionalProperty' in e.params
      ? ` (\`${String((e.params as { additionalProperty: string }).additionalProperty)}\`)`
      : '';
  return `${path} ${e.message ?? 'is invalid'}${extra}`;
}

/**
 * Major-version compatibility check. The app/agents read `major`:
 * a mismatched major means the file was produced by an incompatible contract → re-scan.
 */
export function isCompatible(graph: { meta?: Pick<Meta, 'schemaVersion'> }): boolean {
  const fileMajor = major(graph.meta?.schemaVersion);
  const libMajor = major(SCHEMA_VERSION);
  return fileMajor !== null && fileMajor === libMajor;
}

function major(semver: string | undefined): number | null {
  if (!semver) return null;
  const m = /^(\d+)\.\d+\.\d+$/.exec(semver);
  return m ? Number(m[1]) : null;
}
