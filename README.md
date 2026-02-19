# AgnusAI — AI-Powered PR Review Agent

An AI-powered code review agent that reviews pull requests on **GitHub** and **Azure DevOps**, posts rich inline comments with severity levels, reproduction steps, and AI fix prompts — all powered by your choice of LLM backend.

## Features

- 🤖 **Multiple LLM Backends** — Ollama (local/free), Claude (Anthropic), OpenAI
- 🔄 **Multi-platform** — GitHub and Azure DevOps
- 📍 **Inline Comments** — Rich formatted comments posted on specific lines in the diff
- 📚 **Skills-based** — Pluggable review skills matched by file patterns
- 🚀 **Pipeline-triggered** — Runs in CI/CD, no continuously running service
- 🔌 **Decoupled Architecture** — Prompt building and response parsing are shared across all providers

## Comment Format

Every inline comment follows a rich structured format:

```
**Suggestion:** [description of the issue] [tag]

<details>Severity Level: Major ⚠️</details>

```suggestion
// corrected code
```

**Steps of Reproduction:**
<details>Steps to reproduce...</details>

<details>Prompt for AI Agent 🤖</details>
```

Each comment includes collapsible **Severity**, **Steps of Reproduction**, and a ready-to-paste **AI Agent prompt** to fix the issue.

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
  provider: ollama         # ollama | claude | openai
  model: qwen3.5:cloud
  baseUrl: "http://localhost:11434"

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
| `ANTHROPIC_API_KEY` | Anthropic API Key | Claude backend |
| `OPENAI_API_KEY` | OpenAI API Key | OpenAI backend |
| `OLLAMA_HOST` | Ollama server URL | Ollama (default: localhost:11434) |

## LLM Backends

All backends share the same prompt builder and response parser. Only the API call differs per provider.

### Ollama (Default — Free, Local)

```bash
ollama pull qwen3.5:cloud

node dist/cli.js review --pr 123 --repo owner/repo --provider ollama --model qwen3.5:cloud
```

**Recommended Models:**

| Model | Size | Best For |
|-------|------|----------|
| `qwen3.5:cloud` | ~0.5GB | Fast, general reviews |
| `qwen3.5:397b-cloud` | Cloud | High quality reviews |
| `codellama:70b` | 38GB | Complex code analysis |
| `deepseek-coder:33b` | 19GB | Code-specific reviews |

### Claude (Best Quality)

```bash
export ANTHROPIC_API_KEY=sk-ant-...

node dist/cli.js review --pr 123 --repo owner/repo --provider claude
```

**Models:** `claude-sonnet-4-20250514` (default), `claude-opus-4-20250514`

### OpenAI

```bash
export OPENAI_API_KEY=sk-...

node dist/cli.js review --pr 123 --repo owner/repo --provider openai
```

**Models:** `gpt-4o` (default), `gpt-4-turbo`, `gpt-3.5-turbo`

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
  --provider claude --model claude-sonnet-4-20250514

# Dry run — show review without posting comments
node dist/cli.js review --pr 123 --repo owner/repo --dry-run

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

## Skills

Skills define review behaviour. They are markdown files with YAML front matter that get injected into the LLM prompt.

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
│   - Orchestrates VCS, LLM, and Skills                           │
│   - Validates comment paths against diff                         │
│   - Caches diff to avoid duplicate API calls                    │
└──────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────┐   ┌───────────────────┐   ┌──────────────────┐
│ VCS Adapters │   │   LLM Backends    │   │  Skill Loader    │
│              │   │                   │   │                  │
│ - GitHub     │   │  BaseLLMBackend   │   │ Matches skills   │
│ - Azure      │   │  ┌─────────────┐  │   │ by file glob     │
│   DevOps     │   │  │ prompt.ts   │  │   │ patterns         │
└──────────────┘   │  │ (shared)    │  │   └──────────────────┘
                   │  └─────────────┘  │
                   │  ┌─────────────┐  │
                   │  │ parser.ts   │  │
                   │  │ (shared)    │  │
                   │  └─────────────┘  │
                   │  ┌─────┐ ┌─────┐  │
                   │  │Ollam│ │Claud│  │
                   │  │  a  │ │  e  │  │
                   │  └─────┘ └─────┘  │
                   │  ┌─────┐          │
                   │  │OpenA│          │
                   │  │  I  │          │
                   │  └─────┘          │
                   └───────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Output Layer                              │
│  - Rich inline comments (Severity + Steps + AI Fix Prompt)      │
│  - General summary comment                                       │
│  - Verdict: approve | request_changes | comment                 │
│  - Azure DevOps vote (approve/waiting for author)               │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `BaseLLMBackend` abstract class | `prompt.ts` and `parser.ts` are shared — adding a new provider requires only implementing `generate()` |
| LCS-based diff for Azure DevOps | Azure DevOps API doesn't return unified diffs; we fetch file content at source/target commits and compute the diff ourselves |
| Path normalisation in `postReview` | Azure DevOps paths have a leading `/`; LLM output may omit it — normalised paths are validated against actual diff file list before posting |
| Model generates full markdown body | The LLM writes the entire comment (Severity, Steps, AI prompt) directly — no template stitching needed |

## Project Structure

```
AgnusAi/
├── src/
│   ├── index.ts                  # PRReviewAgent orchestrator
│   ├── cli.ts                    # CLI entry point
│   ├── types.ts                  # TypeScript types
│   ├── adapters/
│   │   └── vcs/
│   │       ├── base.ts           # VCSAdapter interface
│   │       ├── github.ts         # GitHub adapter
│   │       └── azure-devops.ts   # Azure DevOps adapter (LCS diff, path normalisation)
│   └── llm/
│       ├── base.ts               # BaseLLMBackend abstract class
│       ├── prompt.ts             # Shared prompt builder
│       ├── parser.ts             # Shared response parser
│       ├── ollama.ts             # Ollama API call
│       ├── claude.ts             # Claude API call
│       └── openai.ts             # OpenAI API call
├── skills/
│   ├── default/SKILL.md
│   ├── security/SKILL.md
│   ├── frontend/SKILL.md
│   └── backend/SKILL.md
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
            --provider claude
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
- GitHub adapter
- Ollama backend
- CLI skeleton
- Context builder
- Inline comments on specific lines

### ✅ Phase 2 — Multi-provider
- Claude backend
- OpenAI backend
- Azure DevOps adapter with LCS-based real diff
- Decoupled `prompt.ts` / `parser.ts` shared across all providers
- Rich comment format (Severity, Steps of Reproduction, AI Fix Prompt)

### 🔲 Phase 3 — Ticket Integration
- Jira adapter
- Linear adapter
- GitHub Issues adapter
- Azure Boards adapter
- Memory system (learned conventions)

### 🔲 Phase 4 — Distribution
- Binary distribution (pkg/bun)
- npm global install
- Homebrew formula

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT

## Author

[Ashish Maurya](https://github.com/theashishmaurya) — [ivoyant](https://github.com/ivoyant-eng)
