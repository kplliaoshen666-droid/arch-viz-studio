# `@arch-viz/shared` — the `graph.json` contract

This package is the **single source of truth** for `graph.json`, the artifact that
`arch-viz scan` writes into a repo's `docs/architecture/`. The CLI *produces* it, the
viewer app *consumes* it, and **AI agents read this README to edit it safely**.

> If you are an AI agent editing a committed `graph.json`, read **"Editing as an agent"** below.
> The short version: only touch `annotations` (and human-facing `label`s), keep the file
> canonical, and never invent `id`s.

---

## What `graph.json` is

A deterministic, versioned, flat description of one repo's code structure:

```jsonc
{
  "meta":     { /* provenance + how this file was produced */ },
  "nodes":    [ /* modules / files / classes / functions */ ],
  "edges":    [ /* imports / calls / contains, deduped with a weight */ ],
  "clusters": [ /* Louvain communities, used for color + collapse */ ]
}
```

It is produced by reading CodeGraph's local SQLite DB, then deduping edges, clustering
(seeded Louvain), computing metrics, and laying out coordinates (dagre) — all in the CLI,
so the committed SVG and the on-screen graph agree.

## The shape

Top-level key order is fixed (and is the order `canonicalize()` emits): `meta`, `nodes`,
`edges`, `clusters`.

### `meta`

| field | type | meaning |
|---|---|---|
| `schemaVersion` | `"x.y.z"` | **our** contract version (not CodeGraph's). Consumers check `major`. |
| `generatedAt` | ISO-8601 | the one volatile field — isolated here so the diffed body stays stable. |
| `sourceRepo` | string | repo path / identifier. |
| `sourceRepoHash` | string | `git:<sha>` if available, else `none`. |
| `generator` | object | `{ name, version, engine, engineVersion, codegraphSchema, codegraphDbHash }`. |
| `counts` | object | `{ nodes, edges, clusters }` — derived; `canonicalize()` recomputes them. |
| `layout` | object | `{ algo: "dagre", rankdir, version }`. |
| `clustering` | object | `{ algo: "louvain", seed, resolution }`. |

### `nodes[]` (sorted by `id`)

| field | type | notes |
|---|---|---|
| `id` | string | CodeGraph stable id `"<kind>:<hash>"`. **Survives a re-scan.** Never invent or edit. |
| `kind` | `module \| file \| class \| function` | `module` is CLI-synthesized (directory rollup). |
| `label` | string | display name; **escaped at render** (comes from arbitrary repos). Human-editable. |
| `qualifiedName` | string | fully-qualified name. |
| `path` | string | POSIX, repo-relative. |
| `lang` | string | e.g. `typescript`. |
| `span` | `{ startLine, endLine }` | source span. |
| `cluster` | int | index into `clusters[]`; `-1` if unclustered. |
| `flags` | object | `{ exported, async, static, abstract }`. |
| `metrics` | object | `{ loc, fanIn, fanOut, descendants }`. |
| `position` | `{ x, y }` | dagre coords, rounded to 2 dp. |
| `annotations` | `string \| null` | **free text, preserved across re-scans by `id`.** This is the agent-writable field. |

### `edges[]` (sorted by `source`, then `target`, then `kind`)

`{ id, source, target, kind, weight, confidence, resolvedBy }` — `weight` is how many
duplicate edges were collapsed; `confidence`/`resolvedBy` come from CodeGraph metadata.

### `clusters[]` (sorted by `id`)

`{ id, label, color, nodeIds, size, annotations }` — `color` is assigned by the CLI so the
SVG and the app match. `label` and `annotations` are human/agent-editable.

## Determinism guarantees (why diffs stay clean)

`canonicalize(graph)` is the only thing that writes bytes. It guarantees:

- `nodes` sorted by `id`; `edges` by `(source, target, kind)`; `clusters` by `id`; each
  cluster's `nodeIds` sorted.
- object keys emitted in the fixed order above.
- positions rounded to 2 dp, `confidence` to 4 dp, `-0` normalized to `0`.
- `counts` and cluster `size` recomputed from the arrays.
- 2-space indent, trailing newline.

⇒ The same logical graph, in any input order, produces **byte-identical** output. Re-scanning
unchanged code yields no diff.

## Editing as an agent

`graph.json` is safe to hand-edit **if** you follow these rules:

1. **Only edit `annotations` (any node/cluster) and human-facing `label`s.** Do not touch
   `id`, `position`, `metrics`, `edges`, or `meta` — the CLI owns those.
2. **Match nodes by `id`.** Ids are content hashes and are stable across re-scans, so your
   annotation will be re-attached automatically on the next `arch-viz scan`
   (see `mergeAnnotations`).
3. **Keep it canonical.** Easiest: change only string values in place. If you add/reorder,
   re-run the CLI or `canonicalize()` so determinism holds.
4. **Validate.** `validate(graph).ok` must be `true`. Unknown fields are rejected
   (`additionalProperties: false`).

## Versioning

`meta.schemaVersion` is semver, sourced from `SCHEMA_VERSION` in this package.

- **major** — a field removed / renamed / retyped (breaking). The app refuses a mismatched
  major and asks for a re-scan. `isCompatible(graph)` checks this.
- **minor** — an additive field (forward-compatible for consumers that ignore unknowns).
- **patch** — docs / enum-value additions.

## API

```ts
import {
  SCHEMA_VERSION,           // "1.0.0"
  validate,                 // (data) => { ok, errors }
  assertValid,              // (data) => asserts GraphFile (throws)
  isCompatible,             // (graph) => boolean (major match)
  canonicalize,             // (graph) => string  (the bytes on disk)
  canonicalizeGraph,        // (graph) => GraphFile (sorted/rounded clone)
  mergeAnnotations,         // (prev, next) => GraphFile (carry annotations by id)
  graphFileSchema,          // the JSON Schema object
  type GraphFile, type GraphNode, type GraphEdge, type Cluster,
  type NodeKind, type EdgeKind,
} from '@arch-viz/shared';
```
