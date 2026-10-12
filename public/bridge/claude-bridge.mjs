// Squash → Claude Code bridge. Receives bugs from the Squash tab, downloads their screenshots
// into the workspace's project folder and runs Claude Code on them unattended in a new terminal.
// Claude's last step is to write result.json in the batch folder; when it exits, the terminal
// closes and the open Squash tab resolves each bug it fixed with Claude's summary (or comments on
// the ones it could not finish), claiming the run through POST .../results/<batch>/claim.
// Proof of fix: the runner notes HEAD before Claude starts and, when it exits, reports the new HEAD,
// the branch, `git diff --shortstat <start>..<end>` and the branch's PR URL (when `gh` is installed),
// which Squash records on each bug it resolves.
//
// Install (macOS, starts at login):  curl -fsSL https://<squash>/bridge/install.sh | sh
// Run by hand:                       node claude-bridge.mjs [default-folder]
//
// Each Squash workspace maps to its own project folder, chosen the first time you send from it
// (a native folder picker on macOS) and saved in ~/.squash/bridge.json.
//
// Live progress: each run starts Claude with hooks (--settings) that call this script back with
// `--hook <run folder>`, which appends what Claude is doing to that run's events.jsonl. Squash
// polls GET /workspaces/<id>/runs to show it on the bug.
//
// Env: SQUASH_BRIDGE_PORT (4317), SQUASH_ORIGINS (comma-separated allowed app origins),
// After screenshots: Claude may save a screenshot of its fix in the batch folder and name it in
// result.json; Squash fetches it through GET .../results/<batch>/files/<file> and attaches it to the
// bug as the "after" shot.
//
// Questions: POST /workspaces/<id>/questions runs Claude Code read-only and headless (no terminal
// window) on a question about the project, with any items and files it is about; Squash polls
// GET /workspaces/<id>/questions and shows Claude's answer in the app.
//
// Run terminals open in the background: the browser (or whatever was in front) keeps focus. Each
// runner closes its own window when it ends (see closeOwnWindow), even if the bridge restarted.
//
// New projects: POST /projects creates an empty folder (a fresh git repo on main) for a new Squash
// workspace and maps the workspace to it; Squash then sends the project's first feature as a run
// that builds it, creates the GitHub repo and pushes.
//
// Queue: at most SQUASH_MAX_RUNS (3) runs work at once. Items sent while every slot is taken wait
// in a queue (kept in ~/.squash/runs.json, so it survives a restart) and start, oldest first, as
// runs finish; Squash shows them as queued.
//
// Usage: each run's runner records what Claude used (tokens, API-price cost, turns) in
// ~/.squash/usage.jsonl, with the workspace and item numbers it ran for, and the latest plan limits
// Claude Code reports (5-hour and weekly windows) in ~/.squash/limits.json. Squash reads both through
// GET /workspaces/<id>/usage.
//
// SQUASH_CLAUDE_ARGS (extra `claude` flags; the permission mode defaults to "auto", override it
// with e.g. "--permission-mode acceptEdits"), SQUASH_DOWNLOAD_HOSTS (comma-separated extra hosts
// screenshots may be downloaded from), SQUASH_SUPABASE_HOST (this app's Supabase project host).
import { execFile, execFileSync, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import {
  closeSync,
  createWriteStream,
  existsSync,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  statSync,
} from 'node:fs'
import { appendFile, chmod, lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const VERSION = 14
const SCRIPT = fileURLToPath(import.meta.url)
const PORT = Number(process.env.SQUASH_BRIDGE_PORT ?? 4317)
const HOOK = process.argv[2] === '--hook'
const RUNNER = process.argv[2] === '--run'
const DEFAULT_FOLDER = process.argv[2] && !HOOK && !RUNNER ? resolve(process.argv[2]) : null
const CONFIG_DIR = join(homedir(), '.squash')
const CONFIG_FILE = join(CONFIG_DIR, 'bridge.json')
const RUNS_FILE = join(CONFIG_DIR, 'runs.json')
const QUESTIONS_FILE = join(CONFIG_DIR, 'questions.json')
const USAGE_FILE = join(CONFIG_DIR, 'usage.jsonl')
const LIMITS_FILE = join(CONFIG_DIR, 'limits.json')
// Runs the usage route returns per workspace, newest first (totals still count every run).
const USAGE_RUNS = 500
const MAX_QUESTIONS = 30
const MAX_RUNS = 50
const RUNS_PER_WORKSPACE = 10
const MAX_TEXT = 2000
const MAX_ANSWER = 20_000
const ORIGINS = new Set(
  (
    process.env.SQUASH_ORIGINS ??
    'https://squash-livid.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173'
  )
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
)
const EXTRA_ARGS = (process.env.SQUASH_CLAUDE_ARGS ?? '').split(/\s+/).filter(Boolean)
// Runs ship their work (commit, bring in what landed on the remote, resolve conflicts, push), so
// those git commands never wait on a permission prompt nobody is there to answer. Force-pushes
// stay blocked.
const SHIP_TOOLS = [
  '--allowedTools=' +
    [
      'add',
      'commit',
      'push',
      'fetch',
      'pull',
      'rebase',
      'merge',
      'switch',
      'checkout',
      'status',
      'log',
      'diff',
      'init',
      'remote',
    ]
      .map((cmd) => `Bash(git ${cmd}:*)`)
      .concat('Bash(gh repo create:*)', 'Bash(gh repo view:*)')
      .join(','),
  '--disallowedTools=Bash(git push --force:*),Bash(git push -f:*),Bash(git push --force-with-lease:*)',
]
const CLAUDE_ARGS = [
  ...(EXTRA_ARGS.some((a) => a.startsWith('--permission-mode'))
    ? EXTRA_ARGS
    : ['--permission-mode', 'auto', ...EXTRA_ARGS]),
  ...SHIP_TOOLS,
]
/**
 * Flags for a question run: read-only. Claude may read the code and the git and deploy history but
 * never edit, commit or push, and SQUASH_CLAUDE_ARGS cannot widen that (its permission mode and
 * tool lists are dropped; other flags, such as --model, still apply).
 */
export function askArgs(extra = EXTRA_ARGS) {
  const kept = []
  for (let i = 0; i < extra.length; i++) {
    const arg = extra[i]
    const flag = arg.split('=')[0]
    if (
      [
        '--permission-mode',
        '--allowedTools',
        '--allowed-tools',
        '--dangerously-skip-permissions',
      ].includes(flag)
    ) {
      // A flag given as `--flag value` takes its value with it.
      if (!arg.includes('=') && flag !== '--dangerously-skip-permissions') i++
      continue
    }
    kept.push(arg)
  }
  const readOnlyBash = [
    'git log',
    'git show',
    'git status',
    'git diff',
    'git branch',
    'git fetch',
    'git rev-parse',
    'git ls-files',
    'git blame',
    'gh run list',
    'gh run view',
    'gh pr list',
    'gh pr view',
    'gh issue list',
    'gh issue view',
    'vercel ls',
    'vercel inspect',
  ].map((cmd) => `Bash(${cmd}:*)`)
  return [
    '--permission-mode',
    'default',
    ...kept,
    '--allowedTools=' + ['Read', 'Grep', 'Glob', ...readOnlyBash].join(','),
    '--disallowedTools=Edit,MultiEdit,Write,NotebookEdit',
  ]
}
const MAC = process.platform === 'darwin'
const MAX_BODY = 1024 * 1024
// A question may carry files the person attached (sent inline, base64): this many, this big.
const MAX_ASK_BODY = 40 * 1024 * 1024
const MAX_ASK_FILES = 10
const MAX_ASK_FILE = 8 * 1024 * 1024
const MAX_QUESTION = 20_000
const MAX_IMAGE = 15 * 1024 * 1024
const MAX_DOWNLOADS = 100
const SAFE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}$/
const DOWNLOAD_HOSTS = parseHosts(process.env.SQUASH_DOWNLOAD_HOSTS)
const MAX_REDIRECTS = 3
// Launch limits: claude runs at once, and launches per window.
const MAX_RUNNING = Math.min(10, Math.max(1, Math.floor(Number(process.env.SQUASH_MAX_RUNS)) || 3))
// Runs waiting for a slot, and how often the queue checks for one.
const MAX_QUEUED = 30
const QUEUE_POLL_MS = 3000
const MAX_LAUNCHES = 20
const LAUNCH_WINDOW_MS = 10 * 60_000
// A launched run holds its slot while its runner process is alive. A runner that has not written its
// pid file this long after launch never started (or its window was closed first) and frees the slot.
const RUNNER_START_GRACE_MS = 60_000
// Files the bridge writes hold prompts, screenshots and paths: only this user may read them.
const FILE_MODE = 0o600
const DIR_MODE = 0o700
// Files in each batch folder (.squash/bugs/<batch>/), next to prompt.md and events.jsonl.
const RUN_FILE = 'run.json' // claude flags for the runner
const RESULT_FILE = 'result.json' // written by Claude as its last step
const DONE_FILE = 'done.json' // written by the runner when Claude exits
const CLAIM_FILE = 'applied' // created by the Squash tab that applied the result
// Names the bridge or runner use in a batch folder; screenshots may not take them.
const RESERVED_FILES = new Set([
  RUN_FILE,
  RESULT_FILE,
  DONE_FILE,
  CLAIM_FILE,
  'prompt.md',
  'events.jsonl',
  'settings.json',
  'claude.log',
  'runner.log',
  'runner.pid',
  'runs.json',
  'bridge.json',
])
const RUN_ID = /^[0-9a-f]{32}$/
// A batch folder's name, as in the results routes.
const BATCH_NAME = /^[A-Za-z0-9_.-]{1,80}$/
const CLOSE_AFTER_S = 3 // a finished run's window stays this long, to show how it went
// Proof of fix: git and gh run with fixed argv (never a shell) and these limits.
const GIT_TIMEOUT_MS = 10_000
const GH_TIMEOUT_MS = 10_000
const MAX_CMD_OUTPUT = 64 * 1024
const FULL_SHA = /^[0-9a-f]{40}$/
const BRANCH_NAME = /^[^\s\p{Cc}-][^\s\p{Cc}]{0,254}$/u
const PR_URL = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?\/[!-~]*$/
const PR_URL_MAX = 500
// After screenshots Claude saves in a batch folder: an image file, at most this big.
const SCREENSHOT_FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}\.(png|jpe?g|webp)$/i
const MAX_SCREENSHOT = 5 * 1024 * 1024
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
// New project folders: a plain name, created inside an existing parent folder.
const PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

