<!-- GSD:project-start source:PROJECT.md -->
## Project

**arch-viz-studio**

A reusable **local** architecture-visualization tool for the developer's own AI-infrastructure workspace. You point it at any code repository → it reads that repo's code graph (via the CodeGraph CLI) → it produces both an **interactive node-graph app** (explore the architecture) and a **committed, client-presentable artifact bundle** (`docs/architecture/`: a stable `graph.json`, an `ARCHITECTURE.md` narrative, an exported `architecture.svg`, and a self-contained HTML viewer). Built so that every project can be visualized on demand, an AI agent can read+update the outputs, and the results are easy to show to clients or teammates.

**Core Value:** **Point at any repo → get a high-quality, committable architecture picture that a human can present and an AI agent can read+update — with zero non-permissive licenses in the client-facing chain.**

### Constraints

- **License (hard)**: client-visible chain must be ALL permissive — CodeGraph (MIT) + React Flow / @xyflow/react (MIT) + D2 (MPL-2.0) + Mermaid (MIT). Verify each tool's license + version during build before relying on it. GitNexus (Noncommercial) excluded from deliverables.
- **Boundary (hard)**: not a harness subsystem; no global `~/.claude/` mutation; no auto-`gitnexus setup`; no hook registration.
- **Tech stack**: CLI in Node/TypeScript; app = Vite + React + TypeScript + React Flow + Tailwind. Graph source = CodeGraph CLI (primary); GitNexus optional internal-only.
- **Security (light but real)**: subprocess exec of CodeGraph (no shell injection), path handling (no traversal), self-contained HTML viewer must escape code symbols/paths (no HTML/JS injection), npm supply-chain hygiene, and — only if the AI pane ships — code egress to an LLM must be explicit/opt-in.
- **Reusability**: project-agnostic; outputs committed into each target repo, not into this tool.
- **Model routing**: all agent spawns = Opus (quality override).
- **Quality**: high — this is meant to be shown to clients/teammates.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | License | Purpose | Why Recommended |
|------------|---------|---------|---------|-----------------|
| **`@colbymchenry/codegraph`** (CLI) | **0.9.7** latest / **0.9.4** installed | **MIT** ✅ | Primary graph source: tree-sitter parse → local SQLite (`.codegraph/codegraph.db`) | The hard-constrained source. MIT, zero deps, self-contained runtime, works on non-git folders. **Consume via SQLite-direct read (see Contract below), not by stitching CLI queries.** |
| **`better-sqlite3`** | **12.10.0** | **MIT** ✅ | Read CodeGraph's SQLite DB in the CLI to build `graph.json` | **VERIFIED working**: reads `.codegraph/codegraph.db` readonly, full graph (all nodes + all edges) in 2 queries. Synchronous, mature, prebuilt binaries (no compile toolchain needed on this Win11 box). **Do NOT use Node's built-in `node:sqlite`** — see "What NOT to Use". |
| **Node.js + TypeScript** | Node **≥ 22.12** (or 20.19+); TS **6.0.3** | TS = Apache-2.0 (dev only) ✅ | CLI runtime + types | Node floor is dictated by Vite 8 / plugin-react 6 (Node 20.19+ or 22.12+). User already on v22.17.0. TS compiler is a dev dependency — its Apache-2.0 license never ships to a client. |
| **Vite** | **8.0.14** | **MIT** ✅ | Dev server + production bundler for the 4-pane app | Vite 8 (May 2026) ships Rolldown (Rust bundler), 10–30× faster builds, same Rollup/Vite plugin API. Requires Node 20.19+/22.12+. |
| **React + React DOM** | **19.x** (React Flow peer = `>=17`, so 18 also fine) | **MIT** ✅ | UI runtime for the 4-pane app | Project-mandated. React Flow 12 + Vite 8 both fully support React 19. |
| **`@xyflow/react`** (React Flow) | **12.10.2** | **MIT** ✅ | Center pane: interactive editable node-graph (custom module/function nodes, edges, clustering, zoom) | The mandated + correct primary. MIT, custom-node ergonomics, official in-browser image export. Lightweight deps (zustand, classcat, @xyflow/system). **Package is `@xyflow/react`, NOT the old `reactflow`** — see compatibility note. |
| **`@vitejs/plugin-react`** | **6.0.2** | **MIT** ✅ | React fast-refresh / JSX transform for Vite 8 | v6 pairs with Vite 8 (drops Babel, uses Oxc → smaller install, faster HMR). v5 also works with Vite 8 if a Babel-based plugin is ever needed. |
| **Tailwind CSS** | **4.3.0** | **MIT** ✅ | Styling the 4-pane shell + detail/tree panes | Tailwind v4 uses the **`@tailwindcss/vite`** plugin (4.3.0, MIT), not the old PostCSS pipeline. Faster, CSS-first config. |
### Supporting Libraries
| Library | Version | License | Purpose | When to Use |
|---------|---------|---------|---------|-------------|
| **`html-to-image`** | **PIN to `1.11.11`** ⚠️ (latest is 1.11.13) | **MIT** ✅ | In-browser PNG/SVG export of the React Flow graph (`toPng` / `toSvg`) | **MVP export path.** React Flow's own official example hard-pins `1.11.11` because **versions after 1.11.11 do not export images correctly** (open issue `bubkoo/html-to-image#516`). **Pin it; do not take `^1.11.11` or latest.** |
| **`@dagrejs/dagre`** | **3.0.0** | **MIT** ✅ | Auto-layout for the React Flow graph (DAG / hierarchical positioning of modules→functions) | Default layout engine. MIT, the standard React Flow layout pairing. CodeGraph gives edges but no coordinates, so you must lay out. |
| **`vite-plugin-singlefile`** | **2.3.3** | **MIT** ✅ | Build the **self-contained `viz/index.html`** (single double-clickable file, no install) | Build the viewer as a separate tiny Vite entry; this plugin inlines all JS+CSS into one HTML. Explicitly supports Vite 8 (peer `^5.4.21 \|\| ^6 \|\| ^7 \|\| ^8`). |
| **`mermaid`** | **11.15.0** | **MIT** ✅ | "Diagram source + preview" pane (Mermaid flowchart text → SVG, in-browser) | Use for the diagram-source pane and as an **alternate** `architecture.svg` exporter. Browser API: `const { svg } = await mermaid.render(id, def)` (Promise, returns SVG string). Browser-only (needs DOM) — fine, the app is a browser. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **`@tailwindcss/vite` 4.3.0** (MIT) | Tailwind v4 integration | Replaces PostCSS+autoprefixer for v4. Add to Vite `plugins`. |
| **TypeScript 6.0.3** (Apache-2.0, dev only) | Typed CLI + app | Apache-2.0 is a dev-time compiler license; emitted JS carries no license obligation. |
| **`sqlite3` CLI** (optional, for debugging) | Inspect `.codegraph/codegraph.db` by hand during dev | Already present on this box (3.39.3). Not a runtime dep. |
## CodeGraph output-consumption contract (the load-bearing decision)
### Why SQLite-direct for graph.json (not CLI JSON)
### How to read it safely (verified pattern)
- DB runs in **WAL mode** (`status --json` → `"journalMode":"wal"`, `"backend":"node-sqlite"`). Open **readonly** — confirmed working. To be safe against an in-progress index, run `codegraph index`/`sync` to completion (subprocess) **before** opening the DB; don't read mid-write.
- **The `.codegraph/` dir is gitignored by CodeGraph** (it writes its own `.gitignore`). The binary DB is a cache, not an artifact → this is *why* you must **export a normalized `graph.json` into `<repo>/docs/architecture/`** rather than committing the DB. Aligns with the project's "stable, versioned, agent-readable" requirement.
- **Run CodeGraph as a subprocess** (`init` → `index`/`sync` → then read DB). Honor the project's security constraint: spawn with an argv array (no shell string), validate the repo path (no traversal). Never `gitnexus setup`, never touch global `~/.claude/`.
- **De-dup edges** when normalizing: a function calling another twice yields two identical `calls` rows (observed). Collapse to unique `(source,target,kind)` (optionally keep a `count`).
### Where CLI JSON IS the right tool (live app detail pane)
- `codegraph callers <symbol> -p <repo> --json`
- `codegraph callees <symbol> -p <repo> --json`
- `codegraph impact <symbol> -p <repo> -d <depth> --json`
- `codegraph files -p <repo> --json` (file-tree pane: `path`, `language`, `nodeCount`, `size`)
## In-browser export (MVP, no external binary) — concrete approach
- `getViewportForBounds(bounds, width, height, minZoom, maxZoom)` returns `{x, y, zoom}` (verified signature, Context7 `/xyflow/web`).
- **Secondary exporter:** `mermaid.render(id, def)` returns an SVG **string** directly in-browser — use it when the user wants the *diagram-source* (Mermaid) rendered to `architecture.svg` instead of the React Flow canvas. No binary needed.
## Self-contained single-file `viz/index.html` — concrete approach
- A **minimal React Flow viewer** (read-only: pan/zoom/click, no editing toolbar) whose **graph data is the already-exported `graph.json`, inlined at build time** (or string-injected). Keep it lean → small enough to inline comfortably.
- React Flow + React inline fine (lightweight deps). **Confidence: HIGH** this is feasible for a read-only graph viewer.
- ❌ **No Web History routing** under `file://` → the viewer must use **in-memory / hash state only** (no React Router `BrowserRouter`).
- ❌ **`public/` assets and WASM are NOT inlined** → **do NOT ship D2/Mermaid WASM inside the single-file viewer.** Pre-render any needed diagram to inline SVG instead. (This is a second, independent reason D2-WASM-in-viewer is the wrong call — see below.)
- ❌ No code-splitting / sourcemaps / workers in the single file (plugin disables splitting by design).
- ✅ Set `build.assetsInlineLimit` high and let `useRecommendedBuildConfig` (default true) handle the rest.
## React Flow vs Cytoscape.js — center node-graph (primary + fallback)
| Criterion | **React Flow `@xyflow/react` 12.10.2** | **Cytoscape.js 3.33.4** |
|---|---|---|
| License | MIT ✅ | MIT ✅ |
| Custom/editable React nodes | **Excellent** (nodes are React components; rich detail, buttons, badges) | Weak (canvas-rendered; HTML overlays are bolt-ons) |
| Built-in in-browser image export | **Yes** (official html-to-image recipe) | Yes (`cy.png()` / `cy.jpg()`; SVG via `cytoscape-svg` ext) |
| Large-graph performance | Good to ~**a few hundred–~1–2k** rendered nodes (DOM-based; degrades as node count climbs) | **Excellent** at **thousands+** (canvas/WebGL); built-in graph algorithms + many layouts |
| Layouts | Bring-your-own (`@dagrejs/dagre`, optionally `elkjs`) | Many built-in (cola, dagre, fcose, …) |
| Fit for this project's 4-pane + custom detail nodes | **Best fit** | Overkill for typical repos; better for huge ones |
- **Primary = React Flow `@xyflow/react`.** It is the mandated stack and the right default: editable, custom React nodes are exactly what the center pane + clustering + per-node detail need, and the in-browser export story is first-class. Pair with **`@dagrejs/dagre`** for layout.
- **Fall back to Cytoscape.js when a target repo's graph is large** (rule of thumb: **> ~1,500–2,000 rendered nodes**, or noticeable pan/zoom jank). Mitigate first *within* React Flow via **module-level clustering / collapse** (CodeGraph's `contains` edges make file/module grouping natural) and lazy expansion — often that keeps you under the threshold without switching libraries.
- **Do not ship both in the single-file viewer.** The self-contained `viz/index.html` should embed only the React Flow read-only viewer to stay small.
## Installation
# CodeGraph CLI is already installed globally (@colbymchenry/codegraph). Do NOT bundle it.
# --- CLI package (reads CodeGraph SQLite, emits graph.json + ARCHITECTURE.md) ---
# --- App package (Vite + React + React Flow + Tailwind 4-pane) ---
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **better-sqlite3** (read DB) | Parse CodeGraph CLI JSON (`query`/`context`) | Only if CodeGraph ever ships a true "dump-all-nodes-and-edges" JSON command, or if a future build forbids native modules. Today the CLI JSON cannot produce a complete edge list with stable IDs — **don't**. |
| **better-sqlite3** | Node built-in `node:sqlite` (`DatabaseSync`) | Not yet. It's flagged **experimental** ("might change at any time") in Node 22.17 and **failed to open the CodeGraph DB** in my tests (errcode 14). Revisit only once it's stable + proven against WAL DBs. |
| **React Flow** | **Cytoscape.js 3.33.4** | Graphs with **thousands+** of nodes, or when you need built-in graph algorithms/layouts and don't need React-component nodes. |
| **`@dagrejs/dagre`** (layout) | **`elkjs` 0.11.1** | Need richer/orthogonal hierarchical routing than dagre. ⚠️ **elkjs is EPL-2.0 (weak copyleft)** — acceptable as an unmodified library dependency, but **prefer dagre (MIT)** to keep the client chain 100% MIT/MPL. |
| **html-to-image (in-browser)** | `d2` / `mmdc` / Graphviz **binaries** | Only in a non-MVP, opt-in "high-fidelity export" mode **if** the user installs the binary. Out of scope for MVP (binaries not installed; project says so). |
| **Mermaid (text→SVG in pane)** | **`@terrastruct/d2`** (D2 WASM, MPL-2.0) | If you specifically want D2 syntax rendered in-browser. **But see "What NOT to Use" — the 59.8 MB WASM is a poor fit** for this app and incompatible with the single-file viewer. Mermaid (MIT, tiny, browser-native) covers the diagram pane better. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **GitNexus (any client-facing path)** | **PolyForm Noncommercial** → commercial blocker. Hard project constraint: must not appear in `docs/architecture/` or any deliverable. | CodeGraph (MIT) for the shippable chain. (GitNexus may remain an internal-only optional deep-read, never emitted.) |
| **`html-to-image` `^1.11.11` / `1.11.12` / `1.11.13` / latest** | Versions **after 1.11.11 do not export images correctly** (React Flow's official example pins 1.11.11; open issue `bubkoo/html-to-image#516`). I confirmed npm latest is 1.11.13 — **do not take it.** | **Exact pin `html-to-image@1.11.11`.** |
| **Node `node:sqlite` (`DatabaseSync`) for the DB read** | **Experimental** in Node 22 ("might change at any time") **and failed to open the CodeGraph DB** in testing (errcode 14, "unable to open database file"). Unsuitable for a high-quality shippable tool. | **better-sqlite3 12.10.0 (MIT)** — verified reads the DB readonly. |
| **`@terrastruct/d2` (D2 WASM) inside the app/viewer** | License (MPL-2.0) is fine, but it's a **59.8 MB WASM** payload, **not inlinable** by `vite-plugin-singlefile` (WASM/`public/` excluded), and overkill when you already render via React Flow + Mermaid. | In-browser export via **html-to-image** (React Flow) and **Mermaid** (text→SVG). Keep D2 (the Go binary) as an *optional, opt-in, post-MVP* exporter only if a user has it installed. |
| **Graphviz / `d2` / `mmdc` external binaries (MVP)** | **Not installed locally**; MVP must export with zero extra install (project constraint). | In-browser **html-to-image** / **Mermaid**. |
| **`reactflow` (old package name)** | Pre-v12 package; superseded. React Flow 12 is published as **`@xyflow/react`**. Mixing them causes import/version confusion. | **`@xyflow/react@^12.10.2`** only. |
| **Tailwind v3 PostCSS pipeline** | Tailwind v4 changed integration to the **`@tailwindcss/vite`** plugin (CSS-first). Wiring v3-style `postcss.config` + `autoprefixer` is the wrong path on v4. | **`tailwindcss@^4.3.0` + `@tailwindcss/vite@^4.3.0`** plugin. |
| **`elkjs` as the default layout** | **EPL-2.0** (weak copyleft) — tolerable as a dependency but breaks the "100% MIT/MPL" cleanliness goal if you want zero copyleft anywhere. | **`@dagrejs/dagre@^3.0.0` (MIT)** as default; elkjs only if dagre's routing is insufficient. |
## Stack Patterns by Variant
- React Flow + `@dagrejs/dagre` layout + module clustering (collapse via `contains` edges).
- Single-file viewer = read-only React Flow + inlined `graph.json`.
- Because: best DX, custom detail nodes, smallest viewer payload.
- Keep React Flow as the *editable explorer* but **fall back to Cytoscape.js** for the high-density overview render.
- Because: Cytoscape's canvas renderer + built-in layouts scale to thousands; export still works (`cy.png()` / `cytoscape-svg`).
- Add an optional exporter shelling out to `d2` (MPL-2.0) or `mmdc`.
- Because: better aesthetics than html-to-image rasterization — but **never required**, never default, never in the MVP chain.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `vite@8.0.14` | `@vitejs/plugin-react@6.0.2` | v6 is the Vite 8 companion (Oxc-based). v5 also works with Vite 8 (verified in Vite 8 release notes). |
| `vite@8.0.14` | Node **20.19+ / 22.12+** | Hard floor (Vite 8 ESM-only / `require(esm)`). User on 22.17.0 ✅. |
| `vite@8.0.14` | `vite-plugin-singlefile@2.3.3` | Peer explicitly allows `^8.0.0` ✅. |
| `@xyflow/react@12.10.2` | `react@>=17` (so 18 **and** 19) | Peer `react >=17`, `react-dom >=17`. React 19 fine. |
| `tailwindcss@4.3.0` | `@tailwindcss/vite@4.3.0` | v4 integration is the Vite plugin, not PostCSS. |
| `better-sqlite3@12.10.0` | Node 22.x | Prebuilt binary loaded on this Win11 box without a compiler ✅. Native module → rebuild per Node major if Node is upgraded. |
| `@xyflow/react` | `html-to-image@1.11.11` (EXACT) | Pin required — later versions break export (issue #516). |
| `@colbymchenry/codegraph` 0.9.4↔0.9.7 | DB schema **v4** | Installed CLI = 0.9.4, npm latest = 0.9.7 (PROJECT.md said 0.9.4 — **note the drift**). Schema is migration-tracked; assert `MAX(schema_versions.version) >= 4` on read so a CLI bump doesn't silently break you. |
## Sources
- **Live CLI + DB inspection** (HIGH) — ran installed `codegraph` 0.9.4: indexed a test repo, captured `status/query/callers/callees/context/files/impact --json`, dumped the SQLite schema (`schema_versions`, `nodes`, `edges`, `files`, `unresolved_refs`, `project_metadata`), and **verified `better-sqlite3` reads it readonly** + that `node:sqlite` fails (errcode 14) and is flagged experimental.
- **npm registry** (HIGH, license source of truth) — `@colbymchenry/codegraph` 0.9.7/MIT · `@xyflow/react` 12.10.2/MIT · `mermaid` 11.15.0/MIT · `@terrastruct/d2` 0.1.33/MPL-2.0 (59.8 MB WASM) · `better-sqlite3` 12.10.0/MIT · `html-to-image` 1.11.13/MIT · `cytoscape` 3.33.4/MIT · `@dagrejs/dagre` 3.0.0/MIT · `elkjs` 0.11.1/EPL-2.0 · `vite` 8.0.14/MIT · `@vitejs/plugin-react` 6.0.2/MIT · `tailwindcss`+`@tailwindcss/vite` 4.3.0/MIT · `vite-plugin-singlefile` 2.3.3/MIT · `typescript` 6.0.3/Apache-2.0.
- **GitHub API `/license`** (HIGH, cross-check) — terrastruct/d2 = **MPL-2.0** · mermaid-js/mermaid = **MIT** · xyflow/xyflow = **MIT** · cytoscape/cytoscape.js = **MIT**.
- **Context7 `/xyflow/web`** (HIGH) — official "Download Image" example confirming **html-to-image pin to 1.11.11** (issue #516) and `getNodesBounds` / `getViewportForBounds(bounds, w, h, minZoom, maxZoom) → {x,y,zoom}` signatures.
- **Vite 8 announcement + plugin-react notes** (HIGH) — https://vite.dev/blog/announcing-vite8 — Rolldown, Node 20.19+/22.12+, plugin-react v6 pairing (v5 still compatible).
- **Mermaid v11 usage docs** (HIGH) — `const { svg } = await mermaid.render(id, def)`, browser-only, MIT.
- **`vite-plugin-singlefile` GitHub docs** (HIGH) — inlines all JS+CSS into one `index.html`; **no Web History routing under file://, no `public/`/WASM inlining, no code-splitting** — shapes the read-only viewer design.
### Could not fully verify (flagged)
- **Exact `DownloadButton.jsx` body** from React Flow's example site (page returned only partial content / 403 on raw npm). The bounds→viewport→`transform`→`toSvg` mechanism IS documented; only the literal glue is unconfirmed → **MEDIUM** on the precise `style.transform` string (budget ~30 min to wire/test).
- **Cytoscape vs React Flow node-count thresholds** are **MEDIUM** rules of thumb — measure on the dogfood repo before hard-coding a switch.
- **`@terrastruct/d2` size 59.8 MB** is npm `unpackedSize` (HIGH from registry); runtime/in-app WASM footprint may differ but is unquestionably large — recommendation stands.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
