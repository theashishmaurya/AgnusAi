# AgnusAI — AI-Powered PR Review Agent

An AI-powered code review agent that reviews pull requests on **GitHub** and **Azure DevOps**, posts rich inline comments with severity levels, reproduction steps, and AI fix prompts — all powered by your choice of LLM backend.

## Features

- 🤖 **Unified LLM Backend** — Vercel AI SDK with support for Ollama, OpenAI, Azure OpenAI, Claude, and any OpenAI-compatible endpoint
- 🔄 **Multi-platform** — GitHub and Azure DevOps
- 📍 **Inline Comments** — Rich formatted comments posted on specific lines in the diff
- 📚 **Skills-based** — Pluggable review skills matched by file patterns
- 🚀 **Pipeline-triggered** — Runs in CI/CD, no continuously running service
- 🔁 **Incremental Reviews** — Checkpoint tracking: only reviews new commits since last run, no duplicate comments
- 💬 **Comment Reply Threads** — Webhook-driven: users can reply to AI comments and get contextual responses
- 🧹 **Smart Deduplication** — Skips already-reviewed lines, dismissed comments, binary/generated files, and lock files
- 🔌 **Decoupled Architecture** — Prompt building and response parsing are shared across all providers

## Comment Format

Every inline comment follows a rich structured format:

````markdown
**Suggestion:** [description of the issue] [tag]

<details>
<summary><b>Severity Level:</b> Major ⚠️</summary>

```mdx
- ⚠️ Impact point 1
- ⚠️ Impact point 2
```
</details>

```suggestion
// corrected code
```

**Steps of Reproduction:**

<details>
<summary><b>Steps of Reproduction ✅</b></summary>

```mdx
1. Step 1...
2. Step 2...
```
</details>

<details>
<summary><b>Prompt for AI Agent 🤖</b></summary>

```
[Ready-to-paste AI fix prompt]
```
</details>
````

**Severity levels:** 🚨 `error` (critical bugs, security) · ⚠️ `warning` · 💡 `info`

All AgnusAI comments include a hidden marker (`[//]: # (AGNUSAI)`) so they can be identified and deduplicated across review runs.

## Quick Start

```bash
git clone https://github.com/ivoyant-eng/AgnusAi.git
cd AgnusAi
npm install
npm run build

# Review a GitHub PR (dry run)
GITHUB_TOKEN=$(gh auth token) node dist/cli.js review \
  --pr 123 --repo owner/repo --dry-run

# Review an Azure DevOps PR
AZURE_DEVOPS_TOKEN=xxx node dist/cli.js review \
  --pr 456 --repo ivoyant/my-repo --vcs azure
```

## Installation

```bash
git clone https://github.com/ivoyant-eng/AgnusAi.git
cd AgnusAi
npm install
npm run build
```

**Requirements:** Node.js 18+

## Configuration

### Config File

Create `~/.pr-review/config.yaml`:

```bash
mkdir -p ~/.pr-review
cp config.example.yaml ~/.pr-review/config.yaml
```

```yaml
# ~/.pr-review/config.yaml

vcs:
  github:
    token: ""              # or set GITHUB_TOKEN env var
  azure:
    organization: "my-org"
    project: "my-project"
    token: ""              # or set AZURE_DEVOPS_TOKEN env var

llm:
  provider: ollama         # ollama | openai | azure | claude | custom
  model: qwen3.5:cloud
  providers:
    ollama:
      baseURL: http://localhost:11434/v1
    openai:
      baseURL: https://api.openai.com/v1
      apiKey: ${OPENAI_API_KEY}
    azure:
      baseURL: https://your-resource.openai.azure.com/openai/deployments/gpt-4
      apiKey: ${AZURE_OPENAI_KEY}
    claude:
      apiKey: ${ANTHROPIC_API_KEY}
    custom:
      baseURL: https://your-endpoint.com/v1
      apiKey: ${CUSTOM_API_KEY}

skills:
  path: ~/.pr-review/skills
  default: default

review:
  maxDiffSize: 50000
  ignorePaths:
    - node_modules
    - dist
    - build
    - "*.lock"
```

