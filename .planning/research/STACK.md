# Stack Research

**Domain:** Local developer tool — code-knowledge-graph reader → interactive node-graph app + committable architecture artifact bundle (CLI + Vite/React/React Flow desktop-web app)
**Researched:** 2026-05-31
**Confidence:** HIGH (every client-facing license + version cross-verified against npm registry AND GitHub API / Context7; CodeGraph output contract verified by actually running the installed CLI and inspecting its SQLite DB — not from memory)

> **License verdict up front:** The entire client-visible chain is permissive. All MIT except **D2 (MPL-2.0)** and the dev-only TypeScript compiler (Apache-2.0). Nothing copyleft-viral reaches a client deliverable. GitNexus (PolyForm Noncommercial) is **not** in any recommendation below. ✅

---

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

---

## CodeGraph output-consumption contract (the load-bearing decision)

**Recommendation: read the SQLite DB directly with `better-sqlite3` for the full-graph build. Use CLI JSON only for on-demand per-node detail (callers/callees/impact) in the live app.**

This was **verified empirically** — I indexed a real test repo with the installed `codegraph` 0.9.4 and inspected both the JSON outputs and the raw DB.

### Why SQLite-direct for graph.json (not CLI JSON)

1. **There is NO "dump entire graph" CLI command.** Every JSON command (`query`, `callers`, `callees`, `impact`, `context`) is **query/relevance-scoped**:
   - `query <term>` requires a search term and returns ranked matches (rich node objects, but you'd have to enumerate every symbol).
   - `context <task> --format json` has `nodes`/`edges` fields but is **semantic-relevance-scoped** and capped (`--max-nodes` default 50). In my test it returned **0 nodes** for a plausible query — it is NOT a full-graph dump.
   - `callers`/`callees`/`impact` JSON return **minimal records with NO node IDs** (just `name`/`kind`/`filePath`/`startLine`) — you cannot reliably reconstruct a unique edge list from them.
2. **The SQLite schema is complete, stable, and versioned.** Verified schema (CodeGraph 0.9.4):
   - `nodes(id, kind, name, qualified_name, file_path, language, start_line, end_line, start_column, end_column, docstring, signature, visibility, is_exported, is_async, is_static, is_abstract, decorators, type_parameters, updated_at)` — **stable string PKs** like `function:<hash>`, `file:<path>`, `import:<hash>`.
   - `edges(id, source, target, kind, metadata, line, col, provenance)` — `kind` ∈ {`contains`, `imports`, `calls`, …}; `source`/`target` are node IDs.
   - `files(path, content_hash, language, size, modified_at, indexed_at, node_count, errors)`.
   - **`schema_versions(version, applied_at, description)`** — migrations are tracked; current observed version = **4** ("Initial schema includes all migrations"). **Read MAX(version) on open and assert it's a version you support** → forward-compatible contract.
3. **The whole graph comes out in 2 queries** (`SELECT … FROM nodes` + `SELECT … FROM edges`), with stable IDs intact — exactly what a deterministic, versioned `graph.json` needs.

### How to read it safely (verified pattern)

```ts
import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = path.join(repoRoot, '.codegraph', 'codegraph.db');
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

const ver = db.prepare('SELECT MAX(version) AS v FROM schema_versions').get() as { v: number };
if (ver.v < 4) throw new Error(`Unsupported CodeGraph schema v${ver.v}; expected >= 4`);

const nodes = db.prepare(
  'SELECT id, kind, name, qualified_name, file_path, language, start_line, end_line, signature, is_exported FROM nodes'
).all();
const edges = db.prepare(
  'SELECT source, target, kind, line FROM edges'
).all();
db.close();
```

**Operational notes / gotchas:**
- DB runs in **WAL mode** (`status --json` → `"journalMode":"wal"`, `"backend":"node-sqlite"`). Open **readonly** — confirmed working. To be safe against an in-progress index, run `codegraph index`/`sync` to completion (subprocess) **before** opening the DB; don't read mid-write.
- **The `.codegraph/` dir is gitignored by CodeGraph** (it writes its own `.gitignore`). The binary DB is a cache, not an artifact → this is *why* you must **export a normalized `graph.json` into `<repo>/docs/architecture/`** rather than committing the DB. Aligns with the project's "stable, versioned, agent-readable" requirement.
- **Run CodeGraph as a subprocess** (`init` → `index`/`sync` → then read DB). Honor the project's security constraint: spawn with an argv array (no shell string), validate the repo path (no traversal). Never `gitnexus setup`, never touch global `~/.claude/`.
- **De-dup edges** when normalizing: a function calling another twice yields two identical `calls` rows (observed). Collapse to unique `(source,target,kind)` (optionally keep a `count`).

### Where CLI JSON IS the right tool (live app detail pane)

For the selected-node detail pane (callers / callees / impact + AI-explanation slot), shell out on demand:
- `codegraph callers <symbol> -p <repo> --json`
- `codegraph callees <symbol> -p <repo> --json`
- `codegraph impact <symbol> -p <repo> -d <depth> --json`
- `codegraph files -p <repo> --json` (file-tree pane: `path`, `language`, `nodeCount`, `size`)

These are human-meaningful, bounded, and match the existing `codegraph-cli` skill's contract. **Confidence: HIGH** (outputs captured live).

---

## In-browser export (MVP, no external binary) — concrete approach

**Primary: React Flow graph → `architecture.svg` / PNG via `html-to-image` (`toSvg` / `toPng`) + `getNodesBounds` + `getViewportForBounds`.**

This is the **only** export path that needs zero external binaries (no `d2`, `mmdc`, or Graphviz — none installed). Pattern (from React Flow's official "Download Image" example + API reference):

```ts
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toSvg, toPng } from 'html-to-image';   // PINNED 1.11.11

// Export the WHOLE graph, not just the visible viewport:
const nodesBounds = getNodesBounds(nodes);
const imageWidth = 1920, imageHeight = 1080;
const { x, y, zoom } = getViewportForBounds(nodesBounds, imageWidth, imageHeight, 0.5, 2);

const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement;
const svgString = await toSvg(viewportEl, {
  width: imageWidth, height: imageHeight, backgroundColor: '#ffffff',
  style: { width: `${imageWidth}px`, height: `${imageHeight}px`,
           transform: `translate(${x}px, ${y}px) scale(${zoom})` },
});
// svgString → write to docs/architecture/architecture.svg ; toPng(...) → PNG dataURL
```

- `getViewportForBounds(bounds, width, height, minZoom, maxZoom)` returns `{x, y, zoom}` (verified signature, Context7 `/xyflow/web`).
- **Secondary exporter:** `mermaid.render(id, def)` returns an SVG **string** directly in-browser — use it when the user wants the *diagram-source* (Mermaid) rendered to `architecture.svg` instead of the React Flow canvas. No binary needed.

**Confidence: HIGH** for the approach + the html-to-image pin; **MEDIUM** on the exact `style.transform` glue (the official `DownloadButton.jsx` body wasn't fully retrievable, but the bounds→viewport→transform mechanism is documented and standard — budget 30 min to wire).

---

## Self-contained single-file `viz/index.html` — concrete approach

**Build the viewer as a second, tiny Vite entry bundled with `vite-plugin-singlefile` (2.3.3, MIT).** It inlines all JS+CSS into one `dist/index.html` that opens by double-click with no server.

Architecture for the single file:
- A **minimal React Flow viewer** (read-only: pan/zoom/click, no editing toolbar) whose **graph data is the already-exported `graph.json`, inlined at build time** (or string-injected). Keep it lean → small enough to inline comfortably.
- React Flow + React inline fine (lightweight deps). **Confidence: HIGH** this is feasible for a read-only graph viewer.

**Hard gotchas (from the plugin's own docs — these shape the design):**
- ❌ **No Web History routing** under `file://` → the viewer must use **in-memory / hash state only** (no React Router `BrowserRouter`).
- ❌ **`public/` assets and WASM are NOT inlined** → **do NOT ship D2/Mermaid WASM inside the single-file viewer.** Pre-render any needed diagram to inline SVG instead. (This is a second, independent reason D2-WASM-in-viewer is the wrong call — see below.)
- ❌ No code-splitting / sourcemaps / workers in the single file (plugin disables splitting by design).
- ✅ Set `build.assetsInlineLimit` high and let `useRecommendedBuildConfig` (default true) handle the rest.

**Confidence: HIGH** on the tool choice + limitations (read straight from the plugin docs).

---

## React Flow vs Cytoscape.js — center node-graph (primary + fallback)

| Criterion | **React Flow `@xyflow/react` 12.10.2** | **Cytoscape.js 3.33.4** |
|---|---|---|
| License | MIT ✅ | MIT ✅ |
| Custom/editable React nodes | **Excellent** (nodes are React components; rich detail, buttons, badges) | Weak (canvas-rendered; HTML overlays are bolt-ons) |
| Built-in in-browser image export | **Yes** (official html-to-image recipe) | Yes (`cy.png()` / `cy.jpg()`; SVG via `cytoscape-svg` ext) |
| Large-graph performance | Good to ~**a few hundred–~1–2k** rendered nodes (DOM-based; degrades as node count climbs) | **Excellent** at **thousands+** (canvas/WebGL); built-in graph algorithms + many layouts |
| Layouts | Bring-your-own (`@dagrejs/dagre`, optionally `elkjs`) | Many built-in (cola, dagre, fcose, …) |
| Fit for this project's 4-pane + custom detail nodes | **Best fit** | Overkill for typical repos; better for huge ones |

**Recommendation:**
- **Primary = React Flow `@xyflow/react`.** It is the mandated stack and the right default: editable, custom React nodes are exactly what the center pane + clustering + per-node detail need, and the in-browser export story is first-class. Pair with **`@dagrejs/dagre`** for layout.
- **Fall back to Cytoscape.js when a target repo's graph is large** (rule of thumb: **> ~1,500–2,000 rendered nodes**, or noticeable pan/zoom jank). Mitigate first *within* React Flow via **module-level clustering / collapse** (CodeGraph's `contains` edges make file/module grouping natural) and lazy expansion — often that keeps you under the threshold without switching libraries.
- **Do not ship both in the single-file viewer.** The self-contained `viz/index.html` should embed only the React Flow read-only viewer to stay small.

**Confidence: HIGH** on the recommendation; node-count thresholds are **MEDIUM** (rules of thumb, repo-dependent — measure on your dogfood repo).

---

## Installation

```bash
# CodeGraph CLI is already installed globally (@colbymchenry/codegraph). Do NOT bundle it.

# --- CLI package (reads CodeGraph SQLite, emits graph.json + ARCHITECTURE.md) ---
npm install better-sqlite3@^12.10.0
npm install -D typescript@^6.0.3 @types/node @types/better-sqlite3

# --- App package (Vite + React + React Flow + Tailwind 4-pane) ---
npm install react@^19 react-dom@^19 @xyflow/react@^12.10.2
npm install @dagrejs/dagre@^3.0.0 mermaid@^11.15.0
npm install html-to-image@1.11.11   # EXACT PIN — no caret. Later versions break export.
npm install -D vite@^8.0.14 @vitejs/plugin-react@^6.0.2 \
               tailwindcss@^4.3.0 @tailwindcss/vite@^4.3.0 \
               vite-plugin-singlefile@^2.3.3 typescript@^6.0.3
```

> ⚠️ `html-to-image` is the **one** pin that must be exact (`1.11.11`, no `^`). Everything else can take a caret.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **better-sqlite3** (read DB) | Parse CodeGraph CLI JSON (`query`/`context`) | Only if CodeGraph ever ships a true "dump-all-nodes-and-edges" JSON command, or if a future build forbids native modules. Today the CLI JSON cannot produce a complete edge list with stable IDs — **don't**. |
| **better-sqlite3** | Node built-in `node:sqlite` (`DatabaseSync`) | Not yet. It's flagged **experimental** ("might change at any time") in Node 22.17 and **failed to open the CodeGraph DB** in my tests (errcode 14). Revisit only once it's stable + proven against WAL DBs. |
| **React Flow** | **Cytoscape.js 3.33.4** | Graphs with **thousands+** of nodes, or when you need built-in graph algorithms/layouts and don't need React-component nodes. |
| **`@dagrejs/dagre`** (layout) | **`elkjs` 0.11.1** | Need richer/orthogonal hierarchical routing than dagre. ⚠️ **elkjs is EPL-2.0 (weak copyleft)** — acceptable as an unmodified library dependency, but **prefer dagre (MIT)** to keep the client chain 100% MIT/MPL. |
| **html-to-image (in-browser)** | `d2` / `mmdc` / Graphviz **binaries** | Only in a non-MVP, opt-in "high-fidelity export" mode **if** the user installs the binary. Out of scope for MVP (binaries not installed; project says so). |
| **Mermaid (text→SVG in pane)** | **`@terrastruct/d2`** (D2 WASM, MPL-2.0) | If you specifically want D2 syntax rendered in-browser. **But see "What NOT to Use" — the 59.8 MB WASM is a poor fit** for this app and incompatible with the single-file viewer. Mermaid (MIT, tiny, browser-native) covers the diagram pane better. |

---

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

---

## Stack Patterns by Variant

**If the target repo is small/medium (typical, < ~1,500 nodes):**
- React Flow + `@dagrejs/dagre` layout + module clustering (collapse via `contains` edges).
- Single-file viewer = read-only React Flow + inlined `graph.json`.
- Because: best DX, custom detail nodes, smallest viewer payload.

**If the target repo is large (thousands of nodes, React Flow janky even after clustering):**
- Keep React Flow as the *editable explorer* but **fall back to Cytoscape.js** for the high-density overview render.
- Because: Cytoscape's canvas renderer + built-in layouts scale to thousands; export still works (`cy.png()` / `cytoscape-svg`).

**If a user later wants publication-grade diagrams and has binaries installed (post-MVP, opt-in):**
- Add an optional exporter shelling out to `d2` (MPL-2.0) or `mmdc`.
- Because: better aesthetics than html-to-image rasterization — but **never required**, never default, never in the MVP chain.

---

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

---

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

---
*Stack research for: local code-graph visualization tool (CLI + Vite/React/React Flow), permissive-only client chain*
*Researched: 2026-05-31*