// ── Hook mode ────────────────────────────────────────────────────────────────────────────────
// Claude Code runs `node claude-bridge.mjs --hook <run folder>` on each hook event with the event
// as JSON on stdin. It must stay quiet on stdout (Claude reads hook output) and never fail.

const clip = (text, max = MAX_TEXT) => {
  const t = String(text ?? '').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Reads up to the last `bytes` of a file. */
function tail(path, bytes = 512 * 1024) {
  const fd = openSync(path, 'r')
  try {
    const size = fstatSync(fd).size
    const length = Math.min(size, bytes)
    const buf = Buffer.alloc(length)
    readSync(fd, buf, 0, length, size - length)
    return buf.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

/** Claude's most recent text reply in the session transcript, or ''. */
export function lastAssistantText(transcriptPath) {
  if (typeof transcriptPath !== 'string' || !transcriptPath) return ''
  let lines
  try {
    lines = tail(transcriptPath).split('\n')
  } catch {
    return ''
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry
    try {
      entry = JSON.parse(lines[i])
    } catch {
      continue
    }
    if (entry?.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue
    const text = entry.message.content
      .filter((c) => c?.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n')
      .trim()
    if (text) return text
  }
  return ''
}

/** A one-line, human description of a tool call, e.g. "Editing src/App.tsx". */
export function describeTool(name, input = {}, cwd = '') {
  const file = (p) => {
    if (typeof p !== 'string') return 'a file'
    const rel = cwd ? relative(cwd, p) : p
    return rel && !rel.startsWith('..') ? rel : p
  }
  switch (name) {
    case 'Read':
      return `Reading ${file(input.file_path)}`
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return `Editing ${file(input.file_path ?? input.notebook_path)}`
    case 'Write':
      return `Writing ${file(input.file_path)}`
    case 'Bash':
      return clip(input.description || `Running ${input.command ?? 'a command'}`, 160)
    case 'Grep':
      return clip(`Searching for “${input.pattern ?? ''}”`, 160)
    case 'Glob':
      return clip(`Finding files matching ${input.pattern ?? ''}`, 160)
    case 'WebSearch':
      return clip(`Searching the web for “${input.query ?? ''}”`, 160)
    case 'WebFetch':
      return clip(`Reading ${input.url ?? 'a web page'}`, 160)
    case 'Task':
    case 'Agent':
      return clip(`Delegating: ${input.description ?? 'a subtask'}`, 160)
    case 'TodoWrite':
      return 'Updating its plan'
    default:
      return clip(`Using ${String(name ?? 'a tool').replace(/^mcp__/, '')}`, 160)
  }
}

/** Turns a Claude Code hook payload into the event Squash shows, or null to skip it. */
export function hookEvent(input, now = new Date()) {
  const t = now.toISOString()
  switch (input?.hook_event_name) {
    case 'SessionStart':
      return { t, kind: 'start' }
    case 'UserPromptSubmit':
      return { t, kind: 'prompt' }
    case 'PreToolUse': {
      const event = {
        t,
        kind: 'tool',
        text: describeTool(input.tool_name, input.tool_input ?? {}, input.cwd),
      }
      const note = lastAssistantText(input.transcript_path)
      if (note) event.note = clip(note, 500)
      const todos = input.tool_input?.todos
      if (input.tool_name === 'TodoWrite' && Array.isArray(todos)) {
        event.todos = todos.slice(0, 30).map((todo) => ({
          text: clip(todo?.content, 200),
          status: ['pending', 'in_progress', 'completed'].includes(todo?.status)
            ? todo.status
            : 'pending',
        }))
      }
      return event
    }
    case 'Notification':
      return { t, kind: 'waiting', text: clip(input.message || 'Claude needs your input', 300) }
    case 'Stop': {
      const text = input.last_assistant_message || lastAssistantText(input.transcript_path)
      return { t, kind: 'stop', text: clip(text) }
    }
    case 'SessionEnd':
      return { t, kind: 'end' }
    default:
      return null
  }
}

async function runHook(dir) {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const event = hookEvent(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  if (event) {
    await appendFile(join(dir, 'events.jsonl'), JSON.stringify(event) + '\n', { mode: FILE_MODE })
  }
}

/** Hook settings that report every step of this run back to its folder. */
function hookSettings(dir) {
  const command = `${sh(process.execPath)} ${sh(SCRIPT)} --hook ${sh(dir)}`
  const entry = (matcher) => [
    { ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command, timeout: 10 }] },
  ]
  return {
    hooks: {
      SessionStart: entry(),
      UserPromptSubmit: entry(),
      PreToolUse: entry('*'),
      Notification: entry(),
      Stop: entry(),
      SessionEnd: entry(),
    },
  }
}

// ── Runs ─────────────────────────────────────────────────────────────────────────────────────

/** Folds a run's events into what it is doing now. */
export function summarizeRun(meta, events) {
  // A queued run has no events until it starts; one that failed to start never will.
  let state = meta.queued ? 'queued' : meta.failed ? 'ended' : 'starting'
  let activity = null
  let message = null
  let todos = null
  let updatedAt = meta.startedAt
  const steps = []
  for (const e of events) {
    updatedAt = e.t ?? updatedAt
    switch (e.kind) {
      case 'start':
      case 'prompt':
        state = 'working'
        activity = 'Thinking'
        break
      case 'tool':
        state = 'working'
        activity = e.text
        if (e.note) message = e.note
        if (e.todos) todos = e.todos
        steps.push({ t: e.t, text: e.text })
        break
      case 'waiting':
        state = 'waiting'
        activity = e.text
        break
      case 'stop':
        state = 'done'
        activity = null
        if (e.text) message = e.text
        break
      case 'end':
        state = state === 'done' ? 'done' : 'ended'
        activity = null
        break
    }
  }
  return {
    id: meta.id,
    bugs: meta.bugs ?? [],
    folder: meta.folder,
    startedAt: meta.startedAt,
    updatedAt,
    state,
    activity,
    message,
    todos,
    steps: steps.slice(-8),
    stepCount: steps.length,
  }
}

async function loadRuns() {
  try {
    const runs = JSON.parse(await readFile(RUNS_FILE, 'utf8'))
    return Array.isArray(runs) ? runs : []
  } catch {
    return []
  }
}

async function recordRun(run) {
  const runs = [run, ...(await loadRuns()).filter((r) => r.id !== run.id)].slice(0, MAX_RUNS)
  await mkdirPrivate(CONFIG_DIR)
  await writePrivate(RUNS_FILE, JSON.stringify(runs, null, 2) + '\n')
}

async function readEvents(dir) {
  try {
    return (await readFile(join(dir, 'events.jsonl'), 'utf8'))
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)]
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

async function workspaceRuns(workspaceId) {
  const runs = (await loadRuns())
    .filter((r) => r.workspaceId === workspaceId)
    // Queued runs always show, however many there are.
    .filter((r, i) => r.queued || i < RUNS_PER_WORKSPACE)
  return Promise.all(runs.map(async (r) => summarizeRun(r, await readEvents(r.dir))))
}

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Lower-cased hostnames from a comma-separated list. */
export function parseHosts(list) {
  return String(list ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/\.$/, ''))
    .filter(Boolean)
}

let warnedUnpinnedDownloads = false

/** Whether screenshots may be downloaded from this URL. */
export function isAllowedDownload(url, extraHosts = []) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
  const pinnedHost = process.env.SQUASH_SUPABASE_HOST
  if (pinnedHost) {
    return (
      (host === pinnedHost.toLowerCase().replace(/\.$/, '') || extraHosts.includes(host)) &&
      parsed.port === '' &&
      parsed.pathname.startsWith('/storage/v1/object/') &&
      // Encoded separators or dots could walk out of the storage path on the server side.
      !/%2f|%5c|%2e/i.test(parsed.pathname)
    )
  }
  if (!warnedUnpinnedDownloads) {
    warnedUnpinnedDownloads = true
    console.warn(
      'SQUASH_SUPABASE_HOST is unset; downloads allow any Supabase project. Reinstall the helper from your app to pin its storage host.',
    )
  }
  return host.endsWith('.supabase.co') || host.endsWith('.supabase.in') || extraHosts.includes(host)
}

/**
 * Reads a fetch Response body into a Buffer, failing as soon as it would exceed `limit` bytes:
 * up front from Content-Length, otherwise while streaming (the rest is never downloaded).
 */
export async function readCapped(res, limit) {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) {
    await res.body?.cancel().catch(() => {})
    throw new Error('Screenshot too large')
  }
  const chunks = []
  let size = 0
  if (res.body) {
    // Leaving the loop early (the throw) cancels the stream.
    for await (const chunk of res.body) {
      size += chunk.byteLength
      if (size > limit) throw new Error('Screenshot too large')
      chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength))
    }
  }
  return Buffer.concat(chunks, size)
}

