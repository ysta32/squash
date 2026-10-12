// @vitest-environment node
/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeLimits, ClaudeRun, ClaudeUsage } from './claudeExport'

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
  parseHosts(list?: string): string[]
  isAllowedDownload(url: string, extraHosts?: string[]): boolean
  readCapped(res: Response, limit: number): Promise<Buffer>
  fetchAllowed(url: string, extraHosts: string[], fetchImpl: typeof fetch): Promise<Response>
  createLaunchLimiter(options: {
    maxRunning?: number
    maxLaunches?: number
    windowMs?: number
    isRunning?: (run: string, msSinceLaunch: number) => boolean
    now?: () => number
  }): {
    acquire(): { track(run: string): void; release(): void } | null
    readonly running: number
  }
  isReservedName(file: string): boolean
  runnerPidFile(batchDir: string, runId: string): string
  pidAlive(pid: number): boolean
  runnerLive(pidFile: string, msSinceLaunch: number, graceMs?: number): boolean
  execQuiet(file: string, args: string[], options?: ExecOptions): Promise<string | null>
  parseSha(text: unknown): string | null
  parseBranch(text: unknown): string | null
  parseShortstat(
    text: unknown,
  ): { filesChanged: number; additions: number; deletions: number } | null
  parsePrUrl(text: unknown): string | null
  startSha(cwd: string, run?: Exec): Promise<string | null>
  collectGitReport(
    cwd: string,
    start: string | null,
    options?: { run?: Exec; startedAt?: string | null },
  ): Promise<GitReport | null>
  readScreenshot(dir: string, file: string): Promise<{ data: Buffer; type: string }>
  legacyBatches(
    bugsDir: string,
    workspaceId: string,
  ): Promise<{ id: string; workspaceId: string; dir: string; legacy: true }[]>
  askArgs(extra?: string[]): string[]
  validateAsk(payload: unknown): {
    id: string
    question: string
    bugs: number[]
    files: { name: string; data: Buffer }[]
  }
  summarizeQuestion(
    meta: Record<string, unknown>,
    events: BridgeEvent[],
    done: Record<string, unknown> | null,
    live: boolean,
  ): { state: string; answer?: string; activity?: string; error?: string }
  BACKGROUND_TERMINAL_SCRIPT: string[]
  runUsage(result: Record<string, unknown>): Record<string, unknown>
  parseLimits(event: Record<string, unknown>, now?: Date): ClaudeLimits | null
  summarizeUsage(
    entries: Record<string, unknown>[],
    workspaceId: string,
    limits?: ClaudeLimits | null,
    limit?: number,
  ): ClaudeUsage
  validateProject(payload: unknown): {
    workspaceId: string
    workspaceName: string
    name: string
    parent: string | null
  }
}
interface ExecOptions {
  cwd?: string
  timeout?: number
}
type Exec = (file: string, args: string[], options?: ExecOptions) => Promise<string | null>
interface GitReport {
  startSha: string | null
  commitSha: string | null
  noCommit: boolean
  branch: string | null
  prUrl: string | null
  filesChanged: number | null
  additions: number | null
  deletions: number | null
  startedAt: string | null
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

beforeEach(() => vi.stubEnv('SQUASH_SUPABASE_HOST', ''))
afterEach(() => vi.unstubAllEnvs())

describe('isAllowedDownload', () => {
  it('pins the exact project host and storage path, including explicit extra hosts', () => {
    vi.stubEnv('SQUASH_SUPABASE_HOST', 'abc.supabase.co')
    expect(bridge.isAllowedDownload('https://ABC.supabase.co./storage/v1/object/sign/x.png')).toBe(
      true,
    )
    expect(
      bridge.isAllowedDownload('https://files.example.com/storage/v1/object/public/x.png', [
        'files.example.com',
      ]),
    ).toBe(true)
    for (const url of [
      'https://other.supabase.co/storage/v1/object/sign/x.png',
      'https://abc.supabase.in/storage/v1/object/sign/x.png',
      'https://sub.abc.supabase.co/storage/v1/object/sign/x.png',
      'https://abc.supabase.co.evil.com/storage/v1/object/sign/x.png',
      'https://abc.supabase.co/x.png',
      'https://abc.supabase.co/storage/v1/object',
      'https://abc.supabase.co/storage/v1/object/../../admin',
      'https://files.example.com/x.png',
      'http://abc.supabase.co/storage/v1/object/sign/x.png',
      'https://user:pw@abc.supabase.co/storage/v1/object/sign/x.png',
      'https://abc.supabase.co:444/storage/v1/object/sign/x.png',
      'https://abc.supabase.co/storage/v1/object/..%2f..%2frest/v1/x',
      'https://abc.supabase.co/storage/v1/object/%2E%2E/x',
    ])
      expect(bridge.isAllowedDownload(url, ['files.example.com']), url).toBe(false)
  })

  it('warns once when an old install uses the suffix fallback', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      const { isAllowedDownload } = await import('./public/bridge/claude-bridge.mjs');
      if (!isAllowedDownload('https://a.supabase.co/x.png')) process.exit(1);
      if (!isAllowedDownload('https://b.supabase.in/x.png')) process.exit(1);
    `,
      ],
      { encoding: 'utf8', env: { ...process.env, SQUASH_SUPABASE_HOST: '' } },
    )
    expect(result.status).toBe(0)
    expect(result.stderr.match(/SQUASH_SUPABASE_HOST is unset/g)).toHaveLength(1)
  })

  it('allows https Supabase storage hosts', () => {
    expect(bridge.isAllowedDownload('https://abc.supabase.co/storage/v1/object/sign/x.png')).toBe(
      true,
    )
    expect(bridge.isAllowedDownload('https://abc.supabase.in/x.png')).toBe(true)
    expect(bridge.isAllowedDownload('https://ABC.Supabase.CO./x.png')).toBe(true)
  })

  it('rejects other hosts, look-alikes, plain http and credentials', () => {
    for (const url of [
      'https://example.com/x.png',
      'https://supabase.co/x.png',
      'https://evil-supabase.co/x.png',
      'https://abc.supabase.co.evil.com/x.png',
      'http://abc.supabase.co/x.png',
      'https://user:pw@abc.supabase.co/x.png',
      'http://127.0.0.1:4317/claude',
      'file:///etc/passwd',
      'not a url',
    ]) {
      expect(bridge.isAllowedDownload(url), url).toBe(false)
    }
  })

  it('allows exact extra hosts from SQUASH_DOWNLOAD_HOSTS', () => {
    const extra = bridge.parseHosts(' cdn.example.com , Files.Example.org. ,')
    expect(extra).toEqual(['cdn.example.com', 'files.example.org'])
    expect(bridge.isAllowedDownload('https://cdn.example.com/x.png', extra)).toBe(true)
    expect(bridge.isAllowedDownload('https://files.example.org/x.png', extra)).toBe(true)
    expect(bridge.isAllowedDownload('https://sub.cdn.example.com/x.png', extra)).toBe(false)
    expect(bridge.isAllowedDownload('http://cdn.example.com/x.png', extra)).toBe(false)
  })
})

describe('installer config validation', () => {
  const installer = readFileSync('public/bridge/install.sh', 'utf8')
  const start = installer.indexOf('SUPABASE_HOST=')
  const end = installer.indexOf('\nmkdir -p', start)
  const script = installer.slice(start, end) + '\nprintf "%s" "$SUPABASE_HOST"'

  it.each([
    ['{}', ''],
    ['{"supabaseHost":"Project.Supabase.co"}', 'project.supabase.co'],
    ['{"supabaseHost":"storage.example.com"}', 'storage.example.com'],
  ])('accepts valid config %s', (config, expected) => {
    const result = spawnSync('sh', ['-eu', '-c', script], {
      encoding: 'utf8',
      env: { ...process.env, NODE: process.execPath, CONFIG: config },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toBe(expected)
  })

  it.each([
    'not json',
    'null',
    '[]',
    ...[
      '',
      'https://a.supabase.co',
      'a.supabase.co/path',
      'a.supabase.co:443',
      'a..supabase.co',
      '-a.supabase.co',
      'a-.supabase.co',
      'a\nb.supabase.co',
      '$(exit 42)',
      '`exit 42`',
      'a</string>',
      'a'.repeat(64) + '.com',
      null,
      42,
    ].map((supabaseHost) => JSON.stringify({ supabaseHost })),
  ])('rejects invalid config %s', (config) => {
    const result = spawnSync('sh', ['-eu', '-c', script], {
      encoding: 'utf8',
      env: { ...process.env, NODE: process.execPath, CONFIG: config },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Invalid bridge config')
    expect(result.stdout).toBe('')
  })
})

describe('fetchAllowed', () => {
  const redirect = (location: string) => new Response(null, { status: 302, headers: { location } })

  it.each([
    'https://other.supabase.co/storage/v1/object/sign/x.png',
    'https://a.supabase.co/rest/v1/data',
  ])('rejects a pinned redirect to %s before fetching it', async (location) => {
    vi.stubEnv('SQUASH_SUPABASE_HOST', 'a.supabase.co')
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(redirect(location))
    await expect(
      bridge.fetchAllowed('https://a.supabase.co/storage/v1/object/sign/x.png', [], fetchImpl),
    ).rejects.toMatchObject({ status: 400 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('follows redirects that stay on allowed hosts', async () => {
    const calls: string[] = []
    const fetchImpl = (async (url: string) => {
      calls.push(url)
      return calls.length === 1 ? redirect('/next.png') : new Response('ok')
    }) as unknown as typeof fetch
    const res = await bridge.fetchAllowed('https://a.supabase.co/x.png', [], fetchImpl)
    expect(await res.text()).toBe('ok')
    expect(calls).toEqual(['https://a.supabase.co/x.png', 'https://a.supabase.co/next.png'])
  })

  it('refuses to follow a redirect to a host that is not allowed', async () => {
    const calls: string[] = []
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push(url)
      expect(init.redirect).toBe('manual')
      return redirect('http://169.254.169.254/latest/meta-data')
    }) as unknown as typeof fetch
    await expect(
      bridge.fetchAllowed('https://a.supabase.co/x.png', [], fetchImpl),
    ).rejects.toMatchObject({ status: 400 })
    expect(calls).toEqual(['https://a.supabase.co/x.png'])
  })

  it('never fetches a disallowed first URL and stops after a few redirects', async () => {
    let calls = 0
    const fetchImpl = (async () => {
      calls++
      return redirect('https://a.supabase.co/loop.png')
    }) as unknown as typeof fetch
    await expect(bridge.fetchAllowed('https://example.com/x.png', [], fetchImpl)).rejects.toThrow()
    expect(calls).toBe(0)
    await expect(bridge.fetchAllowed('https://a.supabase.co/x.png', [], fetchImpl)).rejects.toThrow(
      /302/,
    )
    expect(calls).toBe(4)
  })
})

describe('readCapped', () => {
  /** A body of `chunks` chunks of `size` bytes that records how many chunks were pulled. */
  function body(chunks: number, size: number) {
    const state = { pulled: 0, cancelled: false }
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (state.pulled === chunks) return controller.close()
        state.pulled++
        controller.enqueue(new Uint8Array(size).fill(state.pulled))
      },
      cancel() {
        state.cancelled = true
      },
    })
    return { stream, state }
  }

  it('returns the whole body when it fits', async () => {
    const { stream } = body(3, 4)
    const data = await bridge.readCapped(new Response(stream), 12)
    expect(data.length).toBe(12)
    expect([...data]).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3])
  })

  it('rejects up front when Content-Length is over the limit, without reading', async () => {
    const { stream, state } = body(100, 4)
    const res = new Response(stream, { headers: { 'content-length': '400' } })
    await expect(bridge.readCapped(res, 100)).rejects.toThrow('Screenshot too large')
    expect(state.pulled).toBeLessThanOrEqual(1)
    expect(state.cancelled).toBe(true)
  })

  it('stops streaming as soon as the limit is passed when the size is not declared', async () => {
    const { stream, state } = body(1000, 10)
    await expect(bridge.readCapped(new Response(stream), 25)).rejects.toThrow(
      'Screenshot too large',
    )
    expect(state.pulled).toBeLessThan(10)
    expect(state.cancelled).toBe(true)
  })

  it('does not trust a small Content-Length', async () => {
    const { stream } = body(10, 10)
    const res = new Response(stream, { headers: { 'content-length': '5' } })
    await expect(bridge.readCapped(res, 50)).rejects.toThrow('Screenshot too large')
  })
})

describe('createLaunchLimiter', () => {
  it('allows at most maxRunning runs at once and frees a slot on release', () => {
    const limiter = bridge.createLaunchLimiter({ maxRunning: 3, now: () => 0 })
    const slots = [limiter.acquire(), limiter.acquire(), limiter.acquire()]
    expect(slots.every(Boolean)).toBe(true)
    expect(limiter.acquire()).toBeNull()
    slots[1]!.release()
    expect(limiter.acquire()).not.toBeNull()
    expect(limiter.acquire()).toBeNull()
  })

  it('frees a slot once its run has finished or grown too old', () => {
    let t = 0
    const done = new Set<string>()
    const limiter = bridge.createLaunchLimiter({
      maxRunning: 2,
      now: () => t,
      isRunning: (run, msSinceLaunch) => msSinceLaunch < 1000 && !done.has(run),
    })
    limiter.acquire()!.track('/a')
    limiter.acquire()!.track('/b')
    expect(limiter.acquire()).toBeNull()
    done.add('/a')
    const third = limiter.acquire()
    expect(third).not.toBeNull()
    expect(limiter.acquire()).toBeNull()
    t = 500
    third!.track('/c')
    t = 1000
    // '/b' (launched at 0) has expired; '/c' (launched at 500) still runs.
    expect(limiter.acquire()).not.toBeNull()
    expect(limiter.running).toBe(2)
  })

  it('always counts a slot that is still preparing, however long it takes', () => {
    let t = 0
    const limiter = bridge.createLaunchLimiter({
      maxRunning: 1,
      now: () => t,
      isRunning: () => false,
    })
    const slot = limiter.acquire()
    t = 10 * 60 * 60_000
    expect(limiter.acquire()).toBeNull()
    slot!.track('/a')
    expect(limiter.acquire()).not.toBeNull()
  })

  it('allows at most maxLaunches per window, even when runs finish', () => {
    let t = 0
    const limiter = bridge.createLaunchLimiter({
      maxRunning: 3,
      maxLaunches: 20,
      windowMs: 600_000,
      now: () => t,
    })
    for (let i = 0; i < 20; i++) {
      t = i * 1000
      const slot = limiter.acquire()
      expect(slot, `launch ${i}`).not.toBeNull()
      slot!.release()
    }
    t = 599_999
    expect(limiter.acquire()).toBeNull()
    t = 600_000
    expect(limiter.acquire()).not.toBeNull()
  })

  it('counts a refused launch against neither limit', () => {
    const limiter = bridge.createLaunchLimiter({ maxRunning: 1, maxLaunches: 2, now: () => 0 })
    const first = limiter.acquire()
    expect(limiter.acquire()).toBeNull()
    first!.release()
    expect(limiter.acquire()).not.toBeNull()
  })
})

describe('isReservedName', () => {
  it('reserves the files the bridge and runner use, in any case', () => {
    for (const name of [
      'done.json',
      'DONE.json',
      'result.json',
      'run.json',
      'applied',
      'prompt.md',
      'events.jsonl',
      'settings.json',
      'claude.log',
      'runner.log',
      'runner.pid',
      'runs.json',
      'runner-0123456789abcdef0123456789abcdef.pid',
    ]) {
      expect(bridge.isReservedName(name), name).toBe(true)
    }
  })

  it('allows ordinary screenshot names', () => {
    for (const name of ['bug-12-1.png', 'done.png', 'result-shot.jpeg', 'runner.png']) {
      expect(bridge.isReservedName(name), name).toBe(false)
    }
  })

  it('gives each launch its own pid file', () => {
    const a = bridge.runnerPidFile('/p/.squash/bugs/b', 'a'.repeat(32))
    const b = bridge.runnerPidFile('/p/.squash/bugs/b', 'b'.repeat(32))
    expect(a).not.toBe(b)
    expect(bridge.isReservedName(basename(a))).toBe(true)
  })
})

describe('runnerLive', () => {
  const dir = mkdtempSync(join(tmpdir(), 'squash-runner-'))
  const deadPid = spawnSync(process.execPath, ['-e', '']).pid!

  it('tells live and dead pids apart', () => {
    expect(bridge.pidAlive(process.pid)).toBe(true)
    expect(bridge.pidAlive(deadPid)).toBe(false)
    expect(bridge.pidAlive(0)).toBe(false)
    expect(bridge.pidAlive(Number.NaN)).toBe(false)
  })

  it('holds the slot while the runner process is alive, with no time limit', () => {
    const file = join(dir, 'live.pid')
    writeFileSync(file, String(process.pid))
    expect(bridge.runnerLive(file, 0)).toBe(true)
    expect(bridge.runnerLive(file, 48 * 60 * 60_000)).toBe(true)
  })

  it('frees the slot as soon as the runner has exited (e.g. its window was closed)', () => {
    const file = join(dir, 'dead.pid')
    writeFileSync(file, String(deadPid))
    expect(bridge.runnerLive(file, 0)).toBe(false)
  })

  it('waits a grace period for a runner that has not written its pid yet', () => {
    const missing = join(dir, 'missing.pid')
    expect(bridge.runnerLive(missing, 0, 30_000)).toBe(true)
    expect(bridge.runnerLive(missing, 29_999, 30_000)).toBe(true)
    expect(bridge.runnerLive(missing, 30_000, 30_000)).toBe(false)
    const empty = join(dir, 'empty.pid')
    writeFileSync(empty, '')
    expect(bridge.runnerLive(empty, 0, 30_000)).toBe(true)
    expect(bridge.runnerLive(empty, 30_000, 30_000)).toBe(false)
  })
})

describe('proof of fix', () => {
  const A = 'a'.repeat(40)
  const B = 'b'.repeat(40)

  it('accepts only full lower-case shas', () => {
    expect(bridge.parseSha(` ${A.toUpperCase()}\n`)).toBe(A)
    for (const bad of ['abc1234', 'g'.repeat(40), 'a'.repeat(64), `${A} x`, '', null]) {
      expect(bridge.parseSha(bad)).toBeNull()
    }
  })

  it('keeps ordinary branch names and drops detached HEAD, options and odd characters', () => {
    expect(bridge.parseBranch('fix/bug-12\n')).toBe('fix/bug-12')
    for (const bad of ['HEAD', '-x', 'a b', 'tab\there', 'x'.repeat(256), '', undefined]) {
      expect(bridge.parseBranch(bad)).toBeNull()
    }
  })

  it('parses git diff --shortstat', () => {
    expect(bridge.parseShortstat(' 3 files changed, 10 insertions(+), 2 deletions(-)\n')).toEqual({
      filesChanged: 3,
      additions: 10,
      deletions: 2,
    })
    expect(bridge.parseShortstat('1 file changed, 1 insertion(+)')).toEqual({
      filesChanged: 1,
      additions: 1,
      deletions: 0,
    })
    expect(bridge.parseShortstat('2 files changed, 5 deletions(-)')).toEqual({
      filesChanged: 2,
      additions: 0,
      deletions: 5,
    })
    expect(bridge.parseShortstat('')).toEqual({ filesChanged: 0, additions: 0, deletions: 0 })
    expect(bridge.parseShortstat('fatal: bad revision')).toBeNull()
    expect(bridge.parseShortstat(null)).toBeNull()
  })

  it('takes only a capped https PR URL from gh', () => {
    const url = 'https://github.com/o/r/pull/12'
    expect(bridge.parsePrUrl(JSON.stringify({ url }))).toBe(url)
    for (const bad of [
      'http://github.com/o/r/pull/1',
      'javascript:alert(1)',
      'https://github.com/o/r/pull/1 x',
      `https://github.com/${'a'.repeat(500)}`,
    ]) {
      expect(bridge.parsePrUrl(JSON.stringify({ url: bad }))).toBeNull()
    }
    expect(bridge.parsePrUrl('no pull requests found')).toBeNull()
    expect(bridge.parsePrUrl(null)).toBeNull()
  })

  it('runs git and gh with fixed argv and validates every answer', async () => {
    const calls: { file: string; args: string[]; options?: ExecOptions }[] = []
    const answers: Record<string, string | null> = {
      'git rev-parse': `${B}\n`,
      'git symbolic-ref': 'fix/bug-12',
      'git -c': ' 2 files changed, 7 insertions(+), 1 deletion(-)',
      'gh pr': '{"url":"https://github.com/o/r/pull/9"}',
    }
    const run: Exec = async (file, args, options) => {
      calls.push({ file, args, options })
      return answers[`${file} ${args[0]}`] ?? null
    }
    const report = await bridge.collectGitReport('/repo', A, { run, startedAt: 'when' })
    expect(report).toEqual({
      startSha: A,
      commitSha: B,
      noCommit: false,
      branch: 'fix/bug-12',
      prUrl: 'https://github.com/o/r/pull/9',
      filesChanged: 2,
      additions: 7,
      deletions: 1,
      startedAt: 'when',
    })
    expect(calls.map((c) => [c.file, ...c.args])).toEqual([
      ['git', 'rev-parse', '--verify', '--quiet', 'HEAD'],
      ['git', 'symbolic-ref', '--quiet', '--short', 'HEAD'],
      [
        'git',
        '-c',
        'core.fsmonitor=false',
        'diff',
        '--shortstat',
        '--no-ext-diff',
        '--no-textconv',
        `${A}..${B}`,
      ],
      ['gh', 'pr', 'view', '--json', 'url'],
    ])
    expect(calls.every((c) => c.options?.cwd === '/repo')).toBe(true)
  })

  it('leaves out what it cannot trust: no repo, a bad start, detached HEAD, gh failing', async () => {
    expect(await bridge.collectGitReport('/x', A, { run: async () => null })).toBeNull()
    expect(await bridge.collectGitReport('/x', A, { run: async () => 'not a sha' })).toBeNull()

    const calls: string[][] = []
    const run: Exec = async (file, args) => {
      calls.push([file, ...args])
      if (args[0] === 'rev-parse') return B
      if (args[0] === 'symbolic-ref') return null // detached
      throw new Error(`unexpected ${file} ${args.join(' ')}`)
    }
    const report = await bridge.collectGitReport('/x', '--output=/tmp/pwn', { run })
    expect(report).toMatchObject({
      startSha: null,
      commitSha: B,
      noCommit: false,
      branch: null,
      prUrl: null,
      filesChanged: null,
    })
    // No diff without a trusted start, and no gh without a branch.
    expect(calls).toHaveLength(2)
  })

  it('reports no commit, never the old HEAD, when HEAD did not move', async () => {
    const calls: string[][] = []
    const run: Exec = async (file, args) => {
      calls.push([file, ...args])
      if (args[0] === 'rev-parse') return A
      if (args[0] === 'symbolic-ref') return 'main'
      if (file === 'git') return ''
      return '{"url":"https://github.com/o/r/pull/1"}'
    }
    expect(await bridge.collectGitReport('/x', A, { run })).toEqual({
      startSha: A,
      commitSha: null,
      noCommit: true,
      branch: 'main',
      prUrl: null,
      filesChanged: 0,
      additions: 0,
      deletions: 0,
      startedAt: null,
    })
    expect(calls.some(([file]) => file === 'gh')).toBe(false)
    expect(calls).toContainEqual(expect.arrayContaining([`${A}..${A}`]))
  })

  it('execQuiet resolves null for a missing command and never uses a shell', async () => {
    expect(await bridge.execQuiet('squash-no-such-command', ['--version'])).toBeNull()
    // A shell would expand this; execFile passes it through literally.
    expect(
      await bridge.execQuiet(process.execPath, ['-e', 'console.log(process.argv[1])', '$HOME;x']),
    ).toBe('$HOME;x')
  })

  it('reports the commits a run made in a real repo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'squash-git-'))
    const git = (...args: string[]) => {
      const r = spawnSync(
        'git',
        ['-c', 'user.name=Squash', '-c', 'user.email=squash@example.test', ...args],
        { cwd: dir, encoding: 'utf8' },
      )
      if (r.status !== 0) throw new Error(r.stderr)
    }
    git('init', '-q', '-b', 'main')
    writeFileSync(join(dir, 'a.txt'), 'one\ntwo\n')
    git('add', '.')
    git('commit', '-q', '-m', 'start')
    const start = await bridge.startSha(dir)
    expect(start).toMatch(/^[0-9a-f]{40}$/)
    git('checkout', '-q', '-b', 'fix/bug-7')
    writeFileSync(join(dir, 'a.txt'), 'one\nTWO\nthree\n')
    writeFileSync(join(dir, 'b.txt'), 'new\n')
    git('add', '.')
    git('commit', '-q', '-m', 'fix')
    // gh is left out so the test never reaches the network.
    const run: Exec = (file, args, options) =>
      file === 'gh' ? Promise.resolve(null) : bridge.execQuiet(file, args, options)
    const report = await bridge.collectGitReport(dir, start, { run })
    expect(report).toMatchObject({
      startSha: start,
      branch: 'fix/bug-7',
      prUrl: null,
      filesChanged: 2,
      additions: 3,
      deletions: 1,
    })
    expect(report?.commitSha).toMatch(/^[0-9a-f]{40}$/)
    expect(report?.commitSha).not.toBe(start)
    expect(report?.noCommit).toBe(false)
    // A second run that commits nothing reports no commit and an empty diff.
    const head = await bridge.startSha(dir)
    writeFileSync(join(dir, 'a.txt'), 'uncommitted\n')
    expect(await bridge.collectGitReport(dir, head, { run })).toMatchObject({
      commitSha: null,
      noCommit: true,
      filesChanged: 0,
      additions: 0,
      deletions: 0,
    })
    expect(await bridge.startSha(tmpdir())).toBeNull()
  })
})

