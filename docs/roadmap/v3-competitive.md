# v3 Roadmap — Competitive Feature Parity & Differentiation

> **Research date:** February 2026
> **Benchmark:** Qodo (formerly CodiumAI) — Qodo Merge v2.1, Gartner 2025 Visionary
> **AgnusAI current state:** v2 complete — graph-aware reviews, Fastify API, React dashboard, GitHub + Azure webhooks, Ollama/OpenAI/Claude/Azure backends, pgvector RAG feedback loop, precision filter, incremental checkpointing.

---

## AgnusAI's Unmatched Advantages (Never Compromise These)

Before listing gaps, these are capabilities Qodo does NOT have that define our positioning:


| Capability                                                                  | AgnusAI                                | Qodo                                                     |
| --------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| **Symbol dependency graph** — Tree-sitter + BFS blast radius                | ✅ Core feature                         | ❌ RAG/embeddings only, no real symbol graph              |
| **Air-gapped / fully self-hostable**                                        | ✅ Docker Compose, zero external calls  | ❌ Enterprise SaaS, on-prem is paid-only                  |
| **Local LLMs via Ollama** — zero data egress                                | ✅ First-class                          | ❌ PR-Agent OSS only, not in Merge enterprise             |
| **Graph-aware context in prompt** — callers, callees, blast radius injected | ✅ `serializeGraphContext()`            | ❌ No structural equivalent                               |
| **RAG feedback loop** — accepted/rejected comments via pgvector             | ✅ `priorExamples` / `rejectedExamples` | ✅ Similar via `auto_best_practices` (different approach) |


---

## Feature Gap Summary

### 🔴 High Impact (Build These)

#### G1 — PR Description Generation (`/describe`)

Qodo automatically writes back to the PR itself: title, change type (bug/feature/refactor/docs/tests), prose summary, file-by-file code walkthrough, and PR labels. AgnusAI only generates a `SUMMARY` block inside a review comment. No PR description mutation, no walkthrough, no labels.

**Impact:** First thing every reviewer reads. Reduces reviewer onboarding time on a PR significantly.
**Plan:** `docs/plans/pr-describe.md`

#### G2 — Inline Suggestions in GitHub `suggestion` Format

Qodo posts suggestions in GitHub's native suggestion block format (one-click apply). It validates each suggestion with tree-sitter before posting — if applying it would produce a syntax-invalid file, the suggestion is dropped. AgnusAI has the `CodeSuggestion` type and `suggestion` fence in the prompt template, but no post-processing validation and no distinct handling in `postReview`.

**Impact:** One-click apply is a major developer UX win. Without it, every fix requires a context switch to the editor.

#### G3 — Rules System with Continuous Learning

Qodo v2.1 (Feb 2026) ships a four-component rules engine:

1. Rules Discovery Agent — scans codebase + PR history to auto-generate rules
2. Rules Expert Agent — detects conflicts, duplicates, stale rules and prunes them
3. Scalable Enforcement — every PR checked against the rule set automatically
4. Analytics — per-rule adoption rates, violation trends, merged violations, CSV export

AgnusAI has the YAML skills system + pgvector RAG feedback loop (`priorExamples`/`rejectedExamples`) — the seed of this capability exists, but it is not surfaced as user-visible governed rules with a management UI or analytics.

**Impact:** For security-sensitive enterprise ICP (fintech/health/defense), demonstrating standards are being enforced and improving over time is a compliance requirement.
**Plan:** `docs/plans/rules-system.md`

#### G4 — Multi-Agent Specialized Review Architecture

Qodo v2.0 runs parallel specialized agents (security, performance, best-practices, ticket-compliance), a Context Collector, and a Judge that consolidates and deduplicates findings. This is why they claim 60.1% F1 on their benchmark (9% ahead of next competitor). AgnusAI does a single LLM call per review — the skills system injects domain instructions but is not parallel multi-agent.

**Impact:** Multi-agent allows focused smaller prompts (lower hallucination), more recall (more real bugs caught), and a Judge to eliminate false positives across agents.
**Plan:** `docs/plans/multi-agent-architecture.md`

#### G5 — Multi-Organization Support

Qodo supports multiple GitHub/Azure/GitLab organizations under one deployment, with per-org webhook endpoints, per-org configuration, and org-scoped user management. AgnusAI is single-tenant today — one admin, invite-only, no organization concept, global webhooks.

**Impact:** Blocks enterprise adoption. Any team with multiple business units, subsidiaries, or product lines cannot use AgnusAI today.
**Plan:** `docs/plans/multi-org.md`

---

### 🟠 Medium-High Impact

#### G6 — Ticket Compliance Scoring

Qodo fetches acceptance criteria from Jira/Linear/Azure Boards/GitHub Issues and posts a structured verdict: `Fully Compliant / Partially Compliant / Not Compliant` with specific gaps listed. AgnusAI injects ticket context into the prompt but the LLM may or may not mention compliance in its freeform output.

**Impact:** Number one feature requested by PMs and QA leads. Makes the reviewer a traceability tool, not just a quality tool.

#### G7 — PR Label Automation

Labels set on the PR automatically: `Bug fix`, `Tests`, `Enhancement`, `possible security issue`, `review effort [1-5]`. Custom labels via config. AgnusAI has no label support.

#### G8 — `/ask` — Interactive Q&A on the PR

Any reviewer can comment `/ask <question>` and the system answers with full diff + codebase context. AgnusAI is one-shot only — no interactive commands.

