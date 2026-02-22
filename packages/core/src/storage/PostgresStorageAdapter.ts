import { Pool, PoolConfig } from 'pg'
import type { ParsedSymbol, Edge } from '@agnus-ai/shared'
import type { StorageAdapter } from './StorageAdapter'

const BASE_DDL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS symbols (
  id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT NOT NULL,
  body_start INT,
  body_end INT,
  doc_comment TEXT,
  PRIMARY KEY (id, repo_id)
);

CREATE TABLE IF NOT EXISTS edges (
  id SERIAL PRIMARY KEY,
  repo_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  kind TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS graph_snapshots (
  repo_id TEXT PRIMARY KEY,
  snapshot TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`

function embeddingTableDDL(dim: number): string {
  return `
CREATE TABLE IF NOT EXISTS symbol_embeddings (
  symbol_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  embedding vector(${dim}),
  PRIMARY KEY (symbol_id, repo_id)
);`
}

export class PostgresStorageAdapter implements StorageAdapter {
  private pool: Pool

  constructor(config: Pool | PoolConfig | string) {
    if (config instanceof Pool) {
      this.pool = config
    } else {
      this.pool = new Pool(typeof config === 'string' ? { connectionString: config } : config)
    }
  }

  /**
   * Run DDL to set up tables. Safe to call multiple times (idempotent).
   * @param vectorDim  Dimension of the embedding vectors to store.
   *   Pass the dimension reported by your embedding model (e.g. 1024 for
   *   qwen3-embedding:0.6b, 1536 for text-embedding-3-small, 768 for
   *   nomic-embed-text / text-embedding-004).
   *   If the symbol_embeddings table already exists with a different dimension,
   *   it will be dropped and recreated — this is safe in dev; in production
   *   re-embed all symbols after changing models.
   */
  async migrate(vectorDim = 1024): Promise<void> {
    await this.pool.query(BASE_DDL)

    // Check if symbol_embeddings already exists and has the right dimension
    const existing = await this.pool.query<{ atttypmod: number }>(`
      SELECT a.atttypmod
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      WHERE c.relname = 'symbol_embeddings'
        AND a.attname = 'embedding'
        AND a.attnum > 0
    `)

    if (existing.rows.length > 0) {
      // pgvector stores dim as (dim + 4) in atttypmod
      const currentDim = existing.rows[0].atttypmod - 4
      if (currentDim !== vectorDim) {
        console.warn(
          `[Storage] symbol_embeddings dimension mismatch: existing=${currentDim}, required=${vectorDim}. ` +
          `Dropping and recreating table.`,
        )
        await this.pool.query('DROP TABLE symbol_embeddings')
        await this.pool.query(embeddingTableDDL(vectorDim))
      }
      // else: right dimension, nothing to do
    } else {
      await this.pool.query(embeddingTableDDL(vectorDim))
    }
  }

  async saveSymbols(symbols: ParsedSymbol[]): Promise<void> {
    if (symbols.length === 0) return
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      for (const s of symbols) {
        await client.query(
          `INSERT INTO symbols
             (id, repo_id, file_path, name, qualified_name, kind, signature, body_start, body_end, doc_comment)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (id, repo_id) DO UPDATE SET
             file_path = EXCLUDED.file_path,
             name = EXCLUDED.name,
             qualified_name = EXCLUDED.qualified_name,
             kind = EXCLUDED.kind,
             signature = EXCLUDED.signature,
             body_start = EXCLUDED.body_start,
             body_end = EXCLUDED.body_end,
             doc_comment = EXCLUDED.doc_comment`,
          [
            s.id, s.repoId, s.filePath, s.name, s.qualifiedName,
            s.kind, s.signature, s.bodyRange[0], s.bodyRange[1],
            s.docComment ?? null,
          ],
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  async saveEdges(edges: Edge[]): Promise<void> {
    if (edges.length === 0) return
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      for (const e of edges) {
        // Using repoId from from symbol id prefix — caller must pass repoId separately
        // We store repoId alongside so pass it as part of edge save call context
        // For now derive repoId from a fixed context; caller injects via wrapper
        await client.query(
          `INSERT INTO edges (repo_id, from_id, to_id, kind) VALUES ($1,$2,$3,$4)`,
          [(e as any).repoId ?? '', e.from, e.to, e.kind],
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  async deleteByFile(filePath: string, repoId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM edges WHERE repo_id = $1 AND (from_id LIKE $2 OR to_id LIKE $2)`,
      [repoId, `${filePath}:%`],
    )
    await this.pool.query(
      `DELETE FROM symbols WHERE repo_id = $1 AND file_path = $2`,
      [repoId, filePath],
    )
    await this.pool.query(
      `DELETE FROM symbol_embeddings WHERE repo_id = $1 AND symbol_id LIKE $2`,
      [repoId, `${filePath}:%`],
    )
  }

  async loadAll(repoId: string): Promise<{ symbols: ParsedSymbol[]; edges: Edge[] }> {
    const symsRes = await this.pool.query(
      `SELECT id, repo_id, file_path, name, qualified_name, kind, signature, body_start, body_end, doc_comment
       FROM symbols WHERE repo_id = $1`,
      [repoId],
    )
    const edgesRes = await this.pool.query(
      `SELECT from_id, to_id, kind FROM edges WHERE repo_id = $1`,
      [repoId],
    )

    const symbols: ParsedSymbol[] = symsRes.rows.map(row => ({
      id: row.id,
      repoId: row.repo_id,
      filePath: row.file_path,
      name: row.name,
      qualifiedName: row.qualified_name,
      kind: row.kind,
      signature: row.signature,
      bodyRange: [row.body_start, row.body_end] as [number, number],
      docComment: row.doc_comment ?? undefined,
    }))

    const edges: Edge[] = edgesRes.rows.map(row => ({
      from: row.from_id,
      to: row.to_id,
      kind: row.kind,
    }))

    return { symbols, edges }
  }

  async saveGraphSnapshot(repoId: string, json: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO graph_snapshots (repo_id, snapshot, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (repo_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = NOW()`,
      [repoId, json],
    )
  }

  async loadGraphSnapshot(repoId: string): Promise<string | null> {
    const res = await this.pool.query(
      `SELECT snapshot FROM graph_snapshots WHERE repo_id = $1`,
      [repoId],
    )
    return res.rows[0]?.snapshot ?? null
  }

  async end(): Promise<void> {
    await this.pool.end()
  }
}