describe('legacyBatches', () => {
  const ws = '9d0d391d-3d9c-4689-af9c-7255e1e2085d'
  function batch(root: string, name: string, files: Record<string, string>) {
    const dir = join(root, name)
    mkdirSync(dir)
    for (const [file, body] of Object.entries(files)) writeFileSync(join(dir, file), body)
  }
  const prompt = (id: string) => `- Link: https://squash.example/app/${id}/bug/17\n`
  const result = '{"bugs":[{"number":17,"resolved":true,"summary":"Done."}]}'

  it('adopts unapplied results an old helper never picked up, for this workspace only', async () => {
    const root = mkdtempSync(join(tmpdir(), 'squash-legacy-'))
    batch(root, '20261012-195226-17', { 'prompt.md': prompt(ws), 'result.json': result })
    batch(root, '20261012-195316-18', { 'prompt.md': prompt('other-ws'), 'result.json': result })
    batch(root, '20261012-195400-19', { 'prompt.md': prompt(ws) })
    batch(root, '20261012-195500-20', {
      'prompt.md': prompt(ws),
      'result.json': result,
      applied: 'x',
    })
    batch(root, '20261012-195600-21', {
      'prompt.md': prompt(ws),
      'result.json': result,
      'run.json': '{}',
    })
    batch(root, '20261012-195700-22', {
      'prompt.md': prompt(ws),
      'result.json': result,
      'done.json': '{}',
    })
    const found = await bridge.legacyBatches(root, ws)
    expect(found).toEqual([
      {
        id: '20261012-195226-17',
        workspaceId: ws,
        dir: join(root, '20261012-195226-17'),
        legacy: true,
      },
    ])
  })

  it('returns nothing when the folder has no batches', async () => {
    expect(await bridge.legacyBatches(join(tmpdir(), 'squash-missing-dir-xyz'), ws)).toEqual([])
  })
})

