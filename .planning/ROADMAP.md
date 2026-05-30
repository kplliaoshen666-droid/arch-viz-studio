# Roadmap: arch-viz-studio

## Overview

A strict, dependency-ordered build of a local code-architecture visualizer. The journey runs along a single forced critical path: first freeze the `graph.json` data contract that everything else reads (the spine), then build the CLI that produces that artifact from CodeGraph, then the 4-pane viewer that renders it, then the committable export bundle, and finally prove reusability by dogfooding the tool on itself plus one mature repo. Nothing real can exist before the schema is agreed, and nothing can be demoed before the CLI emits `graph.json` — so the phases are layers, not independent features. Security & supply-chain is cross-cutting: subprocess/path discipline lands the moment the first subprocess and first file write appear (Phase 2), and the license-allowlist gate becomes a hard ship blocker at the dogfood gate (Phase 5).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Shared Contract** - Freeze the versioned, deterministic, agent-updatable `graph.json` schema in `shared/` (the spine everything reads)
- [x] **Phase 2: CLI Extraction** - `arch-viz scan <repo>` runs CodeGraph, reads its SQLite DB, normalizes, and emits `graph.json` (highest-density security)
- [x] **Phase 3: Viewer Core** - 4-pane Vite/React/React Flow app renders the graph with anti-hairball clustering/collapse/filter/focus designed in
- [ ] **Phase 4: Export & Handoff Bundle** - Deterministic SVG, ARCHITECTURE.md, self-contained HTML viewer, and optional PNG (XSS-critical)
- [ ] **Phase 5: Reusability + Dogfood** - Project-agnostic reuse, the license-allowlist ship gate, and ship-to-validate by visualizing self + one mature repo

## Phase Details

### Phase 1: Shared Contract
**Goal**: A single source-of-truth `shared/` workspace owns the `graph.json` shape — TypeScript types, JSON Schema, `validate()`, `SCHEMA_VERSION`, canonicalize/sort helpers, and an agent-facing `shared/README.md` — so CLI, app, and AI agents all read one frozen, deterministic, hand-editable contract.
**Depends on**: Nothing (first phase)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04
**Success Criteria** (what must be TRUE):
  1. `validate()` accepts a hand-written `fixtures/sample.graph.json` and fails fast (with a clear error) on a fixture with a bad `schemaVersion` or a missing required field, proving the schema is versioned and enforced (SCHEMA-01).
  2. Canonicalizing the same logical graph twice produces byte-identical JSON (stable sorted node/edge order, rounded coords, volatile fields isolated under `meta`), proving determinism is baked in before any producer exists (SCHEMA-02).
  3. Hand-editing the `annotations` area of a fixture and re-canonicalizing preserves those annotations by id and still passes `validate()`, proving agents can safely round-trip edits (SCHEMA-03).
  4. Both a CLI-side and an app-side import of `shared/` compile against the same exported `types` + `schema` + `validate()` + `SCHEMA_VERSION`, and `shared/README.md` documents the shape for an AI agent (SCHEMA-04).
**Plans**: TBD

Plans:
- [x] 01-01: shared/ schema contract — types, JSON Schema, validate(), canonicalize(), mergeAnnotations(), agent-facing README, fixtures; tsc + 18 vitest tests GREEN

### Phase 2: CLI Extraction
**Goal**: `arch-viz scan <repo>` is the only writer of `graph.json` — it syncs CodeGraph, reads `.codegraph/codegraph.db` readonly, does all heavy deterministic work (dedupe→weight, seeded Louvain clusters, metrics, dagre coordinates), stamps provenance, and atomically writes a validated `graph.json` into `<repo>/docs/architecture/`, all under hard subprocess/path security.
**Depends on**: Phase 1
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, SEC-02
**Success Criteria** (what must be TRUE):
  1. Running `arch-viz scan <repo>` writes `graph.json` into `<repo>/docs/architecture/`, and the file is accepted by Phase 1's `validate()`; re-running on unchanged code produces a byte-identical file (CLI-01, CLI-03, SCHEMA-02 honored downstream).
  2. scan runs CodeGraph `sync` (or `index` when `.codegraph/` is absent) before reading, so editing a source file and re-scanning changes the graph — never serving a stale index (CLI-02).
  3. The emitted `graph.json` `meta` records `generatedAt`, repo, commit SHA, CodeGraph version, and DB schema version/hash, so provenance is auditable in every artifact (CLI-04).
  4. Every subprocess is invoked via `execFile` + args array with `shell:false`, and a repo path containing shell metacharacters or a `../` traversal cannot execute injected commands or write outside the realpath-confined target repo (CLI-05; cross-cutting security first enforced here).
  5. A committed lockfile exists and `npm audit` runs in CI for the workspace, establishing supply-chain hygiene from the first runtime install (SEC-02; cross-cutting).
**Plans**: TBD

Plans:
- [x] 02-01: `arch-viz scan` — runCodegraph (node entry, no shell) · better-sqlite3 readonly · dedupe/seeded-Louvain/metrics/dagre · path-fenced atomic emit; 21 cli tests GREEN; real fixture scan byte-identical

