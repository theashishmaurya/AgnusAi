import useSWR from 'swr'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Repo {
  repoId: string
  repoUrl: string
  platform: 'github' | 'azure'
  createdAt: string
}

interface Review {
  id: string
  repoId: string
  repoUrl: string
  prNumber: number
  verdict: 'approve' | 'request_changes' | 'comment'
  commentCount: number
  riskScore: number
  createdAt: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

const VERDICT_LABEL: Record<string, string> = {
  approve: 'Approved',
  request_changes: 'Changes Requested',
  comment: 'Comment',
}

const VERDICT_COLOR: Record<string, string> = {
  approve: 'text-[#E85A1A]',
  request_changes: 'text-foreground',
  comment: 'text-muted-foreground',
}

export default function Dashboard() {
  const { data: repos } = useSWR<Repo[]>('/api/repos', fetcher, { refreshInterval: 30000 })
  const { data: reviews } = useSWR<Review[]>('/api/reviews', fetcher, { refreshInterval: 30000 })

  const hasData = repos && repos.length > 0

  return (
    <div>
      {!hasData ? (
        // Empty state — TinyFish editorial hero
        <EmptyState />
      ) : (
        <div className="space-y-16">
          {/* Repos section */}
          <section>
            <p className="label-meta mb-6">Repositories</p>
            <div className="border-t border-border">
              {repos.map((repo, i) => (
                <div key={repo.repoId} className="flex items-center gap-8 border-b border-border py-5">
                  <span className="num-display w-8 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {repo.repoUrl.replace('https://github.com/', '').replace('https://dev.azure.com/', '')}
                    </p>
                    <p className="label-meta mt-0.5">{repo.platform} · added {formatDate(repo.createdAt)}</p>
                  </div>
                  <Link
                    to={`/app/ready/${repo.repoId}`}
                    className="label-meta hover:text-foreground transition-colors underline"
                  >
                    + VIEW SETUP
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* Reviews table */}
          <section>
            <p className="label-meta mb-6">Recent Reviews</p>

            {/* Header row */}
            <div className="grid grid-cols-[2rem_1fr_6rem_6rem_5rem_8rem] gap-4 border-t border-b border-border py-2 items-center">
              <span className="label-meta">#</span>
              <span className="label-meta">Pull Request</span>
              <span className="label-meta text-right">Comments</span>
              <span className="label-meta text-right">Risk</span>
              <span className="label-meta">Verdict</span>
              <span className="label-meta text-right">Date</span>
            </div>

            {reviews && reviews.length > 0 ? (
              reviews.map((r, i) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[2rem_1fr_6rem_6rem_5rem_8rem] gap-4 border-b border-border py-4 items-center hover:bg-muted/20 transition-colors"
                >
                  <span className="num-display">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate text-sm">
                      {r.repoUrl.split('/').slice(-2).join('/')} #{r.prNumber}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-right">{r.commentCount}</span>
                  <div className="text-right">
                    <RiskBadge score={r.riskScore} />
                  </div>
                  <span className={cn('label-meta', VERDICT_COLOR[r.verdict])}>
                    {VERDICT_LABEL[r.verdict]}
                  </span>
                  <span className="label-meta text-right">{formatDate(r.createdAt)}</span>
                </div>
              ))
            ) : (
              <div className="py-16 text-center">
                <p className="label-meta">No reviews yet — open a PR to trigger the first review.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="max-w-2xl">
      <p className="label-meta mb-4">Dashboard</p>

      <h1 className="text-[clamp(3rem,8vw,7rem)] font-bold leading-none tracking-tight text-foreground mb-8">
        No repos<br />yet.
      </h1>

      <p className="font-mono text-sm text-muted-foreground mb-12">
        Connect a repository to start getting graph-aware PR reviews.
        No CI configuration required.
      </p>

      <div className="border-t border-border mb-8">
        {[
          { n: '01', title: 'Connect Repo', desc: 'Add your GitHub or Azure DevOps repo' },
          { n: '02', title: 'Index Codebase', desc: 'Tree-sitter builds a symbol dependency graph' },
          { n: '03', title: 'Get Reviews', desc: 'Every PR receives blast-radius-aware comments' },
        ].map(s => (
          <div key={s.n} className="flex items-start gap-8 border-b border-border py-5">
            <span className="num-display w-8 shrink-0">{s.n}</span>
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="label-meta mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Link to="/app/connect">
        <button className="bg-foreground text-background h-12 px-8 text-xs tracking-widest uppercase inline-flex items-center gap-3 hover:bg-foreground/85 transition-colors">
          Connect Repository →
        </button>
      </Link>
    </div>
  )
}

function RiskBadge({ score }: { score: number }) {
  const color = score >= 70
    ? 'text-[#E85A1A]'
    : score >= 40
      ? 'text-foreground'
      : 'text-muted-foreground'
  return <span className={cn('font-mono text-sm', color)}>{score}</span>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
