# Cross-AI Code Review — v1 (2026-05-31)

Two independent reviewers, reconciled by the main agent:
- **Codex CLI (GPT, cross-model)** — read-only review (`codex exec -s danger-full-access`; the read-only sandbox failed to spawn on Windows, so sandbox was disabled and a post-run `git status` confirmed zero writes).
- **Independent Opus subagent** — fresh-context review, ran `npm test` / `typecheck` / `lint:licenses`.

Both **converged on the same root cause**: `graph.json` determinism was not actually guaranteed (the prior "byte-identical" runs were stable by luck of SQLite row order, not by construction).

## Findings & resolutions

| # | Sev | Finding | Fix | Commit ref |
|---|-----|---------|-----|------------|
| 1 | CRITICAL (Opus) / MED (Codex) | No `ORDER BY` on DB reads → row order feeds dedupe / Louvain / metrics → non-deterministic output | `readDb.ts`: `ORDER BY id` (nodes), `ORDER BY source,target,kind,metadata` (edges) | this commit |
| 2 | CRITICAL (Opus) | `metrics.descendants` memo + path-dependent cycle-guard → order-dependent under a `contains` cycle | `metrics.ts`: rewrote as per-node reachable-set count (no cross-node memo) — order-independent + cycle-safe | this commit |
| 3 | HIGH (Opus) | `dedupeEdges` kept first-seen `resolvedBy` on equal confidence → flips with input order | tie-break: equal confidence → lexicographically smaller `resolvedBy` | this commit |
| 4 | HIGH (Opus) | Determinism tests only proved idempotency, not order-independence | added `cli/test/determinism.test.ts` (shuffled input + `contains` cycle + equal-confidence dup) | this commit |
| 5 | HIGH (Codex) | Lexical-only write containment → a symlinked dir component could redirect writes outside the repo | `paths.ts`: realpath the deepest existing ancestor + re-check; pid-unique tmp name | this commit |
| 6 | HIGH (Codex) | Target-first CodeGraph resolution executes the scanned repo's `node_modules` JS (RCE on untrusted repos) | default to trusted (own+global) only; target-local gated behind `--use-target-codegraph` | this commit |
| 7 | MED (Opus) | Out-of-range CodeGraph `confidence` would fail the emit gate and abort the scan | `buildGraph.ts`: clamp confidence to [0,1] in `parseMeta` | this commit |
| 8 | MED (Codex) | `codegraphDbHash` only hashed node/edge ids, not content | hash all consumed raw DB rows (sorted) | this commit |
| 9 | LOW (both) | `mdCell` didn't escape Markdown link/image syntax; edge sort not a total order | escape `[ ] ( )` in `mdCell`; add `id` tie-break to canonical edge sort | this commit |

## Confirmed solid by both reviewers (no change needed)
- **No command injection** — `runCodegraph` runs `node <entry> <args>` with `shell:false`, argv arrays; dodges the Windows `.cmd` injection (CVE-2024-27980).
- **XSS / script-breakout boundary holds** — `escapeJsonForScript` escapes every `<`; SVG text + attributes XML-escaped; the self-contained viewer renders code-derived strings via `textContent` only; Mermaid is `securityLevel:'strict'` + pre-escaped.
- **License chain** — 178 shipped deps, 100% permissive; gate passes.
- **Tests** — 57 → **60** GREEN (added 3 determinism regressions); typecheck clean.

## Post-fix verification (runnable cases, all PASS)
1. Self-scan (157 nodes · 265 edges · 36 clusters) → committed `docs/architecture/` bundle.
2. Re-scan → all 4 artifacts **byte-identical** (now guaranteed by `ORDER BY`, not luck).
3. Scan a different repo → bundle lands in *its* `docs/architecture/` (project-agnostic).
4. Annotation round-trip — an agent-edited `annotations` value survives a re-scan by id (SCHEMA-03 end-to-end).
5. Self-contained viewer — inlined JSON has zero raw `<`, carries all nodes, no `fetch` (opens from `file://`).
