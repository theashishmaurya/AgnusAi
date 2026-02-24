# AgnusAI — Claude Code Context

## What This Project Is

A fully open-source, self-hostable AI code reviewer. v2 is a hosted service with graph-aware reviews powered by a symbol dependency graph (Tree-sitter + Postgres/pgvector).

**Positioning:** "The only self-hosted code reviewer that understands your codebase graph."
**ICP:** Security-sensitive engineering teams (fintech, health, defense) who can't send code to third-party AI, and teams running local LLMs (Ollama).

---

## Monorepo Structure

**pnpm monorepo** — `pnpm-workspace.yaml` declares `packages/*`.

```
packages/
├── reviewer/   — CLI reviewer (Layer 0). PRReviewAgent, LLM backends, VCS adapters.
├── shared/     — Shared TypeScript types: ParsedSymbol, Edge, BlastRadius, GraphReviewContext.
├── core/       — Tree-sitter parsers, InMemorySymbolGraph, PostgresStorageAdapter, Indexer, Retriever.
├── api/        — Fastify server: webhooks, SSE, REST API, review orchestration.
├── dashboard/  — Vite React SPA (shadcn/ui, TinyFish editorial theme).
└── docs/       — VitePress docs, served at /docs/ by the API server.
```

Build order: `shared` → `core` → `reviewer` → `api` (dashboard is independent).

---

## Key Source Files

| File | Role |
|------|------|
| `packages/reviewer/src/index.ts` | `PRReviewAgent` — main orchestrator |
| `packages/reviewer/src/cli.ts` | CLI entry point (`agnus review --pr N --repo owner/repo`) |
| `packages/reviewer/src/types.ts` | All reviewer types (`ReviewComment`, `ReviewContext`, `ReviewResult`, etc.) |
| `packages/reviewer/src/llm/prompt.ts` | `buildReviewPrompt()` + `serializeGraphContext()` — what gets sent to the LLM |
| `packages/reviewer/src/llm/parser.ts` | `parseReviewResponse()` — parses LLM output into structured comments |
| `packages/reviewer/src/review/precision-filter.ts` | `filterByConfidence()` — filters low-confidence comments (0.0–1.0 threshold) |
| `packages/reviewer/src/review/checkpoint.ts` | Incremental review checkpoints stored in PR comments |
| `packages/reviewer/src/review/thread.ts` | Comment thread tracking, reply handling |
| `packages/shared/src/types.ts` | `ParsedSymbol`, `Edge`, `BlastRadius`, `GraphReviewContext`, `priorExamples` |
| `packages/core/src/parser/` | Language parsers: TypeScript, Python, Java, Go, C# (web-tree-sitter WASM) |
| `packages/core/src/graph/InMemorySymbolGraph.ts` | BFS adjacency-list graph, `getBlastRadius()` |
| `packages/core/src/storage/PostgresStorageAdapter.ts` | Postgres storage (symbols, edges, embeddings, snapshots) |
| `packages/core/src/indexer/Indexer.ts` | `fullIndex()` + `incrementalUpdate()` with `onProgress` callback |
| `packages/core/src/retriever/Retriever.ts` | Assembles `GraphReviewContext` from diff using BFS + pgvector |
| `packages/api/src/index.ts` | Fastify server entry (registers all plugins and routes) |
| `packages/api/src/graph-cache.ts` | `Map<"repoId:branch", entry>` — in-memory graph per repo/branch |
| `packages/api/src/routes/webhooks.ts` | GitHub + Azure webhook handlers |
| `packages/api/src/routes/repos.ts` | Repo CRUD + SSE indexing progress |
| `packages/api/src/routes/auth.ts` | JWT cookie auth, admin bootstrap, invite tokens, API keys |
| `packages/api/src/review-runner.ts` | Bridges API → `PRReviewAgent` |
| `packages/dashboard/src/` | Vite React SPA root |

---

## Key Commands