#### G9 — PR Effort Estimation + PR Score (0–100)

`review effort [1-5]` label + numeric PR quality score. AgnusAI has per-comment confidence (0.0–1.0) but no aggregate PR-level score or effort signal.

#### G10 — PR Splitting Detection

When a PR covers multiple unrelated themes, explicitly recommend splitting it and name the suggested splits. AgnusAI: none.

#### G11 — Test Generation (`/test` + `/analyze`)

`/analyze` maps changed components; `/test` generates full test suites for selected functions/classes (TS, Python, Java, C#, Go, C++). AgnusAI: none.

---

### 🟡 Medium Impact

#### G12 — Self-Reflection Second Pass

After generating suggestions, a second dedicated LLM call scores each suggestion 0–10 with rationale, re-ranks them, and drops low scores. AgnusAI's `filterByConfidence()` is one call — model scores itself inline, less calibrated.

#### G13 — Auto Best Practices Distillation

Monthly distillation of accepted suggestions into a named rule artifact. Future reviews label matching patterns as `Learned best practice`. AgnusAI has the pgvector RAG loop but no periodic distillation step, no wiki artifact, no labeled output.

#### G14 — `best_practices.md` Hierarchical Config

Hierarchical config: global org → group → repo → subproject (monorepo path-based). AgnusAI has flat skill YAMLs by file extension only.

#### G15 — CI Failure Analysis (`/ci_feedback`)

On CI failure events: which stage, which test, log summary, suggested fix. AgnusAI has no CI event integration.

#### G16 — Documentation Generation (`/add_docs`)

Generates JSDoc/docstrings for every changed function as inline suggestions. Configurable style. AgnusAI: none.

#### G17 — Auto CHANGELOG Update

Reads `CHANGELOG.md`, appends the correct entry in the existing format. AgnusAI: none.

#### G18 — Similar Code Search

Finds code similar to changed components within the org or across public OSS repos, with license info. AgnusAI: none (pgvector similarity exists for symbol retrieval — could be exposed).

#### G19 — `/pr_to_ticket` — Create Ticket from PR

Reads diff + commits → creates a structured ticket in Jira/Linear/GitHub Issues. AgnusAI reads tickets but cannot create them.

---

### 🟢 Low-Medium Impact

- **G20** — Per-push trigger config (`handle_push_trigger` + configurable `push_commands`)
- **G21** — Draft PR opt-in config (`feedback_on_draft_pr = true`)
- **G22** — `allow_only_specific_folders` — path allowlist for monorepo targeting
- **G23** — `response_language` — review output in non-English languages
- **G24** — Browser extension (Chrome) — adds AI buttons directly to GitHub PR pages
- **G25** — Generated file exclusion patterns (`generated_code_ignore.toml`)

---

## Build Sequence for v3

### Phase 1 — Foundation (Unblock Enterprise)

These are the minimum gaps that block sales to multi-team organizations:


| #   | Feature                                                                                                  | Effort | Plan                        |
| --- | -------------------------------------------------------------------------------------------------------- | ------ | --------------------------- |
| 1   | **Multi-organization support** — org entity, per-org webhooks, signup, org-scoped invites                | Large  | `docs/plans/multi-org.md`   |
| 2   | **PR description generation** — auto-write title + walkthrough + type label to PR                        | Medium | `docs/plans/pr-describe.md` |
| 3   | **PR label automation** — security, effort, change type                                                  | Small  | inline with G2              |
| 4   | **Inline suggestion validation** — tree-sitter check before posting `suggestion` blocks                  | Small  | inline with G2              |
| 5   | **Ticket compliance verdict** — structured Fully/Partially/Not Compliant (ticket context already exists) | Small  | standalone                  |


### Phase 2 — Governance (Enterprise Stickiness)


| #   | Feature                                                                            | Effort | Plan                         |
| --- | ---------------------------------------------------------------------------------- | ------ | ---------------------------- |
| 6   | **Rules System UI** — surface RAG loop as named rules with analytics dashboard     | Large  | `docs/plans/rules-system.md` |
| 7   | **Self-reflection second pass** — second LLM call to re-rank and prune suggestions | Small  | standalone                   |
| 8   | `**/ask` command** — respond to PR comment slash commands                          | Medium | standalone                   |
| 9   | **PR splitting detection**                                                         | Small  | inline                       |
| 10  | `**best_practices.md` hierarchy** — org → group → repo → subproject                | Medium | standalone                   |


### Phase 3 — Breadth (Match Feature Parity)


| #   | Feature                                                     | Effort | Plan                                     |
| --- | ----------------------------------------------------------- | ------ | ---------------------------------------- |
| 11  | **Multi-agent architecture** — parallel specialists + Judge | Large  | `docs/plans/multi-agent-architecture.md` |
| 12  | **Test generation**                                         | Large  | standalone                               |
| 13  | **CI failure analysis**                                     | Medium | standalone                               |
| 14  | **Auto best practices distillation**                        | Medium | standalone                               |
| 15  | **Documentation generation**                                | Medium | standalone                               |


---

## What NOT to Build (Qodo Does It, We Shouldn't Copy)

- **Browser extension** — Qodo's Chrome extension is a SaaS-specific UX shortcut. Self-hosters use webhooks.
- **Cloud billing / per-seat pricing UI** — out of scope for self-hosted.
- **SOC-2 / compliance certifications** — not buildable features, organizational processes.
- **monday.com / Gerrit integrations** — niche, low-demand for our ICP.