describe('readScreenshot', () => {
  it('serves an image Claude saved in the batch folder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'squash-shot-'))
    writeFileSync(join(dir, 'after-4.png'), 'png-bytes')
    const shot = await bridge.readScreenshot(dir, 'after-4.png')
    expect(shot.type).toBe('image/png')
    expect(shot.data.toString()).toBe('png-bytes')
  })

  it('refuses paths, non-images, bridge files, symlinks and missing files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'squash-shot-'))
    writeFileSync(join(dir, 'secret.png'), 'x')
    symlinkSync(join(dir, 'secret.png'), join(dir, 'link.png'))
    await expect(bridge.readScreenshot(dir, '../secret.png')).rejects.toThrow('Invalid')
    await expect(bridge.readScreenshot(dir, 'prompt.md')).rejects.toThrow('Invalid')
    await expect(bridge.readScreenshot(dir, 'link.png')).rejects.toThrow('No such')
    await expect(bridge.readScreenshot(dir, 'missing.png')).rejects.toThrow('No such')
  })
})

describe('validateProject', () => {
  it('accepts a plain folder name and an optional parent', () => {
    expect(
      bridge.validateProject({
        workspaceId: 'ws1',
        workspaceName: 'Recipe Box',
        name: 'recipe-box',
      }),
    ).toEqual({ workspaceId: 'ws1', workspaceName: 'Recipe Box', name: 'recipe-box', parent: null })
    expect(
      bridge.validateProject({ workspaceId: 'ws1', name: 'app', parent: '~/Projects' }).parent,
    ).toBe('~/Projects')
  })

  it('refuses names that could leave the parent folder', () => {
    for (const name of ['..', '../x', 'a/b', '.hidden', '', 'a..b']) {
      expect(() => bridge.validateProject({ workspaceId: 'ws1', name })).toThrow()
    }
    expect(() => bridge.validateProject({ workspaceId: '../x', name: 'ok' })).toThrow()
  })
})

