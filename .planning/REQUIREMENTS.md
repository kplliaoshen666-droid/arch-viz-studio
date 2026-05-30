# Requirements: arch-viz-studio

**Defined:** 2026-05-31
**Core Value:** Point at any repo → a high-quality, committable architecture picture a human can present and an AI agent can read+update — with zero non-permissive licenses in the client-facing chain.

## v1 Requirements

### Schema (graph.json contract — the spine)

- [ ] **SCHEMA-01**: graph.json has a versioned, documented schema (`schemaVersion` + JSON Schema + `validate()`) that fails fast on invalid data
- [ ] **SCHEMA-02**: graph.json is deterministic — re-scanning unchanged code yields byte-identical output (stable IDs, sorted nodes/edges, seeded clustering, rounded coords)
- [ ] **SCHEMA-03**: An AI agent can read graph.json and hand-edit an `annotations` area safely; annotations are preserved by id across re-scans and validation still passes
- [ ] **SCHEMA-04**: `shared/` exposes types + schema + `validate()` consumed by BOTH cli and app (single source of truth) with an agent-facing `shared/README.md`

### CLI (scan / extract / emit)

- [ ] **CLI-01**: User can run `arch-viz scan <repo>` and get `graph.json` written into `<repo>/docs/architecture/`
- [ ] **CLI-02**: scan runs CodeGraph (`sync`, or `index` if absent) before reading, so the graph reflects current code, not a stale index
- [ ] **CLI-03**: scan reads CodeGraph's SQLite DB directly (readonly) and normalizes: dedupe edges→weight, seeded Louvain clusters, metrics, dagre coordinates
- [ ] **CLI-04**: graph.json records provenance in `meta` (generatedAt, repo, commit SHA, CodeGraph version, DB schema version/hash)
- [ ] **CLI-05**: scan invokes every subprocess with `execFile` + args array (no shell) and confines all writes to the target repo (realpath + containment check, fixed filenames)

### Viewer (4-pane local app)

- [ ] **VIEW-01**: User can open the app and see the architecture as an interactive React Flow graph (zoom/pan/fit/minimap) laid out from graph.json's dagre coordinates
- [ ] **VIEW-02**: The graph defaults to a collapsed/clustered view and never auto-renders the full node set; user can expand/collapse clusters, filter (path/type/depth), and focus
- [ ] **VIEW-03**: User can search a symbol/file → select → graph re-centers and the detail pane populates
- [ ] **VIEW-04**: Selecting a node shows its detail (signature/path + callers + callees + impact) in pane 3
- [ ] **VIEW-05**: Pane 1 shows the repo/module/file tree; pane 4 shows diagram source (Mermaid) + live preview
- [ ] **VIEW-06**: Above a node-count threshold the app warns and defaults to an aggregated view (performance guardrail)

### Export (handoff bundle)

- [ ] **EXPORT-01**: User can export a deterministic `architecture.svg` (hand-rolled from graph.json — small, diffable, faithful to the on-screen layout)
- [ ] **EXPORT-02**: User can generate `ARCHITECTURE.md` (narrative + embedded diagram + a visible static-extraction caveats block)
- [ ] **EXPORT-03**: User can produce a self-contained `viz/index.html` (graph.json inlined as a `<script>` blob, lightweight read-only viewer, opens with no install/server)
- [ ] **EXPORT-04**: All code-derived text in the bundle is escaped (HTML entities + `</script>` breakout) — verified by an adversarial-symbol fixture repo
- [ ] **EXPORT-05**: User can optionally export a PNG screenshot of the live graph (`html-to-image`, pinned 1.11.11)

### Reuse (reusability + dogfood)

- [ ] **REUSE-01**: The tool runs against any repo (project-agnostic; CodeGraph resolved target-first then global; output lands in each target's `docs/architecture/`)
- [ ] **REUSE-02**: The tool is dogfooded on itself and on one mature repo, and those bundles are the demo (ship-to-validate)

### Security / Supply-chain (cross-cutting)

- [ ] **SEC-01**: A CI license-allowlist gate fails the build if any **shipped** dependency is non-permissive (blocklist PolyForm-*/CC-NC; GitNexus never enters the client chain)
- [ ] **SEC-02**: Lockfile committed and `npm audit` runs in CI

## v2 Requirements

### AI (optional explanation pane)

- **AI-01**: AI-explanation pane explains a selected node grounded in its CodeGraph neighborhood, with citations back to file/symbol
- **AI-02**: AI code egress is opt-in only (payload preview before send, redaction-aware, env-var key, absent from the committed handoff HTML)

### Scale

- **SCALE-01**: Cytoscape.js fallback renderer engages automatically above a measured node-count threshold

## Out of Scope

| Feature | Reason |
|---------|--------|
| Source editing | Tool answers "what IS there", not an editor |
| "What should I change" advice | Decisions belong to GSD/UIUX/QA/AppSec, not a reading tool |
| Cloud / hosted SaaS | Local tool only |
| Real-time collaboration / file-watcher daemon | On-demand-then-commit model, not a live service |
| 3D code-city metaphor | Communicates size, not structure — off-message |
| Dependency-rule CI gating | Dilutes "visualize what IS" into linting |
| GitNexus in any deliverable | PolyForm Noncommercial — commercial blocker; internal-only |
| Harness subsystem / global `~/.claude/` install | Hard boundary from `gitnexus-repo-map` skill |
| Generic "render the whole repo" graph | The hairball — #1 failure mode |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 1 | Done |
| SCHEMA-02 | Phase 1 | Done |
| SCHEMA-03 | Phase 1 | Done |
| SCHEMA-04 | Phase 1 | Done |
| CLI-01 | Phase 2 | Done |
| CLI-02 | Phase 2 | Done |
| CLI-03 | Phase 2 | Done |
| CLI-04 | Phase 2 | Done |
| CLI-05 | Phase 2 | Done |
| SEC-02 | Phase 2 | Done |
| VIEW-01 | Phase 3 | Done |
| VIEW-02 | Phase 3 | Done |
| VIEW-03 | Phase 3 | Done |
| VIEW-04 | Phase 3 | Done |
| VIEW-05 | Phase 3 | Done |
| VIEW-06 | Phase 3 | Done |
| EXPORT-01 | Phase 4 | Done |
| EXPORT-02 | Phase 4 | Done |
| EXPORT-03 | Phase 4 | Done |
| EXPORT-04 | Phase 4 | Done |
| EXPORT-05 | Phase 4 | Done (browser-verify pending) |
| REUSE-01 | Phase 5 | Done |
| REUSE-02 | Phase 5 | Done |
| SEC-01 | Phase 5 | Done |

**Cross-cutting note:** Security & supply-chain (SEC-01, SEC-02, and the CLI-05 subprocess/path discipline) is enforced from first install but each SEC requirement is assigned to exactly one phase for ownership: SEC-02 (lockfile + `npm audit`) → Phase 2 (first runtime install); SEC-01 (license-allowlist on the shipped chain) → Phase 5 (the ship-to-validate gate). The escaping/XSS boundary is owned by Phase 3 (render) and adversarially gated by EXPORT-04 in Phase 4.

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

v2 requirements (AI-01, AI-02, SCALE-01) are intentionally deferred and not mapped to v1 phases.

---
*Requirements defined: 2026-05-31*
*Last updated: 2026-05-31 after roadmap creation (traceability populated, 24/24 v1 mapped)*
