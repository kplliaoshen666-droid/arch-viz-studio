import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

export interface RawNode {
  id: string;
  kind: string;
  name: string;
  qualified_name: string;
  file_path: string;
  language: string;
  start_line: number;
  end_line: number;
  is_exported: number;
  is_async: number;
  is_static: number;
  is_abstract: number;
}

export interface RawEdge {
  source: string;
  target: string;
  kind: string;
  metadata: string | null;
}

export interface RawData {
  nodes: RawNode[];
  edges: RawEdge[];
  codegraphSchema: number;
  /** latest source-file mtime (epoch ms) — the deterministic basis for meta.generatedAt. */
  latestMtime: number;
}

const MIN_SUPPORTED_SCHEMA = 4;

/** Locate `<repo>/.codegraph/codegraph.db`. */
export function locateDb(repoRoot: string): string {
  const dbPath = join(repoRoot, '.codegraph', 'codegraph.db');
  if (!existsSync(dbPath)) {
    throw new Error(`CodeGraph DB not found at ${dbPath} — did indexing succeed?`);
  }
  return dbPath;
}

/** Read CodeGraph's SQLite DB read-only. The DB is the only complete edge source. */
export function readDb(dbPath: string): RawData {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const schemaRow = db.prepare('SELECT MAX(version) AS v FROM schema_versions').get() as {
      v: number | null;
    };
    const codegraphSchema = schemaRow?.v ?? 0;
    if (codegraphSchema < MIN_SUPPORTED_SCHEMA) {
      throw new Error(
        `CodeGraph DB schema v${codegraphSchema} is older than the supported v${MIN_SUPPORTED_SCHEMA}. ` +
          'Re-index with a current CodeGraph.',
      );
    }

    // ORDER BY is load-bearing for determinism: SQLite row order is otherwise
    // unspecified, and downstream dedupe / Louvain insertion / metrics consume this order.
    const nodes = db
      .prepare(
        `SELECT id, kind, name, qualified_name, file_path, language,
                start_line, end_line, is_exported, is_async, is_static, is_abstract
         FROM nodes ORDER BY id`,
      )
      .all() as RawNode[];

    const edges = db
      .prepare('SELECT source, target, kind, metadata FROM edges ORDER BY source, target, kind, metadata')
      .all() as RawEdge[];

    const files = db.prepare('SELECT modified_at FROM files').all() as {
      modified_at: number | null;
    }[];
    const latestMtime = files.reduce((max, f) => Math.max(max, f.modified_at ?? 0), 0);

    return { nodes, edges, codegraphSchema, latestMtime };
  } finally {
    db.close();
  }
}
