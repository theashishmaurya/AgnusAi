# Plan: Rules System UI

> **Priority:** Phase 2 — Governance (Enterprise Stickiness)
> **Effort:** Large (2–3 sprints)
> **Roadmap ref:** `docs/roadmap/v3-competitive.md#G3`

---

## What This Is

Surface AgnusAI's existing pgvector RAG feedback loop as a user-governed **Rules System** — a central UI where teams can create, edit, manage, and track named coding rules that are automatically enforced on every PR review.

The core data already exists: every accepted and rejected review comment is stored in `review_feedback` and retrieved as `priorExamples` / `rejectedExamples` via pgvector in `packages/core/src/retriever/Retriever.ts`. This plan builds the governance layer on top of that foundation.

---

## Current State

| Component | Status |
|---|---|
| `review_feedback` table in Postgres | ✅ Exists |
| `priorExamples` / `rejectedExamples` injected into prompt | ✅ Exists (`Retriever.ts`) |
| Skills YAML files by file extension (`packages/reviewer/skills/`) | ✅ Exists |
| Rules management UI | ❌ None |
| Rule analytics (adherence, violations, trends) | ❌ None |
| Rules discovery (auto-generate from PR history) | ❌ None |
| Per-org rule isolation | ❌ None (needed with multi-org support) |

---

## Database Schema Changes

### New table: `rules`

```sql
CREATE TABLE rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,         -- natural language rule definition
  category    TEXT NOT NULL,         -- 'security' | 'style' | 'performance' | 'correctness' | 'custom'
  scope       TEXT NOT NULL DEFAULT 'org',  -- 'org' | 'repo'
  repo_id     UUID REFERENCES repos(id),    -- null = org-wide
  path_glob   TEXT,                  -- e.g. 'src/payments/**' for monorepo targeting
  enabled     BOOLEAN NOT NULL DEFAULT true,
  source      TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'discovered' | 'imported'
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rules_org ON rules(org_id);
CREATE INDEX idx_rules_repo ON rules(repo_id);
```

### New table: `rule_violations`

```sql
CREATE TABLE rule_violations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES organizations(id),
  repo_id       UUID NOT NULL REFERENCES repos(id),
  pr_number     INTEGER NOT NULL,
  comment_body  TEXT NOT NULL,
  file_path     TEXT,
  line_number   INTEGER,
  resolved      BOOLEAN NOT NULL DEFAULT false,   -- was the violation fixed before merge?
  merged_with_violation BOOLEAN NOT NULL DEFAULT false,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_violations_rule ON rule_violations(rule_id);
CREATE INDEX idx_violations_org ON rule_violations(org_id, detected_at DESC);
```

---

## Backend Changes (`packages/api/`)

### New routes: `src/routes/rules.ts`

```
GET    /api/rules                          List rules for the caller's org (paginated)
POST   /api/rules                          Create a new rule
GET    /api/rules/:id                      Get rule detail
PUT    /api/rules/:id                      Update rule
DELETE /api/rules/:id                      Delete rule
PATCH  /api/rules/:id/toggle               Enable / disable

GET    /api/rules/analytics                Org-wide aggregated analytics (last 30 days)
GET    /api/rules/:id/analytics            Per-rule analytics

POST   /api/rules/discover                 Trigger Rules Discovery Agent
GET    /api/rules/suggestions              List AI-suggested rules pending approval
POST   /api/rules/suggestions/:id/approve Accept a discovered rule → creates rule
DELETE /api/rules/suggestions/:id         Dismiss a discovered rule suggestion
```

### Rules injection in `review-runner.ts`

Extend `buildReviewContext()` to fetch active rules for the repo's org, format them as a structured rules block, and inject into the prompt:

```typescript
// In review-runner.ts
async function buildRulesBlock(orgId: string, repoId: string): Promise<string> {
  const rules = await db
    .select()
    .from(rulesTable)
    .where(
      and(
        eq(rulesTable.orgId, orgId),
        eq(rulesTable.enabled, true),
        or(
          eq(rulesTable.scope, 'org'),
          and(eq(rulesTable.scope, 'repo'), eq(rulesTable.repoId, repoId))
        )
      )
    );

  if (rules.length === 0) return '';

  const lines = rules.map(r => `- [${r.category.toUpperCase()}] ${r.name}: ${r.description}`);
  return `## Organization Rules (Must Enforce)\n${lines.join('\n')}\n`;
}
```

Inject above the `## Codebase Context` section in the prompt. Rules must be listed with explicit instruction to flag violations as `[Rule: <rule-name>]` in the comment body.

