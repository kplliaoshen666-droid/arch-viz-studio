# Architecture Research

**Domain:** Local CLI + offline web-app that turns a CodeGraph code graph into an interactive node-graph + a committed, agent-readable artifact bundle
**Researched:** 2026-05-31
**Confidence:** HIGH (CodeGraph DB schema + CLI JSON shapes verified by direct local inspection of `@colbymchenry/codegraph` v0.9.4; all candidate libraries license-checked against npm registry on 2026-05-31)

---

## TL;DR (decisions the roadmap depends on)

1. **`shared/` is the keystone.** A single TypeScript package owns the `graph.json` types + JSON Schema + `validate()`. `cli/`, `app/`, and AI agents all import it. **It must exist before either CLI or app.**
2. **The normalizer reads CodeGraph's SQLite DB directly** (`.codegraph/codegraph.db`, tables `nodes` / `edges` / `files`), *not* the per-symbol CLI commands. Verified: no single `codegraph` CLI command emits the full edge list; the DB does. CLI commands (`callers`/`callees`/`impact`) are used at runtime in the **app's detail pane**, not during the scan.
3. **All heavy/deterministic work happens in the CLI**: dedup, cluster (Louvain, seeded), metrics, layout coordinates. The app does *interactive-only* recompute (filter, expand/collapse, re-layout on user action). graph.json ships pre-laid-out so the committed SVG and the on-screen graph agree.
4. **Data flow is one-way and file-based**: `scan → normalize → graph.json (on disk) → app reads it → export`. No server in the committed deliverable.
5. **Two load modes, one artifact strategy**: dev/explore = Vite dev server reads `graph.json` over HTTP; handoff = `viz/index.html` with graph.json **inlined as a `<script>` JSON blob** (because `file://` cannot `fetch()` a sibling file, and `vite-plugin-singlefile` does not inline `public/` assets).
6. **Two SVG outputs, different tech**: committed `architecture.svg` = hand-rolled deterministic SVG from graph.json + dagre coordinates (clean, small, diff-friendly). Optional "screenshot what's on screen" PNG = `html-to-image` (MIT). Do **not** use html-to-image for the committed SVG (it emits multi-MB `<foreignObject>` dumps — not diff-friendly).
7. **Build order**: `shared` schema → CLI scan/normalize/emit → app render → export pipeline → ARCHITECTURE.md generator → self-contained bundle → reusability/dogfood.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  TARGET REPO (any repo; e.g. cases/…/foo)                             │
│                                                                        │
│   source code ──► CodeGraph CLI ──► .codegraph/codegraph.db (SQLite)  │
│                   (MIT, tree-sitter)   nodes · edges · files          │
└───────────────────────────────────┬──────────────────────────────────┘
                                     │  read DB (better-sqlite3 / node:sqlite)
                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│  arch-viz-studio  (this tool — lives in tools/arch-viz-studio/)       │
│                                                                        │
│  ┌────────────────────────  cli/  ────────────────────────────────┐   │
│  │  scan      run `codegraph init/index/sync`  (subprocess, no sh) │   │
│  │  normalize DB rows ─► dedup ─► cluster(Louvain) ─► metrics      │   │
│  │  layout    dagre coords (deterministic)                        │   │
│  │  emit      write graph.json  (sorted, schema-validated)        │   │
│  └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ imports types+schema               │
│  ┌──────────────  shared/  ◄──────┴──────────►  (agents read too)  ┐   │
│  │  graph.json TypeScript types · JSON Schema · validate() · const  │  │
│  │  SCHEMA_VERSION · sort/canonicalize helpers                     │   │
│  └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ imports types+schema               │
│  ┌────────────────────────  app/  (Vite+React+RF) ◄─────────────────┐  │
│  │  load   graph.json (HTTP in dev | inlined blob in bundle)        │  │
│  │  state  selection · filters · clusters (Zustand)                │   │
│  │  panes  ① tree  ② React Flow graph  ③ detail  ④ diagram source  │   │
│  │  export ① architecture.svg (deterministic)  ② PNG (html-to-img) │   │
│  │         ③ ARCHITECTURE.md  ④ self-contained viz/index.html      │   │
│  └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────────┼──────────────────────────────────┘
                                     │ writes bundle back into target repo
                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TARGET REPO  docs/architecture/                                      │
