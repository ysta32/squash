// @vitest-environment node
/// <reference types="node" />
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ClaudeRun } from './claudeExport'

interface BridgeEvent {
  t: string
  kind: string
  text?: string
  note?: string
  todos?: { text: string; status: string }[]
}
interface Bridge {
  describeTool(name: string, input?: Record<string, unknown>, cwd?: string): string
  hookEvent(input: Record<string, unknown>, now?: Date): BridgeEvent | null
  summarizeRun(meta: Record<string, unknown>, events: BridgeEvent[]): ClaudeRun
}

// The bridge is a standalone script served from /bridge; importing it must not start the server.
const bridge = (await import('../../public/bridge/claude-bridge.mjs' as string)) as Bridge
const at = (s: number) => new Date(Date.UTC(2026, 9, 6, 12, 0, s))

function transcript(...texts: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'squash-bridge-'))
  const path = join(dir, 'session.jsonl')
  const lines = texts.map((text) =>
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }),
  )
  writeFileSync(path, [JSON.stringify({ type: 'user' }), ...lines, '{"truncated'].join('\n'))
  return path
}

describe('describeTool', () => {
  it('names files relative to the project folder', () => {
    expect(bridge.describeTool('Edit', { file_path: '/repo/src/App.tsx' }, '/repo')).toBe(
      'Editing src/App.tsx',
    )
    expect(bridge.describeTool('Read', { file_path: '/elsewhere/a.ts' }, '/repo')).toBe(
      'Reading /elsewhere/a.ts',
    )
  })

  it('prefers a command description and falls back to the tool name', () => {
    expect(bridge.describeTool('Bash', { command: 'npm test', description: 'Run tests' })).toBe(
      'Run tests',
    )
    expect(bridge.describeTool('Bash', { command: 'npm test' })).toBe('Running npm test')
    expect(bridge.describeTool('mcp__github__create_pr', {})).toBe('Using github__create_pr')
  })
})

describe('hookEvent', () => {
  it('records a tool call with Claude’s latest narration and plan', () => {
    const event = bridge.hookEvent(
      {
        hook_event_name: 'PreToolUse',
        cwd: '/repo',
        transcript_path: transcript('Looking around.', 'Found it: the save button is unbound.'),
        tool_name: 'TodoWrite',
        tool_input: {
          todos: [
            { content: 'Find the bug', status: 'completed' },
            { content: 'Fix it', status: 'in_progress' },
            { content: 'Verify', status: 'bogus' },
          ],
        },
      },
      at(0),
    )
    expect(event).toEqual({
      t: at(0).toISOString(),
      kind: 'tool',
      text: 'Updating its plan',
      note: 'Found it: the save button is unbound.',
      todos: [
        { text: 'Find the bug', status: 'completed' },
        { text: 'Fix it', status: 'in_progress' },
        { text: 'Verify', status: 'pending' },
      ],
    })
  })

  it('takes the final summary on Stop and skips unknown events', () => {
    expect(
      bridge.hookEvent({ hook_event_name: 'Stop', last_assistant_message: 'Fixed #5.' }, at(1)),
    ).toEqual({ t: at(1).toISOString(), kind: 'stop', text: 'Fixed #5.' })
    expect(
      bridge.hookEvent({ hook_event_name: 'Stop', transcript_path: transcript('All done.') }),
    ).toMatchObject({ kind: 'stop', text: 'All done.' })
    expect(bridge.hookEvent({ hook_event_name: 'PostToolUse' })).toBeNull()
    expect(bridge.hookEvent({ hook_event_name: 'Stop', transcript_path: '/missing' })).toEqual(
      expect.objectContaining({ text: '' }),
    )
  })
})

describe('summarizeRun', () => {
  const meta = { id: 'r1', bugs: [5], folder: '/repo', startedAt: at(0).toISOString() }

  it('is starting until Claude reports in', () => {
    expect(bridge.summarizeRun(meta, [])).toMatchObject({ state: 'starting', stepCount: 0 })
  })

  it('follows Claude from working to waiting to done', () => {
    const events: BridgeEvent[] = [
      { t: at(1).toISOString(), kind: 'start' },
      { t: at(2).toISOString(), kind: 'tool', text: 'Reading a.ts', note: 'Looking.' },
      { t: at(3).toISOString(), kind: 'tool', text: 'Editing a.ts' },
    ]
    expect(bridge.summarizeRun(meta, events)).toMatchObject({
      state: 'working',
      activity: 'Editing a.ts',
      message: 'Looking.',
      stepCount: 2,
      updatedAt: at(3).toISOString(),
    })

    events.push({ t: at(4).toISOString(), kind: 'waiting', text: 'Claude needs permission' })
    expect(bridge.summarizeRun(meta, events)).toMatchObject({
      state: 'waiting',
      activity: 'Claude needs permission',
    })

    events.push({ t: at(5).toISOString(), kind: 'stop', text: 'Fixed it.' })
    expect(bridge.summarizeRun(meta, events)).toMatchObject({
      state: 'done',
      activity: null,
      message: 'Fixed it.',
    })

    // A follow-up prompt in the terminal puts it back to work.
    events.push({ t: at(6).toISOString(), kind: 'prompt' })
    expect(bridge.summarizeRun(meta, events).state).toBe('working')
  })

  it('ends when the session closes', () => {
    const events: BridgeEvent[] = [
      { t: at(1).toISOString(), kind: 'tool', text: 'Reading a.ts' },
      { t: at(2).toISOString(), kind: 'end' },
    ]
    expect(bridge.summarizeRun(meta, events).state).toBe('ended')
    // Closing the terminal after Claude finished still reads as finished.
    events.splice(1, 0, { t: at(1).toISOString(), kind: 'stop', text: 'Fixed it.' })
    expect(bridge.summarizeRun(meta, events).state).toBe('done')
  })

  it('keeps only the most recent steps', () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      t: at(i).toISOString(),
      kind: 'tool',
      text: `step ${i}`,
    }))
    const run = bridge.summarizeRun(meta, events)
    expect(run.stepCount).toBe(12)
    expect(run.steps.map((s) => s.text)).toEqual(
      Array.from({ length: 8 }, (_, i) => `step ${i + 4}`),
    )
  })
})
