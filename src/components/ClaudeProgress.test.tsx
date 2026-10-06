import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ClaudeRun } from '../lib/claudeExport'
import { latestRunByBug } from '../lib/claudeExport'
import { ClaudeProgress } from './ClaudeProgress'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const NOW = new Date().toISOString()

function run(overrides: Partial<ClaudeRun> = {}): ClaudeRun {
  return {
    id: 'r1',
    bugs: [5],
    folder: '/repo',
    startedAt: NOW,
    updatedAt: NOW,
    state: 'working',
    activity: 'Editing src/App.tsx',
    message: 'The save handler is never bound.',
    todos: [
      { text: 'Find the cause', status: 'completed' },
      { text: 'Fix it', status: 'in_progress' },
    ],
    steps: [{ t: NOW, text: 'Reading src/App.tsx' }],
    stepCount: 1,
    ...overrides,
  }
}

afterEach(cleanup)

describe('ClaudeProgress', () => {
  it('shows what Claude is doing right now', () => {
    render(<ClaudeProgress run={run()} />)
    expect(screen.getByText('Claude is working')).toBeInTheDocument()
    expect(screen.getByText('Editing src/App.tsx')).toBeInTheDocument()
    expect(screen.getByText('The save handler is never bound.')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: "Claude's plan" })).toHaveTextContent('Fix it')
    expect(screen.getByText('Reading src/App.tsx')).toBeInTheDocument()
  })

  it('asks for attention when Claude is waiting, and shows the summary when done', () => {
    render(<ClaudeProgress run={run({ state: 'waiting', activity: 'Needs permission' })} />)
    expect(screen.getByText('Claude needs you in Terminal')).toBeInTheDocument()
    cleanup()
    render(<ClaudeProgress run={run({ state: 'done', activity: null, message: 'Fixed #5.' })} />)
    expect(screen.getByText('Claude finished')).toBeInTheDocument()
    expect(screen.getByText('Fixed #5.')).toBeInTheDocument()
  })

  it('mentions other items sent in the same run', () => {
    render(<ClaudeProgress run={run({ bugs: [5, 6, 7] })} />)
    expect(screen.getByText('Sent together with 2 other items')).toBeInTheDocument()
  })
})

describe('latestRunByBug', () => {
  it('keeps the newest run for each bug', () => {
    const newer = run({ id: 'new', bugs: [5] })
    const older = run({ id: 'old', bugs: [5, 6] })
    const byBug = latestRunByBug([newer, older])
    expect(byBug.get(5)?.id).toBe('new')
    expect(byBug.get(6)?.id).toBe('old')
    expect(byBug.has(7)).toBe(false)
  })
})
