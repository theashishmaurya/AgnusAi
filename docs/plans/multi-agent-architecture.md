# Plan: Multi-Agent Review Architecture

> **Priority:** Phase 3 — Breadth
> **Effort:** Large (3–4 sprints)
> **Roadmap ref:** `docs/roadmap/v3-competitive.md#G4`

---

## What This Is

Replace the current single LLM call in `PRReviewAgent.review()` with a parallel multi-agent architecture: specialized agents run concurrently against the same PR context, a Context Collector prepares their inputs, and a Judge consolidates and deduplicates findings.

This mirrors Qodo v2.0's architecture and is why they benchmark at 60.1% F1 (9% ahead of next competitor). The key insight: focused smaller prompts per domain produce less hallucination and more recall than one large general prompt.

---

## Current Architecture

```
PRReviewAgent.review()
    │
    ▼
buildReviewPrompt()      ← single prompt, skills injected inline
    │
    ▼
LLMBackend.generateReview()   ← one call
    │
    ▼
parseReviewResponse()
    │
    ▼
filterByConfidence()
    │
    ▼
PRReviewAgent.postReview()
```

**Problem:** One call must cover security, performance, correctness, style, ticket compliance, and graph context simultaneously. The prompt is large, instructions compete, and the model spreads attention thin.

---

## Target Architecture

```
PRReviewAgent.review()
    │
    ▼
ContextCollector.prepare(diff, graphContext, ticket)
    │  ── constructs specialized AgentInput per domain ──
    │
    ▼─────────────────────────────────────────────────────────┐
    │                                                          │
SecurityAgent        PerformanceAgent      CorrectnessAgent   TicketAgent
(focused prompt)     (focused prompt)      (focused prompt)   (focused prompt)
    │                      │                     │                 │
    └──────────────────────┴─────────────────────┴─────────────────┘
                                    │
                                    ▼
                            Judge.consolidate()
                            ── dedup + re-rank + confidence filter ──
                                    │
                                    ▼
                        filterByConfidence()   ← existing
                                    │
                                    ▼
                        PRReviewAgent.postReview()
```

---

## New Types (`packages/shared/src/types.ts`)

```typescript
export type AgentRole =
  | 'security'
  | 'performance'
  | 'correctness'
  | 'style'
  | 'ticket-compliance'
  | 'graph-blast-radius';

export interface AgentInput {
  role: AgentRole;
  diff: string;
  graphContext?: string;          // serialized, trimmed for this agent's concerns
  ticketContext?: string;         // only for ticket-compliance agent
  rules?: string;                 // org rules relevant to this agent's domain
  priorExamples?: string;         // RAG examples filtered to this domain
  systemPrompt: string;           // role-specific system instructions
}

export interface AgentOutput {
  role: AgentRole;
  comments: ReviewComment[];
  summary?: string;               // agent's overall assessment
  tokensUsed: number;
  durationMs: number;
}

export interface ConsolidatedReview {
  comments: ReviewComment[];      // deduped, re-ranked
  summary: string;                // merged from all agents
  verdict: 'approve' | 'request_changes' | 'comment';
  agentOutputs: AgentOutput[];    // raw outputs for debugging
}
```

---

## Context Collector (`packages/reviewer/src/agents/ContextCollector.ts`)

Responsible for taking the full review context and splitting it into targeted `AgentInput` objects per role.

```typescript
export class ContextCollector {
  prepare(
    diff: string,
    graphContext: GraphReviewContext | undefined,
    ticket: TicketContext | undefined,
    orgRules: Rule[],
    priorExamples: PriorExample[]
  ): AgentInput[] {
    const serializedGraph = graphContext
      ? serializeGraphContext(graphContext)
      : undefined;

    return [
      this.buildSecurityInput(diff, serializedGraph, orgRules, priorExamples),
      this.buildPerformanceInput(diff, serializedGraph, orgRules, priorExamples),
      this.buildCorrectnessInput(diff, serializedGraph, orgRules, priorExamples),
      this.buildStyleInput(diff, orgRules, priorExamples),
      ticket
        ? this.buildTicketComplianceInput(diff, ticket, orgRules)
        : null,
      graphContext
        ? this.buildBlastRadiusInput(diff, graphContext, orgRules)
        : null,
    ].filter(Boolean) as AgentInput[];
  }

  private buildSecurityInput(diff, graph, rules, examples): AgentInput {
    return {
      role: 'security',
      diff,
      graphContext: graph,
      rules: rules
        .filter(r => r.category === 'security')
        .map(r => `- ${r.name}: ${r.description}`)
        .join('\n'),
      priorExamples: examples
        .filter(e => e.category === 'security')
        .slice(0, 5)
        .map(e => e.body)
        .join('\n'),
      systemPrompt: SECURITY_AGENT_PROMPT,
    };
  }
  // ... similarly for other roles
}
```

