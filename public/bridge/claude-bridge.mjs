// Squash → Claude Code bridge. Receives bugs from the Squash tab, downloads their screenshots
// into the workspace's project folder and opens Claude Code on them in a new terminal.
//
// Install (macOS, starts at login):  curl -fsSL https://<squash>/bridge/install.sh | sh
// Run by hand:                       node claude-bridge.mjs [default-folder]
//
// Each Squash workspace maps to its own project folder, chosen the first time you send from it
// (a native folder picker on macOS) and saved in ~/.squash/bridge.json.
//
// Env: SQUASH_BRIDGE_PORT (4317), SQUASH_ORIGINS (comma-separated allowed app origins),
// SQUASH_CLAUDE_ARGS (extra `claude` flags, e.g. "--permission-mode acceptEdits").
import { execFile, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, openSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

const VERSION = 2
const PORT = Number(process.env.SQUASH_BRIDGE_PORT ?? 4317)
const DEFAULT_FOLDER = process.argv[2] ? resolve(process.argv[2]) : null
const CONFIG_DIR = join(homedir(), '.squash')
const CONFIG_FILE = join(CONFIG_DIR, 'bridge.json')
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
  return { workspaceId, name: workspaceName(payload.workspaceName), batch, prompt, downloads }
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
  const args = EXTRA_ARGS.map(sh).join(' ')
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
  child.unref()
  console.log(`  running headless; output in ${join(batchDir, 'claude.log')}`)
}

async function handleSend(payload) {
  const { workspaceId, name, batch, prompt, downloads } = validateSend(payload)
  const folder = await folderFor(workspaceId, name)
  const root = join(folder, '.squash')
  const batchDir = join(root, 'bugs', batch)
  await mkdir(batchDir, { recursive: true })
  // Keep exported bugs out of git without touching the project's own .gitignore.
  await writeFile(join(root, '.gitignore'), '*\n')
  await Promise.all(downloads.map((d) => download(d.url, join(batchDir, d.file))))
  const promptFile = join(batchDir, 'prompt.md')
  await writeFile(promptFile, prompt)
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
    if (req.method === 'GET' && path === '/health') {
      return send(res, 200, { ok: true, version: VERSION, platform: process.platform }, origin)
    }
    if (req.method === 'GET' && folderRoute) {
      const saved = (await loadConfig()).workspaces[folderRoute[1]]?.folder ?? DEFAULT_FOLDER
      return send(res, 200, { folder: saved }, origin)
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

if (!existsSync(CONFIG_DIR)) await mkdir(CONFIG_DIR, { recursive: true })