│    graph.json · ARCHITECTURE.md · architecture.svg · viz/index.html   │
│    (committed; AI-agent readable+updatable; client-presentable)       │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility (owns) | Does NOT own | Typical Implementation |
|-----------|----------------------|--------------|------------------------|
| **`shared/`** | graph.json **contract**: TS types, JSON Schema, `SCHEMA_VERSION`, `validate(graph)`, deterministic sort/canonicalize helpers, `node-kind`/`edge-kind` enums | Any IO, any rendering, any CodeGraph knowledge | Pure TS, zero runtime deps except a JSON-Schema validator (`ajv`). Published as a workspace package both `cli/` and `app/` depend on |
| **`cli/` scan** | Drive CodeGraph: locate/install-check, `init`+`index` (or `sync` if `.codegraph/` fresh), surface errors. Subprocess hygiene (argv array, never shell string) | Parsing the graph; layout | Node, `execFile` (not `exec`), `@colbymchenry/codegraph` resolved from target or global |
| **`cli/` normalize** | Read `.codegraph/codegraph.db` → emit normalized graph: **dedup** duplicate edges, **cluster** (Louvain, seeded), **compute metrics** (fan-in/out, LOC, descendant counts), map CodeGraph fields → schema fields | Interactive concerns; rendering | `better-sqlite3` (or `node:sqlite`), `graphology` + `graphology-communities-louvain` |
| **`cli/` layout** | Compute **stable x/y coordinates** per node (dagre) so committed SVG == on-screen graph; write into graph.json `nodes[].position` | Choosing colors / interaction | `@dagrejs/dagre` (sync, deterministic) |
| **`cli/` emit** | Canonicalize (stable key order, sorted arrays), `validate()` against schema, write `graph.json` to `<target>/docs/architecture/` atomically | — | `fs`, `shared/validate`, stable JSON stringify |
| **`app/` load** | Read graph.json (dev: `fetch('/graph.json')`; bundle: read inlined `window.__ARCH_GRAPH__`), `validate()` on load, hold in memory | Producing graph.json | React entry; mode-detect inlined-vs-fetch |
| **`app/` state** | Selection, filters (by kind/cluster/path), expand-collapse, search; derive view-model from immutable graph | Mutating graph.json on disk | Zustand store; selectors derive, never duplicate |
| **`app/` panes** | 4-pane UI: ① repo/module/file tree ② React Flow node-graph ③ selected-node detail (callers/callees/impact via live `codegraph` calls *in dev only* + AI-explanation slot) ④ diagram source (D2/Mermaid text) + preview | Layout math (consumes `nodes[].position`) | `@xyflow/react`, Tailwind, tree component |
| **`app/` export** | ① deterministic `architecture.svg` from graph.json+coords ② optional PNG screenshot ③ `ARCHITECTURE.md` ④ self-contained `viz/index.html` | Re-deriving the graph | In-browser SVG string builder; `html-to-image` (PNG only); md template; singlefile build output |

---

## Recommended Project Structure

Monorepo with three workspaces. Use **npm/pnpm workspaces** (or a single repo with TS project references) — the point is `cli` and `app` both depend on `shared`.

```
tools/arch-viz-studio/
├── package.json                 # workspaces: ["shared","cli","app"]
├── pnpm-workspace.yaml          # (or npm workspaces)
├── tsconfig.base.json           # shared TS config + path aliases
│
├── shared/                      # ── SINGLE SOURCE OF TRUTH ──
│   ├── package.json             # name: @arch-viz/shared
│   ├── src/
│   │   ├── schema.ts            # GraphFile, Node, Edge, Cluster, Meta TS types
│   │   ├── schema.json          # JSON Schema (generated from or kept in sync w/ TS)
│   │   ├── version.ts           # export const SCHEMA_VERSION = "1.0.0"
│   │   ├── enums.ts             # NodeKind, EdgeKind, ClusterAlgo unions
│   │   ├── validate.ts          # validate(graph): {ok, errors} via ajv
│   │   └── canonicalize.ts      # stable sort + ordered-key stringify
│   └── README.md                # ← the agent-facing schema doc (authoritative)
│
├── cli/
│   ├── package.json             # bin: { "arch-viz": "./dist/bin.js" }
│   ├── src/
│   │   ├── bin.ts               # arg parse: scan <repo> [--out] [--no-sync]
│   │   ├── scan/
│   │   │   ├── runCodegraph.ts  # execFile init/index/sync (no shell)
│   │   │   └── locateDb.ts      # resolve <repo>/.codegraph/codegraph.db
│   │   ├── normalize/
│   │   │   ├── readDb.ts        # SELECT nodes/edges/files
│   │   │   ├── dedupeEdges.ts   # collapse dup (source,target,kind)
│   │   │   ├── cluster.ts       # graphology louvain, seeded rng
│   │   │   ├── metrics.ts       # fan-in/out, loc, descendants
│   │   │   └── toGraph.ts       # rows → GraphFile (uses shared types)
│   │   ├── layout/
│   │   │   └── dagreLayout.ts   # x/y per node
│   │   └── emit/
│   │       └── writeGraph.ts    # canonicalize → validate → atomic write
│   └── README.md
│
└── app/
    ├── package.json
    ├── index.html
    ├── vite.config.ts           # base "./"; build modes: dev / bundle (singlefile)
    ├── public/
    │   └── graph.json           # dev-only symlink/copy of a target's graph.json
    └── src/
        ├── main.tsx
        ├── load/
        │   ├── loadGraph.ts     # inlined-blob? else fetch; then validate()
        │   └── inlineGuard.ts   # window.__ARCH_GRAPH__ detection
        ├── state/
        │   └── store.ts         # zustand: selection, filters, clusters
        ├── panes/
        │   ├── TreePane.tsx
        │   ├── GraphPane.tsx    # React Flow; reads nodes[].position
        │   ├── DetailPane.tsx   # callers/callees/impact + AI slot
        │   └── DiagramPane.tsx  # D2/Mermaid source + preview
        ├── export/
        │   ├── toSvg.ts         # deterministic SVG string from graph+coords
        │   ├── toPng.ts         # html-to-image screenshot (optional)
        │   ├── toMarkdown.ts    # ARCHITECTURE.md from graph (+ embedded svg)
        │   └── toBundle.ts      # orchestrate singlefile + inline graph blob
        └── render/
            ├── nodeTypes.tsx    # custom RF node (escapes labels/paths!)
            └── colors.ts        # cluster → color map
```