/**
 * Limits claude runs: at most `maxRunning` at once and `maxLaunches` per `windowMs`.
 * `acquire()` reserves a slot synchronously (so concurrent requests cannot both take the last
 * one) and returns it, or null when busy. `slot.track(run)` marks it launched and
 * `slot.release()` frees it. A launched slot is also freed once `isRunning(run, msSinceLaunch)`
 * is false; a slot that is still preparing (not tracked yet) always counts.
 */
export function createLaunchLimiter({
  maxRunning = MAX_RUNNING,
  maxLaunches = MAX_LAUNCHES,
  windowMs = LAUNCH_WINDOW_MS,
  isRunning = () => true,
  now = Date.now,
} = {}) {
  const running = new Set()
  const launches = []
  return {
    acquire() {
      const t = now()
      while (launches.length && launches[0] <= t - windowMs) launches.shift()
      for (const slot of running) {
        if (slot.launchedAt !== null && !isRunning(slot.run, t - slot.launchedAt)) {
          running.delete(slot)
        }
      }
      if (running.size >= maxRunning || launches.length >= maxLaunches) return null
      const slot = { run: null, launchedAt: null }
      running.add(slot)
      launches.push(t)
      return {
        track(run) {
          slot.run = run
          slot.launchedAt = now()
        },
        release() {
          running.delete(slot)
        },
      }
    },
    get running() {
      return running.size
    },
  }
}

/**
 * Runs waiting for a free slot, oldest first. `add(job)` queues one (false when `maxQueued` are
 * already waiting); `drain()` starts as many as `acquire()` has slots for, handing each to
 * `start(job, slot)`.
 */
export function createRunQueue({ acquire, start, maxQueued = MAX_QUEUED }) {
  const jobs = []
  return {
    add(job) {
      if (jobs.length >= maxQueued) return false
      jobs.push(job)
      return true
    },
    drain() {
      while (jobs.length) {
        const slot = acquire()
        if (!slot) return
        start(jobs.shift(), slot)
      }
    },
    get size() {
      return jobs.length
    },
  }
}

/** Whether a screenshot file name would clash with a file the bridge or runner uses. */
export function isReservedName(file) {
  const name = String(file).toLowerCase()
  return RESERVED_FILES.has(name) || name.startsWith('runner-')
}

/** The pid file a runner writes for one launch (unique even when batches share a folder). */
export function runnerPidFile(batchDir, runId) {
  return join(batchDir, `runner-${runId}.pid`)
}

/** Whether a process with this pid exists. */
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM: it exists but belongs to someone else.
    return err?.code === 'EPERM'
  }
}

/**
 * Whether a launched run still holds its slot: its runner's pid is alive, or the runner has not
 * written its pid file yet and was launched less than `graceMs` ago.
 */
export function runnerLive(pidFile, msSinceLaunch, graceMs = RUNNER_START_GRACE_MS) {
  let text
  try {
    text = readFileSync(pidFile, 'utf8')
  } catch {
    return msSinceLaunch < graceMs
  }
  // An empty file is a runner that is mid-write.
  if (!text.trim()) return msSinceLaunch < graceMs
  return pidAlive(Number(text.trim()))
}

/** Writes a file only this user can read, tightening it if it already existed. */
async function writePrivate(path, data, options = {}) {
  await writeFile(path, data, { mode: FILE_MODE, ...options })
  await chmod(path, FILE_MODE)
}

/** Creates a directory (and its parents) only this user can open, tightening the leaf if it existed. */
async function mkdirPrivate(path) {
  await mkdir(path, { recursive: true, mode: DIR_MODE })
  await chmod(path, DIR_MODE)
}

