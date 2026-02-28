import { useState, useEffect } from 'react'
import { Check, Copy, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/usePermissions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

type Depth = 'fast' | 'standard' | 'deep'
type Section = 'review-depth' | 'pr-description' | 'team' | 'api-key'
type Platform = 'github' | 'azure'
type UpdateMode = PRDescriptionSettings['updateMode']
type PublishMode = PRDescriptionSettings['publishMode']

type PRDescriptionSettings = {
  enabled: boolean
  updateMode: 'created_only' | 'created_and_updated'
  publishMode: 'replace_pr' | 'comment'
  preserveOriginal: boolean
  useMarkers: boolean
  publishLabels: boolean
}

type PRDescriptionOverrides = {
  enabled?: boolean | null
  updateMode?: 'created_only' | 'created_and_updated' | null
  publishMode?: 'replace_pr' | 'comment' | null
  preserveOriginal?: boolean | null
  useMarkers?: boolean | null
  publishLabels?: boolean | null
}

type Repo = { repoId: string; repoUrl: string; platform: Platform }
type Org = { orgKey: string; orgName: string; platform: Platform }

const DEPTH_OPTIONS: Array<{
  key: Depth
  label: string
  hops: string
  embeddings: string
  desc: string
  recommended?: boolean
}> = [
  {
    key: 'fast',
    label: 'Fast',
    hops: '1-hop traversal',
    embeddings: 'No embeddings',
    desc: 'Direct callers only. Lowest latency, minimal token usage.',
  },
  {
    key: 'standard',
    label: 'Standard',
    hops: '2-hop traversal',
    embeddings: 'No embeddings',
    desc: 'Direct and transitive callers. Best balance of context vs. cost.',
    recommended: true,
  },
  {
    key: 'deep',
    label: 'Deep',
    hops: '2-hop traversal',
    embeddings: 'Semantic search',
    desc: 'Adds vector-similar symbols for cross-cutting concern detection.',
  },
]

const UPDATE_MODE_OPTIONS: Array<{ value: UpdateMode; label: string }> = [
  { value: 'created_only', label: 'created only' },
  { value: 'created_and_updated', label: 'created and updated' },
]

const PUBLISH_MODE_OPTIONS: Array<{ value: PublishMode; label: string }> = [
  { value: 'replace_pr', label: 'replace PR body' },
  { value: 'comment', label: 'publish as comment' },
]

function parseNullableBoolean(value: string): boolean | null {
  if (value === 'inherit') return null
  return value === 'true'
}

export default function Settings() {
  const { user, isOrgAdmin, canInviteMembers, canManageSystemApiKey } = usePermissions()
  const [section, setSection] = useState<Section>('review-depth')
  const [depth, setDepth] = useState<Depth>('standard')
  const [saved, setSaved] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [apiKeyPreview, setApiKeyPreview] = useState<string | null>(null)
  const [newApiKey, setNewApiKey] = useState('')
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)
  const [repos, setRepos] = useState<Repo[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrgKey, setSelectedOrgKey] = useState('')
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [orgSettings, setOrgSettings] = useState<PRDescriptionSettings | null>(null)
  const [repoEffective, setRepoEffective] = useState<PRDescriptionSettings | null>(null)
  const [repoOverrides, setRepoOverrides] = useState<PRDescriptionOverrides>({})
  const [prSaved, setPrSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<{ reviewDepth: Depth }> : null)
      .then(d => { if (d?.reviewDepth) setDepth(d.reviewDepth) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!canManageSystemApiKey) return
    fetch('/api/auth/api-key', { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<{ exists: boolean; preview?: string }> : null)
      .then(d => { if (d?.exists && d.preview) setApiKeyPreview(d.preview) })
      .catch(() => {})
  }, [canManageSystemApiKey])

  useEffect(() => {
    fetch('/api/repos', { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<Repo[]> : [])
      .then(r => {
        setRepos(r)
        if (!selectedRepoId && r.length > 0) setSelectedRepoId(r[0].repoId)
      })
      .catch(() => {})
    fetch('/api/orgs', { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<Org[]> : [])
      .then(o => {
        setOrgs(o)
        if (!selectedOrgKey && o.length > 0) setSelectedOrgKey(o[0].orgKey)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedOrgKey) return
    fetch(`/api/orgs/${encodeURIComponent(selectedOrgKey)}/settings`, { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<{ prDescription: PRDescriptionSettings }> : null)
      .then(d => { if (d?.prDescription) setOrgSettings(d.prDescription) })
      .catch(() => {})
  }, [selectedOrgKey])

  useEffect(() => {
    if (!selectedRepoId) return
    fetch(`/api/repos/${encodeURIComponent(selectedRepoId)}/settings`, { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<{ prDescription: { effective: PRDescriptionSettings; overrides: PRDescriptionOverrides } }> : null)
      .then(d => {
        if (d?.prDescription?.effective) setRepoEffective(d.prDescription.effective)
        if (d?.prDescription?.overrides) setRepoOverrides(d.prDescription.overrides)
      })
      .catch(() => {})
  }, [selectedRepoId])

  async function save() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reviewDepth: depth }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function generateInvite() {
    setInviteLoading(true)
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      const d = await res.json() as { url: string }
      setInviteUrl(d.url)
    } finally {
      setInviteLoading(false)
    }
  }

  function copyInvite() {
    navigator.clipboard.writeText(inviteUrl)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  async function generateApiKey() {
    setApiKeyLoading(true)
    setNewApiKey('')
    try {
      const res = await fetch('/api/auth/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const d = await res.json() as { key: string }
      setNewApiKey(d.key)
      setApiKeyPreview(`${d.key.slice(0, 12)}...${d.key.slice(-4)}`)
    } finally {
      setApiKeyLoading(false)
    }
  }

  function copyApiKey() {
    navigator.clipboard.writeText(newApiKey)
    setApiKeyCopied(true)
    setTimeout(() => setApiKeyCopied(false), 2000)
  }

  async function saveOrgPRSettings() {
    const org = orgs.find(o => o.orgKey === selectedOrgKey)
    if (!org || !orgSettings) return
    await fetch(`/api/orgs/${encodeURIComponent(org.orgKey)}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        platform: org.platform,
        orgName: org.orgName,
        prDescription: orgSettings,
      }),
    })
    setPrSaved(true)
    setTimeout(() => setPrSaved(false), 1500)
  }

  async function saveRepoPRSettings() {
    if (!selectedRepoId) return
    await fetch(`/api/repos/${encodeURIComponent(selectedRepoId)}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ prDescription: repoOverrides }),
    })
    // refresh effective + overrides after save
    const res = await fetch(`/api/repos/${encodeURIComponent(selectedRepoId)}/settings`, { credentials: 'include' })
    if (res.ok) {
      const d = await res.json() as { prDescription: { effective: PRDescriptionSettings; overrides: PRDescriptionOverrides } }
      setRepoEffective(d.prDescription.effective)
      setRepoOverrides(d.prDescription.overrides)
    }
    setPrSaved(true)
    setTimeout(() => setPrSaved(false), 1500)
  }

  const NAV: Array<{ key: Section; label: string; requires?: 'org_admin' | 'system_admin' }> = [
    { key: 'review-depth', label: 'Review Depth' },
    { key: 'pr-description', label: 'PR Description' },
    { key: 'team', label: 'Team & Invites', requires: 'org_admin' },
    { key: 'api-key', label: 'API Key', requires: 'system_admin' },
  ]

  return (
    <div className="flex gap-0 items-stretch border border-border">

      {/* ── Sidebar ── */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col">
        {/* Sidebar header */}
        <div className="px-5 py-4 border-b border-border">
          <p className="label-meta">Settings</p>
        </div>

        <nav className="py-2 flex-1">
          {NAV.filter(n =>
            !n.requires ||
            (n.requires === 'org_admin' && isOrgAdmin) ||
            (n.requires === 'system_admin' && canManageSystemApiKey)
          ).map((n) => (
            <button
              key={n.key}
              onClick={() => setSection(n.key)}
              className={cn(
                'w-full text-left px-5 py-3 label-meta transition-colors flex items-center gap-3',
                section === n.key
                  ? 'text-foreground bg-muted/30 border-r-2 border-r-[#E85A1A]'
                  : 'hover:bg-muted/20 hover:text-foreground',
              )}
            >
              {section === n.key && (
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#E85A1A',
                    flexShrink: 0,
                  }}
                />
              )}
              {n.label}
            </button>
          ))}
        </nav>

        {/* User — pinned at bottom of sidebar */}
        {user && (
          <div className="border-t border-border px-5 py-4">
            <p className="label-meta truncate text-foreground">{user.email}</p>
            <p className="label-meta mt-1" style={{ color: '#E85A1A' }}>{user.role}</p>
          </div>
        )}
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 px-10 py-8 min-w-0 overflow-hidden">

        {/* ── Review Depth ── */}
        {section === 'review-depth' && (
          <div>
            <p className="label-meta mb-3" style={{ color: '#E85A1A' }}>// review-depth</p>
            <h1 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold leading-none tracking-tight text-foreground mb-8">
              Review Depth.
            </h1>

            <div className="border-t border-border mb-8">
              {DEPTH_OPTIONS.map((opt, i) => {
                const isSelected = depth === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setDepth(opt.key)}
                    className={cn(
                      'w-full flex items-start gap-8 border-b border-border py-5 text-left transition-colors hover:bg-muted/20',
                      isSelected && 'bg-muted/30',
                    )}
                  >
                    <span className={cn('num-display w-8 shrink-0 pt-0.5', isSelected && 'text-[#E85A1A]')}>
                      {isSelected
                        ? <Check className="h-4 w-4 text-[#E85A1A]" />
                        : String(i + 1).padStart(2, '0')
                      }
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-base">{opt.label}</span>
                        {opt.recommended && (
                          <Badge variant="default" className="text-[10px] py-0">Recommended</Badge>
                        )}
                      </div>
                      <p className="label-meta">{opt.hops} · {opt.embeddings}</p>
                      <p className="text-sm text-muted-foreground mt-2 font-mono">{opt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Token impact table */}
            <div className="border border-border mb-8">
              <div className="grid grid-cols-4 border-b border-border">
                {['', 'Fast', 'Standard', 'Deep'].map((h) => (
                  <div key={h} className={cn('px-4 py-3 label-meta', !h && 'border-r border-border')}>{h}</div>
                ))}
              </div>
              {[
                { label: 'Graph hops', fast: '1', standard: '2', deep: '2' },
                { label: 'Embedding search', fast: '—', standard: '—', deep: '✓' },
                { label: 'Extra tokens', fast: '~200', standard: '~600', deep: '~1 200' },
                { label: 'Latency added', fast: '<1ms', standard: '<2ms', deep: '~150ms' },
              ].map(row => (
                <div key={row.label} className="grid grid-cols-4 border-b border-border last:border-0">
                  <div className="px-4 py-3 label-meta border-r border-border">{row.label}</div>
                  {[row.fast, row.standard, row.deep].map((val, ci) => (
                    <div
                      key={ci}
                      className={cn(
                        'px-4 py-3 font-mono text-sm',
                        (ci === 0 && depth === 'fast') ||
                        (ci === 1 && depth === 'standard') ||
                        (ci === 2 && depth === 'deep')
                          ? 'bg-muted/30 text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {val}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <Button size="lg" onClick={save} disabled={saved}>
              {saved ? '✓ Saved' : 'Save Settings'}
            </Button>
          </div>
        )}

        {section === 'pr-description' && (
          <div className="space-y-8">
            <p className="label-meta mb-3" style={{ color: '#E85A1A' }}>// pr-description</p>
            <h1 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold leading-none tracking-tight text-foreground">
              PR Description Rules.
            </h1>

            <div className="border border-border p-5 space-y-4">
              <p className="font-semibold">Organization Defaults</p>
              <div className="max-w-md">
                <Select value={selectedOrgKey} onValueChange={setSelectedOrgKey}>
                  <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map(o => <SelectItem key={o.orgKey} value={o.orgKey}>{o.platform} / {o.orgName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {orgSettings && (
                <div className="grid gap-3 max-w-xl">
                  <div className="label-meta flex items-center justify-between gap-3">
                    <span>Enable PR description generation</span>
                    <Switch checked={orgSettings.enabled} onCheckedChange={checked => setOrgSettings({ ...orgSettings, enabled: checked })} />
                  </div>
                  <div className="space-y-2">
                    <label className="label-meta">Update mode</label>
                    <Select
                      value={orgSettings.updateMode}
                      onValueChange={(value: UpdateMode) => setOrgSettings({ ...orgSettings, updateMode: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UPDATE_MODE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="label-meta">Publish mode</label>
                    <Select
                      value={orgSettings.publishMode}
                      onValueChange={(value: PublishMode) => setOrgSettings({ ...orgSettings, publishMode: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PUBLISH_MODE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="label-meta flex items-center justify-between gap-3">
                    <span>Preserve original description content</span>
                    <Switch checked={orgSettings.preserveOriginal} onCheckedChange={checked => setOrgSettings({ ...orgSettings, preserveOriginal: checked })} />
                  </div>
                  <div className="label-meta flex items-center justify-between gap-3">
                    <span>Update only when markers are present</span>
                    <Switch checked={orgSettings.useMarkers} onCheckedChange={checked => setOrgSettings({ ...orgSettings, useMarkers: checked })} />
                  </div>
                  <div className="label-meta flex items-center justify-between gap-3">
                    <span>Publish labels</span>
                    <Switch checked={orgSettings.publishLabels} onCheckedChange={checked => setOrgSettings({ ...orgSettings, publishLabels: checked })} />
                  </div>
                </div>
              )}
              <Button onClick={saveOrgPRSettings} disabled={!selectedOrgKey}>{prSaved ? '✓ Saved' : 'Save Org Defaults'}</Button>
            </div>

            <div className="border border-border p-5 space-y-4">
              <p className="font-semibold">Repository Overrides (take precedence)</p>
              <div className="max-w-md">
                <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
                  <SelectTrigger><SelectValue placeholder="Select repository" /></SelectTrigger>
                  <SelectContent>
                    {repos.map(r => <SelectItem key={r.repoId} value={r.repoId}>{r.platform} / {r.repoUrl.split('/').slice(-2).join('/')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {repoEffective && (
                <p className="label-meta">Effective: {repoEffective.updateMode}, {repoEffective.publishMode}, labels={String(repoEffective.publishLabels)}</p>
              )}
              <div className="grid gap-3 max-w-xl">
                <div className="space-y-2">
                  <label className="label-meta">Enabled</label>
                  <Select
                    value={repoOverrides.enabled == null ? 'inherit' : (repoOverrides.enabled ? 'true' : 'false')}
                    onValueChange={(value) => setRepoOverrides({ ...repoOverrides, enabled: parseNullableBoolean(value) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">inherit</SelectItem>
                      <SelectItem value="true">true</SelectItem>
                      <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="label-meta">Update mode</label>
                  <Select
                    value={repoOverrides.updateMode ?? 'inherit'}
                    onValueChange={(value) => setRepoOverrides({
                      ...repoOverrides,
                      updateMode: value === 'inherit' ? null : (value as UpdateMode),
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">inherit</SelectItem>
                      {UPDATE_MODE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="label-meta">Publish mode</label>
                  <Select
                    value={repoOverrides.publishMode ?? 'inherit'}
                    onValueChange={(value) => setRepoOverrides({
                      ...repoOverrides,
                      publishMode: value === 'inherit' ? null : (value as PublishMode),
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">inherit</SelectItem>
                      {PUBLISH_MODE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="label-meta">Preserve original</label>
                  <Select
                    value={repoOverrides.preserveOriginal == null ? 'inherit' : (repoOverrides.preserveOriginal ? 'true' : 'false')}
                    onValueChange={(value) => setRepoOverrides({ ...repoOverrides, preserveOriginal: parseNullableBoolean(value) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">inherit</SelectItem>
                      <SelectItem value="true">true</SelectItem>
                      <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="label-meta">Use markers</label>
                  <Select
                    value={repoOverrides.useMarkers == null ? 'inherit' : (repoOverrides.useMarkers ? 'true' : 'false')}
                    onValueChange={(value) => setRepoOverrides({ ...repoOverrides, useMarkers: parseNullableBoolean(value) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">inherit</SelectItem>
                      <SelectItem value="true">true</SelectItem>
                      <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="label-meta">Publish labels</label>
                  <Select
                    value={repoOverrides.publishLabels == null ? 'inherit' : (repoOverrides.publishLabels ? 'true' : 'false')}
                    onValueChange={(value) => setRepoOverrides({ ...repoOverrides, publishLabels: parseNullableBoolean(value) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">inherit</SelectItem>
                      <SelectItem value="true">true</SelectItem>
                      <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={saveRepoPRSettings} disabled={!selectedRepoId}>{prSaved ? '✓ Saved' : 'Save Repo Overrides'}</Button>
            </div>
          </div>
        )}

        {/* ── Team & Invites ── */}
        {section === 'team' && canInviteMembers && (
          <div>
            <p className="label-meta mb-3" style={{ color: '#E85A1A' }}>// team</p>
            <h1 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold leading-none tracking-tight text-foreground mb-8">
              Invite Members.
            </h1>

            <div className="border-t border-border pt-6">
              <p className="text-sm text-muted-foreground mb-6">
                Generate a one-time invite link. The recipient will be able to create an account.
              </p>

              <Button size="lg" variant="outline" onClick={generateInvite} disabled={inviteLoading}>
                {inviteLoading ? 'Generating...' : 'Generate Invite Link'}
              </Button>

              {inviteUrl && (
                <div className="flex items-stretch border border-border mt-6">
                  <div className="flex-1 px-4 py-3 font-mono text-sm text-muted-foreground overflow-x-auto whitespace-nowrap bg-muted/20">
                    {inviteUrl}
                  </div>
                  <button
                    onClick={copyInvite}
                    className="flex items-center gap-2 px-4 border-l border-border label-meta hover:bg-muted/30 transition-colors"
                  >
                    {inviteCopied
                      ? <><CheckCircle className="h-3.5 w-3.5 text-[#E85A1A]" /> COPIED</>
                      : <><Copy className="h-3.5 w-3.5" /> COPY</>
                    }
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── API Key ── */}
        {section === 'api-key' && canManageSystemApiKey && (
          <div>
            <p className="label-meta mb-3" style={{ color: '#E85A1A' }}>// ci-cd</p>
            <h1 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold leading-none tracking-tight text-foreground mb-8">
              API Key.
            </h1>

            <div className="border-t border-border pt-6">
              <p className="text-sm text-muted-foreground mb-2">
                Use this key to trigger reviews from CI/CD pipelines via{' '}
                <code className="font-mono text-xs bg-muted/40 px-1">Authorization: Bearer &lt;key&gt;</code>.
              </p>

              {apiKeyPreview && !newApiKey && (
                <div className="flex items-center gap-3 mb-6 mt-4">
                  <span className="label-meta">Current key:</span>
                  <span className="font-mono text-sm text-muted-foreground">{apiKeyPreview}</span>
                </div>
              )}

              {!apiKeyPreview && !newApiKey && (
                <p className="text-sm text-muted-foreground mb-6 mt-4">No API key generated yet.</p>
              )}

              <Button size="lg" variant="outline" onClick={generateApiKey} disabled={apiKeyLoading}>
                {apiKeyLoading ? 'Generating...' : apiKeyPreview ? 'Regenerate API Key' : 'Generate API Key'}
              </Button>

              {newApiKey && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#E85A1A]" />
                    <span className="label-meta text-[#E85A1A]">Copy this key now — it won't be shown again.</span>
                  </div>
                  <div className="flex items-stretch border border-[#E85A1A]">
                    <div className="flex-1 px-4 py-3 font-mono text-sm overflow-x-auto whitespace-nowrap bg-muted/20">
                      {newApiKey}
                    </div>
                    <button
                      onClick={copyApiKey}
                      className="flex items-center gap-2 px-4 border-l border-[#E85A1A] label-meta hover:bg-muted/30 transition-colors"
                    >
                      {apiKeyCopied
                        ? <><CheckCircle className="h-3.5 w-3.5 text-[#E85A1A]" /> COPIED</>
                        : <><Copy className="h-3.5 w-3.5" /> COPY</>
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
