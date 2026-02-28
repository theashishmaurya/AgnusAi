export type SymbolKind = 'function' | 'class' | 'method' | 'interface' | 'const' | 'type'
export type EdgeKind = 'calls' | 'imports' | 'inherits' | 'implements' | 'uses' | 'overrides'

export interface ParsedSymbol {
  id: string              // "src/auth/service.ts:AuthService.login"
  filePath: string
  name: string
  qualifiedName: string   // "AuthService.login"
  kind: SymbolKind
  signature: string       // "login(credentials: Credentials): Promise<User>"
  bodyRange: [number, number]
  docComment?: string
  repoId: string
}

export interface Edge {
  from: string            // symbol id
  to: string              // symbol id
  kind: EdgeKind
}

export interface BlastRadius {
  directCallers: ParsedSymbol[]      // 1 hop
  transitiveCallers: ParsedSymbol[]  // 2 hops
  affectedFiles: string[]
  riskScore: number                  // 0-100
}

export interface GraphReviewContext {
  changedSymbols: ParsedSymbol[]
  callers: ParsedSymbol[]
  callees: ParsedSymbol[]
  blastRadius: BlastRadius
  semanticNeighbors: ParsedSymbol[]
  priorExamples?: string[]
  rejectedExamples?: string[]
}

export interface IndexProgress {
  step: 'parsing' | 'embedding' | 'done' | 'error'
  file?: string
  progress?: number
  total?: number
  symbolCount?: number
  edgeCount?: number
  durationMs?: number
  message?: string
}

export interface IndexStats {
  symbolCount: number
  edgeCount: number
  fileCount: number
  durationMs: number
}

export const USER_ROLES = ['admin', 'member'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ORG_ROLES = ['admin', 'member'] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export const VCS_PLATFORMS = ['github', 'azure'] as const
export type VcsPlatform = (typeof VCS_PLATFORMS)[number]

export interface OrgMembership {
  orgId: string
  slug: string
  name: string
  role: OrgRole
}

export interface AuthJwtClaims {
  id: string
  email: string
  role: UserRole
  isSystemAdmin: boolean
  activeOrgId: string | null
  activeOrgRole: OrgRole | null
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === 'string' && (ORG_ROLES as readonly string[]).includes(value)
}

export function isVcsPlatform(value: unknown): value is VcsPlatform {
  return typeof value === 'string' && (VCS_PLATFORMS as readonly string[]).includes(value)
}

export function coerceUserRole(value: unknown, fallback: UserRole = 'member'): UserRole {
  return isUserRole(value) ? value : fallback
}

export function coerceOrgRole(value: unknown, fallback: OrgRole = 'member'): OrgRole {
  return isOrgRole(value) ? value : fallback
}

export function coerceNullableOrgRole(value: unknown): OrgRole | null {
  return isOrgRole(value) ? value : null
}
