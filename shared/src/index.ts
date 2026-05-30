// @arch-viz/shared — the single source of truth for the graph.json contract.
// Imported by cli/ (producer), app/ (consumer); its README.md is read by AI agents.

export { SCHEMA_VERSION } from './version';
export * from './enums';
export type * from './types';
export { graphFileSchema } from './jsonSchema';
export { validate, assertValid, isCompatible } from './validate';
export type { ValidationResult } from './validate';
export { canonicalize, canonicalizeGraph } from './canonicalize';
export { mergeAnnotations } from './annotations';
