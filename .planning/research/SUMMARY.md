# Project Research Summary

**Project:** arch-viz-studio
**Domain:** Local developer tool — CodeGraph-backed code-graph visualizer (Node/TS CLI + offline Vite/React/React Flow 4-pane app) that emits a committed, agent-readable, client-presentable `docs/architecture/` artifact bundle
**Researched:** 2026-05-31
**Confidence:** HIGH

## Executive Summary

This is a **local, on-demand code-architecture visualizer** in the lineage of Sourcetrail (closest UX analog), CodeSee (closest product analog), and Picrew's CodeAtlas (closest bundle analog) — but deliberately trimmed to a **100% permissive client-facing chain** and built around an existing, MIT-licensed graph source the user already has installed (`@colbymchenry/codegraph` 0.9.4). The way experts build this category is now well-understood: a **deterministic CLI pipeline** turns the parsed code graph into a stable, versioned data artifact, and a **thin interactive viewer** renders it. Crucially, every credible tool in this space refuses to "render the whole repo" — they cluster, collapse, filter, and focus, because above a few hundred nodes the picture becomes an unreadable "hairball." That anti-pattern is the single most important product-shaping fact in the research.

The recommended approach is a **monorepo with three workspaces — `shared/`, `cli/`, `app/` — where `shared/` is the keystone.** `shared/` owns the `graph.json` TypeScript types + JSON Schema + `validate()` + `SCHEMA_VERSION`; `cli/` produces graph.json by reading CodeGraph's SQLite DB directly (verified: no single CLI command emits the full edge list, but two SQL queries do) and doing *all* heavy deterministic work (dedupe, Louvain clustering, metrics, dagre layout coordinates); `app/` only consumes graph.json and does interactive-only recompute. Data flow is one-way and file-based (`scan → normalize → graph.json → app reads → export`) with **no server in any committed deliverable**. The stack is fully verified and license-clean (all MIT except D2's MPL-2.0 and the dev-only TS compiler), with one hard pin that matters: **`html-to-image@1.11.11` exact** (later versions break image export — React Flow's own example pins it).

The **highest-leverage and highest-risk item is the same thing: the versioned, deterministic, agent-updatable `graph.json` schema.** Everything (all 4 panes, the bundle, agent-readability, diff-friendliness) reads it; retrofitting stable IDs, deterministic ordering, schemaVersion, and a layout/semantic split after agents and committed files depend on the shape is painful-to-impossible. **Build and freeze it first.** The other concentrated risks are well-mapped and all preventable at birth: the hairball (fix with clustering/collapse/filter/focus as a single table-stakes bundle + a node-count threshold and React.memo discipline in the viewer); a stale CodeGraph index silently producing a confidently-wrong committed graph (fix with `sync`-before-read + provenance stamping); and a small, sharp security surface — `execFile`+args (never `exec`/`shell:true`), `</script>` break-out + HTML escaping in the self-contained viewer, path-confined writes, a license-allowlist CI gate, and opt-in-only LLM egress for the optional AI pane. None of these are research gaps; they are known hazards with documented mitigations that should become explicit phase exit criteria.

## Key Findings

### Recommended Stack

The entire client-visible chain is **permissive and verified** against npm + GitHub + Context7, and the CodeGraph output contract was verified *empirically* by running the installed CLI and inspecting its SQLite DB (not from memory). See [STACK.md](./STACK.md) for full version/license table and the verified DB-read pattern.

**Core technologies:**
- **`@colbymchenry/codegraph`** (MIT, 0.9.4 installed / 0.9.7 npm latest) — the hard-constrained graph source; tree-sitter parse → local `.codegraph/codegraph.db`. Consume **via direct SQLite read**, not by stitching CLI queries.
- **`better-sqlite3` 12.10.0** (MIT) — read CodeGraph's DB **readonly** to build graph.json; whole graph in 2 queries with stable IDs. Verified working; prebuilt binaries (no compiler needed on this Win11 box). **Do NOT use Node's `node:sqlite`** — experimental + failed to open the DB (errcode 14).
- **`@xyflow/react` (React Flow) 12.10.2** (MIT) — center-pane interactive node-graph; custom React nodes are exactly right for the detail/clustering UX. Package is `@xyflow/react`, **not** the old `reactflow`.
- **`@dagrejs/dagre` 3.0.0** (MIT) — deterministic auto-layout (CodeGraph gives edges, no coordinates). Use the `@dagrejs` fork; default over `elkjs` (EPL-2.0) to keep the chain copyleft-free.
- **Vite 8.0.14 + `@vitejs/plugin-react` 6.0.2 + Tailwind 4.3.0/`@tailwindcss/vite`** (all MIT) — app build/dev (Node ≥ 22.12 or 20.19+; user on 22.17.0 ✅).
- **`html-to-image` PINNED `1.11.11` EXACT** (MIT) — in-browser PNG screenshot; **the one pin that must not take a caret** (>1.11.11 breaks export, issue #516).
- **`vite-plugin-singlefile` 2.3.3** (MIT) — builds the self-contained `viz/index.html` (inlines JS+CSS; does **not** inline `public/`/WASM → inline graph.json yourself).
- **`mermaid` 11.15.0** (MIT) — diagram-source pane (text→SVG in-browser, GitHub-native). D2 (MPL-2.0, 59.8 MB WASM) is **not** recommended in-app.
- **Supporting (CLI clustering):** `graphology` + `graphology-communities-louvain` (MIT), seeded for determinism.

**Render-engine fallback:** React Flow is primary; fall back to **Cytoscape.js 3.33.4** (MIT, canvas/WebGL) only for genuinely large graphs (rule of thumb **> ~1,500–2,000 visible nodes**, MEDIUM — measure on the dogfood repo). Mitigate *within* React Flow first via module clustering + collapse.

### Expected Features

Grounded in 12 surveyed tools (Sourcetrail, CodeSee, dependency-cruiser, Madge, aider repo-map, CodeBoarding, DeepWiki, CodeAtlas, Axon, CodeCharta, Structurizr, React Flow). See [FEATURES.md](./FEATURES.md).

**Must have (table stakes — absence = "feels broken"):**
- **Module/dependency graph + call graph** (module ↔ function granularity toggle) — the category baseline.
- **Auto-layout + zoom/pan/fit + minimap** — React Flow built-ins + dagre.
- **The anti-hairball bundle, treated as ONE table-stakes feature, not separable polish: clustering by folder + collapse/expand + filtering (path/type/depth) + focus mode.** Default view = top-level modules collapsed; expand-on-demand; **never auto-render the full node set.** This is the #1 latent failure mode.
- **Symbol/file search → select → re-center graph + populate detail** (Sourcetrail's #1 feature).
- **Click node → detail pane** (signature/path + callers + callees, deterministic from CodeGraph).
- **External-dependency distinction, color/legend, circular-edge highlight, local-only (no upload).**
- **In-browser SVG + PNG export** (no external binary in MVP).
- **The committed bundle**: `graph.json` + `ARCHITECTURE.md` + `architecture.svg` + self-contained `viz/index.html`, with **HTML/path escaping as a must-have, not optional.**

**Should have (the 5 differentiators that are the actual bet):**
- **Committed, versioned, agent-readable `graph.json`** (L) — the unique combo: a documented machine-contract graph an agent can read AND safely update, living in the target repo. **The spine.**
- **Diff-friendly graph.json** (deterministic IDs + ordering) — co-designed with the schema, not a later pass; makes the artifact PR-reviewable.
- **Self-contained shareable `viz/index.html`** — hand a client one file, no install, no server.
- **Impact / blast-radius** (transitive callers from CodeGraph, depth-config) in P3 + highlight in P2 — a concrete answer, not a vibe; **label confidence (static = over-approximation).**
- **AI-explanation of a selected node** (grounded in graph context + cites back to file/symbol, DeepWiki-style) — opt-in egress.

**Defer (v2+):**
- **AI-explanation pane** — needs deterministic P3 + egress-consent UX first (PROJECT.md marks it optional/later).
- **Layered / C4-ish architectural grouping** — semantic layer assignment is genuinely hard.
- **Hotspot/churn overlay** — needs git-history ingest; off critical path.
- **GitNexus internal-only deep-read** — only if CodeGraph proves insufficient; license-fenced, never in deliverables.

**Anti-features (deliberately NOT build):** source editing, "what should I change" advice, cloud/SaaS, real-time collaboration, file-watcher/daemon (this tool is on-demand), 3D code-city metaphor, dependency rule-validation/CI gating, GitNexus anywhere client-facing, harness/global-install, and the **generic "render everything" graph** (the hairball).

### Architecture Approach

A **deterministic, file-based, one-way pipeline** with `shared/` as the integration seam between a Node CLI producer, a browser app consumer, and AI-agent editors. All heavy/deterministic work (dedupe, cluster, metrics, layout coordinates) happens in the CLI so the committed SVG and the on-screen graph agree; the app does interactive-only recompute and never mutates graph.json on disk. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the verified DB schema mapping, the concrete graph.json proposal, and the 6 anti-patterns.

**Major components:**
1. **`shared/`** (keystone, build first) — graph.json TS types + JSON Schema + `validate()` + `SCHEMA_VERSION` + canonicalize helpers + enums; its `README.md` is the **agent-facing schema doc**. Pure TS, zero IO/render deps (only `ajv`). Imported by both `cli/` and `app/`.
2. **`cli/`** (scan → normalize → layout → emit) — drive CodeGraph via `execFile` (no shell); read `.codegraph/codegraph.db` directly; dedupe edges, Louvain-cluster (seeded), compute metrics, dagre coordinates; `emit` is the **only writer** (single canonicalize+validate gate → atomic write into `<repo>/docs/architecture/`).
3. **`app/`** (load → state → panes → export → render) — Vite+React+React Flow 4-pane (① tree ② graph ③ detail ④ diagram-source); `load` is the only place that knows inlined-vs-fetch; `export` is the only place that turns the in-memory graph back into files; `render/nodeTypes.tsx` owns the **escaping boundary** (security-critical). State in Zustand; graph.json is immutable input.
4. **The committed bundle** (output) — graph.json + ARCHITECTURE.md + architecture.svg + viz/index.html, written into the *target* repo's `docs/architecture/`, traveling with that repo.

**Two cross-cutting architecture decisions the roadmapper must carry:**
- **Two SVG paths, two technologies:** the committed `architecture.svg` is a **hand-rolled deterministic SVG** (`<rect>`/`<text>`/`<path>` from graph.json + dagre coords + cluster colors) — small, diffable, faithful. The optional PNG "screenshot" uses `html-to-image` on the live DOM. **Do NOT use html-to-image for the committed SVG** (it emits multi-MB `<foreignObject>` dumps — not diff-friendly).
- **Two load modes, one artifact strategy:** dev/explore = Vite dev server `fetch('/graph.json')`; handoff = `viz/index.html` with graph.json **inlined as a `<script>` JSON blob** (a `file://` page cannot `fetch()` a sibling file, and singlefile does not inline `public/`). The self-contained HTML is a **frozen snapshot + lightweight read-only viewer**, NOT the full editing app (Pitfall 8).

### Critical Pitfalls

Top items from [PITFALLS.md](./PITFALLS.md) (10 detailed pitfalls + debt/security/perf/UX tables + a "looks done but isn't" checklist). The high-value security test for this tool is the **adversarial-symbol fixture repo**.

1. **graph.json schema churn / non-determinism breaks agents and floods git diffs** — version the schema (`schemaVersion`), validate on read AND write, sort nodes/edges by stable keys, seed Louvain, round float coords, isolate volatile provenance under `meta`, preserve `annotations` by id across re-scans. **Decide at P0; near-impossible to retrofit.** (Same item flagged as the spine in FEATURES + the keystone in ARCHITECTURE.)
2. **Stale CodeGraph index → confidently-wrong graph, committed** — `arch-viz scan` must run `codegraph sync` (or `index` if `.codegraph/` absent) **before reading the DB**; stamp provenance (`generatedAt`, commit SHA, CodeGraph version, DB hash) into graph.json and render it in viewer + HTML. Guard Node 25 (CodeGraph hard-exits — V8 WASM JIT bug).
3. **Subprocess command injection** — `execFile`/`spawn` + args array, `shell:false` always; never interpolate the repo path into a shell string. **Windows gotcha:** don't "fix" `.cmd` shims with `shell:true` (re-opens injection) — resolve the real executable. Validate/realpath the repo path.
4. **HTML/JS injection in the self-contained viewer** — two sinks, two escapes: HTML-escape visible symbol text (no `dangerouslySetInnerHTML` on code-derived strings) AND escape the inlined-data sink (`</`→`<\/` or `\uXXXX`; prefer `<script type="application/json">` + `JSON.parse`). Stored XSS travels with the deliverable.
5. **Large-graph hairball + React Flow perf collapse** — hierarchical dagre layout from day one, collapse-by-default + drill-down, cluster/aggregate, filter; `React.memo` every node/edge + `useCallback`/`useMemo` props; never subscribe sidebars to the full nodes/edges arrays; **node-count threshold (suggest 500) → default to aggregated view + warn**, and switch to canvas/WebGL above ~2,000 visible. Retrofitting perf later "requires significant code-logic changes" — **decide in the viewer phase.**

**Also map (lower frequency, still preventable at birth):** license contamination — GitNexus/PolyForm/CC-NC in the client chain (license-allowlist CI gate, fail build; GitNexus internal-only); path traversal on bundle write (resolve + containment-check every output path, fixed filenames, realpath); implicit LLM egress of client code (opt-in only + payload preview + redaction + env-var key; absent from handoff HTML).

## Implications for Roadmap

Research is strongly convergent: ARCHITECTURE.md's "Build Order," FEATURES.md's "Feature Dependencies," and PITFALLS.md's "proposed phase buckets" all describe the **same dependency-ordered backbone**. Suggested phases follow it directly.

**Backbone:** `shared (schema) → cli (scan/normalize/emit) → app (render) → export/bundle → [optional AI pane]`, with **Security & Supply-chain as a cross-cutting concern that touches every phase from the first dependency install.**

### Phase 1: Shared Contract — the graph.json schema (the spine)
**Rationale:** Every pane, the bundle, agent-readability, and diff-friendliness read this; it's the integration seam between CLI/app/agents and is the one thing that is genuinely painful to retrofit once committed files and agents depend on the shape. All three research files independently name it first. **Build and freeze it before anything else.**
**Delivers:** `shared/` workspace — TS types, JSON Schema, `validate()`, `SCHEMA_VERSION`, canonicalize/sort helpers, NodeKind/EdgeKind enums, the agent-facing `shared/README.md` schema doc, and a hand-written `fixtures/sample.graph.json` + a CI test that `validate(fixture)` passes and `fixture.meta.schemaVersion === SCHEMA_VERSION`.
**Addresses:** "Committed, versioned, agent-readable graph.json" + "Diff-friendly graph.json" differentiators (the core bet).
**Avoids:** Pitfall 7 (schema churn / non-determinism). Bakes in determinism, semantic-vs-layout separation awareness, and `annotations`-preservation from day one.

### Phase 2: CLI Extraction — scan + normalize + layout + emit
**Rationale:** Produces the artifact every downstream surface consumes; depends only on Phase 1. This is where CodeGraph integration + the first subprocess + the first file write happen — so it's where the highest-density security correctness must land.
**Delivers:** `arch-viz scan <repo>` → `sync`/`index` CodeGraph (subprocess) → read `.codegraph/codegraph.db` readonly → dedupe/Louvain(seeded)/metrics → dagre `nodes[].position` → canonicalize → validate → atomic write of `graph.json` into `<repo>/docs/architecture/`. Provenance stamped in `meta`.
**Uses:** `better-sqlite3` (readonly DB read), `graphology`+`graphology-communities-louvain` (seeded), `@dagrejs/dagre`, `execFile` (no shell).
**Implements:** ARCHITECTURE.md `cli/` component; the verified 2-query DB-read pattern + field-mapping table.
**Avoids:** Pitfall 2 (sync-before-read + provenance + Node-25 guard), Pitfall 3 (execFile+args), Pitfall 9 (path-confined writes, fixed filenames, realpath). End-to-end validate on the dogfood repo here.

### Phase 3: Viewer Core — 4-pane app, render + the anti-hairball bundle
**Rationale:** First time a human can *see* the graph; depends on Phases 1–2. The hairball + React Flow perf decisions are core viewer architecture that cannot be bolted on later — they must be designed in.
**Delivers:** Vite+React+React Flow app; `load` (dev fetch + validate, mode-detect inlined-vs-fetch), Zustand state, ① tree + ② React Flow graph (reads `nodes[].position`, cluster colors, zoom/pan/fit/minimap) + ③ detail (signature/callers/callees, deterministic) + ④ diagram-source (Mermaid text + preview). Search → select → re-center + populate. **Clustering + collapse/expand + filter + focus as the default-collapsed, anti-hairball bundle, with a node-count threshold + large-graph warning.**
**Uses:** `@xyflow/react`, `@dagrejs/dagre` (interactive re-layout), Tailwind, `mermaid`; Cytoscape.js held as the documented fallback above the threshold.
**Avoids:** Pitfall 5 (layout-from-day-one, collapse-by-default, `React.memo` discipline, threshold/fallback), Pitfall 4 partial (full app never uses `dangerouslySetInnerHTML` on code data). Structure the app so a **stripped read-only viewer entry is feasible** (sets up Phase 4).

### Phase 4: Export & Handoff Bundle — SVG / PNG / ARCHITECTURE.md / self-contained HTML
**Rationale:** Turns the interactive view into the committable deliverable; reuses Phase 3's coords + colors. This is where the "committable, presentable" half of the Core Value is proven, and where the sharpest deliverable-borne security risk (XSS in a file handed to clients) lives.
**Delivers:** `toSvg` (deterministic hand-rolled `architecture.svg`) → `toMarkdown` (`ARCHITECTURE.md` narrative + embedded SVG + a **visible static-extraction caveats block** + per-node "verify in CodeGraph" affordance) → `toBundle` (lightweight read-only viewer via `vite-plugin-singlefile` + **inlined graph.json blob**, size-budgeted ≤ ~1–2 MB) → optional `toPng` (`html-to-image@1.11.11`). Provenance rendered in viewer + HTML.
**Uses:** `vite-plugin-singlefile`, `html-to-image` (PNG only, EXACT pin).
**Avoids:** Pitfall 4 (the `</script>` break-out + escaping + **adversarial-symbol fixture as an exit criterion**), Pitfall 8 (lightweight viewer not full app; size budget), Pitfall 1 (caveats block + verify-in-CodeGraph), Pitfall 9 (containment-checked writes for all four files).

### Phase 5: Reusability + Dogfood (ship-to-validate gate)
**Rationale:** PROJECT.md has **zero validated requirements** — this is the gate that converts hypotheses to validated. Depends on all above.
**Delivers:** `arch-viz scan <anyrepo> [--out]` ergonomics; CodeGraph resolution (target-first, global fallback); run the tool on **itself** + one mature repo; ship those bundles as the demo. Measure the real React Flow node-count threshold on the dogfood graph (resolves the MEDIUM stack/perf rule-of-thumb).
**Avoids:** confirms the large-graph + provenance + license-chain behaviors on real input.

### Phase 6 (optional/later): AI-Explanation Pane
**Rationale:** Explicitly deferred in PROJECT.md + FEATURES.md; needs deterministic P3 + egress-consent UX as prerequisites.
**Delivers:** grounded, cited (DeepWiki-style) explanation of a selected node from its CodeGraph neighborhood (aider PageRank trick to bound context).
**Avoids:** Pitfall 10 — **entry criteria**: opt-in only, payload preview before send, redaction-aware, env-var key, per-session consent, and the pane **absent from the committed handoff HTML.**

### Cross-cutting: Security & Supply-chain (every phase)
**Rationale:** PITFALLS.md is explicit that this touches every phase; it is not a standalone phase.
**Delivers:** license-allowlist CI gate (fail build on non-permissive; blocklist PolyForm-*/CC-NC; verify the **shipped** chain specifically, which is narrower than dev deps) from the first install; committed lockfile + `audit` in CI; the args-array subprocess discipline reused for every subprocess (CodeGraph, git, any future d2/mmdc).

### Phase Ordering Rationale

- **Strict dependency order is forced by the data contract:** nothing real can be built before the graph.json shape is agreed (Phase 1 blocks all). The CLI must produce the artifact before the app can consume it (Phase 2 blocks 3). Export reuses the viewer's coords+colors (Phase 4 after 3). Dogfood needs all of it (Phase 5 last). This is the explicit "critical path: shared → cli → app render → export" from ARCHITECTURE.md, confirmed by FEATURES.md's dependency graph.
- **Grouping follows the monorepo workspace boundaries** (`shared`/`cli`/`app`) which are also clean testability seams — each CLI stage and each `app` module is independently testable.
- **Pitfalls are front-loaded to where retrofitting is impossible:** determinism/schema (Phase 1), subprocess/stale/path (Phase 2), and perf/hairball (Phase 3) all "must be decided early" per the research; deferring any of them multiplies recovery cost (HIGH for XSS/injection/egress leaks).

### Research Flags

Phases likely needing deeper research (`/gsd:plan-phase --research-phase <N>`) during planning:
- **Phase 2 (CLI Extraction):** the **`module`-granularity synthesis** open question — CodeGraph emits `file`/`function`/`class`/`import` but NOT `module`; decide whether "module" = CLI-synthesized directory-rollup and how `contains` edges chain dir→file→symbol. Also the **Louvain cluster-labeling heuristic** (most-common dir vs top-degree node vs path prefix) needs tuning against the dogfood repo. The `better-sqlite3` vs `node:sqlite` call is already resolved (better-sqlite3), so that part needs no research.
- **Phase 4 (Export):** the **exact `getNodesBounds → getViewportForBounds → style.transform` glue** for image export is MEDIUM (the literal `DownloadButton.jsx` body wasn't fully retrievable — budget ~30 min to wire/test); and the **deterministic SVG string-builder** layout fidelity (matching dagre coords to a hand-rolled SVG) is novel enough to warrant a focused spike.

Phases with standard, well-documented patterns (can likely skip research-phase):
- **Phase 1 (Shared schema):** the concrete graph.json proposal, field-mapping, and versioning strategy are already fully specified in ARCHITECTURE.md — this is authoring, not research.
- **Phase 3 (Viewer Core):** React Flow + dagre + clustering/collapse + memoization are extensively documented (React Flow official examples, multiple perf guides); the patterns and thresholds are already in PITFALLS.md/STACK.md.
- **Phase 5 (Dogfood):** integration/ergonomics work, no new domain research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every client-facing license + version cross-verified against npm AND GitHub/Context7; the CodeGraph output contract verified by **running the installed CLI and inspecting its SQLite DB** (not from memory). The html-to-image pin and the `node:sqlite` rejection are empirically confirmed. |
| Features | HIGH | Table stakes + anti-features grounded in 12 surveyed tools; the 5 differentiators map directly to PROJECT.md Core Value + closest-analog tools. The hairball-as-table-stakes conclusion is unanimous across the graph-viz literature. |
| Architecture | HIGH | graph.json schema + the two-SVG-path and two-load-mode decisions verified against the actual CodeGraph DB shape and the actual `file://`/singlefile constraints; build-order matches the feature dependency graph. |
| Pitfalls | HIGH | React Flow scale mechanics, CodeGraph staleness behavior, tree-sitter static-analysis limits, Node subprocess injection, `</script>` break-out, and all three license classifications verified against primary sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **CodeGraph version drift (0.9.4 installed vs 0.9.7 npm latest):** PROJECT.md says 0.9.4; npm advanced to 0.9.7 between install and research. The DB schema is migration-tracked — **mitigation already designed:** assert `MAX(schema_versions.version) >= 4` on DB open and stamp `engineVersion` + `codegraphSchema` into graph.json `meta`, so a CLI bump can't silently break the read. Re-verify the CodeGraph license on any upgrade. (Resolve operationally in Phase 2.)
- **`module` granularity not emitted by CodeGraph:** the requirement lists module-level views but CodeGraph emits `file`/`function`/`class`/`import` only. **Handle in Phase 2 planning** (likely a CLI-synthesized directory-rollup; flagged as a research item above).
- **Cytoscape vs React Flow node-count threshold is a rule of thumb (MEDIUM):** ~1,500–2,000 visible nodes / 500-node aggregation default are starting points, not measured. **Resolve by measuring on the dogfood repo in Phase 5** before hard-coding a switch.
- **Exact React Flow image-export `style.transform` glue (MEDIUM):** mechanism documented, literal example body unconfirmed. **Budget ~30 min in Phase 4** to wire and test against a real graph.
- **Detail-pane live data in the shipped bundle:** confirmed unavailable from `file://` (no DB) — the bundle's detail pane shows only graph.json-resident data; live `callers`/`callees`/`impact` is a dev-only / optional `serve`-mode feature. Scope the HTML viewer accordingly (not a gap to resolve, a constraint to honor in Phases 3–4).

## Sources

### Primary (HIGH confidence)
- **Live CodeGraph CLI + SQLite DB inspection** (`@colbymchenry/codegraph` 0.9.4, 2026-05-31) — indexed a test repo; captured `status/query/callers/callees/context/files/impact --json`; dumped the DB schema (`schema_versions`=4, `nodes`/`edges`/`files`/`unresolved_refs`); verified `better-sqlite3` reads readonly and `node:sqlite` fails (errcode 14). Source of truth for the output contract.
- **npm registry + GitHub `/license` API** (2026-05-31) — license/version source of truth for the entire stack (CodeGraph MIT, @xyflow/react MIT, @dagrejs/dagre MIT, graphology MIT, vite-plugin-singlefile MIT, html-to-image MIT, mermaid MIT, cytoscape MIT, vite/plugin-react/tailwind MIT, D2 MPL-2.0, elkjs EPL-2.0, TypeScript Apache-2.0, GitNexus PolyForm-Noncommercial).
- **Context7 `/xyflow/web`** — official "Download Image" example confirming the **html-to-image 1.11.11 pin** (issue #516) and `getNodesBounds`/`getViewportForBounds` signatures.
- **React Flow official docs** — Performance, Layouting (dagre drop-in, ELK complex), MiniMap/Sub Flows/Built-In Components.
- **vite-plugin-singlefile + html-to-image GitHub/npm docs** — inlines JS/CSS but NOT `public/`/WASM; no `file://` `fetch`; html-to-image `<foreignObject>` bloat.
- **Node.js child_process docs** — `exec` spawns a shell; `execFile`/`spawn` no shell by default; Windows `.bat`/`.cmd` caveat (DEP0190).
- **OWASP XSS Prevention/Filter-Evasion + Sophie Alpert "Preventing XSS when embedding JSON in HTML"** — `</`→`<\/` escape inside `<script>`.
- **CodeGraph docs (GitHub + DeepWiki CLI reference + indexing guide)** — staleness layers; "script outside agent session → run `sync` first"; Node 25.x hard-exit.
- **PROJECT.md** — Core Value, hard constraints, Key Decisions.

### Secondary (MEDIUM confidence)
- **Tools surveyed for features** — Sourcetrail, CodeSee, dependency-cruiser, Madge, aider repo-map, CodeBoarding, DeepWiki, CodeAtlas (Picrew), Axon, CodeCharta, Structurizr.
- **Static-analysis soundness** — arXiv 2407.07804 (13 tools miss ~61% dynamic methods); tree-sitter KG (static structure only); "Call graph" (dynamic dispatch → incompleteness).
- **Scale/perf data points** — Synergy Codes React Flow perf guide; xyflow Discussion #4975 / Issue #3044; Cytoscape WebGL preview.
- **Hairball UX** — Cambridge Intelligence; Microsoft Research "Trimming the Hairball"; REACHER (CMU); FACETS.

### Tertiary (LOW confidence)
- **Cytoscape↔React Flow node-count switch threshold** — rule of thumb only; measure on the dogfood repo (Phase 5).
- **Exact `DownloadButton.jsx` `style.transform` glue** — mechanism documented, literal body unconfirmed; wire-and-test in Phase 4.
- **`@terrastruct/d2` 59.8 MB** — npm `unpackedSize`; keep D2 out of the app.

---
*Research completed: 2026-05-31*
*Ready for roadmap: yes*