describe('questions', () => {
  it('runs read-only, whatever SQUASH_CLAUDE_ARGS says about permissions', () => {
    const args = bridge.askArgs([
      '--permission-mode',
      'bypassPermissions',
      '--dangerously-skip-permissions',
      '--allowedTools=Edit',
      '--model',
      'opus',
    ])
    expect(args.slice(0, 2)).toEqual(['--permission-mode', 'default'])
    expect(args).not.toContain('bypassPermissions')
    expect(args).not.toContain('--dangerously-skip-permissions')
    expect(args).not.toContain('--allowedTools=Edit')
    expect(args).toContain('--model')
    expect(args).toContain('opus')
    const allowed = args.find((a) => a.startsWith('--allowedTools='))!
    expect(allowed).toContain('Read')
    expect(allowed).toContain('Bash(git log:*)')
    expect(allowed).not.toMatch(/Edit|Write|git push|git commit/)
    expect(args).toContain('--disallowedTools=Edit,MultiEdit,Write,NotebookEdit')
  })

  it('validates a question and decodes its attached files', () => {
    const ask = bridge.validateAsk({
      workspaceId: 'ws1',
      id: 'ask-20261012-120000-ab12',
      question: '  Is #12 fixed?  ',
      prompt: 'Answer it',
      bugs: [12, -1],
      files: [{ name: 'file-1-notes.txt', data: Buffer.from('hello').toString('base64') }],
    })
    expect(ask.question).toBe('Is #12 fixed?')
    expect(ask.bugs).toEqual([12])
    expect(ask.files[0].data.toString()).toBe('hello')
  })

  it('rejects unsafe or reserved file names and a missing question', () => {
    const base = { workspaceId: 'ws1', id: 'ask-1', question: 'Q', prompt: 'P' }
    for (const name of ['../x', 'result.json', 'done.json', '.hidden', 'a/b']) {
      expect(() => bridge.validateAsk({ ...base, files: [{ name, data: '' }] })).toThrow()
    }
    expect(() => bridge.validateAsk({ ...base, question: ' ' })).toThrow('Missing question')
  })

  it('reports a question as working, answered or failed', () => {
    const meta = { id: 'ask-1', question: 'Q', askedAt: at(0).toISOString() }
    const tool = { t: at(1).toISOString(), kind: 'tool', text: 'Reading src/App.tsx' }
    expect(bridge.summarizeQuestion(meta, [tool], null, true)).toMatchObject({
      state: 'working',
      activity: 'Reading src/App.tsx',
    })
    expect(
      bridge.summarizeQuestion(meta, [], { answer: 'Yes, fixed.', exitCode: 0 }, true),
    ).toMatchObject({ state: 'answered', answer: 'Yes, fixed.' })
    expect(bridge.summarizeQuestion(meta, [], { answer: '', exitCode: 1 }, true).state).toBe(
      'failed',
    )
    expect(bridge.summarizeQuestion(meta, [], null, false).state).toBe('failed')
  })
})