### Structure Rationale

- **`shared/` first and isolated:** the graph.json contract is the integration seam between CLI, app, and AI agents. If it has IO or framework deps, it can't be imported cleanly by both a Node CLI and a browser bundle. Keep it pure TS + ajv. **Its `README.md` is the agent-facing schema documentation** (the thing an AI agent reads before editing graph.json).
- **`cli/` split scan/normalize/layout/emit:** these are four distinct deterministic stages with a clear pipe. Splitting them makes each independently testable (a normalize unit test can feed canned DB rows; a layout test can feed a canned graph). It also lets `emit` be the *only* writer (single validate+canonicalize gate before disk).
- **`app/` split load/state/panes/export/render:** load is the only place that knows "inlined vs fetched"; export is the only place that turns the in-memory graph back into files; render owns the escaping boundary (security-critical). Panes stay thin.
- **`render/nodeTypes.tsx` owns escaping:** code symbols/paths flow from arbitrary repos into the DOM and into the self-contained HTML. One place must guarantee no HTML/JS injection (constraint from PROJECT.md).

---

## The graph.json Schema (concrete proposal)

> Designed against the **verified** CodeGraph DB shape. CodeGraph emits node IDs as `"<kind>:<hash>"` (e.g. `"function:cce15011…"`), edges with `kind ∈ {calls, contains, imports}`, and edge `metadata` carrying `{confidence, resolvedBy}`. CodeGraph also keeps its *own* `schema_versions` table (currently `4`) — we record that as `meta.generator.codegraphSchema` but version **our** file independently.

### Design requirements → how the schema meets them

| Requirement | Mechanism |
|---|---|
| **Stable / versioned** | `meta.schemaVersion` (semver). Major bump = breaking field change; agents/app check `major` on load. |
| **Diff-friendly** | Deterministic output: `nodes` sorted by `id`, `edges` sorted by `(source,target,kind)`, object keys emitted in fixed order, no volatile fields in the diffed body (`generatedAt` lives in `meta`, isolated). Floats (positions, metrics) rounded to fixed precision. |
| **AI-agent-updatable** | Flat, documented, human-readable; IDs are stable content hashes (an agent can re-find a node after a re-scan); a `notes`/`annotations` free-text field per node that the CLI **preserves** across re-scans (merge by id); schema published in `shared/README.md`. |

### Shape

