// Phase 1 proof that the app side compiles against the shared contract (SCHEMA-04).
// Phase 3 replaces this file with the real Vite/React/React Flow viewer.
import { isCompatible, validate } from '@arch-viz/shared';
import type { GraphFile } from '@arch-viz/shared';

/** What the viewer does on load: validate, then refuse an incompatible major. */
export function canLoad(data: unknown): data is GraphFile {
  return validate(data).ok && isCompatible(data as GraphFile);
}
