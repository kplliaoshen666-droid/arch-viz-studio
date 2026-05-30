# Architecture — arch-viz-studio

> `arch-viz` v0.1.0 · engine codegraph 0.9.4 · **151** nodes · **257** edges · **31** clusters · source `git:38070838ab561ce1ea024d4af3ff26b6ba7a46ba`

![Architecture diagram](./architecture.svg)

## ⚠️ Static-extraction caveats

- Built by **static analysis** (tree-sitter via CodeGraph). It is an *over-approximation*: dynamic dispatch, reflection, and runtime wiring may be missing or imprecise.
- `calls` edges and blast-radius are structural, not a runtime guarantee — verify in CodeGraph for critical decisions.
- Regenerate with `arch-viz scan` after code changes; do not hand-edit anything except `annotations`.

## Clusters

| # | Cluster | Nodes |
|--:|---|--:|
| 0 | app | 16 |
| 1 | app | 1 |
| 2 | app | 1 |
| 3 | app | 1 |
| 4 | cli | 13 |
| 5 | cli | 8 |
| 6 | cli | 13 |
| 7 | shared | 7 |
| 8 | shared | 5 |
| 9 | vitest.config.ts | 1 |
| 10 | shared | 15 |
| 11 | cli | 7 |
| 12 | cli | 14 |
| 13 | cli | 14 |
| 14 | cli | 1 |
| 15 | cli | 1 |
| 16 | app | 15 |
| 17 | app | 1 |
| 18 | cli | 1 |
| 19 | cli | 2 |
| 20 | cli | 2 |
| 21 | app | 1 |
| 22 | app | 1 |
| 23 | shared | 1 |
| 24 | app | 1 |
| 25 | shared | 1 |
| 26 | shared | 3 |
| 27 | app | 1 |
| 28 | shared | 1 |
| 29 | cli | 1 |
| 30 | app | 1 |

## Key nodes (by connectivity)

| Symbol | Kind | Path | Fan-in | Fan-out |
|---|---|---|--:|--:|
| `main` | function | `cli/src/bin.ts` | 1 | 10 |
| `writeBundle` | function | `cli/src/emit/writeGraph.ts` | 1 | 9 |
| `buildGraph` | function | `cli/src/normalize/buildGraph.ts` | 1 | 8 |
| `writeGraphFile` | function | `cli/src/emit/writeGraph.ts` | 0 | 6 |
| `App` | function | `app/src/App.tsx` | 0 | 6 |
| `toSvg` | function | `cli/src/export/toSvg.ts` | 2 | 4 |
| `validate` | function | `shared/src/validate.ts` | 5 | 0 |
| `main` | function | `cli/test/fixtures/sample-repo/index.ts` | 1 | 4 |
| `computeView` | function | `app/src/derive/viewModel.ts` | 1 | 4 |
| `toHtml` | function | `cli/src/export/toHtml.ts` | 1 | 3 |
| `canonicalize` | function | `shared/src/canonicalize.ts` | 2 | 1 |
| `clusterNodes` | function | `cli/src/normalize/cluster.ts` | 1 | 2 |

*Schema 1.0.0 · generated 2026-05-30T22:35:13.311Z · machine-readable graph in [graph.json](./graph.json) · open [viz/index.html](./viz/index.html) (no install).*