### Environment Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | GitHub reviews |
| `AZURE_DEVOPS_TOKEN` | Azure DevOps PAT | Azure DevOps reviews |
| `ANTHROPIC_API_KEY` | Anthropic API Key | Claude provider |
| `OPENAI_API_KEY` | OpenAI API Key | OpenAI provider |
| `AZURE_OPENAI_KEY` | Azure OpenAI Key | Azure provider |
| `CUSTOM_API_KEY` | Custom endpoint key | Custom provider |

See `.env.example` for full configuration options.

## LLM Backend

AgnusAI uses Vercel AI SDK's `@ai-sdk/openai-compatible` package to support any OpenAI-compatible endpoint:

### Claude (Best Quality)

```bash
export ANTHROPIC_API_KEY=sk-ant-...

node dist/cli.js review --pr 123 --repo owner/repo --provider claude
```

**Models:** `claude-sonnet-4-6` (default), `claude-opus-4-6`

### Ollama (Local, Free)

```bash
ollama pull qwen3.5:cloud

node dist/cli.js review --pr 123 --repo owner/repo --provider ollama --model qwen3.5:cloud
```

### OpenAI

```bash
export OPENAI_API_KEY=sk-...

node dist/cli.js review --pr 123 --repo owner/repo --provider openai
```

**Models:** `gpt-4o` (default), `gpt-4-turbo`, `gpt-3.5-turbo`

### Azure OpenAI

```bash
export AZURE_OPENAI_KEY=...

node dist/cli.js review --pr 123 --repo owner/repo --provider azure
```

### Custom / Self-hosted

Any OpenAI-compatible endpoint (LM Studio, vLLM, etc.):

```bash
node dist/cli.js review --pr 123 --repo owner/repo \
  --provider custom --model my-model
```

**Recommended Models:**

| Model | Provider | Best For |
|-------|----------|----------|
| `claude-sonnet-4-6` | Claude | High quality, balanced |
| `claude-opus-4-6` | Claude | Maximum quality |
| `gpt-4o` | OpenAI | General reviews |
| `qwen3.5:cloud` | Ollama | Fast, free, general |
| `codellama:70b` | Ollama | Complex code analysis |
| `deepseek-coder:33b` | Ollama | Code-specific reviews |

## CLI Commands

```bash
# Review a GitHub PR
node dist/cli.js review --pr 123 --repo owner/repo

# Review an Azure DevOps PR
node dist/cli.js review \
  --pr 456 \
  --repo ivoyant/my-repo \
  --vcs azure

# Use a specific provider and model
node dist/cli.js review --pr 123 --repo owner/repo \
  --provider claude --model claude-sonnet-4-6

# Dry run — show review without posting comments
node dist/cli.js review --pr 123 --repo owner/repo --dry-run

# Incremental review — only review new commits since last run
node dist/cli.js review --pr 123 --repo owner/repo --incremental

# Output as JSON
node dist/cli.js review --pr 123 --repo owner/repo --output json

# Use a specific skill
node dist/cli.js review --pr 123 --repo owner/repo --skill security

# List available skills
node dist/cli.js skills

# Show current config
node dist/cli.js config
```

## VCS Support

### GitHub

```bash
GITHUB_TOKEN=$(gh auth token) node dist/cli.js review \
  --pr 123 --repo owner/repo
```

### Azure DevOps

Azure org and project are read from `~/.pr-review/config.yaml`. The `--repo` flag takes the form `<any-prefix>/<repository-name>` — only the repository name (after `/`) is used.

```bash
AZURE_DEVOPS_TOKEN=xxx node dist/cli.js review \
  --pr 10295 \
  --repo ivoyant/orchestration-studio \
  --vcs azure
```

Azure DevOps does not expose a unified diff endpoint, so AgnusAI fetches file content at source and target commits and computes the diff using an LCS algorithm. Path normalization is applied automatically so inline comments always land on the correct lines.

## Incremental Reviews

With `--incremental`, AgnusAI tracks review state using a checkpoint stored as an HTML comment in the PR metadata. On subsequent runs:

1. Only commits added **since the last checkpoint** are reviewed
2. Files that haven't changed are skipped entirely
3. Comments on lines that are identical to the previously reviewed version are deduplicated
4. The checkpoint is updated after every successful run

This prevents duplicate noise on PRs that receive multiple rounds of feedback.

## Comment Reply Threads