### Graph context trimming

The full `serializeGraphContext()` output can be large. Each agent gets a trimmed view:
- **Security agent** — callers (who calls the changed code, potential attack surface)
- **Performance agent** — callees + blast radius (what the changed code calls, N+1 patterns)
- **Correctness agent** — full blast radius (all affected files)
- **Blast radius agent** — full graph context only

---

## Specialized Agents (`packages/reviewer/src/agents/`)

Each agent is a thin wrapper: takes an `AgentInput`, calls `LLMBackend.generateReview()` with its system prompt and diff, returns `AgentOutput`.

```typescript
// packages/reviewer/src/agents/BaseAgent.ts
export abstract class BaseAgent {
  constructor(
    protected llm: LLMBackend,
    protected role: AgentRole
  ) {}

  async run(input: AgentInput): Promise<AgentOutput> {
    const start = Date.now();
    const prompt = buildAgentPrompt(input);
    const raw = await this.llm.generateReview(prompt);
    const comments = parseReviewResponse(raw);

    return {
      role: this.role,
      comments: comments.map(c => ({ ...c, source: this.role })),
      summary: extractSummary(raw),
      tokensUsed: raw.usage?.totalTokens ?? 0,
      durationMs: Date.now() - start,
    };
  }
}
```

### Agent system prompts (`packages/reviewer/src/agents/prompts/`)

Each agent gets a focused system prompt. Example for the security agent:

```
You are a security-focused code reviewer. Your ONLY job is to find security vulnerabilities
in the provided diff: injection (SQL, command, XSS), authentication/authorization flaws,
secrets in code, insecure dependencies, unsafe deserialization, path traversal, SSRF, and
privilege escalation.

DO NOT comment on style, performance, or correctness unless they directly create a security risk.
For each finding, rate your confidence 0.0–1.0. Only report findings with confidence >= 0.6.
Output format: [File: path] [Line: N] [Confidence: X.X] <finding>
```

Similarly focused prompts for: performance (N+1, memory leaks, unnecessary loops), correctness (logic errors, off-by-one, type safety, null handling), style (naming, structure, maintainability), ticket compliance (acceptance criteria mapping), blast-radius (what will break if this merges).

---

## Parallel Execution (`packages/reviewer/src/agents/AgentOrchestrator.ts`)

```typescript
export class AgentOrchestrator {
  constructor(private llm: LLMBackend) {}

  async runAll(inputs: AgentInput[]): Promise<AgentOutput[]> {
    // All agents run in parallel — Promise.allSettled so one failure
    // doesn't cancel the others
    const results = await Promise.allSettled(
      inputs.map(input => this.runAgent(input))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<AgentOutput> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  private async runAgent(input: AgentInput): Promise<AgentOutput> {
    const agent = new BaseAgent(this.llm, input.role);
    return agent.run(input);
  }
}
```

**Concurrency control:** For Ollama (single-GPU self-hosted), parallel calls will queue. Add a `maxConcurrency` config option (default: 3 for cloud LLMs, 1 for Ollama) via semaphore.

```typescript
const MAX_CONCURRENCY = process.env.AGENT_CONCURRENCY
  ? parseInt(process.env.AGENT_CONCURRENCY)
  : llmProvider === 'ollama' ? 1 : 3;
```

---

## Judge (`packages/reviewer/src/agents/Judge.ts`)

Consolidates outputs from all agents. Responsibilities:
1. **Deduplication** — remove near-duplicate comments (same file+line, similar body)
2. **Re-ranking** — sort by confidence desc, then by risk category (security first)
3. **Self-reflection pass** — second LLM call to score each unique comment 0–10
4. **Summary synthesis** — merge agent summaries into one coherent review summary
5. **Verdict determination** — security finding → `request_changes`; no findings → `approve`

