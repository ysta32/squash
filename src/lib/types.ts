import type { Json } from './database.types'

export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type BugStatus = 'open' | 'resolved'
export type BugKind = 'bug' | 'feature'
export type MemberRole = 'owner' | 'member'
export type EventType = 'filed' | 'resolved' | 'reopened' | 'edited' | 'commented' | 'assigned'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  avatar_color: string
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  invite_code: string
  owner_id: string
  created_at: string
}

export interface WorkspaceMember {
  workspace_id: string
  user_id: string
  role: MemberRole
  joined_at: string
  profile: Profile
}

export interface Bug {
  id: string
  workspace_id: string
  number: number
  title: string
  description: string
  context?: Json | null
  transcript: string | null
  severity: Severity
  status: BugStatus
  kind: BugKind
  filed_by: string
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  updated_at: string
  /** Current workspace member the bug is assigned to, or null. No FK (see attribution note). */
  assignee_id: string | null
}

export interface BugAttachment {
  id: string
  bug_id: string
  storage_path: string
  width: number
  height: number
  size_bytes: number
  created_at: string
}

export interface Comment {
  id: string
  bug_id: string
  author_id: string
  body: string
  created_at: string
  /** Set by the server whenever the body changes; null if never edited. */
  edited_at: string | null
}

export interface BugEvent {
  id: string
  bug_id: string
  actor_id: string
  type: EventType
  note: string | null
  created_at: string
}

/** Client-side pending upload state attached to an optimistic bug. */
export interface PendingUpload {
  localId: string
  previewUrl: string
  progress: number
  error?: string
}

export type BugWithMeta = Bug & {
  attachments: BugAttachment[]
  pending?: PendingUpload[]
  optimistic?: boolean
}

export const KIND_LABEL: Record<BugKind, { one: string; many: string }> = {
  bug: { one: 'Bug', many: 'Bugs' },
  feature: { one: 'Feature', many: 'Features' },
}

export const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical']

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

/** Tailwind background class for the severity dot/badge. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  low: 'bg-sev-low',
  medium: 'bg-sev-medium',
  high: 'bg-sev-high',
  critical: 'bg-sev-critical',
}
