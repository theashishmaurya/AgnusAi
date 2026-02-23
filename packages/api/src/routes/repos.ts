import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { createDefaultRegistry, Indexer, InMemorySymbolGraph, PostgresStorageAdapter } from '@agnus-ai/core'
import type { IndexProgress } from '@agnus-ai/shared'
import { loadRepo, getOrLoadRepo, evictRepo } from '../graph-cache'
import { createEmbeddingAdapter } from '../embedding-factory'

export async function repoRoutes(app: FastifyInstance): Promise<void> {
  const pool: Pool = app.db

  /**
   * POST /api/repos — register a repo and trigger async full index per branch
   * Body: { repoUrl, platform, token, repoPath, branches? }
   */
  app.post('/api/repos', async (req, reply) => {
    const { repoUrl, platform, token, repoPath, branches } = req.body as {
      repoUrl: string
      platform: 'github' | 'azure'
      token?: string
      repoPath?: string
      branches?: string[]
    }

    if (!repoUrl || !platform) {
      return reply.status(400).send({ error: 'repoUrl and platform are required' })
    }

    const indexBranches = (branches && branches.length > 0) ? branches : ['main']

    // Derive a stable repoId from the URL
    const repoId = Buffer.from(repoUrl).toString('base64url').slice(0, 32)

    // Ensure repos table exists and upsert the registration
    await pool.query(`
      CREATE TABLE IF NOT EXISTS repos (
        repo_id TEXT PRIMARY KEY,
        repo_url TEXT NOT NULL,
        platform TEXT NOT NULL,
        token TEXT,
        repo_path TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await pool.query(
      `INSERT INTO repos (repo_id, repo_url, platform, token, repo_path)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (repo_id) DO UPDATE SET token = EXCLUDED.token, repo_path = EXCLUDED.repo_path`,
      [repoId, repoUrl, platform, token ?? null, repoPath ?? null],
    )

    // Ensure repo_branches table exists and insert branch registrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS repo_branches (
        repo_id TEXT NOT NULL REFERENCES repos(repo_id) ON DELETE CASCADE,
        branch TEXT NOT NULL,
        PRIMARY KEY (repo_id, branch)
      )
    `)
    for (const branch of indexBranches) {
      await pool.query(
        `INSERT INTO repo_branches (repo_id, branch) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [repoId, branch],
      )
    }

    // Trigger full index in background per branch (parallel)
    setImmediate(async () => {
      try {
        const embeddingAdapter = createEmbeddingAdapter(pool)
        const storage = new PostgresStorageAdapter(pool)
        await storage.migrate(embeddingAdapter?.dim ?? 1024)
        const repoLocalPath = repoPath ?? repoUrl.split('/').pop() ?? repoId

        await Promise.all(indexBranches.map(async (branch) => {
          const graph = new InMemorySymbolGraph()
          const registry = await createDefaultRegistry()
          const indexer = new Indexer(registry, graph, storage, embeddingAdapter)

          await indexer.fullIndex(repoLocalPath, repoId, branch, (progress) => {
            setProgress(`${repoId}:${branch}`, progress)
          })

          await loadRepo(repoId, branch)
          setProgress(`${repoId}:${branch}`, null) // done
        }))
      } catch (err) {
        console.error(`[repos] Full index failed for ${repoId}:`, (err as Error).message)
      }
    })

    return reply.status(202).send({
      repoId,
      branches: indexBranches,
      message: `Indexing started for ${indexBranches.length} branch(es) — stream progress at /api/repos/${repoId}/index/status?branch=<branch>`,
    })
  })

  /**
   * GET /api/repos/:id/index/status — SSE stream of indexing progress
   * Query: ?branch=develop  (defaults to 'main')
   */
  app.get('/api/repos/:id/index/status', async (req, reply) => {
    const { id: repoId } = req.params as { id: string }
    const { branch = 'main' } = req.query as { branch?: string }
    const progressKey = `${repoId}:${branch}`

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    const send = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // Poll progress every 500ms until done or connection closes
    let done = false
    const interval = setInterval(() => {
      const progress = getProgress(progressKey)
      if (progress) {
        send(progress)
        if (progress.step === 'done') {
          done = true
          clearInterval(interval)
          reply.raw.end()
        }
      }
    }, 500)

    req.raw.on('close', () => {
      clearInterval(interval)
    })

    // Keep connection open (Fastify needs returned promise)
    return new Promise<void>(resolve => {
      const check = setInterval(() => {
        if (done || reply.raw.closed) {
          clearInterval(check)
          resolve()
        }
      }, 100)
    })
  })

  /**
   * GET /api/repos/:id/graph/blast-radius/:symbolId
   * Query: ?branch=develop  (defaults to 'main')
   */
  app.get('/api/repos/:id/graph/blast-radius/:symbolId', async (req, reply) => {
    const { id: repoId, symbolId } = req.params as { id: string; symbolId: string }
    const { branch = 'main' } = req.query as { branch?: string }
    const entry = await getOrLoadRepo(repoId, branch)
    const br = entry.graph.getBlastRadius([decodeURIComponent(symbolId)])
    return reply.send(br)
  })

  /**
   * DELETE /api/repos/:id — evict all branches from cache and remove from DB
   */
  app.delete('/api/repos/:id', async (req, reply) => {
    const { id: repoId } = req.params as { id: string }
    await pool.query('DELETE FROM repos WHERE repo_id = $1', [repoId])
    evictRepo(repoId) // evicts all branches (no branch arg = evict all)
    return reply.status(204).send()
  })
}

// ----- Simple in-process progress store -----
// Key format: `${repoId}:${branch}`
const progressStore = new Map<string, IndexProgress | null>()

function setProgress(key: string, progress: IndexProgress | null): void {
  progressStore.set(key, progress)
}

function getProgress(key: string): IndexProgress | null | undefined {
  return progressStore.get(key)
}
