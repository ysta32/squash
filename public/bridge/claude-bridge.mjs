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
// SQUASH_CLAUDE_ARGS (extra `claude` flags; the permission mode defaults to "auto", override it
// with e.g. "--permission-mode acceptEdits"), SQUASH_DOWNLOAD_HOSTS (comma-separated extra hosts
// screenshots may be downloaded from), SQUASH_SUPABASE_HOST (this app's Supabase project host).
import { execFile, spawn } from 'node:child_process'
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
import { appendFile, chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const VERSION = 8
const SCRIPT = fileURLToPath(import.meta.url)
const PORT = Number(process.env.SQUASH_BRIDGE_PORT ?? 4317)
const HOOK = process.argv[2] === '--hook'
const RUNNER = process.argv[2] === '--run'
const DEFAULT_FOLDER = process.argv[2] && !HOOK && !RUNNER ? resolve(process.argv[2]) : null
const CONFIG_DIR = join(homedir(), '.squash')
const CONFIG_FILE = join(CONFIG_DIR, 'bridge.json')
const RUNS_FILE = join(CONFIG_DIR, 'runs.json')
const MAX_RUNS = 50
const RUNS_PER_WORKSPACE = 10
const MAX_TEXT = 2000
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
// Runs ship their work (commit and push), so those git commands never wait on a permission prompt
// nobody is there to answer. Force-pushes stay blocked.
const SHIP_TOOLS = [
  '--allowedTools=Bash(git add:*),Bash(git commit:*),Bash(git push:*)',
  '--disallowedTools=Bash(git push --force:*),Bash(git push -f:*)',
]
const CLAUDE_ARGS = [
  ...(EXTRA_ARGS.some((a) => a.startsWith('--permission-mode'))
    ? EXTRA_ARGS
    : ['--permission-mode', 'auto', ...EXTRA_ARGS]),
  ...SHIP_TOOLS,
]
const MAC = process.platform === 'darwin'
const MAX_BODY = 1024 * 1024
const MAX_IMAGE = 15 * 1024 * 1024
const MAX_DOWNLOADS = 100
const SAFE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}$/
const DOWNLOAD_HOSTS = parseHosts(process.env.SQUASH_DOWNLOAD_HOSTS)
const MAX_REDIRECTS = 3
// Launch limits: claude runs at once, and launches per window.
const MAX_RUNNING = 3
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
const CLOSE_AFTER_MS = 4000
// Proof of fix: git and gh run with fixed argv (never a shell) and these limits.
const GIT_TIMEOUT_MS = 10_000
const GH_TIMEOUT_MS = 10_000
const MAX_CMD_OUTPUT = 64 * 1024
const FULL_SHA = /^[0-9a-f]{40}$/
const BRANCH_NAME = /^[^\s\p{Cc}-][^\s\p{Cc}]{0,254}$/u
const PR_URL = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?\/[!-~]*$/
const PR_URL_MAX = 500

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
  let state = 'starting'
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
    .slice(0, RUNS_PER_WORKSPACE)
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