AgnusAI includes a webhook handler that enables two-way conversations on inline comments.

When a user replies to an AgnusAI comment:
1. A GitHub webhook delivers the `pull_request_review_comment` event
2. The handler fetches the full thread history
3. The LLM generates a contextual response (taking into account the original issue, the user's reply, and prior conversation)
4. The response is posted as a reply in the thread

Dismissal signals ("wontfix", "as designed", "intentional") are detected and the thread is closed gracefully.

## Smart Deduplication

AgnusAI applies multiple layers of filtering before posting any comment:

- **Same-line deduplication** — will not post a second comment on a line that already has an AgnusAI comment
- **Dismissed comments** — respects "wontfix" and similar signals; will not re-open resolved threads
- **Fixed code** — detects when the code that triggered a comment has since been changed and skips re-commenting
- **Binary files** — images, fonts, archives, and compiled assets are skipped
- **Generated/minified files** — auto-generated files and minified bundles are skipped
- **Lock files** — `package-lock.json`, `pnpm-lock.yaml`, etc. are always skipped
- **Draft PRs** — draft PRs are skipped by default
- **Merged/closed PRs** — already-merged PRs are skipped

## Skills

Skills define review behaviour. They are Markdown files with YAML front matter that get injected into the LLM prompt.

### Built-in Skills

| Skill | Triggers | Focus |
|-------|----------|-------|
| `default` | `**/*` | General correctness, patterns, best practices |
| `security` | `**/*.ts`, `**/api/**` | Vulnerabilities, auth, input validation |
| `frontend` | `**/*.tsx`, `**/*.css` | React patterns, a11y, performance |
| `backend` | `**/api/**`, `**/*.go` | API design, database, reliability |

### Creating a Custom Skill

```bash
mkdir -p ~/.pr-review/skills/my-skill
```

```markdown
---
name: My Custom Review
description: Custom review rules for our codebase
trigger:
  - "**/*.ts"
  - "src/**/*.js"
priority: high
---

# My Custom Review Rules

## What to Check
- No `any` types allowed
- All public functions must have JSDoc comments
- Max 50 lines per function
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLI Entry Point                           │
│              node dist/cli.js review --pr 123 ...               │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                        PRReviewAgent                             │
│   - Orchestrates VCS, LLM, Skills, and Checkpoint               │
│   - Handles incremental diff fetching                           │
│   - Coordinates deduplication and comment posting               │
└──────────────────────────────────────────────────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────────┐
│VCS Adapters│ │ LLM Backend │ │  Skills  │ │   Checkpoint     │
│            │ │             │ │  Loader  │ │   Manager        │
│ - GitHub   │ │ Vercel AI   │ │          │ │                  │
│ - Azure    │ │ SDK         │ │ Glob     │ │ Incremental SHA  │
│   DevOps   │ │ ┌─────────┐ │ │ pattern  │ │ tracking via PR  │
└────────────┘ │ │prompt.ts│ │ │ matching │ │ comment metadata │
               │ └─────────┘ │ └──────────┘ └──────────────────┘
               │ ┌─────────┐ │
               │ │parser.ts│ │
               │ └─────────┘ │
               │ Ollama      │
               │ Claude      │
               │ OpenAI      │
               │ Azure       │
               │ Custom      │
               └─────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Comment Manager                              │
│  - Deduplication (same-line, dismissed, fixed, binary, locks)   │
│  - Post inline comments with severity + steps + AI prompt       │
│  - Post general summary comment                                  │
│  - Verdict: approve | request_changes | comment                 │
│  - Azure DevOps vote (approve / waiting for author)             │
└──────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Webhook Handler (GitHub)                       │
│  - Listens for pull_request_review_comment events               │
│  - Builds thread history context                                 │
│  - LLM generates contextual reply                               │
│  - Posts reply via GitHub API                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `BaseLLMBackend` abstract class | `prompt.ts` and `parser.ts` are shared — adding a new provider requires only implementing `generate()` |
| LCS-based diff for Azure DevOps | Azure DevOps API doesn't return unified diffs; file content at source/target commits is fetched and diffed locally |
| Path normalisation in `postReview` | Azure DevOps paths have a leading `/`; LLM output may omit it — normalised paths are validated against the actual diff file list before posting |
| LLM generates full markdown body | The LLM writes the entire comment directly — no template stitching; avoids reliability issues with local models |
| Checkpoint in PR comment metadata | Incremental state is stored as an HTML comment in the PR itself, requiring no external database |

## Project Structure

```
AgnusAi/
├── src/
│   ├── index.ts                    # PRReviewAgent — main orchestrator
│   ├── cli.ts                      # CLI entry point (review, skills, config)
│   ├── types.ts                    # TypeScript interfaces
│   │
│   ├── adapters/
│   │   ├── vcs/
│   │   │   ├── base.ts             # VCSAdapter interface
│   │   │   ├── github.ts           # GitHub implementation (Octokit)
│   │   │   └── azure-devops.ts     # Azure DevOps (LCS diff, path normalisation)
│   │   └── ticket/                 # Phase 3 — Ticket integration (stubs)
│   │       ├── base.ts
│   │       ├── jira.ts
│   │       └── linear.ts
│   │
│   ├── llm/
│   │   ├── base.ts                 # BaseLLMBackend abstract class
│   │   ├── unified.ts              # UnifiedLLMBackend (Vercel AI SDK)
│   │   ├── prompt.ts               # Shared prompt builder
│   │   ├── parser.ts               # Shared response parser
│   │   ├── ollama.ts
│   │   ├── claude.ts
│   │   └── openai.ts
│   │
│   ├── review/
│   │   ├── engine.ts               # ReviewEngine — orchestrates review process
│   │   ├── comment-manager.ts      # Platform-agnostic comment posting
│   │   ├── deduplication.ts        # Comment filtering and dedup logic
│   │   ├── checkpoint.ts           # Incremental review state tracking
│   │   ├── thread.ts               # Comment thread types and utilities
│   │   ├── reply.ts                # LLM-powered reply generation
│   │   └── output.ts               # Output formatting
│   │
│   ├── context/
│   │   ├── builder.ts              # ReviewContext assembly
│   │   └── types.ts
│   │
│   ├── skills/
│   │   └── loader.ts               # SkillLoader — glob pattern matching
│   │
│   └── webhook/
│       └── handler.ts              # GitHub webhook handler for comment replies
│
├── skills/
│   ├── default/SKILL.md
│   ├── security/SKILL.md
│   ├── frontend/SKILL.md
│   └── backend/SKILL.md
│
├── __tests__/                      # Jest test suite
├── .env.example
├── config.example.yaml
└── package.json
```

## CI/CD Integration

### GitHub Actions

```yaml
name: AI PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install AgnusAI
        run: |
          git clone https://github.com/ivoyant-eng/AgnusAi.git
          cd AgnusAi && npm install && npm run build

      - name: Run Review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          cd AgnusAi
          node dist/cli.js review \
            --pr ${{ github.event.pull_request.number }} \
            --repo ${{ github.repository }} \
            --provider claude \
            --incremental
```

### Azure Pipelines

```yaml
trigger: none
pr:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'

  - script: |
      git clone https://github.com/ivoyant-eng/AgnusAi.git
      cd AgnusAi && npm install && npm run build
    displayName: 'Install AgnusAI'

  - script: |
      cd AgnusAi
      node dist/cli.js review \
        --pr $(System.PullRequest.PullRequestId) \
        --repo ivoyant/$(Build.Repository.Name) \
        --vcs azure
    displayName: 'Run Review'
    env:
      AZURE_DEVOPS_TOKEN: $(System.AccessToken)
      ANTHROPIC_API_KEY: $(ANTHROPIC_API_KEY)
```

## Roadmap

### ✅ Phase 1 — Foundation
- [x] GitHub adapter (Octokit)
- [x] Ollama backend
- [x] CLI skeleton (`review`, `skills`, `config`)
- [x] Context builder
- [x] Inline comments on specific diff lines
- [x] Skills-based review with glob pattern matching

### ✅ Phase 2 — Multi-provider & Azure DevOps
- [x] Claude backend
- [x] OpenAI backend
- [x] Azure OpenAI backend
- [x] Azure DevOps adapter with LCS-based diff computation
- [x] Decoupled `prompt.ts` / `parser.ts` shared across all providers
- [x] Rich comment format (Severity, Steps of Reproduction, AI Fix Prompt)

### ✅ Phase 2.5 — Incremental Reviews & Comment Threading
- [x] Incremental review with checkpoint tracking (`--incremental`)
- [x] Only reviews new commits since last run; skips unchanged files
- [x] Comment deduplication (same-line, dismissed, fixed code)
- [x] Skips binary, generated, minified, and lock files
- [x] Draft / merged / closed PR detection
- [x] GitHub webhook handler for comment replies
- [x] LLM-powered contextual reply generation
- [x] Thread history tracking for coherent multi-turn conversations
- [x] Dismissal detection ("wontfix", "as designed")

### 🔲 Phase 3 — Ticket Integration
- [ ] Jira adapter
- [ ] Linear adapter
- [ ] GitHub Issues adapter
- [ ] Azure Boards adapter
- [ ] Memory system (learned codebase conventions)

### 🔲 Phase 4 — Distribution
- [ ] Binary distribution (pkg / bun)
- [ ] npm global install (`npx agnusai review ...`)
- [ ] Homebrew formula

---

## v2 Roadmap — Deeper Code Intelligence

The following features extend AgnusAI beyond diff-level reviews into full codebase understanding.

### Priority Overview

| Priority | Feature | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| **P2** | TypeScript Type Checking | 🟡 Medium | 🟡 Medium | 🔲 Not Started |
| **P2** | Codebase Embeddings | 🔴 High | 🔴 High | 🔲 Not Started |
| **P3** | Multi-language LSP | 🟡 Medium | 🔴 High | 🔲 Not Started |
| **P3** | Impact Analysis | 🔴 High | 🔴 High | 🔲 Not Started |

---

### P2: TypeScript Type-Aware Reviews

Use the TypeScript Compiler API (`ts.createProgram`) to extract type information, diagnostics, and function signatures, then inject this context into the review prompt for richer analysis.

```
ts.createProgram() → TypeChecker → getTypeAtLocation()
     │
     ▼
Extract types, diagnostics, function signatures
     │
     ▼
Inject into review prompt → Type-aware LLM review
```

---

### P2: Codebase Embeddings (Context Awareness)

Chunk the codebase by function/class, generate embeddings via Vercel AI SDK `embedMany()`, and store them in a vector database (Qdrant). During review, retrieve semantically similar code patterns to enrich the review context.

```
Codebase → Chunker (function/class) → embedMany() → Qdrant
     │
     ▼
During review → Query similar patterns → Inject into context
```

---

### P3: Multi-language LSP + Impact Analysis

| Language | LSP Server |
|----------|------------|
| TypeScript | `ts.createProgram()` |
| Python | Pyright / Pylance |
| Go | gopls |
| Rust | rust-analyzer |
| Java | jdtls |

**Impact Analysis:**
- Find all dependents of changed functions/classes
- Detect breaking API changes
- Suggest related files that may need updates
- Generate call graphs for affected code paths

---

## Architecture Overview (v2 Target)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GitHub Webhook                              │
│                   (PR events, comment replies)                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PR Event Handler                             │
│              • Incremental Diff Analyzer                            │
│              • Comment Manager (post/reply/resolve)                 │
└─────────────────────────────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   LSP Manager    │  │  Context Builder  │  │    Vector DB     │
│  (P2/P3)         │  │                   │  │    (Qdrant)      │
│                  │  │ • Diff context    │  │                  │
│ • TypeScript     │  │ • Type info       │  │ • Embeddings     │
│ • Python (P3)    │  │ • Similar code    │  │ • Metadata       │
│ • Go (P3)        │  │ • Thread history  │  │ • Similarity     │
│ • Rust (P3)      │  │                   │  │   queries        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        LLM Backend (Vercel AI SDK)                  │
│              Ollama • Claude • OpenAI • Azure • Custom              │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Comment Manager                              │
│              • Post inline comments                                 │
│              • Reply to threads                                     │
│              • Resolve stale comments                               │
│              • Update checkpoint                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Want to contribute?** Check [CONTRIBUTING.md](./CONTRIBUTING.md) or pick up an issue from the roadmap!

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT

## Author

[Ashish Maurya](https://github.com/theashishmaurya) — [ivoyant](https://github.com/ivoyant-eng)
