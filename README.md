# arch-viz-studio

**Point it at any repo → get a high-quality, committable architecture picture that a human can present and an AI agent can read + update — with zero non-permissive licenses in the client-facing chain.**

A local tool that reads a repo's code graph (via the [CodeGraph](https://www.npmjs.com/package/@colbymchenry/codegraph) CLI) and produces:

- an **interactive 4-pane viewer** (explore the architecture — tree · graph · inspector · diagram), and
- a **committable handoff bundle** in the target repo's `docs/architecture/`:
  `graph.json` · `architecture.svg` · `ARCHITECTURE.md` · `viz/index.html`.

> The bundle is the deliverable. `viz/index.html` is self-contained (~one file, no install, no server) — double-click it and the architecture opens in any browser. `graph.json` is a versioned, deterministic, machine-readable contract an AI agent can read and safely annotate.

---

## Quickstart

```bash
npm install                 # one-time, from this repo
# CodeGraph is resolved from the target repo first, then your global install
npm i -g @colbymchenry/codegraph   # if you don't have it

# scan ANY repo → writes the bundle into <repo>/docs/architecture/
npm run arch-viz -- scan /path/to/some/repo

# explore interactively (dev server)
npm run dev:app             # then open the printed http://localhost URL
```

## How it travels into other projects

The **tool stays put** (here, in `tools/arch-viz-studio/`); only its **output** is copied into other repos:

```
arch-viz scan <repo>
   └─► <repo>/docs/architecture/
         ├─ graph.json        ← machines / AI agents / CI read this (documented schema)
         ├─ ARCHITECTURE.md    ← renders on GitHub
         ├─ architecture.svg   ← small, diff-friendly, embeds in a README
         └─ viz/index.html     ← double-click → interactive viewer, no install
```

Commit that folder into the target repo and it travels with it: teammates open `viz/index.html`,
other programs/agents read `graph.json` — **none of them need arch-viz-studio installed.**
Re-run `arch-viz scan` after code changes to refresh it (annotations you add are preserved by id).

## Layout

| Package | Role |
|---|---|
| `shared/` | the `graph.json` contract — types, JSON Schema, `validate()`, `canonicalize()`. Single source of truth (see [`shared/README.md`](./shared/README.md)). |
| `cli/` | `arch-viz scan` — runs CodeGraph, reads its SQLite DB, normalizes (dedupe · seeded Louvain · metrics · dagre), emits the bundle. |
| `app/` | Vite + React + React Flow 4-pane viewer + in-browser PNG export. |

## Commands

```bash
npm run arch-viz -- scan <repo> [--out <dir>] [--no-sync]
npm run typecheck      # tsc across all packages
npm test               # vitest (schema · CLI pipeline · viewer logic · adversarial escaping)
npm run lint:licenses  # SEC-01 — fails if any shipped dep is non-permissive
npm run dev:app        # interactive viewer
npm run build:app      # production build of the viewer
```

## Guarantees

- **Deterministic** — re-scanning unchanged code yields a byte-identical bundle (clean git diffs).
- **Safe** — subprocesses run without a shell; writes are confined to the target repo; all
  code-derived text in the SVG/HTML/Markdown is escaped (adversarial-symbol tested).
- **Permissive-only** — the client-facing chain is 100% MIT / ISC / BSD / Apache-2.0 / MPL-2.0;
  a CI gate fails the build on anything else.

## Demo

This repo dogfoods itself: see [`docs/architecture/`](./docs/architecture/) for arch-viz-studio's own
architecture bundle (open `docs/architecture/viz/index.html`).

## License

MIT.