function readBody(req) {
  return new Promise((ok, fail) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
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
  const { args = [] } = (await readJson(join(batchDir, RUN_FILE))) ?? {}
  const prompt = await readFile(join(batchDir, 'prompt.md'), 'utf8')
  const log = createWriteStream(join(batchDir, 'claude.log'), { flags: 'a', mode: FILE_MODE })
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
  for await (const line of createInterface({ input: child.stdout })) {
    log.write(line + '\n')
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
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
    JSON.stringify({ exitCode, result, git, finishedAt: t }),
  )
  console.log(
    result
      ? '\n✓ Done. Squash will update the bugs. Closing this window…'
      : `\n✗ Claude finished without a result (exit ${exitCode}). Closing this window…`,
  )
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

/** Closes a Terminal window once its shell has exited, so macOS does not ask to confirm. */
async function closeWindow(windowId) {
  for (let i = 0; i < 30; i++) {
    const state = await osascript(
      [
        'on run argv',
        'tell application "Terminal"',
        'set matches to (every window whose id is ((item 1 of argv) as integer))',
        'if matches is {} then return "gone"',
        'set w to item 1 of matches',
        'if busy of selected tab of w then return "busy"',
        'close w',
        'return "closed"',
        'end tell',
        'end run',
      ],
      [String(windowId)],
    ).catch(() => 'gone')
    if (state !== 'busy') return
    await new Promise((ok) => setTimeout(ok, 1000))
  }
}

/** Closes the run's Terminal window shortly after the runner reports Claude has finished. */
function closeWhenDone(windowId, batchDir) {
  const timer = setInterval(() => {
    if (!existsSync(join(batchDir, DONE_FILE))) return
    clearInterval(timer)
    setTimeout(() => void closeWindow(windowId), CLOSE_AFTER_MS)
  }, 2000)
}

/** Runs Claude Code on the batch: in a new Terminal window on macOS, headless elsewhere. */
async function launch(folder, batchDir, runId) {
  await writePrivate(
    join(batchDir, 'settings.json'),
    JSON.stringify(hookSettings(batchDir), null, 2) + '\n',
  )
  await writePrivate(join(batchDir, RUN_FILE), JSON.stringify({ args: CLAUDE_ARGS }))
  if (MAC) {
    const command = `cd ${sh(folder)} && ${sh(process.execPath)} ${sh(SCRIPT)} --run ${sh(batchDir)} ${runId}; exit`
    const windowId = await osascript(
      [
        'on run argv',
        'tell application "Terminal"',
        'activate',
        'do script (item 1 of argv)',
        // do script opens the new window in front.
        'return id of front window',
        'end tell',
        'end run',
      ],
      [command],
    )
    if (/^\d+$/.test(windowId)) closeWhenDone(Number(windowId), batchDir)
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

async function handleSend(payload) {
  const { workspaceId, name, batch, bugs, prompt, downloads } = validateSend(payload)
  // Reserve before any await so concurrent requests cannot overshoot the limits.
  const slot = limiter.acquire()
  if (!slot) throw new HttpError(429, 'busy', 'busy')
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
    await recordRun({
      id: batch,
      workspaceId,
      bugs,
      folder,
      dir: batchDir,
      startedAt: new Date().toISOString(),
    })
    const runId = randomBytes(16).toString('hex')
    slot.track({ pidFile: runnerPidFile(batchDir, runId) })
    await launch(folder, batchDir, runId)
    console.log(`→ ${name}: Claude Code started in ${folder} (${downloads.length} screenshots)`)
    return { ok: true, folder }
  } catch (err) {
    // Nothing is running if it failed before (or while) starting Claude.
    slot.release()
    throw err
  }
}

async function handleSetFolder(workspaceId, payload) {
  const name = workspaceName(payload.workspaceName)
  let folder
  if (typeof payload.folder === 'string' && payload.folder.trim()) {
    folder = resolve(payload.folder.trim().replace(/^~(?=$|\/)/, homedir()))
    if (!isAbsolute(folder) || !isDir(folder)) throw bad(`Not a folder: ${folder}`)
  } else {
    folder = await pickFolder(name)
  }
  await saveFolder(workspaceId, name, folder)
  console.log(`✓ ${name} → ${folder}`)
  return { folder }
}

/** The recorded run with this batch name in the workspace, or null. */
async function findRun(workspaceId, batch) {
  return (await loadRuns()).find((r) => r.id === batch && r.workspaceId === workspaceId) ?? null
}

/** Finished runs in the workspace that no Squash tab has applied yet. */
async function workspaceResults(workspaceId) {
  const results = []
  for (const run of (await loadRuns()).filter((r) => r.workspaceId === workspaceId)) {
    if (!run.dir || existsSync(join(run.dir, CLAIM_FILE))) continue
    const done = await readJson(join(run.dir, DONE_FILE))
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
  if (!run?.dir || !existsSync(join(run.dir, DONE_FILE))) {
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
  })
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
  for (const file of [CONFIG_FILE, RUNS_FILE]) {
    if (existsSync(file)) await chmod(file, FILE_MODE)
  }
  serve()
}
