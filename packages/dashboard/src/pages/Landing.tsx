import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LandingHeader } from '@/components/LandingHeader'
import { GraphViz } from '@/components/GraphViz'

const TICKER_ITEMS = [
  'Graph-Aware Review', 'Tree-Sitter Parsing', 'Postgres + pgvector',
  'Blast Radius Analysis', 'Webhook Triggered', '100% Self-Hosted',
  'Open Source', 'Incremental Indexing', 'TypeScript · Python · Java · C#',
  'Ollama · OpenAI · Claude · Azure', 'Precision Filter', 'RAG Feedback Loop',
  'Azure DevOps + GitHub', 'Confidence Scoring', 'Team-Specific Learning',
]

export default function Landing() {
  useEffect(() => {
    document.title = 'AgnusAI — Graph-Aware AI Code Review'
    return () => { document.title = 'AgnusAI — Code Review' }
  }, [])

  return (
    <div className="lp-root">
      <LandingHeader />
      <HeroSection />
      <TrustBar />
      <HowItWorks />
      <DiffComparison />
      <FeaturesGrid />
      <Testimonials />
      <CtaSection />
      <LandingFooter />
    </div>
  )
}

function HeroSection() {
  return (
    <div className="hero">
      <div>
        <div className="hero-file-comment">
          <div className="tl-dots">
            <span className="tl tl-r" />
            <span className="tl tl-y" />
            <span className="tl tl-g" />
          </div>
          <span className="syn-cmt">// pr-review.ts</span>
        </div>
        <div className="hero-prompt">&gt;_</div>
        <h1>
          AI reviews that see<br />the{' '}
          <em>whole picture.</em>
        </h1>
        <div className="hero-code-block lp-mono">
          <span className="syn-kw">const</span>{' '}review = {'{'}<br />
          {'\u00A0\u00A0'}blastRadius:{' '}<span className="syn-num">4</span>,{'     '}<span className="syn-cmt">// functions affected</span><br />
          {'\u00A0\u00A0'}symbols:{'\u00A0\u00A0\u00A0\u00A0'}<span className="syn-num">2_841</span>,{'  '}<span className="syn-cmt">// indexed in graph</span><br />
          {'\u00A0\u00A0'}depth:{'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}<span className="syn-str">"2-hop"</span>,{'  '}<span className="syn-cmt">// BFS traversal</span><br />
          {'\u00A0\u00A0'}llm:{'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}<span className="syn-str">"ollama"</span>{' '}<span className="syn-cmt">// or openai, claude</span><br />
          {'}'}
        </div>
        <div className="hero-desc lp-mono">
          {'/**'}<br />
          {'\u00A0* AgnusAI indexes your codebase with Tree-sitter,'}<br />
          {'\u00A0* builds a symbol dependency graph, and reviews'}<br />
          {'\u00A0* every PR with full blast-radius context.'}<br />
          {'\u00A0*/'}
        </div>
        <div className="hero-ctas">
          <Link to="/app" className="btn-p">$ open --app →</Link>
          <a href="https://github.com/ivoyant-eng/AgnusAi" className="btn-g">$ git clone</a>
        </div>
      </div>
      <GraphViz />
    </div>
  )
}

function TrustBar() {
  return (
    <div className="trust">
      <div className="trust-inner">
        <div className="tstat">
          <div className="tstat-num">6<em>+</em></div>
          <div className="tstat-label">Languages</div>
        </div>
        <div className="tstat">
          <div className="tstat-num">4</div>
          <div className="tstat-label">LLM Providers</div>
        </div>
        <div className="tstat">
          <div className="tstat-num">2<em>-hop</em></div>
          <div className="tstat-label">Graph Depth</div>
        </div>
        <div className="tstat">
          <div className="tstat-num">MIT</div>
          <div className="tstat-label">License</div>
        </div>
        <div className="tstat">
          <div className="tstat-num">1</div>
          <div className="tstat-label">Command Deploy</div>
        </div>
      </div>
    </div>
  )
}

function HowItWorks() {
  return (
    <div className="sec sec-top">
      <p className="sec-label">// how it works</p>
      <div className="how-grid">
        <div className="how-step">
          <div className="how-n">01</div>
          <div className="how-icon">🔗</div>
          <div className="how-title">Connect a Repo</div>
          <div className="how-desc">Add your GitHub or Azure DevOps repo URL and a personal access token. AgnusAI uses it to clone, index, and post review comments.</div>
        </div>
        <div className="how-step">
          <div className="how-n">02</div>
          <div className="how-icon">🕸️</div>
          <div className="how-title">Build the Symbol Graph</div>
          <div className="how-desc">Tree-sitter WASM parses every file. Symbols and call edges go into Postgres + pgvector. Future pushes trigger fast incremental reindex.</div>
        </div>
        <div className="how-step">
          <div className="how-n">03</div>
          <div className="how-icon">⚡</div>
          <div className="how-title">Graph-Aware Reviews</div>
          <div className="how-desc">Every PR webhook triggers a 2-hop BFS. Callers, callees, and blast radius are surfaced to the LLM before it writes a single review comment.</div>
        </div>
      </div>
    </div>
  )
}

function DiffComparison() {
  return (
    <div className="sec">
      <p className="sec-label">// without vs with agnus-ai</p>
      <div className="diff-wrap">
        <div className="diff-header">
          <div className="tl-dots">
            <span className="tl tl-r" />
            <span className="tl tl-y" />
            <span className="tl tl-g" />
          </div>
          <span className="diff-fname">review-comparison.diff</span>
        </div>
        <div className="diff-body">
          <div className="diff-col">
            <div className="diff-col-hdr">flat-diff-review.ts</div>
            <div className="diff-line dl-del"><span className="sign">–</span><span>sees changed lines only, no caller context</span></div>
            <div className="diff-line dl-del"><span className="sign">–</span><span>re-reviews unchanged code on every push</span></div>
            <div className="diff-line dl-del"><span className="sign">–</span><span>misses breaking changes in downstream callers</span></div>
            <div className="diff-line dl-del"><span className="sign">–</span><span>no semantic awareness of similar patterns</span></div>
            <div className="diff-line dl-del"><span className="sign">–</span><span>noisy low-confidence speculative comments</span></div>
            <div className="diff-line dl-del"><span className="sign">–</span><span>fixed review style — doesn't learn your team</span></div>
            <div className="diff-line dl-del"><span className="sign">–</span><span>code sent to third-party cloud API</span></div>
            <div className="diff-line dl-del"><span className="sign">–</span><span>locked to one LLM provider</span></div>
          </div>
          <div className="diff-col">
            <div className="diff-col-hdr">agnus-ai-review.ts</div>
            <div className="diff-line dl-add"><span className="sign">+</span><span>2-hop BFS surfaces callers, callees, blast radius</span></div>
            <div className="diff-line dl-add"><span className="sign">+</span><span>incremental — only re-reviews new commits (GitHub + Azure)</span></div>
            <div className="diff-line dl-add"><span className="sign">+</span><span>flags affected downstream functions before merge</span></div>
            <div className="diff-line dl-add"><span className="sign">+</span><span>deep mode: pgvector semantic neighbour lookup</span></div>
            <div className="diff-line dl-add"><span className="sign">+</span><span>precision filter drops comments below confidence threshold</span></div>
            <div className="diff-line dl-add"><span className="sign">+</span><span>RAG loop learns from your team's 👍-rated comments</span></div>
            <div className="diff-line dl-add"><span className="sign">+</span><span>100% self-hosted — one docker compose up</span></div>
            <div className="diff-line dl-add"><span className="sign">+</span><span>Ollama · OpenAI · Claude · Azure — your choice</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeaturesGrid() {
  return (
    <div className="sec">
      <p className="sec-label">// what makes it different</p>
      <div className="feat-grid">
        <div className="feat-card">
          <div className="feat-icon">🔍</div>
          <div className="feat-title">Diff-aware Reviews</div>
          <div className="feat-desc">Reviews only what changed. Checkpoints prevent re-reviewing unchanged files, keeping token costs minimal.</div>
          <span className="feat-tag">Incremental</span>
        </div>
        <div className="feat-card">
          <div className="feat-icon">🕸️</div>
          <div className="feat-title">Graph-aware Blast Radius</div>
          <div className="feat-desc">Tree-sitter builds a live dependency graph. Knows which callers are affected before the LLM sees a single line.</div>
          <span className="feat-tag">2-hop BFS</span>
        </div>
        <div className="feat-card">
          <div className="feat-icon">🧠</div>
          <div className="feat-title">Semantic Neighbors</div>
          <div className="feat-desc">All symbols embedded via pgvector. Deep mode surfaces semantically similar code even without a direct graph edge.</div>
          <span className="feat-tag">Deep Mode</span>
        </div>
        <div className="feat-card">
          <div className="feat-icon">🔌</div>
          <div className="feat-title">Any LLM, Any Embedding</div>
          <div className="feat-desc">Ollama, OpenAI, Claude, Azure for generation. Any OpenAI-compatible embedding URL — including fully local models.</div>
          <span className="feat-tag">Provider-agnostic</span>
        </div>
        <div className="feat-card">
          <div className="feat-icon">🌐</div>
          <div className="feat-title">Multi-language Parsers</div>
          <div className="feat-desc">TypeScript, JavaScript, Python, Java, Go, C# — all via Tree-sitter WASM. No language server or build toolchain needed.</div>
          <span className="feat-tag">Tree-sitter</span>
        </div>
        <div className="feat-card">
          <div className="feat-icon">🐳</div>
          <div className="feat-title">Self-hostable, MIT</div>
          <div className="feat-desc">One <code>docker compose up</code>. Postgres, pgvector, and Ollama included. Your code never leaves your infrastructure.</div>
          <span className="feat-tag">MIT License</span>
        </div>
        <div className="feat-card">
          <div className="feat-icon">🎯</div>
          <div className="feat-title">Precision Filter</div>
          <div className="feat-desc">The LLM self-scores every comment with <code>[Confidence: X.X]</code>. Anything below the threshold is silently dropped — only high-signal findings reach your PR.</div>
          <span className="feat-tag">Signal / Noise</span>
        </div>
        <div className="feat-card">
          <div className="feat-icon">🔁</div>
          <div className="feat-title">Feedback Learning Loop</div>
          <div className="feat-desc">Every 👍 on a review comment is embedded and stored. Future reviews inject the top-5 team-approved examples into the prompt — the more you rate, the more on-point reviews become.</div>
          <span className="feat-tag">RAG · Per-repo</span>
        </div>
      </div>
    </div>
  )
}

function Testimonials() {
  return (
    <div className="testi-bg">
      <div className="sec">
        <p className="sec-label">// what engineering teams say</p>
        <div className="testi-grid">
          <div className="testi-card">
            <div className="testi-comment-hdr lp-mono">{'/** @author Siddharth Rao · Staff Eng, Payments */'}</div>
            <p className="testi-text">We run AgnusAI on our fintech monorepo. The blast-radius analysis caught a downstream auth bug that three human reviewers missed. It paid for itself in the first week.</p>
            <div className="testi-author">
              <div className="testi-av">SR</div>
              <div>
                <div className="testi-name">Siddharth Rao</div>
                <div className="testi-role">Staff Engineer · Payments Platform</div>
              </div>
            </div>
          </div>
          <div className="testi-card">
            <div className="testi-comment-hdr lp-mono">{'/** @author Maya Adesanya · Eng Lead, HealthTech */'}</div>
            <p className="testi-text">We're in healthcare — sending code to third-party AI is a non-starter. AgnusAI with Ollama runs entirely on-prem. Finally, AI code review we can actually use.</p>
            <div className="testi-author">
              <div className="testi-av">MA</div>
              <div>
                <div className="testi-name">Maya Adesanya</div>
                <div className="testi-role">Engineering Lead · HealthTech</div>
              </div>
            </div>
          </div>
          <div className="testi-card">
            <div className="testi-comment-hdr lp-mono">{'/** @author Tobias Klein · Platform Lead, SaaS */'}</div>
            <p className="testi-text">The graph context injected into the LLM prompt is genuinely impressive. Reviews feel like they're from someone who actually understands the whole codebase.</p>
            <div className="testi-author">
              <div className="testi-av">TK</div>
              <div>
                <div className="testi-name">Tobias Klein</div>
                <div className="testi-role">Platform Eng Lead · Series B SaaS</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CtaSection() {
  return (
    <div className="cta-sec sec-top">
      <div>
        <h2 className="cta-h">
          Ship with<br />
          <em>full context.</em>
        </h2>
      </div>
      <div>
        <div className="cta-install lp-mono">
          <span className="pr">$</span>
          <code>docker compose up --build</code>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--lp-muted)', marginBottom: '20px', lineHeight: 1.7 }}>
          <span className="syn-cmt lp-mono">{'// No cloud. No config. Graph-aware reviews on every PR in under five minutes.'}</span>
        </p>
        <div className="hero-ctas">
          <Link to="/app" className="btn-p">$ open --app →</Link>
          <a href="/docs/" className="btn-g">$ man docs</a>
        </div>
      </div>
    </div>
  )
}

function LandingFooter() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <footer style={{ background: 'var(--lp-hdr-bg)', borderTop: '1px solid var(--lp-hdr-border)', overflow: 'hidden' }}>
      <div
        className="animate-ticker-32"
        style={{ display: 'flex', width: 'max-content' }}
        onMouseEnter={e => (e.currentTarget.style.animationPlayState = 'paused')}
        onMouseLeave={e => (e.currentTarget.style.animationPlayState = 'running')}
      >
        {items.map((item, i) => (
          <span
            key={i}
            className="lp-mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '12px 24px',
              fontSize: '0.6rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'color-mix(in srgb, var(--lp-hdr-fg) 40%, transparent)',
              borderRight: '1px solid color-mix(in srgb, var(--lp-hdr-fg) 8%, transparent)',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: 'var(--lp-accent)', fontSize: '0.4rem' }}>◆</span>
            {item}
          </span>
        ))}
      </div>
    </footer>
  )
}
