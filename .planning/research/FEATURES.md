# Feature Research

**Domain:** Local code-architecture / dependency / call-graph visualization tool (CodeGraph-backed, client-presentable, agent-readable)
**Researched:** 2026-05-31
**Confidence:** HIGH (table stakes + anti-features grounded in surveyed tools; differentiators grounded in PROJECT.md constraints + closest-analog tools)

## How To Read This

Every feature below is tagged for the **4-pane layout** from PROJECT.md:

- **P1 — Tree** = repo/module/file tree (left rail)
- **P2 — Graph** = React Flow node-graph (center)
- **P3 — Detail** = selected-node detail (callers/callees/impact + AI-explanation slot)
- **P4 — Diagram** = diagram source (D2/Mermaid) + SVG preview/export

Plus two non-pane targets that the panes feed:
- **CLI** = `arch-viz scan` pipeline (produces `graph.json`)
- **Bundle** = committed `docs/architecture/` artifacts (`graph.json` + `ARCHITECTURE.md` + `architecture.svg` + `viz/index.html`)

Complexity: **S** (≈≤1 day, library-provided or thin glue) · **M** (≈2-4 days, real logic) · **L** (≈1wk+, hard correctness/UX surface).

---

## Tools Surveyed (grounding)

| Tool | What it taught us | License note |
|------|-------------------|--------------|
| **Sourcetrail** (archived FOSS) | The canonical 3-view model = **search + interactive symbol/call graph + code view**. Graph re-centers on selected symbol; node grouping by namespace/file; call-graph shows caller side AND callee side; depth-limited "custom trails." This is the closest UX analog to our 4-pane. | GPLv3 (don't reuse code) |
| **CodeSee** (acq. GitKraken) | Auto-generated **self-maintaining** maps; upstream+downstream dependencies; **change-impact / blast-radius** ("how risky is this refactor"); labels/color-coding/tours for **knowledge transfer**; AI Q&A over codebase. Validates impact-analysis + AI-explain as real differentiators. | Commercial/hosted |
| **dependency-cruiser** | Folder/**directory boundary** clustering in graph; `--max-depth` to tame size; **self-contained HTML report**; rule validation (out of scope for us). | MIT |
| **Madge** | Minimal viable feature set: dep graph, **circular-dependency detection**, color-coding (blue=has deps, green=leaf, red=circular), image export. Sets the floor. | MIT |
| **aider repo-map** | Tree-sitter symbol graph + **PageRank to rank "most important" symbols** so you don't dump everything. Directly informs default graph seeding + AI-pane context budgeting. | Apache-2.0 |
| **CodeBoarding** | LLM+static analysis → **layered architecture diagrams** + component docs + **Mermaid committed to repo** (`.codeboarding/`). Validates "committed, embeddable, layered." | (check) |
| **DeepWiki** (Cognition) | AI wiki with **source-linked citations** (explanation → exact file+line); "Deep Research" multi-file mode; MCP server for agents. Informs AI-pane: cite back to nodes, don't hallucinate. | Hosted |
| **CodeAtlas (Picrew)** | **Single self-contained `codeatlas.html` (file:// friendly) + `module-map.json` + `summary.md` in one run**; embedded JSON; layered relationship graph + framework-flow graph. This is almost exactly our bundle shape — strong validation. | (check) |
| **Axon** | Force-directed graph (Sigma/WebGL) + file-tree sidebar + **symbol detail panel with code preview, callers/callees, impact analysis, BFS-depth blast radius**. Validates the P3 detail-pane contents. | (check) |
| **CodeCharta** | City metaphor + **hotspot detection** + **fully local / privacy-first** ("code never leaves your machine"). Validates local-only posture; city metaphor is an anti-feature for us (see below). | BSD-3 |
| **Structurizr** | C4 "models-as-code"; one model → many views; **diagrams-as-code in version control**; explicitly drops the C4 "Code" level as "too detailed to keep current" → that level is *exactly* what auto-generation (us) should own. | Commercial + OSS libs |
| **React Flow / @xyflow** | Built-ins we get for free: **MiniMap, Controls (zoom/fit/lock), Background, Panel, NodeToolbar, NodeResizer**; **sub-flows/grouping via `parentId` + `group` node type**; layout examples (Dagre, ELK, force, **expand/collapse**). | MIT |

---

## Feature Landscape

### Table Stakes (Users Expect These)

If any of these is missing, the tool "feels broken" relative to Sourcetrail / CodeSee / Madge / dep-cruiser. Users give no credit for having them, but penalize hard for absence.

| Feature | Why Expected | Complexity | Pane | Notes |
|---------|--------------|------------|------|-------|
| **Module/dependency graph** | The baseline of the entire category (Madge, dep-cruiser, Sourcetrail). | **M** | P2 | Nodes = modules/files, edges = imports/deps from CodeGraph `query`/`files`. React Flow + a layout engine (Dagre or ELK). |
| **Call graph (function-level callers↔callees)** | Sourcetrail/Axon center on this; CodeGraph ships `callers`/`callees` natively. | **M** | P2 + P3 | Two granularities (module vs function) — let user toggle/drill. Maps 1:1 to CodeGraph CLI. |
| **Auto layout (hierarchical/directed)** | Hand-placed nodes feel broken; Madge defaults to Graphviz `dot`. | **S** | P2 | Use ELK or Dagre layered layout (directed graphs have direction). React Flow has both as examples. |
| **Zoom / pan / fit-to-view** | Non-negotiable for any canvas. | **S** | P2 | React Flow `Controls` built-in (zoom, fit, lock). |
| **Minimap** | Expected for any non-trivial graph; orientation aid. | **S** | P2 | React Flow `MiniMap` built-in; color nodes by type/layer. |
| **Symbol/file search + jump-to** | Sourcetrail's #1 feature; without it big graphs are unusable. | **M** | P1 → P2/P3 | Search box with autocomplete over symbols/files; selecting re-centers graph + opens detail. |
| **Click node → detail** | Core interaction of every explorer (Sourcetrail, Axon, CodeSee). | **M** | P2 → P3 | Selecting a node populates P3 (signature, path, callers, callees, metrics). |
| **Clustering by folder/module** | dep-cruiser's directory boundaries; Sourcetrail's group-by-namespace/file. Without it the graph is a hairball. | **M** | P2 | React Flow sub-flows (`parentId`/`group`). Group nodes by directory by default. |
| **Collapse / expand groups** | Required to manage scale; React Flow ships an expand/collapse example. | **M** | P2 | Collapse a folder-group into a supernode; expand on demand. **Depends on clustering.** |
| **Filtering (by path / type / depth)** | dep-cruiser `--max-depth`; the single most-cited cure for the "hairball." Treat as table stakes, not polish. | **M** | P1 + P2 | Filter by directory subtree, node type (module/fn/external), and BFS depth from a focus node. |
| **Circular / problematic edge highlight** | Madge's headline feature (red = circular). Cheap signal, high expectation. | **S** | P2 | Detect cycles in the edge set; color/badge them. |
| **Export graph to image (SVG + PNG)** | Madge/dep-cruiser/CodeCharta all export; needed to put a picture in a doc/slide. | **M** | P2/P4 | In-browser (MVP rule: no external `d2`/`mmdc` binary). SVG from React Flow DOM or from D2/Mermaid render; PNG via canvas. |
| **External-dependency distinction** | Madge excludes node_modules by default; users expect "my code vs third-party" separation. | **S** | P2 | Style/section external/library nodes differently; allow hide. |
| **Color/legend by category** | Madge color scheme; CodeSee color-coding. Needed so a stranger can read the picture. | **S** | P2 + P4 | Legend keyed to layer/type/health. Feeds "presentable" bar. |
| **Local-only, no upload** | CodeCharta's explicit promise ("code stays private"); expected of a local dev tool. | **S** | all | Default no network. Only the optional AI pane may egress, opt-in (PROJECT.md constraint). |

> **The hairball is the #1 latent failure mode.** Graph-viz research is unanimous: above a few hundred visible nodes, *no* layout saves you — you must **filter/cluster/focus before laying out**. For this tool that means: **default view = top-level modules collapsed**, expand-on-demand, and "focus a node → show its neighborhood at depth N" rather than "render the whole repo." Treat clustering + collapse + filtering + focus-mode as a **single table-stakes bundle**, not separable nice-to-haves. (Cambridge Intelligence; "Grooming the hairball"; arXiv FACETS.)

### Differentiators (Competitive Advantage)

These align with PROJECT.md Core Value: *point at any repo → committable, presentable, agent-readable architecture picture, all-permissive chain*. Don't differentiate on everything — these five are the bet.

| Feature | Value Proposition | Complexity | Pane | Notes |
|---------|-------------------|------------|------|-------|
| **Impact / blast-radius from CodeGraph** ("what breaks if I touch this") | CodeSee's "how risky is this refactor" + Axon's BFS-depth impact, but driven by CodeGraph's real `callers` transitive closure — a concrete answer, not a vibe. | **M** | P3 (+ P2 highlight) | Compute transitive callers (upstream) to configurable depth; render count + list in P3 and **highlight the affected subgraph in P2**. Distinguish direct vs indirect callers (Drift/REACHER pattern). **Caveat to surface:** static call graphs over-approximate — label confidence, don't claim runtime certainty. |
| **AI-explanation of a selected node** (grounded slot) | CodeSee/DeepWiki prove demand; our edge = explanation is **grounded in the node's graph context** (callers/callees/signature) and **cites back** to file/symbol, à la DeepWiki source-links — so it's trustworthy and presentable. | **M** | P3 | Opt-in, explicit code egress (PROJECT.md security). Feed the LLM the node + its CodeGraph neighborhood + ranked-important neighbors (aider PageRank trick) so the explanation is bounded and accurate. Anti-hallucination: only explain what's in the graph; cite nodes. |
| **Committed, versioned, agent-readable `graph.json`** | Unique combo: a **stable, explicitly-versioned, documented schema** that an AI agent can read AND safely update, living in the target repo. Structurizr/CodeBoarding commit diagrams; few commit a *machine-contract* graph for agents. | **L** | CLI → Bundle | Schema versioning + JSON Schema doc is the hard part (forward-compat, deterministic node IDs). This is the spine everything else reads. **Everything downstream depends on this.** |
| **Self-contained shareable `viz/index.html`** | Picrew CodeAtlas (`codeatlas.html`, file:// friendly) + dep-cruiser HTML report prove the pattern; hand a client one file, no install, no server. | **M** | Bundle (renders P2/P3 read-only) | Inline JSON + JS into one HTML; opens from disk. Must **escape all code symbols/paths** (PROJECT.md: no HTML/JS injection). Read-only subset of the live app. |
| **Diff-friendly graph.json (stable IDs, sorted, deterministic)** | Makes the committed artifact reviewable in PRs — architecture changes show up as readable diffs (Structurizr's "diagrams-as-code in VCS" value, but for the data). | **M** | CLI → Bundle | Deterministic ordering + stable node IDs (path/symbol-based, not run-order) so regenerating yields minimal diffs. **Depends on / co-designed with the schema.** A subtle but high-leverage feature for the "committable" promise. |

**Secondary differentiators (valuable, lower priority):**

| Feature | Value Proposition | Complexity | Pane | Notes |
|---------|-------------------|------------|------|-------|
| **Layered / architectural grouping** (C4-ish levels) | Structurizr's multi-level view + CodeBoarding's "layered diagrams"; lets the picture read as *architecture*, not just file soup. | **L** | P2 + P4 | Group modules into layers (e.g. ui / domain / data / external) via config or heuristics. Elevates "presentable to a client." Hard because layer assignment is semantic. |
| **`ARCHITECTURE.md` narrative with embedded diagram** | CodeBoarding/DeepWiki ship prose+diagram; a human-readable narrative is what a client/teammate actually reads first. | **M** | Bundle | Generate from graph stats + (optionally) AI summary; embed `architecture.svg`. Both human- and agent-readable. |
| **D2/Mermaid source emission + preview** | Diagrams-as-code lets users paste into their own docs/PRs (Mermaid embeds in GitHub natively). | **M** | P4 | Generate D2 *and/or* Mermaid text from graph.json; render in-browser (Mermaid is JS-native/DOM; D2 via WASM). **License: D2 = MPL-2.0, Mermaid = MIT — both OK.** Prefer Mermaid for GitHub-native embedding; D2 for nicer layouts. |
| **"Presentation polish" pass** (legend, title, clean default zoom, consistent palette) | The explicit HIGH quality bar / "shown to clients." Sourcetrail/Madge look utilitarian; CodeSee looks like a product. | **M** | P2 + P4 + Bundle | Not one feature — a cross-cutting bar: sensible default framing, readable labels, a legend, a title block, restrained palette. Budget for it; it's what separates "internal tool" from "client deliverable." |
| **Dogfood self-visualization** | PROJECT.md requirement; also the best demo asset. | **S** | — | Run the tool on itself once it has code; ship that bundle as the example. |

### Anti-Features (Deliberately NOT Build)

Documented to prevent scope creep. Most are confirmed by PROJECT.md "Out of Scope"; the rest are category traps observed in surveyed tools.

| Feature | Why Requested / Surface Appeal | Why Problematic | Alternative |
|---------|-------------------------------|-----------------|-------------|
| **Editing source code from the graph** | "I'm already looking at the code, let me change it." | Turns a viewer into an IDE; unbounded scope; correctness/safety burden. PROJECT.md: "visualization + export only." | Read-only. Link out to the file/line; the user's own editor edits. |
| **"What should I change" / refactor advice** | AI is right there; feels natural to ask "how do I fix this." | The tool answers *"what IS there,"* not *"what SHOULD be."* That's owned by GSD/UIUX/QA/AppSec (PROJECT.md). Architectural opinions need accountability the tool can't carry. | AI pane *explains* the current node only. Decisions stay with the human + the decision-owning systems. |
| **Cloud / hosted service / SaaS** | CodeSee/DeepWiki are hosted; "let me share a URL." | PROJECT.md: local tool only. Hosting = auth, infra, code-egress liability, license exposure. | Self-contained `viz/index.html` is the "share" story — a file, not a server. |
| **Becoming a general IDE / editor** | Sourcetrail-as-workbench creep. | Bottomless. PROJECT.md hard line. | Stay a visualizer + exporter. Integrate by *linking out*, not absorbing. |
| **Real-time collaboration / multiplayer** | "Let's explore the graph together live." | Needs server, presence, conflict resolution — contradicts local-only; massive complexity for a personal/on-demand tool. | Share the committed bundle / HTML asynchronously. Git is the collaboration layer. |
| **Real-time auto-watch / live-updating model** (à la Code Atlas.live "watches your keystrokes") | "Diagram should update as I type." | This tool is **on-demand** (`arch-viz scan`), summoned per project (PROJECT.md). A file-watcher/daemon contradicts the "summoned, then commits an artifact" model and adds a long-running process. | Re-run `scan` on demand / in CI. The *committed* artifact is the point, not a live mirror. |
| **GitNexus anywhere in client-facing output** | It's a deeper repo-reader. | **PolyForm Noncommercial license = commercial blocker** (PROJECT.md hard constraint). | CodeGraph (MIT) is the primary source. GitNexus stays INTERNAL-only optional deep-read, never in `docs/architecture/`. |
| **Harness subsystem / global install / hook registration** | "Make it always-on across all projects." | PROJECT.md hard boundary: no global `~/.claude/` mutation, no `gitnexus setup`, no hooks, not in skills manifest. | Lives in `tools/arch-viz-studio/`, invoked explicitly. |
| **3D code-city metaphor** (CodeCharta/CodeCity) | Looks impressive in screenshots. | Pretty ≠ presentable-to-a-client-for-*architecture*. 3D cities communicate *metrics/size*, not *dependency structure* — and they're navigation-hostile and heavy. Off-message for "show the architecture." | 2D node-graph + clean layout + legend. Keep it legible. |
| **Dependency rule-validation / CI gating** (dep-cruiser's signature feature) | "Fail the build on a forbidden import." | That's a *linting/policy* product, a different job with different UX. Mixing it in dilutes "visualize what IS there." | Out of scope. (QA/AppSec own gating.) The graph can *reveal* cycles; it doesn't *enforce* policy. |
| **Generic full-repo "render everything" graph** | "Just show me the whole thing." | The hairball. Guaranteed unreadable above a few hundred nodes; kills the "presentable" promise. | Default to collapsed top-level + focus/expand on demand. Never auto-render the full node set. |
| **Multi-language deep semantic analysis beyond CodeGraph** | "Add type inference / data-flow / runtime tracing." | Re-implements a compiler; CodeGraph (tree-sitter) is the agreed source of truth and its precision is the contract. | Consume CodeGraph's output. Surface its limits honestly (static = over-approximation). |

---

## Feature Dependencies

```
[CLI: arch-viz scan → CodeGraph subprocess]
    └──produces──> [graph.json (versioned, documented schema)]   ◄── THE SPINE
                       ├──read by──> [P2 Graph render]
                       │                  ├──requires──> [Auto layout (ELK/Dagre)]
                       │                  ├──requires──> [Clustering by folder]
                       │                  │                  └──requires──> [Collapse/Expand]
                       │                  ├──enhanced by──> [Filtering (path/type/depth)]
                       │                  └──enhanced by──> [Focus mode / neighborhood-at-depth]
                       ├──read by──> [P1 Tree]  ──drives selection──> [P2 + P3]
                       ├──read by──> [P3 Detail]
                       │                  ├──requires──> [Callers/callees (CodeGraph)]
                       │                  ├──requires──> [Impact / blast-radius]  (transitive callers)
                       │                  └──slot for──> [AI explanation]  (opt-in egress)
                       ├──read by──> [P4 D2/Mermaid emission] ──> [in-browser SVG/PNG export]
                       └──read by──> [Bundle]
                                          ├──> [architecture.svg]   (from P4 render or P2)
                                          ├──> [ARCHITECTURE.md]    (narrative + embedded svg)
                                          └──> [viz/index.html]     (self-contained; inline graph.json)

[Diff-friendly graph.json] ──co-designed-with──> [graph.json schema]   (deterministic IDs + ordering)
[Search] ──drives──> [selection] ──drives──> [P2 re-center + P3 populate]
[Presentation polish] ──cross-cuts──> [P2, P4, Bundle]
[Impact highlight in P2] ──requires──> [Impact compute in P3]
```

### Dependency Notes

- **Everything depends on `graph.json`.** The schema (versioning, deterministic node IDs, documentation) is the load-bearing wall. Get it wrong and every pane + the bundle + agent-readability + diff-friendliness inherit the damage. **Build and freeze this first.**
- **Collapse/Expand requires Clustering** which requires the graph to carry folder/module grouping. Design grouping into the schema, not bolted on.
- **Impact-highlight-in-P2 requires Impact-compute-in-P3** — the transitive-caller computation produces the node set that P2 then styles. Same feature, two surfaces.
- **Diff-friendly graph.json is co-designed with the schema**, not a later pass — deterministic IDs/ordering must be baked into the emitter from day one (retrofitting stable IDs is painful).
- **AI explanation enhances P3 but must not block it** — P3 (signature/callers/callees/impact) is fully useful with the AI slot empty. Ship P3 deterministic-first; AI is an opt-in overlay (also respects the explicit-egress security constraint).
- **`architecture.svg` can come from either P2 (React Flow DOM → SVG) or P4 (D2/Mermaid render).** Decide one canonical source for the *committed* svg to avoid two divergent "official" pictures. (Recommendation: P4/D2 for the committed static svg — cleaner layout for a client; P2 stays the interactive surface.)
- **Self-contained HTML conflicts with "live CodeGraph queries."** The HTML is a *frozen snapshot* of graph.json — it cannot re-query CodeGraph. So any feature that needs live CLI calls (e.g. re-running impact at a new depth) is app-only, not HTML-bundle. Scope the HTML to read-only-from-embedded-JSON.
- **Filtering/Focus mode conflicts with "show everything."** They are the same surface; the resolution is a hard product stance: **focus is the default, full-render is never offered.**

---

## MVP Definition

### Launch With (v1) — proves the Core Value end-to-end

The thinnest slice that delivers *"point at a repo → committable, presentable, agent-readable picture."*

- [ ] **CLI `arch-viz scan` → CodeGraph subprocess → `graph.json`** — without this there is no product. (CLI)
- [ ] **Versioned, documented, deterministic graph.json schema** — the spine; agent-readable + diff-friendly from day one. (CLI/Bundle)
- [ ] **P2 module/dependency graph** with **auto-layout, zoom/pan/fit, minimap** — the core picture. (P2)
- [ ] **Folder clustering + collapse/expand + basic filtering** — the anti-hairball bundle; without it the graph is unpresentable. (P2)
- [ ] **P1 tree** + **symbol/file search** → selects a node. (P1)
- [ ] **P3 detail: signature/path + callers + callees** (CodeGraph, deterministic). (P3)
- [ ] **In-browser SVG + PNG export** (no external binary). (P2/P4)
- [ ] **`ARCHITECTURE.md` + `architecture.svg` + self-contained `viz/index.html`** committed to `docs/architecture/`. (Bundle)
- [ ] **HTML/path escaping** in the bundle (security must-have, not optional). (Bundle)
- [ ] **Dogfood**: visualize the tool itself or one mature repo; ship as the demo. (—)

### Add After Validation (v1.x) — once the core picture is trusted

- [ ] **Impact / blast-radius** (transitive callers, depth-configurable) in P3 + highlight in P2 — *trigger:* core graph proven readable. (P3/P2)
- [ ] **D2 + Mermaid source emission + in-browser preview** in P4 — *trigger:* users ask to paste diagrams into their own docs. (P4)
- [ ] **Circular-dependency highlight** — cheap, high-signal. (P2)
- [ ] **Function-level call-graph drill-down** (toggle module↔function granularity) — *trigger:* module view too coarse for real questions. (P2)
- [ ] **Presentation-polish pass** (legend, title block, palette, default framing) — *trigger:* first time it's actually shown to a client. (cross-cut)

### Future Consideration (v2+) — defer until the above is solid

- [ ] **AI-explanation pane** (opt-in code egress, grounded + cited) — *defer:* needs the deterministic P3 + egress consent UX first; PROJECT.md marks it "[optional/later]." (P3)
- [ ] **Layered / C4-ish architectural grouping** — *defer:* semantic layer assignment is genuinely hard; do it once heuristics/config are worth it. (P2/P4)
- [ ] **Hotspot overlay** (churn/complexity color, CodeCharta-style) — *defer:* needs git-history ingest; nice but off the critical path. (P2)
- [ ] **GitNexus internal-only deep-read** (INTERNAL, never in deliverables) — *defer:* only if CodeGraph proves insufficient; license-fenced. (CLI internal)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| graph.json schema (versioned, deterministic) | HIGH | HIGH | **P1** |
| CLI scan → CodeGraph → graph.json | HIGH | MEDIUM | **P1** |
| P2 dependency graph + layout + zoom/minimap | HIGH | MEDIUM | **P1** |
| Clustering + collapse/expand + filter (anti-hairball) | HIGH | MEDIUM | **P1** |
| P1 tree + search → select | HIGH | MEDIUM | **P1** |
| P3 callers/callees/signature | HIGH | MEDIUM | **P1** |
| In-browser SVG/PNG export | HIGH | MEDIUM | **P1** |
| Bundle: ARCHITECTURE.md + svg + self-contained HTML | HIGH | MEDIUM | **P1** |
| HTML/path escaping (security) | HIGH | LOW | **P1** |
| Impact / blast-radius (+ P2 highlight) | HIGH | MEDIUM | **P2** |
| D2/Mermaid emission + preview | MEDIUM | MEDIUM | **P2** |
| Circular-dependency highlight | MEDIUM | LOW | **P2** |
| Function-level call-graph drill-down | MEDIUM | MEDIUM | **P2** |
| Presentation polish (legend/title/palette) | HIGH | MEDIUM | **P2** |
| AI-explanation pane (opt-in, grounded) | MEDIUM | MEDIUM | **P3** |
| Layered / C4 architectural grouping | MEDIUM | HIGH | **P3** |
| Hotspot / churn overlay | LOW | MEDIUM | **P3** |

**Priority key:** P1 = must-have for launch · P2 = should-have, add when possible · P3 = nice-to-have / future.

---

## Competitor Feature Analysis

| Feature | Sourcetrail (closest UX analog) | CodeSee (closest product analog) | CodeAtlas-Picrew (closest bundle analog) | Our Approach |
|---------|--------------------------------|----------------------------------|------------------------------------------|--------------|
| Graph centerpiece | Interactive symbol/call graph, re-centers on selection | Auto map, services/files/deps | Layered relationship + framework-flow graph | React Flow node-graph, focus-on-select, folder-clustered (P2) |
| Detail pane | Code view (snippets) beside graph | File/change detail | summary.md | P3: signature + callers/callees + **impact** + AI slot (not a code editor) |
| Impact / blast-radius | Depth-limited custom trails | "How risky is this refactor" | — | CodeGraph transitive callers, depth-config, highlighted in P2 |
| Clustering | Group by namespace/file | Color/labels/tours | Layered groups | Folder grouping + collapse/expand + filter (anti-hairball default) |
| Export / artifact | (none committed) | Hosted maps | **codeatlas.html + module-map.json + summary.md** | **graph.json + ARCHITECTURE.md + architecture.svg + self-contained HTML**, committed to target repo |
| Agent-readable data | No | API/MCP (hosted) | module-map.json (informal) | **Versioned, documented, diff-friendly graph.json** (explicit machine contract) |
| AI explanation | No | AI Q&A | No | Opt-in, **grounded in node's graph context + cited** (DeepWiki-style), explain-only |
| Hosting | Local desktop (GPLv3) | Cloud | Local file | **Local only**, all-permissive chain (CodeGraph MIT / React Flow MIT / D2 MPL-2.0 / Mermaid MIT) |
| Editing | No (explorer) | No | No | **No** (visualize + export only) |
| Live auto-update | Re-index on change | Self-maintaining (hosted) | One-shot run | **On-demand `scan`**; artifact is the deliverable (no daemon/watcher) |

---

## Sources

Tools & products analyzed:
- [Sourcetrail — DOCUMENTATION.md (CoatiSoftware)](https://github.com/CoatiSoftware/Sourcetrail/blob/master/DOCUMENTATION.md) + [Wikipedia](https://en.wikipedia.org/wiki/Sourcetrail)
- [CodeSee — Codebase Maps](https://www.codesee.io/codebase-maps) + [Code Visualization](https://www.codesee.io/learning-center/code-visualization) + [C4 Diagram](https://www.codesee.io/learning-center/c4-diagram)
- [dependency-cruiser (sverweij)](https://github.com/sverweij/dependency-cruiser) + [Netlify: visualize a project's dependency graph](https://www.netlify.com/blog/2018/08/23/how-to-easily-visualize-a-projects-dependency-graph-with-dependency-cruiser/)
- [Madge (pahen)](https://github.com/pahen/madge)
- [aider — Building a better repository map with tree-sitter](https://aider.chat/2023/10/22/repomap.html) + [Repository map docs](https://aider.chat/docs/repomap.html)
- [CodeBoarding](https://github.com/CodeBoarding/CodeBoarding)
- [DeepWiki — complete guide](https://codersera.com/blog/deepwiki-complete-guide-2026/) + [Devin docs](https://docs.devin.ai/work-with-devin/deepwiki)
- [CodeAtlas (Picrew) — single-file architecture map skill](https://github.com/Picrew/CodeAtlas)
- [Axon (harshkedia177) — graph-powered code intelligence](https://github.com/harshkedia177/axon) + [code-graph-mcp (sdsrss)](https://github.com/sdsrss/code-graph-mcp) + [Drift — Call Graph Analysis](https://github.com/dadbodgeoff/drift/wiki/Call-Graph-Analysis)
- [CodeCharta (MaibornWolff)](https://github.com/MaibornWolff/codecharta) + [CodeCity (Wettel)](https://wettel.github.io/codecity.html)
- [Structurizr](https://structurizr.com/) + [C4 model](https://c4model.com/)
- [React Flow — MiniMap](https://reactflow.dev/api-reference/components/minimap) + [Sub Flows](https://reactflow.dev/learn/layouting/sub-flows) + [Built-In Components](https://reactflow.dev/learn/concepts/built-in-components)

Rendering / export specifics:
- [Mermaid — Usage / render API](https://mermaid.js.org/config/usage.html) + [@terrastruct/d2 (npm, WASM)](https://www.npmjs.com/package/@terrastruct/d2) + [d2wasm bindings](https://github.com/uses-ink/d2wasm)

Domain pitfalls (hairball / scale UX):
- [Cambridge Intelligence — Graph visualization UX](https://cambridge-intelligence.com/graph-visualization-ux-how-to-avoid-wrecking-your-graph-visualization/) + [Fixing data hairballs](https://cambridge-intelligence.com/blog/hairball-effect-in-graph-visualization/) + [Visualize large networks](https://cambridge-intelligence.com/blog/visualize-large-networks/)
- [REACHER — Visualizing Call Graphs (CMU LaToza & Myers)](https://www.cs.cmu.edu/~NatProg/papers/Paper3_LaTozaAndMyers_paper.pdf)
- [FACETS — Adaptive Local Exploration of Large Graphs (arXiv)](https://arxiv.org/pdf/1505.06792)

Project ground truth:
- `tools/arch-viz-studio/.planning/PROJECT.md` (Core Value, Constraints, Out of Scope, Key Decisions)

---
*Feature research for: local code-architecture visualization tool (CodeGraph-backed, client-presentable, agent-readable)*
*Researched: 2026-05-31*
