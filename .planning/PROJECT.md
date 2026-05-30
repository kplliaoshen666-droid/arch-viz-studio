# arch-viz-studio

## What This Is

A reusable **local** architecture-visualization tool for the developer's own AI-infrastructure workspace. You point it at any code repository → it reads that repo's code graph (via the CodeGraph CLI) → it produces both an **interactive node-graph app** (explore the architecture) and a **committed, client-presentable artifact bundle** (`docs/architecture/`: a stable `graph.json`, an `ARCHITECTURE.md` narrative, an exported `architecture.svg`, and a self-contained HTML viewer). Built so that every project can be visualized on demand, an AI agent can read+update the outputs, and the results are easy to show to clients or teammates.

## Core Value

**Point at any repo → get a high-quality, committable architecture picture that a human can present and an AI agent can read+update — with zero non-permissive licenses in the client-facing chain.**

## Requirements

### Validated

(None yet — ship to validate)

### Active

<!-- Hypotheses until shipped + validated. -->

- [ ] CLI `arch-viz scan <repo>` runs CodeGraph on a target repo and emits a normalized, documented `graph.json` (stable schema) into `<repo>/docs/architecture/`
- [ ] graph.json schema is explicitly versioned + documented so AI agents can read AND update it safely
- [ ] Local 4-pane app: repo/module/file tree · React Flow node-graph (modules/functions/edges, clustering, zoom) · selected-node detail (CodeGraph callers/callees/impact + AI-explanation slot) · diagram source (D2/Mermaid) + preview
- [ ] In-browser export of `architecture.svg` / PNG (no external `d2`/`mmdc` binary required for MVP)
- [ ] Generate `ARCHITECTURE.md` (human + agent readable narrative, embeds the diagram)
- [ ] Emit a self-contained `viz/index.html` viewer that opens with no install (hand to clients/teammates)
- [ ] Reusable across any repo (project-agnostic; output lands in each target repo's `docs/architecture/`)
- [ ] [optional/later] AI-explanation pane: LLM explains a selected node from graph context
- [ ] Dogfood: visualize the tool itself (once it has code) and/or one existing mature repo

### Out of Scope

- **GitNexus in any client-facing deliverable** — PolyForm Noncommercial license; commercial blocker. GitNexus stays an INTERNAL-only optional deep-read, never in `docs/architecture/` outputs.
- **Harness subsystem / global install** — never `gitnexus setup`, never register Claude Code hooks, never modify global `~/.claude/`, never promote into the canonical skills manifest (per `gitnexus-repo-map` skill hard rules). This tool lives in `tools/arch-viz-studio/`, summoned on demand.
- **Cloud / hosted service** — local tool only.
- **"What should I change" advice** — the tool answers "what IS there" (reads code), it does not own architecture decisions (that's GSD/UIUX/QA/AppSec).
- **Becoming a general IDE / editor** — visualization + export only.

## Context

- Built inside the user's Personal AI Infrastructure workspace (`…/tools/arch-viz-studio/`), a sibling of `cases/`. The workspace overall was not git-tracked; this project was `git init`'d standalone (branch `main`).
- The user already has the CodeGraph CLI installed globally (`@colbymchenry/codegraph` v0.9.4, **MIT**) and the `codegraph-cli` + `gitnexus-repo-map` skills in their harness ("Code Reading Tools pair").
- CodeGraph parses with tree-sitter into a local SQLite (`.codegraph/codegraph.db`: symbols + edges + files) and exposes a CLI (`init/index/sync/status/query/files/callers/callees/context`). It works on non-git folders.
- Origin: user wants a repeatable way to visualize each project's architecture, agent-friendly + client-presentable. Came out of a discussion where an external review proposed a large stack (GitNexus + React Flow + D2 + Mermaid + Kroki + Graphify + CodeBoarding + Structurizr); scope was trimmed to a permissive-only minimal core.
- Quality bar is explicitly high ("质量必须很高"); all agent spawns use Opus (user override of default routing).

## Constraints

- **License (hard)**: client-visible chain must be ALL permissive — CodeGraph (MIT) + React Flow / @xyflow/react (MIT) + D2 (MPL-2.0) + Mermaid (MIT). Verify each tool's license + version during build before relying on it. GitNexus (Noncommercial) excluded from deliverables.
- **Boundary (hard)**: not a harness subsystem; no global `~/.claude/` mutation; no auto-`gitnexus setup`; no hook registration.
- **Tech stack**: CLI in Node/TypeScript; app = Vite + React + TypeScript + React Flow + Tailwind. Graph source = CodeGraph CLI (primary); GitNexus optional internal-only.
- **Security (light but real)**: subprocess exec of CodeGraph (no shell injection), path handling (no traversal), self-contained HTML viewer must escape code symbols/paths (no HTML/JS injection), npm supply-chain hygiene, and — only if the AI pane ships — code egress to an LLM must be explicit/opt-in.
- **Reusability**: project-agnostic; outputs committed into each target repo, not into this tool.
- **Model routing**: all agent spawns = Opus (quality override).
- **Quality**: high — this is meant to be shown to clients/teammates.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Form = standalone local small app (CLI + Vite/React/React Flow 4-pane), not a convention/script, not a harness subsystem | User chose "独立本地小 app"; honors the gitnexus-repo-map no-subsystem red line | — Pending |
| Primary graph source = CodeGraph CLI (MIT), not GitNexus | GitNexus is PolyForm Noncommercial → commercial blocker for client deliverables; CodeGraph is MIT + works on non-git folders | — Pending |
| GitNexus = internal-only optional deep-read, never in deliverables | License + "client-visible chain avoids GitNexus" user decision | — Pending |
| Output bundle committed into each target repo's `docs/architecture/` | AI-agent readable+updatable + client-presentable + travels with the repo | — Pending |
| Build via GSD as its own mini-project; all spawns Opus | User chose "走 GSD 小项目" + "全 Opus / 质量很高" | — Pending |
| MVP export in-browser (no external d2/mmdc binary) | Zero extra install; d2/mmdc/graphviz not present locally | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-31 after initialization*
