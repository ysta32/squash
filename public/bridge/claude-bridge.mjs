// Squash → Claude Code bridge. Receives bugs from the Squash tab, downloads their screenshots
// into the workspace's project folder and opens Claude Code on them in a new terminal.
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
// SQUASH_CLAUDE_ARGS (extra `claude` flags, e.g. "--permission-mode acceptEdits").
import { execFile, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import {
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
} from 'node:fs'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = 3
const SCRIPT = fileURLToPath(import.meta.url)
const PORT = Number(process.env.SQUASH_BRIDGE_PORT ?? 4317)
const HOOK = process.argv[2] === '--hook'
const DEFAULT_FOLDER = process.argv[2] && !HOOK ? resolve(process.argv[2]) : null
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
const MAC = process.platform === 'darwin'
const MAX_BODY = 1024 * 1024
const MAX_IMAGE = 15 * 1024 * 1024
const MAX_DOWNLOADS = 100
const SAFE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}$/

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
  if (event) await appendFile(join(dir, 'events.jsonl'), JSON.stringify(event) + '\n')
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
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(RUNS_FILE, JSON.stringify(runs, null, 2) + '\n')
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
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n')
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
    if (typeof d?.file !== 'string' || !SAFE_NAME.test(d.file) || d.file.includes('..')) {
      throw bad('Invalid file name')
    }
    if (typeof d.url !== 'string' || new URL(d.url).protocol !== 'https:') {
      throw bad('Screenshot URLs must be https')
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

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`Screenshot download failed (${res.status})`)
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length > MAX_IMAGE) throw new Error('Screenshot too large')
  await writeFile(dest, data)
}

/** Opens Claude Code on the prompt: a new Terminal window on macOS, headless elsewhere. */
async function launch(folder, promptFile, batchDir) {
  const settingsFile = join(batchDir, 'settings.json')
  await writeFile(settingsFile, JSON.stringify(hookSettings(batchDir), null, 2) + '\n')
  const args = ['--settings', settingsFile, ...EXTRA_ARGS].map(sh).join(' ')
  if (MAC) {
    const command = `cd ${sh(folder)} && claude ${args} "$(cat ${sh(promptFile)})"`
    await osascript(
      [
        'on run argv',
        'tell application "Terminal"',
        'activate',
        'do script (item 1 of argv)',
        'end tell',
        'end run',
      ],
      [command],
    )
    return
  }
  const log = openSync(join(batchDir, 'claude.log'), 'a')
  const child = spawn('sh', ['-c', `claude -p ${args} "$(cat ${sh(promptFile)})"`], {
    cwd: folder,
    detached: true,
    stdio: ['ignore', log, log],
  })
  // Close the run even if Claude exits without its SessionEnd hook.
  child.on('exit', () => {
    const event = { t: new Date().toISOString(), kind: 'end' }
    appendFile(join(batchDir, 'events.jsonl'), JSON.stringify(event) + '\n').catch(() => {})
  })
  child.unref()
  console.log(`  running headless; output in ${join(batchDir, 'claude.log')}`)
}

async function handleSend(payload) {
  const { workspaceId, name, batch, bugs, prompt, downloads } = validateSend(payload)
  const folder = await folderFor(workspaceId, name)
  const root = join(folder, '.squash')
  const batchDir = join(root, 'bugs', batch)
  await mkdir(batchDir, { recursive: true })
  // Keep exported bugs out of git without touching the project's own .gitignore.
  await writeFile(join(root, '.gitignore'), '*\n')
  await Promise.all(downloads.map((d) => download(d.url, join(batchDir, d.file))))
  const promptFile = join(batchDir, 'prompt.md')
  await writeFile(promptFile, prompt)
  await recordRun({
    id: batch,
    workspaceId,
    bugs,
    folder,
    dir: batchDir,
    startedAt: new Date().toISOString(),
  })
  await launch(folder, promptFile, batchDir)
  console.log(`→ ${name}: Claude Code started in ${folder} (${downloads.length} screenshots)`)
  return { ok: true, folder }
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
  if (!existsSync(CONFIG_DIR)) await mkdir(CONFIG_DIR, { recursive: true })
  serve()
}
