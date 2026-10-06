import { describe, expect, it, vi } from 'vitest'
import type { BugWithMeta, WorkspaceMember } from './types'
import { batchName, formatClaudePrompt } from './claudeExport'

vi.mock('./supabase', () => ({ supabase: {} }))

const members: WorkspaceMember[] = [
  {
    workspace_id: 'ws',
    user_id: 'ada',
    role: 'owner',
    joined_at: '2026-10-01T10:00:00Z',
    profile: {
      id: 'ada',
      display_name: 'Ada',
      avatar_url: null,
      avatar_color: '#7c3aed',
      created_at: '2026-10-01T10:00:00Z',
    },
  },
]

function bug(overrides: Partial<BugWithMeta> = {}): BugWithMeta {
  return {
    id: 'b1',
    workspace_id: 'ws',
    number: 12,
    title: 'Login button does nothing',
    description: 'Clicking login on Safari does nothing',
    transcript: null,
    severity: 'high',
    status: 'open',
    filed_by: 'ada',
    created_at: '2026-10-01T10:00:00Z',
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    updated_at: '2026-10-01T10:00:00Z',
    attachments: [
      {
        id: 'a1',
        bug_id: 'b1',
        storage_path: 'ws/b1/one.webp',
        width: 800,
        height: 600,
        size_bytes: 1000,
        created_at: '2026-10-01T10:00:00Z',
      },
    ],
    ...overrides,
  }
}

const base = {
  members,
  workspaceName: 'Acme',
  origin: 'https://squash.test',
  urls: { 'ws/b1/one.webp': "https://cdn.test/one.webp?token=a'b" },
  comments: [{ id: 'c1', bug_id: 'b1', author_id: 'ada', body: 'Only on Safari', created_at: '' }],
}

describe('formatClaudePrompt', () => {
  it('includes details, comments and a quoted curl script for the clipboard', () => {
    const { prompt, downloads } = formatClaudePrompt({ ...base, bugs: [bug()] })
    expect(prompt).toContain('Fix this bug from the Squash bug tracker (workspace "Acme")')
    expect(prompt).toContain('## Bug #12: Login button does nothing')
    expect(prompt).toContain('- Severity: High')
    expect(prompt).toContain('- Link: https://squash.test/app/ws/bug/12')
    expect(prompt).toContain('    Clicking login on Safari does nothing')
    expect(prompt).toContain('- Ada: Only on Safari')
    expect(prompt).toContain(
      `curl -sfo "$d/bug-12-1.webp" 'https://cdn.test/one.webp?token=a'\\''b'`,
    )
    expect(downloads).toEqual([
      { file: 'bug-12-1.webp', url: "https://cdn.test/one.webp?token=a'b" },
    ])
  })

  it('points at local files and drops the curl script in bridge mode', () => {
    const { prompt } = formatClaudePrompt({
      ...base,
      bugs: [bug(), bug({ id: 'b2', number: 13, attachments: [] })],
      localDir: '.squash/bugs/x',
    })
    expect(prompt).toContain('Fix these 2 bugs')
    expect(prompt).toContain('- .squash/bugs/x/bug-12-1.webp (800×600)')
    expect(prompt).not.toContain('curl')
    expect(prompt).toContain('## Bug #13')
  })

  it('marks screenshots without a signed URL as unavailable', () => {
    const { prompt, downloads } = formatClaudePrompt({ ...base, urls: {}, bugs: [bug()] })
    expect(prompt).toContain('bug-12-1.webp: unavailable')
    expect(downloads).toEqual([])
    expect(prompt).not.toContain('curl')
  })
})

describe('batchName', () => {
  it('is filesystem-safe and names the bugs', () => {
    expect(batchName([bug()], new Date('2026-10-06T15:30:12Z'))).toBe('20261006-153012-12')
  })
})
