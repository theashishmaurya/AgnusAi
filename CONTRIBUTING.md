# Contributing to AgnusAI

Thank you for your interest in contributing! This document covers how to set up the project, the codebase structure, and guidelines for submitting changes.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Adding a New LLM Provider](#adding-a-new-llm-provider)
- [Adding a New VCS Adapter](#adding-a-new-vcs-adapter)
- [Creating or Improving Skills](#creating-or-improving-skills)
- [Code Style](#code-style)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Issues](#reporting-issues)

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- TypeScript (installed via `npm install`)
- An Ollama instance running locally (for local testing), or API keys for Claude / OpenAI

### Setup

```bash
git clone https://github.com/ivoyant-eng/AgnusAi.git
cd AgnusAi
npm install
npm run build
```

### Running Locally

```bash
# Dry run against a GitHub PR
GITHUB_TOKEN=$(gh auth token) node dist/cli.js review \
  --pr 123 --repo owner/repo --dry-run

# Dry run against an Azure DevOps PR
AZURE_DEVOPS_TOKEN=xxx node dist/cli.js review \
  --pr 456 --repo ivoyant/my-repo --vcs azure --dry-run
```

### Watching for Changes

```bash
npx tsc --watch
```

---

## Project Structure

```
src/
├── index.ts                  # PRReviewAgent — main orchestrator
├── cli.ts                    # CLI commands (review, skills, config)
├── types.ts                  # All TypeScript interfaces and types
│
├── adapters/
│   └── vcs/
│       ├── base.ts           # VCSAdapter interface
│       ├── github.ts         # GitHub implementation
│       └── azure-devops.ts   # Azure DevOps implementation
│
└── llm/
    ├── base.ts               # BaseLLMBackend abstract class
    ├── prompt.ts             # Shared prompt builder (edit here to change review format)
    ├── parser.ts             # Shared response parser
    ├── ollama.ts             # Ollama API call only
    ├── claude.ts             # Claude API call only
    └── openai.ts             # OpenAI API call only

skills/                       # Built-in skills shipped with the project
├── default/SKILL.md
├── security/SKILL.md
├── frontend/SKILL.md
└── backend/SKILL.md
```

### Key Principle

> **Prompt building and response parsing live in `prompt.ts` and `parser.ts` — not in individual provider files.**

Each LLM backend only implements one method: `generate(prompt, context): Promise<string>`. Everything else is shared.

---

## Adding a New LLM Provider

1. Create `src/llm/<provider>.ts`
2. Extend `BaseLLMBackend` and implement `generate()`:

```typescript
import { BaseLLMBackend } from './base';
import { ReviewContext } from '../types';

interface MyProviderConfig {
  apiKey: string;
  model?: string;
}

export class MyProviderBackend extends BaseLLMBackend {
  readonly name = 'myprovider';
  private apiKey: string;
  private model: string;

  constructor(config: MyProviderConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'my-default-model';
  }

  async generate(prompt: string, _context: ReviewContext): Promise<string> {
    // Make the API call and return the raw text response
    const response = await fetch('https://api.myprovider.com/v1/chat', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt })
    });
    const data = await response.json() as { text: string };
    return data.text;
  }
}
```

3. Register the provider in `src/cli.ts` — add a branch to the LLM initialisation block:

```typescript
} else if (config.llm.provider === 'myprovider') {
  const apiKey = process.env.MYPROVIDER_API_KEY || config.llm.apiKey;
  llm = new MyProviderBackend({ apiKey, model: config.llm.model });
}
```

4. Export from `src/index.ts`:

```typescript
export { MyProviderBackend } from './llm/myprovider';
```

5. Update `src/types.ts` to add `'myprovider'` to the `LLMConfig.provider` union type.

That's it — the new provider automatically uses the shared prompt and parser.

---

## Adding a New VCS Adapter

1. Create `src/adapters/vcs/<platform>.ts`
2. Implement the `VCSAdapter` interface from `src/adapters/vcs/base.ts`:

```typescript
import { VCSAdapter } from './base';
import { PullRequest, Diff, FileInfo, ReviewComment, Review, Ticket, Author } from '../../types';

export class MyPlatformAdapter implements VCSAdapter {
  readonly name = 'myplatform';

  async getPR(prId: string | number): Promise<PullRequest> { ... }
  async getDiff(prId: string | number): Promise<Diff> { ... }
  async getFiles(prId: string | number): Promise<FileInfo[]> { ... }
  async addComment(prId: string | number, comment: ReviewComment): Promise<void> { ... }
  async addInlineComment(prId, path, line, body, severity): Promise<void> { ... }
  async submitReview(prId: string | number, review: Review): Promise<void> { ... }
  async getLinkedTickets(prId: string | number): Promise<Ticket[]> { ... }
  async getAuthor(prId: string | number): Promise<Author> { ... }
  async getFileContent(path: string, ref?: string): Promise<string> { ... }
}
```

### Diff Requirements

The `getDiff()` method must return a `Diff` with populated `DiffHunk[]` per file. Each hunk's `content` field should be a standard unified diff block:

```
@@ -10,5 +10,7 @@
 context line
-removed line
+added line
 context line
```

If your platform doesn't provide a raw diff endpoint (like Azure DevOps), fetch file content at two commits and use the LCS algorithm pattern from `src/adapters/vcs/azure-devops.ts` as reference.

3. Register the adapter in `src/cli.ts`.

---

## Creating or Improving Skills

Skills are markdown files that get injected into the LLM prompt for matching file types.

### Structure

```markdown
---
name: My Skill
description: What this skill reviews
trigger:
  - "**/*.py"
  - "src/api/**"
priority: high   # high | medium | low
---

# Review Focus

What to look for in these files...

## Common Issues
- Issue 1
- Issue 2
```

### Built-in Skills Location

`skills/` at the project root — these are shipped with the agent.

### User Skills Location

`~/.pr-review/skills/` — user-defined skills, not tracked in the repo.

### Tips for Writing Good Skills

- Be specific about what to check — vague instructions produce vague reviews
- Include examples of bad patterns and what to suggest instead
- Keep skills focused on one concern (security, performance, etc.) rather than everything
- Higher `priority` skills are injected first into the prompt

---

## Code Style

- **TypeScript strict mode** is enabled — avoid `any` types
- **No classes where plain functions suffice** — `prompt.ts` and `parser.ts` use exported functions, not classes
- **Keep provider files thin** — only the API call, nothing else
- **Error messages should be actionable** — tell the user what to do, not just what failed
- Run `npm run build` before committing — the CI will reject TypeScript errors

---

## Submitting a Pull Request

1. **Fork** the repository and create a branch from `master`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes** and ensure the project builds:
   ```bash
   npm run build
   ```

3. **Test manually** with a real or dry-run PR review:
   ```bash
   node dist/cli.js review --pr <id> --repo <repo> --dry-run
   ```

4. **Commit** with a clear message following this format:
   ```
   <type>: <short description>

   Types: feat | fix | refactor | docs | chore
   ```
   Examples:
   - `feat: add Gemini LLM backend`
   - `fix: normalise Azure DevOps file paths before posting`
   - `docs: update ADR with LCS diff decision`

5. **Push** and open a Pull Request against `master` on `ivoyant-eng/AgnusAi`.

6. Fill in the PR description explaining:
   - **What** changed
   - **Why** it was needed
   - **How** to test it

### PR Checklist

- [ ] `npm run build` passes with no errors
- [ ] Manually tested with `--dry-run` against a real PR
- [ ] New provider/adapter follows the existing interface
- [ ] No secrets or tokens committed
- [ ] README / ADR updated if architecture changed

---

## Reporting Issues

Open an issue at [github.com/ivoyant-eng/AgnusAi/issues](https://github.com/ivoyant-eng/AgnusAi/issues) with:

- **What you expected** to happen
- **What actually happened** (include the full error output)
- **How to reproduce** it (PR URL if possible, CLI command used, provider, model)
- **Environment**: OS, Node.js version, provider

---

## Questions?

Open a discussion or reach out to [@theashishmaurya](https://github.com/theashishmaurya).
