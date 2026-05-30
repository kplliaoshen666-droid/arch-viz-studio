/**
 * OUR graph.json contract version (semver) — independent of CodeGraph's own
 * internal schema version (recorded separately under meta.generator.codegraphSchema).
 *
 * Bump rules (see README.md "Versioning"):
 *   major — a field is removed / renamed / retyped (breaking). Consumers MUST re-scan.
 *   minor — an additive field. Forward-compatible for consumers that ignore unknowns.
 *   patch — documentation / enum-value additions only.
 */
export const SCHEMA_VERSION = '1.0.0';