```jsonc
{
  "meta": {
    "schemaVersion": "1.0.0",          // OUR contract version (semver)
    "generatedAt": "2026-05-31T08:00:00Z",
    "sourceRepo": "cases/route-b/foo", // repo path or name (relative/identifier)
    "sourceRepoHash": "git:9f2a…|none", // git HEAD sha if available, else "none"
    "generator": {
      "name": "arch-viz",
      "version": "0.1.0",              // this tool's version
      "engine": "codegraph",
      "engineVersion": "0.9.4",        // CodeGraph CLI version (from `--version`)
      "codegraphSchema": 4,            // CodeGraph's internal schema_versions max
      "codegraphDbHash": "sha256:…"    // hash of codegraph.db → cache/repro key
    },
    "counts": { "nodes": 8, "edges": 6, "clusters": 2 },
    "layout": { "algo": "dagre", "rankdir": "LR", "version": 1 },
    "clustering": { "algo": "louvain", "seed": 42, "resolution": 1.0 }
  },

  "nodes": [                            // sorted by id (ascending)
    {
      "id": "function:cce15011e0125d59f6bef014ae79c04f",  // = CodeGraph id (stable hash)
      "kind": "function",              // module | file | class | function  (NodeKind)
      "label": "add",                  // CodeGraph name
      "qualifiedName": "add",          // CodeGraph qualified_name
      "path": "src/math.ts",           // CodeGraph file_path (POSIX, repo-relative)
      "lang": "typescript",
      "span": { "startLine": 1, "endLine": 1 },
      "cluster": 0,                    // index into clusters[]; -1 if unclustered
      "flags": { "exported": true, "async": false, "static": false, "abstract": false },
      "metrics": {                     // computed in CLI; rounded
        "loc": 1,                      // endLine-startLine+1
        "fanIn": 1,                    // # incoming calls edges
        "fanOut": 0,                   // # outgoing calls edges
        "descendants": 0               // contained nodes (for module/file/class)
      },
      "position": { "x": 120, "y": 0 },// dagre coords, rounded to int
      "annotations": null              // free text PRESERVED across re-scans (agent/human)
    }
  ],

  "edges": [                           // sorted by (source, target, kind)
    {
      "id": "function:…->function:…:calls",  // derived stable id (source+target+kind)
      "source": "function:…double…",
      "target": "function:…add…",
      "kind": "calls",                 // imports | calls | contains  (EdgeKind)
      "weight": 1,                     // dedup count (N collapsed dup edges → weight N)
      "confidence": 0.9,               // from CodeGraph metadata.confidence (max if deduped)
      "resolvedBy": "exact-match"      // from CodeGraph metadata.resolvedBy
    }
  ],

  "clusters": [                        // communities; index = cluster id
    {
      "id": 0,
      "label": "math",                 // auto: most-common dir or top node; human-editable
      "color": "#4f8cff",              // assigned in CLI for stable SVG/app agreement
      "nodeIds": ["function:…add…", "function:…double…"],  // sorted
      "size": 2,
      "annotations": null              // PRESERVED across re-scans
    }
  ]
}
```

### Field-mapping table (CodeGraph DB → graph.json)