describe('run terminals', () => {
  it('open without bringing Terminal to the front', () => {
    const script = bridge.BACKGROUND_TERMINAL_SCRIPT.join('\n')
    expect(script).not.toMatch(/^activate$/m)
    expect(script).toContain('path to frontmost application')
    expect(script).toContain('tell application previous to activate')
  })
})

describe('usage', () => {
  const result = {
    type: 'result',
    total_cost_usd: 1.38151600002,
    num_turns: 38,
    duration_ms: 233086,
    usage: {
      input_tokens: 72,
      output_tokens: 14440,
      cache_read_input_tokens: 2469500,
      cache_creation_input_tokens: 74816,
    },
    modelUsage: { 'claude-opus-5-5[1m]': {} },
  }

  it('reads what a run used from its result event', () => {
    expect(bridge.runUsage(result)).toEqual({
      tokens: 72 + 14440 + 2469500 + 74816,
      input: 72,
      output: 14440,
      cacheRead: 2469500,
      cacheWrite: 74816,
      costUsd: 1.3815,
      turns: 38,
      durationMs: 233086,
      models: ['claude-opus-5-5[1m]'],
    })
    expect(bridge.runUsage({}).tokens).toBe(0)
  })

  it('reads plan limits from a rate limit event', () => {
    const event = {
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'allowed',
        unifiedWindows: {
          five_hour: { utilization: 0.03, resetsAt: 1791845400 },
          seven_day: { utilization: 0.091, resetsAt: 1792141200 },
        },
      },
    }
    expect(bridge.parseLimits(event, at(0))).toEqual({
      fiveHour: { usedPercent: 3, resetsAt: new Date(1791845400 * 1000).toISOString() },
      sevenDay: { usedPercent: 9.1, resetsAt: new Date(1792141200 * 1000).toISOString() },
      status: 'allowed',
      updatedAt: at(0).toISOString(),
    })
    expect(bridge.parseLimits({ rate_limit_info: { status: 'allowed' } })).toBeNull()
    expect(bridge.parseLimits({})).toBeNull()
  })

  it('totals a workspace and lists its runs newest first', () => {
    const entries = [
      { id: 'a', workspaceId: 'w1', kind: 'fix', bugs: [1, 2], tokens: 100, costUsd: 0.5 },
      { id: 'b', workspaceId: 'w2', kind: 'fix', bugs: [1], tokens: 999, costUsd: 9 },
      { id: 'c', workspaceId: 'w1', kind: 'question', bugs: [], tokens: 50, costUsd: 0.25 },
    ]
    const usage = bridge.summarizeUsage(entries, 'w1', null, 1)
    expect(usage.total).toMatchObject({ runs: 2, tokens: 150, costUsd: 0.75 })
    expect(usage.runs.map((r) => r.id)).toEqual(['c'])
    expect(usage.limits).toBeNull()
  })
})