### Violation tracking in `review-runner.ts`

After `filterByConfidence()`, scan parsed comments for `[Rule: ...]` markers. Upsert matching violations into `rule_violations`. On PR merge webhook, mark any unresolved violations as `merged_with_violation = true`.

---

## Rules Discovery Agent

A background job (runs on-demand via `POST /api/rules/discover` or on a configurable schedule):

### Algorithm

```
1. Fetch the last N=500 accepted review comments from review_feedback
   WHERE feedback_type = 'accepted' AND org_id = ?

2. Cluster comments by semantic similarity (pgvector cosine distance < 0.15)

3. For each cluster with size >= 3 (recurring pattern threshold):
   - Call LLM: "Given these accepted review comments, generate a concise, actionable
     coding rule in natural language. Output: { name, description, category }"
   - Deduplicate against existing rules (pgvector similarity check)
   - Save as a pending suggestion in rule_suggestions table

4. Return count of new suggestions generated
```

### New table: `rule_suggestions`

```sql
CREATE TABLE rule_suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL,
  source_count INTEGER NOT NULL,     -- how many comments this was derived from
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'dismissed'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Analytics

### Aggregated (org-wide, last 30 days)

```typescript
interface OrgRulesAnalytics {
  totalRules: number;
  enabledRules: number;
  totalViolationsDetected: number;
  totalViolationsMerged: number;
  mergeViolationRate: number;       // merged / detected
  topViolatedRules: Array<{
    ruleId: string;
    ruleName: string;
    violationCount: number;
    mergedCount: number;
  }>;
}
```

### Per-rule (last 30 days)

```typescript
interface RuleAnalytics {
  ruleId: string;
  ruleName: string;
  totalPRsEvaluated: number;
  violationsDetected: number;
  violationsResolved: number;
  violationsMerged: number;
  complianceRate: number;           // (evaluated - violated) / evaluated
  weeklyTrend: Array<{ week: string; violations: number }>;
}
```

CSV export endpoint: `GET /api/rules/analytics/export?type=merged_violations`

---

## Dashboard UI (`packages/dashboard/`)

### New pages

```
/rules                         Rules list — table with enable/disable toggles
/rules/new                     Create rule (natural language input + category selector)
/rules/:id                     Rule detail — description, analytics chart, recent violations
/rules/suggestions             Discovered rules pending approval
/rules/analytics               Org-wide analytics dashboard
```

### Rules list table columns

| Column | Notes |
|---|---|
| Rule name | Link to detail page |
| Category | Badge (security / style / performance / etc.) |
| Scope | Org-wide or repo-specific |
| Source | Manual / Discovered / Imported |
| Violations (30d) | Count with red badge if > 0 merged |
| Enabled | Toggle switch |
| Actions | Edit / Delete |

### Analytics dashboard components

- **Summary cards:** Total rules, violations detected, violations merged, compliance rate
- **Violation trend chart:** Bar chart, weekly, last 30 days
- **Top violated rules:** Table sorted by violation count
- **CSV export button** for merged violations

---

## Prompt Integration

Rules block is injected immediately before `## Codebase Context`:

```
## Organization Rules (Must Enforce)
- [SECURITY] No hardcoded secrets: Do not commit API keys, tokens, or passwords directly in source code.
- [PERFORMANCE] Avoid N+1 queries: All database lookups inside loops must be refactored to batch queries.
- [STYLE] Error handling required: All async functions must have try/catch with typed error handling.

## Codebase Context
...

## Code Diff to Review
...
```

The LLM is instructed (in the system prompt) to:
1. Check each rule explicitly
2. Prefix any rule violation with `[Rule: <rule-name>]` so the parser can extract it
3. Still apply general review best practices beyond the listed rules

---

## Build Order

1. **DB schema** — `rules`, `rule_violations`, `rule_suggestions` tables + migrations
2. **Backend routes** — CRUD + toggle + analytics queries
3. **Prompt injection** — rules block in `review-runner.ts`
4. **Violation tracking** — parse `[Rule: ...]` markers post-review
5. **Dashboard: Rules list + create/edit** — basic CRUD UI
6. **Dashboard: Analytics** — charts + CSV export
7. **Discovery agent** — clustering + LLM summarization (schedule or on-demand)
8. **Dashboard: Suggestions review UI**

---

## Out of Scope (This Plan)

- Cross-org rule sharing / templates
- Rule versioning / history
- Automated rule conflict detection (Rules Expert Agent)
- Integration with external compliance frameworks (SOC-2, HIPAA)