### Phase 3: Viewer Core
**Goal**: A Vite + React + React Flow 4-pane app loads and validates `graph.json` and renders it as an interactive graph that defaults to a collapsed, clustered view — with clustering, collapse/expand, filter (path/type/depth), focus, search, a detail pane, a tree pane, a Mermaid diagram-source pane, and a node-count performance guardrail — so a human can finally *see* the architecture without ever hitting the hairball.
**Depends on**: Phase 2
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06
**Success Criteria** (what must be TRUE):
  1. Opening the app on a dogfood `graph.json` shows an interactive React Flow graph (zoom/pan/fit/minimap) laid out from the file's dagre coordinates (VIEW-01).
  2. The graph opens collapsed/clustered and never auto-renders the full node set; the user can expand/collapse clusters and filter by path/type/depth, and above the node-count threshold the app warns and defaults to an aggregated view (VIEW-02, VIEW-06).
  3. Searching a symbol/file selects it, re-centers the graph, and populates the detail pane with signature/path + callers + callees + impact (VIEW-03, VIEW-04).
  4. Pane 1 shows the repo/module/file tree and pane 4 shows the Mermaid diagram source with a live preview (VIEW-05).
  5. Code-derived strings rendered in any pane are escaped (no `dangerouslySetInnerHTML` on CodeGraph data), keeping the XSS boundary intact and the app structured so a stripped read-only viewer is feasible for Phase 4 (cross-cutting security; sets up EXPORT-03/04).
**Plans**: TBD
**UI hint**: yes

Plans:
- [x] 03-01: Vite+React+React Flow 4-pane app (tree · graph · inspector · mermaid) — anti-hairball cluster collapse/expand/filter/threshold, search→select→recenter, escaping boundary; vite build + 47 tests GREEN

### Phase 4: Export & Handoff Bundle
**Goal**: Turn the interactive view into the committable, client-presentable half of the Core Value — a deterministic hand-rolled `architecture.svg`, an `ARCHITECTURE.md` narrative with an embedded diagram and a visible static-extraction caveats block, a self-contained `viz/index.html` (graph.json inlined as a `<script>` blob, read-only viewer, opens with no install), and an optional PNG — with all code-derived text adversarially escaped.
**Depends on**: Phase 3
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-04, EXPORT-05
**Success Criteria** (what must be TRUE):
  1. Exporting produces a deterministic `architecture.svg` (hand-rolled `<rect>`/`<text>`/`<path>` from graph.json coords + cluster colors) that is small, diff-friendly, and faithful to the on-screen layout — re-exporting unchanged input yields an identical SVG (EXPORT-01).
  2. Generating `ARCHITECTURE.md` produces a human- and agent-readable narrative that embeds the diagram and contains a visible static-extraction caveats block (EXPORT-02).
  3. Opening the produced `viz/index.html` directly from `file://` (no server, no install) renders the read-only viewer with graph.json inlined, and provenance is shown (EXPORT-03).
  4. Running the export against an adversarial-symbol fixture repo (symbols/paths containing `</script>`, HTML, and quotes) yields a bundle where nothing breaks out of the data sink or executes — HTML entities + `</script>` breakout are escaped (EXPORT-04; cross-cutting XSS gate, the sharpest deliverable-borne risk).
  5. The user can optionally export a PNG of the live graph via `html-to-image` pinned exactly to 1.11.11 (EXPORT-05).
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD during plan-phase

### Phase 5: Reusability + Dogfood
**Goal**: Prove the tool is project-agnostic and ship-to-validate it — resolve CodeGraph target-first then global, land output in each target's `docs/architecture/`, enforce the license-allowlist CI gate that fails the build on any non-permissive *shipped* dependency, and run the whole pipeline on the tool itself plus one mature repo so those committed bundles become the demo.
**Depends on**: Phase 4
**Requirements**: REUSE-01, REUSE-02, SEC-01
**Success Criteria** (what must be TRUE):
  1. Running `arch-viz scan <anyrepo>` on a repo other than this tool resolves CodeGraph (target-first, global fallback) and writes a valid bundle into that target's `docs/architecture/`, proving project-agnostic reuse (REUSE-01).
  2. The tool is dogfooded on itself and on one mature repo, and both produced bundles (graph.json + ARCHITECTURE.md + architecture.svg + viz/index.html) open and present cleanly as the demo (REUSE-02).
  3. A CI license-allowlist gate fails the build if any shipped dependency is non-permissive (blocklist PolyForm-*/CC-NC), and GitNexus never appears in the client-facing chain — closing the Core Value's "zero non-permissive licenses" guarantee as a hard ship blocker (SEC-01; cross-cutting, enforced as the gate the tool ships behind).
**Plans**: TBD

Plans:
- [ ] 05-01: TBD during plan-phase

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Shared Contract | 1/1 | Complete | 2026-05-31 |
| 2. CLI Extraction | 1/1 | Complete | 2026-05-31 |
| 3. Viewer Core | 1/1 | Complete | 2026-05-31 |
| 4. Export & Handoff Bundle | 0/TBD | Not started | - |
| 5. Reusability + Dogfood | 0/TBD | Not started | - |