```bash
# Build
pnpm install
pnpm build                                          # build all packages
pnpm --filter @agnus-ai/reviewer build              # build reviewer only

# Run CLI
node packages/reviewer/dist/cli.js review --pr 123 --repo owner/repo

# Full stack
docker compose up --build                           # API + Postgres/pgvector + Ollama (on host)

# Dev
pnpm --filter @agnus-ai/dashboard dev               # dashboard dev server (Vite, port 5173)
pnpm --filter @agnus-ai/api dev                     # API dev server (port 3000)

# Dry-run review (inspect without posting)
curl -b /tmp/agnus.txt -X POST http://localhost:3000/api/repos/<repoId>/review \
  -H 'Content-Type: application/json' \
  -d '{"prNumber": 123, "dryRun": true}' | jq '{verdict, commentCount, comments}'
```

---

## Technical Decisions

- **Tree-sitter WASM** (`web-tree-sitter`) — no native compilation, grammar `.wasm` files bundled in `packages/core`.
- **InMemorySymbolGraph** — loaded from Postgres snapshot per `(repoId, branch)` on startup. Cache key: `"repoId:branch"`.
- **Postgres + pgvector** — symbols, edges, graph snapshots, symbol embeddings. Branch is part of the composite PK on all tables.
- **Embedding adapters** — Ollama, OpenAI, Google, Http (selected via `EMBEDDING_PROVIDER` env var).
- **Review depth** — Fast (1-hop BFS), Standard (2-hop, default), Deep (2-hop + pgvector cosine search).
- **RAG feedback loop** — `priorExamples` in `GraphReviewContext` injects past developer-approved comments into the prompt. Feedback stored in Postgres, retrieved via pgvector.
- **Precision filter** — LLM self-assesses `[Confidence: X.X]` per comment; `filterByConfidence()` drops below threshold (default 0.7), configurable via `PRECISION_THRESHOLD` env var. Confidence marker extracted by parser, removed from displayed body. Applied in both `review()` and `incrementalReview()` paths.
- **Azure incremental diff** — On `git.pullrequest.updated` webhook, adapter uses `$compareTo=latest.id - 1` to diff only new commits vs previous iteration. On `created`, uses `$compareTo=0` for full cumulative diff.
- **`MAX_DIFF_SIZE` env var** — Max diff characters sent to LLM. Default: 150000. Set `MAX_DIFF_SIZE=300000` to increase for large PRs. Configurable in `review-runner.ts`.
- **`dryRun` on review endpoint** — `POST /api/repos/:id/review` accepts `{ dryRun: true }` to run the full review pipeline (graph context, RAG, precision filter) without posting comments or writing to DB. Returns `{ comments: [...] }` in the response.
- **Auth** — JWT httpOnly cookies (`@fastify/jwt` + `@fastify/cookie`). Admin seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Invite-only registration. API keys in `system_api_keys` table.
- **Docker** — Multi-stage build. `pnpm deploy --legacy` for flat production `node_modules`. Ollama runs on the host, reached via `host.docker.internal`.
- **Dashboard theme** — shadcn/ui + TinyFish editorial: off-white `#EBEBEA` bg, black display type, orange `#E85A1A` accent, uppercase tracked labels, hairline borders, `border-radius: 0`.

---

## Review Pipeline Flow

```
CLI / Webhook
     │
     ▼
PRReviewAgent.review(prId, graphContext?)
     │  ① fetch PR, diff, files from VCS adapter
     │  ② fetch linked tickets
     │  ③ match skills (YAML files in packages/reviewer/skills/)
     │  ④ buildReviewPrompt() → inject graph context + prior examples
     │
     ▼
LLMBackend.generateReview(context)   ← unified backend (Ollama/OpenAI/Claude/Azure)
     │
     ▼
parseReviewResponse()                ← extracts SUMMARY / [File: Line:] blocks / VERDICT / [Confidence: X.X]
     │
     ▼
filterByConfidence()                 ← drops comments below PRECISION_THRESHOLD (default 0.7)
     │
     ▼
PRReviewAgent.postReview()           ← validates paths against diff, submits via VCS adapter
                                        (skipped when dryRun=true)
```

Graph context is assembled by `Retriever` (BFS on `InMemorySymbolGraph` + pgvector) and injected as `## Codebase Context` section in the prompt.

---

## Workflow & Preferences

- **Commits:** Multiple logical commits per PR — one per file or concern. Never squash.
- **Docs:** Goes in `packages/docs/` (VitePress), or `docs/` at root for architecture/roadmap.
- **No over-engineering:** Don't add abstractions, error handling, or features not directly asked for.
- **Git user:** ashish.1999vns@gmail.com
