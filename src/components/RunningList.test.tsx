import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ClaudeRun } from '../lib/claudeExport'
import { orderRuns } from '../lib/claudeRunView'
import type { BugWithMeta } from '../lib/types'
import { RunningList } from './RunningList'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const NOW = new Date().toISOString()
const EARLIER = new Date(Date.now() - 60_000).toISOString()

function run(overrides: Partial<ClaudeRun> = {}): ClaudeRun {
  return {
    id: 'r1',
    bugs: [5],
    folder: '/repo',
    startedAt: NOW,
    updatedAt: NOW,
    state: 'working',
    activity: 'Editing src/App.tsx',
    message: 'Looking at the save handler.',
    todos: [
      { text: 'Find the cause', status: 'completed' },
      { text: 'Fix it', status: 'in_progress' },
    ],
    steps: [],
    stepCount: 3,
    ...overrides,
  }
}

function item(number: number, kind: BugWithMeta['kind'], title: string): BugWithMeta {
  return {
    id: `b${number}`,
    workspace_id: 'ws',
    number,
    title,
    description: '',
    transcript: null,
    severity: 'medium',
    status: 'open',
    kind,
    filed_by: 'ada',
    created_at: NOW,
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    assignee_id: null,
    updated_at: NOW,
    attachments: [],
  }
}

const bugs = [item(5, 'bug', 'Save does nothing'), item(9, 'feature', 'Dark mode')]

afterEach(cleanup)

describe('RunningList', () => {
  it('shows runs for bugs and features together, live and finished', () => {
    const onOpen = vi.fn()
    render(
      <RunningList
        runs={[
          run(),
          run({
            id: 'r2',
            bugs: [9],
            state: 'done',
            activity: null,
            message: 'Built dark mode, committed and pushed to main.',
            updatedAt: EARLIER,
          }),
        ]}
        bugs={bugs}
        selectedNumber={null}
        onOpen={onOpen}
        claudeConnected
      />,
    )
    const runs = within(screen.getByRole('list', { name: 'Claude Code runs' }))
    const [live, finished] = runs.getAllByRole('listitem', { name: /Claude/ })
    expect(live).toHaveTextContent('Claude is working')
    expect(live).toHaveTextContent('Save does nothing')
    expect(live).toHaveTextContent('Editing src/App.tsx')
    expect(live).toHaveTextContent('1 of 2 done · Fix it')
    expect(finished).toHaveTextContent('Claude finished')
    expect(finished).toHaveTextContent('Dark mode')
    expect(finished).toHaveTextContent('Summary')
    expect(finished).toHaveTextContent('Built dark mode, committed and pushed to main.')
    fireEvent.click(within(finished).getByRole('button', { name: /Dark mode/ }))
    expect(onOpen).toHaveBeenCalledWith(9)
  })

  it('explains the view when nothing has run yet', () => {
    const onClaudeSetup = vi.fn()
    render(
      <RunningList
        runs={[]}
        bugs={bugs}
        selectedNumber={null}
        onOpen={vi.fn()}
        claudeConnected={false}
        onClaudeSetup={onClaudeSetup}
      />,
    )
    expect(screen.getByText('Nothing running')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Set up Claude Code' }))
    expect(onClaudeSetup).toHaveBeenCalled()
  })
})

describe('orderRuns', () => {
  it('puts runs needing you first, then live runs, then finished ones by recency', () => {
    const done = run({ id: 'done', state: 'done', updatedAt: NOW })
    const old = run({ id: 'old', state: 'ended', updatedAt: EARLIER })
    const working = run({ id: 'working', updatedAt: EARLIER })
    const waiting = run({ id: 'waiting', state: 'waiting', updatedAt: EARLIER })
    expect(orderRuns([old, done, working, waiting]).map((r) => r.id)).toEqual([
      'waiting',
      'working',
      'done',
      'old',
    ])
  })
})