/** Single-quotes a value for a POSIX shell. */
const sh = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`

async function loadConfig() {
  try {
    const parsed = JSON.parse(await readFile(CONFIG_FILE, 'utf8'))
    return { workspaces: parsed.workspaces ?? {} }
  } catch {
    return { workspaces: {} }
  }
}

async function saveFolder(workspaceId, name, folder) {
  const config = await loadConfig()
  config.workspaces[workspaceId] = { name, folder }
  await mkdirPrivate(CONFIG_DIR)
  await writePrivate(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n')
}

function isDir(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Runs an AppleScript with arguments passed as `argv`, so nothing needs escaping. */
function osascript(lines, args) {
  return new Promise((ok, fail) => {
    execFile(
      'osascript',
      [...lines.flatMap((l) => ['-e', l]), ...args],
      { timeout: 10 * 60_000 },
      (err, stdout, stderr) => {
        if (!err) return ok(stdout.trim())
        if (/-128/.test(stderr)) return fail(new HttpError(400, 'cancelled', 'No folder chosen'))
        fail(new Error(stderr.trim() || err.message))
      },
    )
  })
}

/** Native folder picker, shown in front via Terminal (which the bridge already drives). */
async function pickFolder(name) {
  if (!MAC) {
    throw new HttpError(409, 'no_folder', `Set a project folder for "${name}" in Squash first`)
  }
  const path = await osascript(
    [
      'on run argv',
      'tell application "Terminal"',
      'activate',
      'return POSIX path of (choose folder with prompt (item 1 of argv))',
      'end tell',
      'end run',
    ],
    [`Choose the project folder Claude should fix bugs from “${name}” in`],
  )
  return path.replace(/\/$/, '')
}

/** Native picker for the folder a new project is created in. */
async function pickParent(name) {
  if (!MAC) throw new HttpError(409, 'no_folder', `Type the folder to create "${name}" in`)
  const path = await osascript(
    [
      'on run argv',
      'tell application "Terminal"',
      'activate',
      'return POSIX path of (choose folder with prompt (item 1 of argv))',
      'end tell',
      'end run',
    ],
    [`Choose where to create the folder for “${name}”`],
  )
  return path.replace(/\/$/, '')
}

/** Expands a leading ~ and resolves a typed folder path. */
const expandHome = (path) => resolve(path.trim().replace(/^~(?=$|\/)/, homedir()))

async function folderFor(workspaceId, name) {
  const saved = (await loadConfig()).workspaces[workspaceId]?.folder
  if (saved && isDir(saved)) return saved
  if (DEFAULT_FOLDER) return DEFAULT_FOLDER
  const picked = await pickFolder(name)
  await saveFolder(workspaceId, name, picked)
  return picked
}

function send(res, status, body, origin) {
  const headers = { 'Content-Type': 'application/json', Vary: 'Origin' }
  if (origin) headers['Access-Control-Allow-Origin'] = origin
  res.writeHead(status, headers)
  res.end(JSON.stringify(body))
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((ok, fail) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        fail(new HttpError(413, 'too_large', 'Request too large'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch {
        fail(new HttpError(400, 'invalid', 'Invalid JSON'))
      }
    })
    req.on('error', fail)
  })
}

function bad(message) {
  return new HttpError(400, 'invalid', message)
}

function workspaceName(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : 'this workspace'
}

function validateSend(payload) {
  const { workspaceId, batch, prompt, downloads } = payload
  const bugs = Array.isArray(payload.bugs)
    ? payload.bugs.filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX_DOWNLOADS)
    : []
  if (typeof workspaceId !== 'string' || !SAFE_NAME.test(workspaceId)) {
    throw bad('Invalid workspace')
  }
  if (typeof batch !== 'string' || !SAFE_NAME.test(batch)) throw bad('Invalid batch name')
  if (typeof prompt !== 'string' || !prompt.trim()) throw bad('Missing prompt')
  if (!Array.isArray(downloads) || downloads.length > MAX_DOWNLOADS) throw bad('Invalid downloads')
  for (const d of downloads) {
    if (
      typeof d?.file !== 'string' ||
      !SAFE_NAME.test(d.file) ||
      d.file.includes('..') ||
      isReservedName(d.file)
    ) {
      throw bad('Invalid file name')
    }
    if (typeof d.url !== 'string' || !isAllowedDownload(d.url, DOWNLOAD_HOSTS)) {
      throw bad('Screenshot URLs must be https links to Supabase storage or SQUASH_DOWNLOAD_HOSTS')
    }
  }
  return {
    workspaceId,
    name: workspaceName(payload.workspaceName),
    batch,
    bugs,
    prompt,
    downloads,
  }
}

/** Fetches a screenshot, following redirects only to allowed hosts. */
export async function fetchAllowed(url, extraHosts = DOWNLOAD_HOSTS, fetchImpl = fetch) {
  const signal = AbortSignal.timeout(30_000)
  let current = url
  for (let hop = 0; ; hop++) {
    if (!isAllowedDownload(current, extraHosts)) throw bad('Screenshot URL host not allowed')
    const res = await fetchImpl(current, { signal, redirect: 'manual' })
    if (res.status < 300 || res.status >= 400) return res
    await res.body?.cancel().catch(() => {})
    const location = res.headers.get('location')
    if (!location || hop >= MAX_REDIRECTS) {
      throw new Error(`Screenshot download failed (${res.status})`)
    }
    current = new URL(location, current).href
  }
}

async function download(url, dest) {
  const res = await fetchAllowed(url)
  if (!res.ok) {
    await res.body?.cancel().catch(() => {})
    throw new Error(`Screenshot download failed (${res.status})`)
  }
  await writePrivate(dest, await readCapped(res, MAX_IMAGE))
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

// ── Runner ───────────────────────────────────────────────────────────────────────────────────
// `node claude-bridge.mjs --run <batch folder>`, started in the project folder: runs Claude Code
// headless on the batch's prompt (its hooks still report progress), prints what it does, then
// records the result for Squash and exits.

/** One terminal line per tool call. */
function toolLine(block) {
  return `  • ${describeTool(block.name, block.input ?? {}, process.cwd())}`
}

async function runBatch(batchDir, runId) {
  // The bridge counts this run as running while this process is alive.
  if (RUN_ID.test(runId ?? '')) {
    await writePrivate(runnerPidFile(batchDir, runId), String(process.pid), { flag: 'wx' })
  }
  const { args = [], usage: usageMeta = null } = (await readJson(join(batchDir, RUN_FILE))) ?? {}
  const prompt = await readFile(join(batchDir, 'prompt.md'), 'utf8')
  const log = createWriteStream(join(batchDir, 'claude.log'), { flags: 'a', mode: FILE_MODE })
  closeOwnWindow()
  console.log(`Squash → Claude Code in ${process.cwd()}`)
  console.log('Running unattended. This window closes on its own when Claude is done.\n')
  const startedAt = new Date().toISOString()
  const start = await startSha(process.cwd())

  const settings = join(batchDir, 'settings.json')
  const child = spawn(
    'claude',
    ['-p', '--output-format', 'stream-json', '--verbose', '--settings', settings, ...args],
    { stdio: ['pipe', 'pipe', 'inherit'] },
  )
  const exited = new Promise((ok) => {
    child.on('close', (code) => ok(code))
    child.on('error', (err) => {
      console.error(`✗ Could not start claude: ${err.message}`)
      ok(null)
    })
  })
  child.stdin.on('error', () => {})
  child.stdin.end(prompt)
  // Claude's final reply (the stream's closing `result` event): the answer to a question.
  let answer = ''
  let usage = null
  for await (const line of createInterface({ input: child.stdout })) {
    log.write(line + '\n')
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (event.type === 'result' && typeof event.result === 'string') answer = event.result.trim()
    if (event.type === 'result') usage = runUsage(event)
    if (event.type === 'rate_limit_event') {
      const limits = parseLimits(event)
      if (limits) await writePrivate(LIMITS_FILE, JSON.stringify(limits) + '\n').catch(() => {})
    }
    if (event.type !== 'assistant') continue
    for (const block of event.message?.content ?? []) {
      if (block.type === 'text' && block.text.trim()) console.log(`\n${block.text.trim()}\n`)
      if (block.type === 'tool_use') console.log(toolLine(block))
    }
  }
  const exitCode = await exited
  log.end()

  const result = await readJson(join(batchDir, RESULT_FILE))
  const git = await collectGitReport(process.cwd(), start, { startedAt })
  const t = new Date().toISOString()
  // Close the run even if Claude exits without its SessionEnd hook.
  await appendFile(join(batchDir, 'events.jsonl'), JSON.stringify({ t, kind: 'end' }) + '\n', {
    mode: FILE_MODE,
  })
  await writePrivate(
    join(batchDir, DONE_FILE),
    JSON.stringify({
      exitCode,
      result,
      git,
      answer: clip(answer, MAX_ANSWER),
      usage,
      finishedAt: t,
    }),
  )
  if (usage && usageMeta?.workspaceId) {
    const entry = {
      id: basename(batchDir),
      workspaceId: usageMeta.workspaceId,
      kind: usageMeta.kind === 'question' ? 'question' : 'fix',
      bugs: Array.isArray(usageMeta.bugs) ? usageMeta.bugs : [],
      finishedAt: t,
      ...usage,
    }
    await appendFile(USAGE_FILE, JSON.stringify(entry) + '\n', { mode: FILE_MODE }).catch(() => {})
  }
  console.log(
    result
      ? '\n✓ Done. Squash will update the bugs. Closing this window…'
      : `\n✗ Claude finished without a result (exit ${exitCode}). Closing this window…`,
  )
}

// ── Usage ────────────────────────────────────────────────────────────────────────────────────

const count = (n) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0)

/** What a run used, from the closing `result` event of `claude -p --output-format stream-json`. */
export function runUsage(result) {
  const u = result?.usage ?? {}
  const input = count(u.input_tokens)
  const output = count(u.output_tokens)
  const cacheRead = count(u.cache_read_input_tokens)
  const cacheWrite = count(u.cache_creation_input_tokens)
  const cost = Number(result?.total_cost_usd)
  return {
    tokens: input + output + cacheRead + cacheWrite,
    input,
    output,
    cacheRead,
    cacheWrite,
    costUsd: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 10_000) / 10_000 : 0,
    turns: count(result?.num_turns),
    durationMs: count(result?.duration_ms),
    models: Object.keys(result?.modelUsage ?? {})
      .filter((m) => typeof m === 'string' && m.length <= 100)
      .slice(0, 5),
  }
}

const utilization = (window) => {
  const used = Number(window?.utilization)
  const resets = Number(window?.resetsAt)
  if (!Number.isFinite(used)) return null
  return {
    // 0..1 in the event; a percentage here.
    usedPercent: Math.min(100, Math.max(0, Math.round(used * 1000) / 10)),
    resetsAt: Number.isFinite(resets) && resets > 0 ? new Date(resets * 1000).toISOString() : null,
  }
}

/**
 * Plan limits from a stream-json `rate_limit_event` (Claude subscriptions only): how much of the
 * 5-hour and weekly windows is used and when each resets. Null when the event carries none.
 */
export function parseLimits(event, now = new Date()) {
  const info = event?.rate_limit_info
  if (!info || typeof info !== 'object') return null
  const windows = info.unifiedWindows ?? {}
  const fiveHour = utilization(windows.five_hour)
  const sevenDay = utilization(windows.seven_day)
  if (!fiveHour && !sevenDay) return null
  return {
    fiveHour,
    sevenDay,
    status: ['allowed', 'allowed_warning', 'rejected'].includes(info.status) ? info.status : null,
    updatedAt: now.toISOString(),
  }
}

/**
 * A workspace's usage from the ledger's entries (oldest first, as appended): totals over every run,
 * the newest `limit` runs, and the account's latest plan limits.
 */
export function summarizeUsage(entries, workspaceId, limits = null, limit = USAGE_RUNS) {
  const total = { runs: 0, tokens: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 }
  const runs = []
  for (const e of entries) {
    if (e?.workspaceId !== workspaceId) continue
    total.runs++
    for (const key of ['tokens', 'input', 'output', 'cacheRead', 'cacheWrite', 'costUsd']) {
      total[key] += Number.isFinite(e[key]) ? e[key] : 0
    }
    runs.push({
      id: String(e.id ?? ''),
      kind: e.kind === 'question' ? 'question' : 'fix',
      bugs: Array.isArray(e.bugs) ? e.bugs.filter(Number.isInteger) : [],
      finishedAt: typeof e.finishedAt === 'string' ? e.finishedAt : null,
      tokens: count(e.tokens),
      costUsd: Number.isFinite(e.costUsd) ? e.costUsd : 0,
      turns: count(e.turns),
      durationMs: count(e.durationMs),
      models: Array.isArray(e.models) ? e.models.filter((m) => typeof m === 'string') : [],
    })
  }
  total.costUsd = Math.round(total.costUsd * 10_000) / 10_000
  return { limits, total, runs: runs.reverse().slice(0, limit) }
}

async function workspaceUsage(workspaceId) {
  let entries = []
  try {
    entries = (await readFile(USAGE_FILE, 'utf8')).split('\n').flatMap((line) => {
      try {
        return line ? [JSON.parse(line)] : []
      } catch {
        return []
      }
    })
  } catch {
    // No runs recorded yet.
  }
  return summarizeUsage(entries, workspaceId, await readJson(LIMITS_FILE))
}

// ── Proof of fix ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs `file` with a fixed argv (no shell) in `cwd`; resolves its trimmed stdout, or null when it is
 * missing, fails, times out or prints too much. Never rejects and never prompts.
 */
export function execQuiet(file, args, { cwd, timeout = GIT_TIMEOUT_MS } = {}) {
  return new Promise((ok) => {
    try {
      execFile(
        file,
        args,
        {
          cwd,
          timeout,
          maxBuffer: MAX_CMD_OUTPUT,
          windowsHide: true,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
            GIT_OPTIONAL_LOCKS: '0',
            GH_PROMPT_DISABLED: '1',
            GH_NO_UPDATE_NOTIFIER: '1',
            NO_COLOR: '1',
          },
        },
        (err, stdout) => ok(err ? null : String(stdout).trim()),
      )
    } catch {
      ok(null)
    }
  })
}

/** A full lower-case commit sha, or null. */
export function parseSha(text) {
  const t = typeof text === 'string' ? text.trim().toLowerCase() : ''
  return FULL_SHA.test(t) ? t : null
}

/** A branch name safe to store and show (not detached HEAD, no spaces or control characters), or null. */
export function parseBranch(text) {
  const t = typeof text === 'string' ? text.trim() : ''
  return t !== 'HEAD' && BRANCH_NAME.test(t) ? t : null
}

/** `git diff --shortstat` output as counts. Empty output means nothing changed; anything else is null. */
export function parseShortstat(text) {
  if (typeof text !== 'string') return null
  const t = text.trim()
  if (!t) return { filesChanged: 0, additions: 0, deletions: 0 }
  const m =
    /^(\d{1,9}) files? changed(?:, (\d{1,9}) insertions?\(\+\))?(?:, (\d{1,9}) deletions?\(-\))?$/.exec(
      t,
    )
  if (!m) return null
  return { filesChanged: Number(m[1]), additions: Number(m[2] ?? 0), deletions: Number(m[3] ?? 0) }
}

/** The https URL from `gh pr view --json url`, or null. */
export function parsePrUrl(text) {
  let url
  try {
    url = JSON.parse(text)?.url
  } catch {
    return null
  }
  return typeof url === 'string' && url.length <= PR_URL_MAX && PR_URL.test(url) ? url : null
}

const headSha = (cwd, run) => run('git', ['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd })

/** HEAD of the git repo at `cwd` when a run begins, or null (not a repo, or no commits yet). */
export async function startSha(cwd, run = execQuiet) {
  return parseSha(await headSha(cwd, run))
}

/**
 * What a run left behind in the repo at `cwd`: the new HEAD, its branch, the diff since `start`
 * and the branch's pull request (when `gh` is installed and finds one). When HEAD is still `start`
 * the run made no commit: commitSha is null, noCommit is true and the diff is empty (zero counts).
 * Null outside a git repo.
 * Every output is validated; a step that fails just leaves its fields null.
 */
export async function collectGitReport(cwd, start, { run = execQuiet, startedAt = null } = {}) {
  const head = parseSha(await headSha(cwd, run))
  if (!head) return null
  const begin = parseSha(start)
  // HEAD did not move: the run made no commit, and the old HEAD is no proof of anything.
  const noCommit = begin !== null && head === begin
  const branch = parseBranch(
    await run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd }),
  )
  // Both ends are validated full shas, so the range can never be read as an option.
  const stat = begin
    ? parseShortstat(
        await run(
          'git',
          [
            '-c',
            'core.fsmonitor=false',
            'diff',
            '--shortstat',
            '--no-ext-diff',
            '--no-textconv',
            `${begin}..${head}`,
          ],
          { cwd },
        ),
      )
    : null
  // Without a new commit an existing PR on the branch is not this run's work either.
  const prUrl =
    branch && !noCommit
      ? parsePrUrl(
          await run('gh', ['pr', 'view', '--json', 'url'], { cwd, timeout: GH_TIMEOUT_MS }),
        )
      : null
  return {
    startSha: begin,
    commitSha: noCommit ? null : head,
    noCommit,
    branch,
    prUrl,
    filesChanged: stat?.filesChanged ?? null,
    additions: stat?.additions ?? null,
    deletions: stat?.deletions ?? null,
    startedAt,
  }
}

/**
 * AppleScript that closes the Terminal window holding the tty in argv 1 once its shell has exited
 * (so macOS does not ask to confirm), argv 2 seconds later. The window is found while the runner
 * holds the tty (busy: a finished window keeps showing the tty after it has been reused), then
 * followed by id.
 */
export const CLOSE_OWN_WINDOW_SCRIPT = [
  'on run argv',
  'set myTty to item 1 of argv',
  'set myWindow to missing value',
  'tell application "Terminal"',
  'repeat with w in windows',
  'repeat with t in tabs of w',
  'if tty of t is myTty and busy of t then set myWindow to id of w',
  'end repeat',
  'end repeat',
  'end tell',
  'if myWindow is missing value then return',
  // Runs can take hours; give up after a day.
  'repeat 43200 times',
  'tell application "Terminal"',
  'set matches to (every window whose id is myWindow and visible is true)',
  'if matches is {} then return',
  'set finished to not (busy of selected tab of (item 1 of matches))',
  'end tell',
  'if finished then',
  'delay ((item 2 of argv) as number)',
  'tell application "Terminal"',
  'set matches to (every window whose id is myWindow and visible is true)',
  'if matches is not {} then close (item 1 of matches)',
  'end tell',
  'return',
  'end if',
  'delay 2',
  'end repeat',
  'end run',
]

/**
 * Closes this run's Terminal window when the run ends, however it ends. A detached osascript
 * watches the window, so it outlives the runner and does not depend on the bridge (which may
 * restart mid-run); the window is matched by this process's tty, which, unlike the window id the
 * bridge saw at launch, cannot mix up when several runs open at once.
 */
function closeOwnWindow() {
  if (!MAC || !process.stdout.isTTY) return
  let tty
  try {
    tty = execFileSync('tty', { stdio: ['inherit', 'pipe', 'ignore'], encoding: 'utf8' }).trim()
  } catch {
    return
  }
  if (!/^\/dev\/ttys\d+$/.test(tty)) return
  const args = [...CLOSE_OWN_WINDOW_SCRIPT.flatMap((l) => ['-e', l]), tty, String(CLOSE_AFTER_S)]
  spawn('osascript', args, { detached: true, stdio: 'ignore' }).unref()
}

/**
 * AppleScript that opens a run's Terminal window without taking focus: Terminal is never activated,
 * and whatever app was in front (the browser with Squash) is brought back in case launching
 * Terminal pulled it forward. Returns the new window's id.
 */
export const BACKGROUND_TERMINAL_SCRIPT = [
  'on run argv',
  'set previous to path to frontmost application as text',
  'tell application "Terminal"',
  'do script (item 1 of argv)',
  // do script opens the new window first among Terminal's own windows.
  'set newWindow to id of front window',
  'end tell',
  'if previous does not contain "Terminal" then',
  'try',
  'tell application previous to activate',
  'end try',
  'end if',
  'return newWindow',
  'end run',
]

/**
 * Runs Claude Code on the batch: in a new background Terminal window on macOS, headless elsewhere
 * and for questions (`headless`), whose answers show in Squash instead.
 */
async function launch(
  folder,
  batchDir,
  runId,
  { args = CLAUDE_ARGS, headless = false, usage = null } = {},
) {
  await writePrivate(
    join(batchDir, 'settings.json'),
    JSON.stringify(hookSettings(batchDir), null, 2) + '\n',
  )
  // `usage` says whose run this is ({ workspaceId, kind, bugs }), for the usage ledger.
  await writePrivate(join(batchDir, RUN_FILE), JSON.stringify({ args, usage }))
  if (MAC && !headless) {
    const command = `cd ${sh(folder)} && ${sh(process.execPath)} ${sh(SCRIPT)} --run ${sh(batchDir)} ${runId}; exit`
    await osascript(BACKGROUND_TERMINAL_SCRIPT, [command])
    return
  }
  const log = openSync(join(batchDir, 'runner.log'), 'a', FILE_MODE)
  const child = spawn(process.execPath, [SCRIPT, '--run', batchDir, runId], {
    cwd: folder,
    detached: true,
    stdio: ['ignore', log, log],
  })
  child.unref()
  console.log(`  running headless; output in ${join(batchDir, 'claude.log')}`)
}

/** A launched run holds its slot while its runner process is alive. */
const limiter = createLaunchLimiter({
  isRunning: (run, msSinceLaunch) => runnerLive(run.pidFile, msSinceLaunch),
})

/** Runs sent while every slot was taken; each starts when one frees up. */
const runQueue = createRunQueue({
  acquire: () => limiter.acquire(),
  start: (job, slot) => void startQueued(job, slot),
})

/** Launches a recorded run in the slot reserved for it. */
async function startRun(run, name, slot) {
  const runId = randomBytes(16).toString('hex')
  slot.track({ pidFile: runnerPidFile(run.dir, runId) })
  await launch(run.folder, run.dir, runId, { usage: run.usage })
  console.log(`→ ${name}: Claude Code started in ${run.folder}`)
}

async function startQueued({ run, name }, slot) {
  try {
    const started = { ...run, queued: false, startedAt: new Date().toISOString() }
    await recordRun(started)
    await startRun(started, name, slot)
  } catch (err) {
    slot.release()
    await recordRun({ ...run, queued: false, failed: true }).catch(() => {})
    console.error(
      `✗ ${name}: queued run failed to start:`,
      err instanceof Error ? err.message : err,
    )
  }
}

/** Queues the runs a previous bridge left waiting, oldest first. */
async function requeueRuns() {
  const waiting = (await loadRuns()).filter((r) => r.queued).reverse()
  for (const run of waiting) {
    if (existsSync(join(run.dir, 'prompt.md')) && runQueue.add({ run, name: run.name ?? 'Squash' }))
      continue
    await recordRun({ ...run, queued: false, failed: true })
  }
  if (waiting.length) console.log(`  ${runQueue.size} queued run(s) waiting for a slot`)
  runQueue.drain()
}

async function handleSend(payload) {
  const { workspaceId, name, batch, bugs, prompt, downloads } = validateSend(payload)
  // Reserve before any await so concurrent requests cannot overshoot the limits. Runs already
  // waiting go first: a new one only starts straight away when none are.
  const slot = runQueue.size === 0 ? limiter.acquire() : null
  if (!slot && runQueue.size >= MAX_QUEUED) throw new HttpError(429, 'busy', 'busy')
  try {
    const folder = await folderFor(workspaceId, name)
    const root = join(folder, '.squash')
    const batchDir = join(root, 'bugs', batch)
    await mkdirPrivate(root)
    await mkdirPrivate(batchDir)
    // Keep exported bugs out of git without touching the project's own .gitignore.
    await writeFile(join(root, '.gitignore'), '*\n')
    await Promise.all(downloads.map((d) => download(d.url, join(batchDir, d.file))))
    await writePrivate(join(batchDir, 'prompt.md'), prompt)
    const run = {
      id: batch,
      workspaceId,
      name,
      bugs,
      folder,
      dir: batchDir,
      startedAt: new Date().toISOString(),
      usage: { workspaceId, kind: 'fix', bugs },
    }
    if (!slot) {
      // Recorded before it joins the queue, so starting it always overwrites the queued record.
      await recordRun({ ...run, queued: true })
      if (!runQueue.add({ run, name })) {
        await recordRun({ ...run, failed: true })
        throw new HttpError(429, 'busy', 'busy')
      }
      const ahead = runQueue.size - 1
      console.log(`… ${name}: queued until a run finishes (${ahead} ahead)`)
      return { ok: true, folder, queued: true, ahead }
    }
    await recordRun(run)
    await startRun(run, name, slot)
    return { ok: true, folder }
  } catch (err) {
    // Nothing is running if it failed before (or while) starting Claude.
    slot?.release()
    throw err
  }
}

async function handleSetFolder(workspaceId, payload) {
  const name = workspaceName(payload.workspaceName)
  let folder
  if (typeof payload.folder === 'string' && payload.folder.trim()) {
    folder = expandHome(payload.folder)
    if (!isAbsolute(folder) || !isDir(folder)) throw bad(`Not a folder: ${folder}`)
  } else {
    folder = await pickFolder(name)
  }
  await saveFolder(workspaceId, name, folder)
  console.log(`✓ ${name} → ${folder}`)
  return { folder }
}

/**
 * Batches launched by helpers before v4, which never recorded runs or wrote done.json: Claude
 * still wrote result.json, but nothing picked it up, so those items were never resolved. Returns
 * the unapplied ones in `bugsDir` (a project's .squash/bugs) whose prompt is for this workspace.
 * A batch with run.json belongs to the runner (it may still be working) and is never adopted.
 */
export async function legacyBatches(bugsDir, workspaceId) {
  let names
  try {
    names = await readdir(bugsDir)
  } catch {
    return []
  }
  const found = []
  for (const name of names.sort()) {
    if (!BATCH_NAME.test(name)) continue
    const dir = join(bugsDir, name)
    const has = (file) => existsSync(join(dir, file))
    if (!has(RESULT_FILE) || has(RUN_FILE) || has(DONE_FILE) || has(CLAIM_FILE)) continue
    let prompt
    try {
      prompt = await readFile(join(dir, 'prompt.md'), 'utf8')
    } catch {
      continue
    }
    if (prompt.includes(`/app/${workspaceId}/`))
      found.push({ id: name, workspaceId, dir, legacy: true })
  }
  return found
}

/** Legacy batches in the workspace's project folder (see legacyBatches). */
async function workspaceLegacyRuns(workspaceId) {
  const folder = (await loadConfig()).workspaces[workspaceId]?.folder ?? DEFAULT_FOLDER
  if (!folder || !isDir(folder)) return []
  return legacyBatches(join(folder, '.squash', 'bugs'), workspaceId)
}

/** The recorded (or legacy) run with this batch name in the workspace, or null. */
async function findRun(workspaceId, batch) {
  const recorded = (await loadRuns()).find((r) => r.id === batch && r.workspaceId === workspaceId)
  if (recorded) return recorded
  return (await workspaceLegacyRuns(workspaceId)).find((r) => r.id === batch) ?? null
}

/** Finished runs in the workspace that no Squash tab has applied yet. */
async function workspaceResults(workspaceId) {
  const results = []
  const recorded = (await loadRuns()).filter((r) => r.workspaceId === workspaceId)
  const ids = new Set(recorded.map((r) => r.id))
  const legacy = (await workspaceLegacyRuns(workspaceId)).filter((r) => !ids.has(r.id))
  for (const run of [...recorded, ...legacy]) {
    if (!run.dir || existsSync(join(run.dir, CLAIM_FILE))) continue
    const done = run.legacy
      ? { exitCode: null, result: await readJson(join(run.dir, RESULT_FILE)), git: null }
      : await readJson(join(run.dir, DONE_FILE))
    if (done)
      results.push({
        batch: run.id,
        exitCode: done.exitCode ?? null,
        result: done.result ?? null,
        git: done.git ?? null,
      })
  }
  return results
}

/** Marks a run as applied. Only the first caller gets claimed: true, so it is applied once. */
async function claimResult(workspaceId, batch) {
  const run = await findRun(workspaceId, batch)
  if (!run?.dir || !existsSync(join(run.dir, run.legacy ? RESULT_FILE : DONE_FILE))) {
    throw new HttpError(404, 'not_found', 'No such finished run')
  }
  try {
    await writePrivate(join(run.dir, CLAIM_FILE), new Date().toISOString(), { flag: 'wx' })
    return { claimed: true }
  } catch (err) {
    if (err?.code === 'EEXIST') return { claimed: false }
    throw err
  }
}

/**
 * An after screenshot Claude saved in a run's batch folder: a plain image file (never a symlink),
 * named in SCREENSHOT_FILE form, not one of the bridge's own files, at most MAX_SCREENSHOT bytes.
 */
export async function readScreenshot(dir, file) {
  if (typeof file !== 'string' || !SCREENSHOT_FILE.test(file) || isReservedName(file)) {
    throw bad('Invalid screenshot name')
  }
  const path = join(dir, file)
  let info
  try {
    info = await lstat(path)
  } catch {
    throw new HttpError(404, 'not_found', 'No such screenshot')
  }
  if (!info.isFile()) throw new HttpError(404, 'not_found', 'No such screenshot')
  if (info.size > MAX_SCREENSHOT) throw new HttpError(413, 'too_large', 'Screenshot too large')
  const data = await readFile(path)
  const ext = file.split('.').pop().toLowerCase()
  return { data, type: IMAGE_TYPES[ext] }
}

async function sendScreenshot(res, workspaceId, batch, file, origin) {
  const run = await findRun(workspaceId, batch)
  if (!run?.dir) throw new HttpError(404, 'not_found', 'No such run')
  const { data, type } = await readScreenshot(run.dir, file)
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  })
  res.end(data)
}

/** Validates a new project request: the workspace, a plain folder name and an optional parent. */
export function validateProject(payload) {
  const { workspaceId, name, parent } = payload ?? {}
  if (typeof workspaceId !== 'string' || !SAFE_NAME.test(workspaceId)) {
    throw bad('Invalid workspace')
  }
  if (typeof name !== 'string' || !PROJECT_NAME.test(name) || name.includes('..')) {
    throw bad('Use letters, numbers, dots, dashes and underscores for the folder name')
  }
  if (parent !== undefined && parent !== null && typeof parent !== 'string') {
    throw bad('Invalid parent folder')
  }
  return {
    workspaceId,
    workspaceName: workspaceName(payload.workspaceName),
    name,
    parent: typeof parent === 'string' && parent.trim() ? parent : null,
  }
}

/**
 * Creates a new project's folder: `<parent>/<name>`, empty, a git repo on `main`, and maps the
 * workspace to it so its runs open there. An existing folder is used only when it is empty.
 */
async function handleProject(payload) {
  const { workspaceId, workspaceName: label, name, parent: typed } = validateProject(payload)
  const parent = typed ? expandHome(typed) : await pickParent(name)
  if (!isAbsolute(parent) || !isDir(parent)) throw bad(`Not a folder: ${parent}`)
  const folder = join(parent, name)
  if (basename(folder) !== name) throw bad('Invalid folder name')
  if (existsSync(folder)) {
    if (!isDir(folder) || (await readdir(folder)).length > 0) {
      throw new HttpError(409, 'exists', `${folder} already exists and is not empty`)
    }
  } else {
    await mkdir(folder)
  }
  if ((await execQuiet('git', ['init', '-b', 'main'], { cwd: folder })) === null) {
    // Older git has no -b: init, then point HEAD at main.
    await execQuiet('git', ['init'], { cwd: folder })
    await execQuiet('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: folder })
  }
  await saveFolder(workspaceId, label, folder)
  console.log(`✓ New project ${label} → ${folder}`)
  return { folder }
}

// ── Questions ────────────────────────────────────────────────────────────────────────────────

/** A file the person attached to a question, by the name Squash gives it in the question folder. */
const ASK_FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}$/

/** Validates a question: its id, the text, item screenshots to download and attached files. */
export function validateAsk(payload) {
  const { id, question, prompt } = payload ?? {}
  const sent = validateSend({ ...payload, batch: id, downloads: payload?.downloads ?? [] })
  if (typeof question !== 'string' || !question.trim()) throw bad('Missing question')
  if (question.length > MAX_QUESTION) throw bad('Question too long')
  if (typeof prompt !== 'string' || !prompt.trim()) throw bad('Missing prompt')
  const files = payload.files ?? []
  if (!Array.isArray(files) || files.length > MAX_ASK_FILES) throw bad('Too many files')
  const names = new Set(sent.downloads.map((d) => d.file))
  const decoded = files.map((f) => {
    if (
      typeof f?.name !== 'string' ||
      !ASK_FILE.test(f.name) ||
      f.name.includes('..') ||
      isReservedName(f.name) ||
      names.has(f.name)
    ) {
      throw bad('Invalid file name')
    }
    names.add(f.name)
    if (typeof f.data !== 'string') throw bad('Invalid file')
    const data = Buffer.from(f.data, 'base64')
    if (data.length > MAX_ASK_FILE) throw bad(`${f.name} is too large`)
    return { name: f.name, data }
  })
  return { ...sent, id: sent.batch, question: question.trim(), files: decoded }
}

async function loadQuestions() {
  try {
    const list = JSON.parse(await readFile(QUESTIONS_FILE, 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

async function saveQuestions(list) {
  await mkdirPrivate(CONFIG_DIR)
  await writePrivate(QUESTIONS_FILE, JSON.stringify(list.slice(0, MAX_QUESTIONS), null, 2) + '\n')
}

/**
 * A question as Squash shows it: `working` (with what Claude is doing), `answered` (with the
 * answer) or `failed` (Claude exited without one, or its runner never started or died).
 */
export function summarizeQuestion(meta, events, done, live) {
  const base = {
    id: meta.id,
    question: meta.question,
    bugs: meta.bugs ?? [],
    files: meta.files ?? [],
    askedAt: meta.askedAt,
  }
  if (done) {
    const answer = typeof done.answer === 'string' ? done.answer.trim() : ''
    return answer
      ? { ...base, state: 'answered', answer, finishedAt: done.finishedAt ?? null }
      : {
          ...base,
          state: 'failed',
          error: `Claude finished without an answer (exit ${done.exitCode ?? 'unknown'}).`,
          finishedAt: done.finishedAt ?? null,
        }
  }
  if (!live) return { ...base, state: 'failed', error: 'Claude stopped before answering.' }
  const run = summarizeRun({ id: meta.id, startedAt: meta.askedAt }, events)
  return { ...base, state: 'working', activity: run.activity ?? 'Starting' }
}

async function workspaceQuestions(workspaceId) {
  const list = (await loadQuestions()).filter((q) => q.workspaceId === workspaceId)
  return Promise.all(
    list.map(async (q) => {
      const done = await readJson(join(q.dir, DONE_FILE))
      const since = Date.now() - Date.parse(q.askedAt)
      const live = done ? true : runnerLive(runnerPidFile(q.dir, q.runId), since)
      return summarizeQuestion(q, done ? [] : await readEvents(q.dir), done, live)
    }),
  )
}

/** Starts a read-only, headless Claude Code run that answers a question about the project. */
async function handleAsk(workspaceIdFromPath, payload) {
  const ask = validateAsk({ ...payload, workspaceId: workspaceIdFromPath })
  const slot = limiter.acquire()
  if (!slot) throw new HttpError(429, 'busy', 'busy')
  try {
    const folder = await folderFor(ask.workspaceId, ask.name)
    const root = join(folder, '.squash')
    const dir = join(root, 'questions', ask.id)
    await mkdirPrivate(root)
    await mkdirPrivate(join(root, 'questions'))
    await mkdirPrivate(dir)
    await writeFile(join(root, '.gitignore'), '*\n')
    await Promise.all(ask.downloads.map((d) => download(d.url, join(dir, d.file))))
    await Promise.all(ask.files.map((f) => writePrivate(join(dir, f.name), f.data)))
    await writePrivate(join(dir, 'prompt.md'), ask.prompt)
    const runId = randomBytes(16).toString('hex')
    const record = {
      id: ask.id,
      workspaceId: ask.workspaceId,
      question: clip(ask.question, MAX_QUESTION),
      bugs: ask.bugs,
      files: ask.files.map((f) => f.name),
      folder,
      dir,
      runId,
      askedAt: new Date().toISOString(),
    }
    await saveQuestions([record, ...(await loadQuestions()).filter((q) => q.id !== ask.id)])
    slot.track({ pidFile: runnerPidFile(dir, runId) })
    await launch(folder, dir, runId, {
      args: askArgs(),
      headless: true,
      usage: { workspaceId: ask.workspaceId, kind: 'question', bugs: ask.bugs },
    })
    console.log(`? ${ask.name}: Claude Code is answering a question in ${folder}`)
    return { ok: true, id: ask.id }
  } catch (err) {
    slot.release()
    throw err
  }
}

/** Removes a question (and its answer) from the workspace's list. */
async function forgetQuestion(workspaceId, id) {
  const list = await loadQuestions()
  const kept = list.filter((q) => !(q.id === id && q.workspaceId === workspaceId))
  if (kept.length === list.length) throw new HttpError(404, 'not_found', 'No such question')
  await saveQuestions(kept)
  return { ok: true }
}

function serve() {
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin?.replace(/\/$/, '')
    const allowed = origin !== undefined && ORIGINS.has(origin)

    if (req.method === 'OPTIONS') {
      if (!allowed) return send(res, 403, { error: 'Origin not allowed' })
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Private-Network': 'true',
        'Access-Control-Allow-Local-Network': 'true',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      })
      return res.end()
    }
    // Only the Squash app may talk to the bridge: any other site could otherwise start Claude here.
    if (!allowed) return send(res, 403, { error: 'Origin not allowed' })

    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname
      const folderRoute = /^\/workspaces\/([A-Za-z0-9_-]{1,80})\/folder$/.exec(path)
      const runsRoute = /^\/workspaces\/([A-Za-z0-9_-]{1,80})\/runs$/.exec(path)
      const resultsRoute = /^\/workspaces\/([A-Za-z0-9_-]{1,80})\/results$/.exec(path)
      const claimRoute =
        /^\/workspaces\/([A-Za-z0-9_-]{1,80})\/results\/([A-Za-z0-9_.-]{1,80})\/claim$/.exec(path)
      const fileRoute =
        /^\/workspaces\/([A-Za-z0-9_-]{1,80})\/results\/([A-Za-z0-9_.-]{1,80})\/files\/([A-Za-z0-9_.-]{1,84})$/.exec(
          path,
        )
      const usageRoute = /^\/workspaces\/([A-Za-z0-9_-]{1,80})\/usage$/.exec(path)
      const questionsRoute = /^\/workspaces\/([A-Za-z0-9_-]{1,80})\/questions$/.exec(path)
      const forgetRoute =
        /^\/workspaces\/([A-Za-z0-9_-]{1,80})\/questions\/([A-Za-z0-9_.-]{1,80})\/forget$/.exec(
          path,
        )
      if (req.method === 'GET' && path === '/health') {
        return send(res, 200, { ok: true, version: VERSION, platform: process.platform }, origin)
      }
      if (req.method === 'GET' && folderRoute) {
        const saved = (await loadConfig()).workspaces[folderRoute[1]]?.folder ?? DEFAULT_FOLDER
        return send(res, 200, { folder: saved }, origin)
      }
      if (req.method === 'GET' && runsRoute) {
        return send(res, 200, { runs: await workspaceRuns(runsRoute[1]) }, origin)
      }
      if (req.method === 'GET' && resultsRoute) {
        return send(res, 200, { runs: await workspaceResults(resultsRoute[1]) }, origin)
      }
      if (req.method === 'GET' && fileRoute) {
        return await sendScreenshot(res, fileRoute[1], fileRoute[2], fileRoute[3], origin)
      }
      if (req.method === 'GET' && usageRoute) {
        return send(res, 200, await workspaceUsage(usageRoute[1]), origin)
      }
      if (req.method === 'GET' && questionsRoute) {
        return send(res, 200, { questions: await workspaceQuestions(questionsRoute[1]) }, origin)
      }
      if (req.method === 'POST' && questionsRoute) {
        const body = await readBody(req, MAX_ASK_BODY)
        return send(res, 200, await handleAsk(questionsRoute[1], body), origin)
      }
      if (req.method === 'POST' && forgetRoute) {
        return send(res, 200, await forgetQuestion(forgetRoute[1], forgetRoute[2]), origin)
      }
      if (req.method === 'POST' && path === '/projects') {
        return send(res, 200, await handleProject(await readBody(req)), origin)
      }
      if (req.method === 'POST' && claimRoute) {
        return send(res, 200, await claimResult(claimRoute[1], claimRoute[2]), origin)
      }
      if (req.method === 'POST' && folderRoute) {
        return send(res, 200, await handleSetFolder(folderRoute[1], await readBody(req)), origin)
      }
      if (req.method === 'POST' && path === '/claude') {
        return send(res, 200, await handleSend(await readBody(req)), origin)
      }
      return send(res, 404, { error: 'Not found' }, origin)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Failed'
      console.error('✗', message)
      return send(res, status, { error: message, code: err?.code }, origin)
    }
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is busy: the Squash bridge is probably already running.`)
      process.exit(1)
    }
    throw err
  })

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Squash → Claude bridge v${VERSION} on http://127.0.0.1:${PORT}`)
    console.log(`  folders: ${DEFAULT_FOLDER ?? `per workspace, saved in ${CONFIG_FILE}`}`)
    console.log(`  origins: ${[...ORIGINS].join(', ')}`)
    console.log('Leave this running, then press "Send to Claude" in Squash.')
    void requeueRuns()
  })
  setInterval(() => runQueue.drain(), QUEUE_POLL_MS).unref()
}

function isMain() {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(SCRIPT)
  } catch {
    return false
  }
}

if (isMain()) {
  if (HOOK) {
    // A broken progress report must never interrupt Claude: swallow everything, exit 0.
    await runHook(resolve(process.argv[3] ?? '.')).catch(() => {})
    process.exit(0)
  }
  if (RUNNER) {
    await runBatch(resolve(process.argv[3] ?? '.'), process.argv[4]).catch((err) => {
      console.error('✗', err instanceof Error ? err.message : err)
      process.exitCode = 1
    })
    process.exit()
  }
  // Tighten files left readable by older versions of the bridge.
  await mkdirPrivate(CONFIG_DIR)
  for (const file of [CONFIG_FILE, RUNS_FILE, USAGE_FILE, LIMITS_FILE]) {
    if (existsSync(file)) await chmod(file, FILE_MODE)
  }
  serve()
}