```typescript
export class Judge {
  constructor(private llm: LLMBackend) {}

  async consolidate(outputs: AgentOutput[]): Promise<ConsolidatedReview> {
    const allComments = outputs.flatMap(o => o.comments);

    // Step 1: Dedup
    const unique = this.deduplicate(allComments);

    // Step 2: Self-reflection (second LLM call)
    const ranked = await this.selfReflect(unique);

    // Step 3: Sort
    const sorted = ranked
      .sort((a, b) => {
        // Security first
        if (a.source === 'security' && b.source !== 'security') return -1;
        if (b.source === 'security' && a.source !== 'security') return 1;
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      });

    // Step 4: Verdict
    const verdict = this.determineVerdict(sorted);

    // Step 5: Merge summaries
    const summary = await this.synthesizeSummary(outputs);

    return { comments: sorted, summary, verdict, agentOutputs: outputs };
  }

  private deduplicate(comments: ReviewComment[]): ReviewComment[] {
    // Group by filePath + lineNumber, keep highest confidence within each group
    const groups = new Map<string, ReviewComment[]>();
    for (const c of comments) {
      const key = `${c.path}:${c.line}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    return Array.from(groups.values()).map(group =>
      group.reduce((best, c) => (c.confidence ?? 0) > (best.confidence ?? 0) ? c : best)
    );
  }

  private async selfReflect(comments: ReviewComment[]): Promise<ReviewComment[]> {
    if (comments.length === 0) return [];

    const prompt = buildSelfReflectionPrompt(comments);
    const raw = await this.llm.generateReview(prompt);
    return parseSelfReflectionScores(raw, comments);
    // Self-reflection re-scores each comment 0-10 with rationale.
    // Comments scoring < 5 are dropped. Confidence is updated.
  }

  private determineVerdict(
    comments: ReviewComment[]
  ): 'approve' | 'request_changes' | 'comment' {
    if (comments.some(c => c.source === 'security' && (c.confidence ?? 0) >= 0.8))
      return 'request_changes';
    if (comments.some(c => c.severity === 'error'))
      return 'request_changes';
    if (comments.length === 0)
      return 'approve';
    return 'comment';
  }
}
```

---

## Integration into `PRReviewAgent` (`packages/reviewer/src/index.ts`)

```typescript
// Replaces: const result = await this.llm.generateReview(prompt)

const collector = new ContextCollector();
const orchestrator = new AgentOrchestrator(this.llm);
const judge = new Judge(this.llm);

const inputs = collector.prepare(
  context.diff,
  context.graphContext,
  context.ticket,
  context.orgRules ?? [],
  context.priorExamples ?? []
);

const agentOutputs = await orchestrator.runAll(inputs);
const consolidated = await judge.consolidate(agentOutputs);

// consolidated.comments → pass to filterByConfidence() as before
// consolidated.summary → use as the SUMMARY section
// consolidated.verdict → use as review verdict
```

No changes to `filterByConfidence()`, `parseReviewResponse()`, or `postReview()`.

---

## New Environment Variables

```env
# Max concurrent agent calls (default: 3 for cloud, 1 for Ollama)
AGENT_CONCURRENCY=3

# Agents to enable (comma-separated) — can disable specific agents
ENABLED_AGENTS=security,performance,correctness,style,ticket-compliance,graph-blast-radius

# Self-reflection threshold — comments scoring below this are dropped
SELF_REFLECTION_MIN_SCORE=5
```

---

## Performance Characteristics

| Scenario | Current (1 call) | Multi-agent (parallel) |
|---|---|---|
| Ollama (single GPU) | ~30s | ~90–120s (sequential due to concurrency=1) |
| OpenAI GPT-4o (cloud) | ~15s | ~20s (parallel, 3 concurrent) |
| Claude Sonnet (cloud) | ~12s | ~18s (parallel, 3 concurrent) |

For Ollama users, add a config option to select "fast mode" (single call, current behavior) vs "thorough mode" (multi-agent). Default: single call for Ollama, multi-agent for cloud.

```env
REVIEW_MODE=fast|thorough|auto   # auto = thorough for cloud, fast for Ollama
```

---

## Build Order

1. **Types** — `AgentRole`, `AgentInput`, `AgentOutput`, `ConsolidatedReview` in shared
2. **System prompts** — write focused prompts for each agent role
3. **BaseAgent** — thin LLM call wrapper
4. **ContextCollector** — diff/graph/ticket splitting logic
5. **AgentOrchestrator** — parallel runner with semaphore
6. **Judge** — dedup + self-reflection + verdict
7. **Integration** — wire into `PRReviewAgent.review()` behind `REVIEW_MODE` flag
8. **Tests** — compare single-call vs multi-agent output on a fixed test diff set
9. **Observability** — log per-agent tokens + duration for cost tracking

---

## Success Metrics

- Recall improvement: measure on a fixed set of known bugs — target >10% more real issues caught vs single call
- False positive rate: should not increase with Judge dedup + self-reflection
- Latency: cloud mode ≤ 2× current latency
- Token cost: benchmark per-PR token spend multi-agent vs single-call

---

## Out of Scope (This Plan)

- Agent-specific fine-tuning or specialized models
- Cross-PR learning per agent role
- Real-time streaming of individual agent outputs to the dashboard
- Agent skill marketplace (external plugins)