| graph.json field | Source (verified) | Transform |
|---|---|---|
| `nodes[].id` | `nodes.id` | passthrough (already `kind:hash`) |
| `nodes[].kind` | `nodes.kind` | filter to {module,file,class,function}; drop `import`-kind nodes by default (they're noise — keep the `imports` *edge*) |
| `nodes[].label` | `nodes.name` | passthrough; **escape at render** |
| `nodes[].path` | `nodes.file_path` | normalize to POSIX |
| `nodes[].metrics.fanIn/Out` | derived from `edges` | count `calls` edges |
| `edges[]` | `edges.source/target/kind` | **dedupe** `(source,target,kind)` → `weight` |
| `edges[].confidence` / `resolvedBy` | `edges.metadata` (JSON) | parse JSON, take `confidence`/`resolvedBy` |
| `meta.codegraphSchema` | `schema_versions` max(`version`) | read on scan |
| `meta.generator.codegraphDbHash` | hash of `codegraph.db` file | sha256 |

### Versioning strategy

- **Semver on `meta.schemaVersion`.** App + agents read `major`. **Major** = field removed/renamed/retyped (breaking) → app refuses to load mismatched major with a clear message + suggests re-scan. **Minor** = additive field (forward-compatible; old app ignores new fields). **Patch** = doc/enum-value additions.
- **Single source:** `shared/src/version.ts` exports `SCHEMA_VERSION`; CLI stamps it on emit, app asserts on load. CI test: `validate(fixture)` must pass and `fixture.meta.schemaVersion === SCHEMA_VERSION`.
- **Migrations:** ship `shared/migrations/<from>-<to>.ts` only when a major bump lands; `arch-viz migrate graph.json` upgrades an old committed file in place. (Defer until first breaking change — YAGNI for v1.)
- **Why agent-updatable holds:** the schema is documented in `shared/README.md`, fields are flat and named, IDs are stable hashes (agent edits survive a re-scan via id-merge), and `annotations` fields are explicitly **preserved** by the CLI's emit step (re-scan merges old annotations by node/cluster id rather than overwriting). An agent can therefore add an explanation to a node and not have it clobbered next scan.

---

## Architectural Patterns

### Pattern 1: Deterministic Pipeline (CLI)

**What:** `scan → readDb → dedupe → cluster → metrics → layout → canonicalize → validate → write`. Every stage is a pure function `(input) → output` except the two IO ends (read DB, write file).
**When to use:** all CLI work.
**Trade-offs:** + trivially testable (feed canned rows), + reproducible (same DB + same seed ⇒ byte-identical graph.json ⇒ clean git diffs). − you must be disciplined about determinism (seed the Louvain rng, fix float precision, sort before stringify).

```typescript
// cli/src/emit/writeGraph.ts (sketch)
import { validate, canonicalize, SCHEMA_VERSION } from "@arch-viz/shared";
export function writeGraph(graph: GraphFile, outPath: string) {
  graph.meta.schemaVersion = SCHEMA_VERSION;
  const text = canonicalize(graph);     // stable key order + sorted arrays + rounded floats
  const res = validate(JSON.parse(text));
  if (!res.ok) throw new Error("graph.json failed schema validation:\n" + res.errors.join("\n"));
  atomicWrite(outPath, text);           // tmp + rename
}
```

### Pattern 2: Shared Contract Package (the integration seam)

**What:** `shared/` exports types + schema + validate + version. CLI imports it to *produce*, app imports it to *consume*, agents read its README to *edit*.
**When to use:** always — this is the spine.
**Trade-offs:** + one definition, no drift between producer/consumer; + breaking changes are loud (TS compile + schema validate fail). − requires a workspace/monorepo setup up front (small cost, big payoff).

### Pattern 3: Pre-computed layout, interactive-only recompute

**What:** CLI writes `nodes[].position` (dagre). App renders those directly so the committed SVG and the on-screen graph match. The app only re-runs layout when the *user* expands/collapses or filters (and that re-layout is ephemeral, never written back unless they re-export).
**When to use:** whenever a committed artifact must match the interactive view.
**Trade-offs:** + SVG == screenshot, no surprise; + app startup is instant (no layout pass). − re-scan needed to refresh positions after big code changes (acceptable; positions are advisory).

### Pattern 4: Two render targets, two technologies

**What:** committed `architecture.svg` is built by a **deterministic string builder** (`<rect>`/`<text>`/`<path>` from graph.json + coords). The optional PNG "screenshot" uses `html-to-image` on the live React Flow DOM.
**Why split:** `html-to-image` serializes the DOM into `<foreignObject>` — verified by research to produce multi-MB, attribute-bloated SVGs that are *not* diff-friendly and not clean for a committed artifact. A hand-rolled SVG from the graph is small, stable, and reviewable. PNG-via-html-to-image is fine because PNG is binary anyway (not diffed).
**Trade-offs:** + committed SVG is tiny + diffable + faithful to graph data; − you maintain a small SVG builder (but it's ~one file, and it shares the dagre coords + cluster colors the app already has).

---

## Data Flow

### Primary flow (scan → committed bundle)

```
arch-viz scan <repo>
   ↓
[scan]      execFile codegraph init/index (or sync)      → <repo>/.codegraph/codegraph.db
   ↓
[normalize] SELECT nodes,edges,files  → dedupe → louvain(seed) → metrics
   ↓
[layout]    dagre → nodes[].position
   ↓
[emit]      canonicalize → validate(shared schema) → atomic write
   ↓
<repo>/docs/architecture/graph.json        ← the contract artifact
```

### App load flow (two modes, one strategy)

```
DEV / EXPLORE                         SELF-CONTAINED HANDOFF
─────────────                         ──────────────────────
vite dev server                       viz/index.html (file://, double-click)
   ↓ fetch('/graph.json')                ↓ read window.__ARCH_GRAPH__  (inlined JSON)
loadGraph() → validate()              loadGraph() → validate()
   ↓                                     ↓
in-memory GraphFile                   in-memory GraphFile
   ↓                                     ↓
React Flow renders nodes[].position   React Flow renders nodes[].position
```

> **Decision — static file vs server:** *No server in the deliverable.* Dev uses Vite's dev server purely for DX (HMR, fetch). The handoff is a single `viz/index.html` with graph.json **inlined as a `<script>window.__ARCH_GRAPH__ = {…}</script>` blob**, because (a) a `file://` page cannot `fetch()` a sibling `graph.json` (browser security — verified), and (b) `vite-plugin-singlefile` does not inline `public/` assets (verified). Inlining the JSON sidesteps both. This is the **simplest** thing that serves both "dev/explore" and "self-contained handoff." A tiny local server (`arch-viz serve`) is an *optional later convenience* for live `codegraph callers/callees` in the detail pane — **not** required for MVP and never part of the committed bundle.

### Export flow (in-app)

```
in-memory GraphFile + dagre coords + cluster colors
   ├─► toSvg.ts        → architecture.svg     (deterministic <rect>/<path>/<text>)
   ├─► toMarkdown.ts   → ARCHITECTURE.md       (narrative + embedded <svg> + node/cluster tables)
   ├─► toPng.ts        → architecture.png       (optional; html-to-image screenshot of RF DOM)
   └─► toBundle.ts     → viz/index.html         (singlefile build + inlined graph blob)
                          ↓ (in dev: write all four back to <repo>/docs/architecture/)
```

> In dev, "Export bundle" writes the four files into the target's `docs/architecture/`. In the shipped single-file viewer, "Export" triggers browser downloads (no FS write from `file://`). The canonical commit path is the dev/CLI write.

### State management (app)

```
immutable GraphFile (loaded once)
        ↓ selectors (derive view-model: filtered nodes/edges, visible clusters)
Zustand store { selectedId, filters, expanded, search }
        ↓ subscribe
Panes (Tree / Graph / Detail / Diagram)  ──actions──► store
```

- **Server state vs client state:** graph.json is immutable "server" state (loaded, never mutated in place). Selection/filter/expand is client UI state (Zustand). Detail-pane live data (`callers`/`callees`/`impact`) is fetched on demand **in dev only** (needs the CLI/DB present); in the shipped bundle the detail pane reads only what's already in graph.json.

---

## Build Order (with dependencies)

> This is the dependency-ordered backbone the roadmap should phase around. Each item lists what it **blocks**.

1. **`shared/` schema contract** — types + JSON Schema + `validate()` + `SCHEMA_VERSION` + canonicalize + `README.md` (agent doc) + a hand-written `fixtures/sample.graph.json`.
   *Blocks: everything.* This is the integration seam; nothing real can be built without the agreed shape.

2. **`cli/` scan + normalize + emit** — drive CodeGraph, read DB, dedupe/cluster/metrics, write a validated graph.json into `<repo>/docs/architecture/`.
   *Depends on (1). Blocks: app, export.* Produces the artifact the app consumes. Validate against the dogfood repo end-to-end here.

3. **`cli/` layout (dagre)** — add `nodes[].position`.
   *Depends on (2). Blocks: faithful SVG export.* Can be folded into the same phase as (2) if convenient, but is logically a distinct deterministic stage.

4. **`app/` load + render (panes ①②)** — Vite+React+React Flow; load graph.json (dev fetch), validate, render tree + node-graph from `nodes[].position`; clustering colors; zoom.
   *Depends on (1)+(2)+(3). Blocks: detail pane, export.* First time a human can *see* the graph.

5. **`app/` panes ③④** — detail pane (callers/callees/impact + AI slot) and diagram-source pane (D2/Mermaid text + preview).
   *Depends on (4). Detail-pane live data depends on optional `serve` or dev DB access.* The AI-explanation pane is explicitly optional/later (PROJECT.md).

6. **Export pipeline** — `toSvg` (deterministic) → `toMarkdown` → `toBundle` (singlefile + inlined graph) → optional `toPng`.
   *Depends on (4)/(3). Blocks: the committed artifact bundle + client handoff.* Export *after* render because it reuses the same coords + colors. Order within: SVG first (it's embedded into ARCHITECTURE.md), then markdown, then bundle.

7. **Reusability + dogfood** — `arch-viz scan <anyrepo>` ergonomics, `--out` override, writing into each target's `docs/architecture/`, then visualize the tool itself + one mature repo.
   *Depends on all above.* This is the "ship to validate" gate (PROJECT.md has zero validated requirements yet).

**Critical path:** `shared (1) → cli scan/normalize/emit (2,3) → app render (4) → export (6)`. Panes ③④ (5) and reusability/dogfood (7) hang off that spine.

---

## Reusability (project-agnostic targeting)

- **Invocation:** `arch-viz scan <repo> [--out <dir>]`. Default `--out` = `<repo>/docs/architecture/`. The tool resolves the target's `.codegraph/codegraph.db`, never its own.
- **Self-targeting:** the tool lives in `tools/arch-viz-studio/`; `arch-viz scan .` from a target repo writes that repo's bundle. The tool is *summoned on demand* (PROJECT.md hard rule: not a harness subsystem, no global install, no `~/.claude/` mutation, no hook registration).
- **CodeGraph resolution:** prefer a `codegraph` resolvable from the target repo; fall back to the globally installed one (user has `@colbymchenry/codegraph` v0.9.4 global). Record `engineVersion` in `meta` so a committed graph.json is traceable to the generator that made it.
- **The committed bundle travels with the target repo** (in *its* `docs/architecture/`), so an AI agent or teammate opening that repo finds graph.json + ARCHITECTURE.md + architecture.svg + viz/index.html without needing arch-viz-studio present.

---

## Scaling Considerations

> "Scale" here = **graph size** (nodes/edges from large repos), not concurrent users (it's a local single-user tool).

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Small repo (≤ ~500 nodes) | Render everything; dagre is instant; single graph.json. No special handling. |
| Medium (~500–5k nodes) | Default the graph view to **module/file granularity**, expand-to-functions on demand (use `contains` edges to drill down). React Flow handles a few thousand nodes; keep functions collapsed until a module is opened. Cluster-collapse via Louvain communities. |
| Large (5k–50k+ nodes) | Don't render the full function-level graph. Strategy: (a) graph.json still stores all nodes, (b) app renders cluster/module summary nodes by default, (c) edges aggregated to cluster-level with summed `weight`, (d) lazy-expand one cluster at a time. Consider `meta.level` summaries precomputed in CLI. |

### Scaling priorities

1. **First bottleneck: React Flow DOM node count.** Thousands of DOM nodes janks. Fix: default to module-level, collapse functions, expand on click (the `contains` hierarchy makes this natural).
2. **Second bottleneck: SVG export size / ARCHITECTURE.md embed.** A function-level SVG for a big repo is huge. Fix: the committed `architecture.svg` defaults to the **module/cluster-level** view; full detail stays interactive-only.
3. **Third: graph.json file size.** Tens of thousands of nodes → large JSON. Fix only if observed: gzip the inlined blob in the bundle, or split `meta`/`nodes`/`edges`. Don't pre-optimize (YAGNI).

---

## Anti-Patterns

### Anti-Pattern 1: Reconstructing the full graph from per-symbol CLI calls

**What people do:** loop `codegraph callers`/`callees` over every symbol to assemble the edge list.
**Why it's wrong:** verified — those commands return *symbol-scoped* views, are slow (one subprocess per symbol), and won't give a complete, deduped edge set. They also don't expose `contains` cleanly.
**Do this instead:** read `.codegraph/codegraph.db` directly (tables `nodes`/`edges`/`files`). Use the per-symbol CLI commands only at *runtime* in the detail pane for live drill-down.

### Anti-Pattern 2: Using html-to-image for the committed SVG

**What people do:** call `toSvg()` on the React Flow DOM and commit the result as `architecture.svg`.
**Why it's wrong:** verified — it emits `<foreignObject>` with inlined DOM/CSS → multi-MB, attribute-bloated, non-diff-friendly, and visually coupled to current CSS. Bad as a reviewable, committed artifact.
**Do this instead:** generate a clean deterministic SVG (`<rect>`/`<text>`/`<path>`) from graph.json + dagre coords + cluster colors. Reserve `html-to-image` for an optional PNG "screenshot."

### Anti-Pattern 3: Fetching graph.json from the self-contained HTML

**What people do:** ship `viz/index.html` that does `fetch('graph.json')`.
**Why it's wrong:** verified — opened via `file://`, browsers block `fetch()` of sibling files; the viewer is then blank when double-clicked. `vite-plugin-singlefile` also won't inline `public/graph.json`.
**Do this instead:** inline graph.json as `<script>window.__ARCH_GRAPH__ = {…}</script>` at bundle time; `loadGraph()` prefers the inlined blob, falls back to `fetch` only in dev.

### Anti-Pattern 4: Non-deterministic graph.json (kills diff-friendliness)

**What people do:** stringify nodes/edges in DB order, leave Louvain unseeded, embed `generatedAt` inline among nodes, full-float positions.
**Why it's wrong:** every re-scan produces a different file → noisy git diffs → defeats the "diff-friendly, agent-updatable" requirement.
**Do this instead:** sort nodes by id, edges by `(source,target,kind)`; seed Louvain (`seed:42`); round positions/metrics; emit keys in fixed order; isolate volatile fields under `meta`; preserve `annotations` by id across scans.

### Anti-Pattern 5: Mutating graph.json from the running app

**What people do:** let the app write filter/expand state back into graph.json on disk.
**Why it's wrong:** graph.json is the *source-of-truth artifact*; UI state is ephemeral. Writing UI state pollutes the committed file and breaks reproducibility.
**Do this instead:** graph.json is immutable input. The app holds UI state in Zustand. Only an explicit "Export bundle" (re-running emit semantics) writes files, and it writes the *canonical* graph, not UI state.

### Anti-Pattern 6: Unescaped code symbols in DOM / single-file HTML

**What people do:** inject `node.label` / `node.path` straight into innerHTML or into the inlined HTML blob.
**Why it's wrong:** symbols/paths come from arbitrary repos → HTML/JS injection in the viewer (PROJECT.md security constraint).
**Do this instead:** centralize escaping in `render/nodeTypes.tsx` and in the bundle's JSON serialization (JSON.stringify is safe for the blob; escape any HTML-context interpolation). React escapes text children by default — never use `dangerouslySetInnerHTML` for repo-derived strings.

---

## Integration Points

### External Tools

| Tool | License (verified 2026-05-31) | Integration Pattern | Notes |
|------|------|---------------------|-------|
| `@colbymchenry/codegraph` | **MIT** (registry latest 0.9.7; user has 0.9.4) | subprocess `execFile` (no shell) + read its SQLite DB | Primary graph source. Works on non-git folders. Record version in `meta`. |
| `@xyflow/react` (React Flow) | **MIT** (12.10.2) | app render layer; consumes `nodes[].position` | Unopinionated about positioning — feed it dagre coords. |
| `@dagrejs/dagre` | **MIT** (3.0.0) | CLI layout (sync, deterministic) | Use the `@dagrejs` fork; original `dagre` deprecated. Synchronous (simpler than elkjs). |
| `graphology` + `graphology-communities-louvain` | **MIT** (0.26.0 / 2.0.2) | CLI clustering; **seed the rng** | Louvain communities → `clusters[]`. Seed for determinism. |
| `vite-plugin-singlefile` | **MIT** (2.3.3) | bundle build of viz/index.html | Inlines JS/CSS; does **not** inline `public/` → inline graph.json yourself. |
| `html-to-image` | **MIT** (1.11.13) | optional PNG screenshot of RF DOM | Pin known-good version; `<foreignObject>` based; not for committed SVG. |
| D2 / Mermaid (diagram-source pane) | MPL-2.0 / MIT (per PROJECT.md) | diagram *text* + preview | For pane ④. MVP renders text; in-browser Mermaid is MIT and embeddable. |
| **GitNexus** | PolyForm **Noncommercial** | **EXCLUDED from deliverables** | Internal-only optional deep-read; never in `docs/architecture/`. Hard constraint. |

> **License chain is clean:** every tool in the client-facing chain is permissive (MIT, plus MPL-2.0 for optional D2). No Noncommercial in the committed bundle. **Verify versions at build time** (PROJECT.md constraint) — the registry already advanced CodeGraph 0.9.4→0.9.7 between install and now.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `cli/` ↔ `shared/` | import types + `validate` + `canonicalize` | CLI is the *producer*; must validate before write. |
| `app/` ↔ `shared/` | import types + `validate` | App is the *consumer*; validate on load (refuse mismatched major). |
| agents ↔ `shared/README.md` | read schema doc | Agents edit graph.json by hand using the documented shape; `annotations` survive re-scan. |
| `cli/` ↔ CodeGraph | subprocess + DB read | The *only* place that knows CodeGraph internals. App never touches the DB in the committed path. |
| `app/load` ↔ rest of app | `loadGraph(): GraphFile` | Single function hides inlined-vs-fetch. |
| `app/render` ↔ repo strings | escaping boundary | Security-critical; one place owns it. |

---

## Open Questions (for phase-specific research)

1. **`node:sqlite` vs `better-sqlite3`:** `node:sqlite` works (verified, experimental warning) and is zero-install; `better-sqlite3` is stable but a native dep. Decide in the CLI phase based on Node version target. (Leaning `better-sqlite3` for stability unless targeting Node ≥ 22 only.)
2. **Cluster labeling heuristic:** auto-label a Louvain community by most-common directory vs top-degree node vs path prefix. Tune during normalize phase against the dogfood repo.
3. **Module-node synthesis:** CodeGraph emits `file`/`function`/`class`/`import` but the requirement lists `module` granularity. Decide whether "module" = directory-rollup synthesized by the CLI (likely yes) and how `contains` edges chain dir→file→symbol.
4. **D2/Mermaid in pane ④:** generate diagram *source* from graph.json (which dialect default?) and whether to render in-browser (Mermaid is MIT/embeddable; D2 needs WASM or stays text-only for MVP).
5. **Detail-pane live data in the shipped bundle:** confirmed unavailable from `file://` (no DB) — detail pane in the bundle shows only graph.json-resident data; live callers/callees is a dev-only / `serve`-mode feature.

## Sources

- CodeGraph DB schema + CLI JSON shapes: **direct local inspection** of `@colbymchenry/codegraph` v0.9.4 (indexed a test repo, read `.codegraph/codegraph.db` via `node:sqlite`; captured `status -j`, `query -j`, `callers -j`, `impact -j`, and table PRAGMA) — 2026-05-31. (HIGH confidence; primary evidence.)
- Library licenses/versions via `npm view` (2026-05-31): `@colbymchenry/codegraph` MIT 0.9.7 · `@xyflow/react` MIT 12.10.2 · `@dagrejs/dagre` MIT 3.0.0 · `graphology` MIT 0.26.0 · `graphology-communities-louvain` MIT 2.0.2 · `vite-plugin-singlefile` MIT 2.3.3 · `html-to-image` MIT 1.11.13.
- React Flow image export (getNodesBounds / getViewportForBounds / html-to-image; `<foreignObject>` bloat): https://reactflow.dev/examples/misc/download-image · https://github.com/xyflow/xyflow/discussions/1139 · https://reactflow.dev/api-reference/utils/get-nodes-bounds
- React Flow layout (dagre vs elkjs, MIT `@dagrejs` fork, elkjs EPL-2.0): https://reactflow.dev/learn/layouting/layouting · https://reactflow.dev/examples/layout/dagre · https://reactflow.dev/examples/layout/elkjs
- vite-plugin-singlefile (inlines JS/CSS, NOT public/ assets; offline `file://` limits): https://github.com/richardtallent/vite-plugin-singlefile · https://www.npmjs.com/package/vite-plugin-singlefile
- html-to-image (`toSvg` via `<foreignObject>`, MIT, browser limits): https://github.com/bubkoo/html-to-image · https://www.npmjs.com/package/html-to-image
- graphology Louvain community detection: https://graphology.github.io/standard-library/communities-louvain.html · https://www.npmjs.com/package/graphology-communities-louvain

---
*Architecture research for: CodeGraph-driven local code-architecture visualizer (CLI + offline web-app + committed artifact bundle)*
*Researched: 2026-05-31*
