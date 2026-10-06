// Local bridge for "Send to Claude": receives bugs from the Squash tab, downloads their
// screenshots into the target repo and opens Claude Code on them in a new terminal.
//
//   npm run claude-bridge                      # fix bugs in this repo
//   npm run claude-bridge -- ~/code/my-app     # fix bugs in another repo
//
// Env: SQUASH_BRIDGE_PORT (4317), SQUASH_ORIGINS (comma-separated allowed app origins),
// SQUASH_CLAUDE_ARGS (extra `claude` flags, e.g. "--permission-mode acceptEdits").
import { execFile, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, openSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const PORT = Number(process.env.SQUASH_BRIDGE_PORT ?? 4317)
const REPO = resolve(process.argv[2] ?? process.env.INIT_CWD ?? process.cwd())
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
const MAX_BODY = 1024 * 1024
const MAX_IMAGE = 15 * 1024 * 1024
const MAX_DOWNLOADS = 100
const SAFE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}$/

if (!existsSync(REPO)) {
  console.error(`Repo not found: ${REPO}`)
  process.exit(1)
}

/** Single-quotes a value for a POSIX shell. */
const sh = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`

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
        fail(new Error('Request too large'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')))
    req.on('error', fail)
  })
}

function validate(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid payload')
  const { batch, prompt, downloads } = payload
  if (typeof batch !== 'string' || !SAFE_NAME.test(batch)) throw new Error('Invalid batch name')
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Missing prompt')
  if (!Array.isArray(downloads) || downloads.length > MAX_DOWNLOADS) {
    throw new Error('Invalid downloads')
  }
  for (const d of downloads) {
    if (typeof d?.file !== 'string' || !SAFE_NAME.test(d.file) || d.file.includes('..')) {
      throw new Error('Invalid file name')
    }
    if (typeof d.url !== 'string' || new URL(d.url).protocol !== 'https:') {
      throw new Error('Screenshot URLs must be https')
    }
  }
  return { batch, prompt, downloads }
}

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`Screenshot download failed (${res.status})`)
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length > MAX_IMAGE) throw new Error('Screenshot too large')
  await writeFile(dest, data)
}

/** Opens Claude Code on the prompt: a new Terminal window on macOS, headless elsewhere. */
function launch(promptFile, batchDir) {
  const args = EXTRA_ARGS.map(sh).join(' ')
  if (process.platform === 'darwin') {
    const command = `cd ${sh(REPO)} && claude ${args} "$(cat ${sh(promptFile)})"`
    const script = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return new Promise((ok, fail) => {
      execFile(
        'osascript',
        [
          '-e',
          'tell application "Terminal"',
          '-e',
          'activate',
          '-e',
          `do script "${script}"`,
          '-e',
          'end tell',
        ],
        (err) => (err ? fail(err) : ok()),
      )
    })
  }
  const log = openSync(join(batchDir, 'claude.log'), 'a')
  const child = spawn('sh', ['-c', `claude -p ${args} "$(cat ${sh(promptFile)})"`], {
    cwd: REPO,
    detached: true,
    stdio: ['ignore', log, log],
  })
  child.unref()
  console.log(`  running headless; output in ${join(batchDir, 'claude.log')}`)
  return Promise.resolve()
}

async function handleClaude(raw) {
  const { batch, prompt, downloads } = validate(JSON.parse(raw))
  const root = join(REPO, '.squash')
  const batchDir = join(root, 'bugs', batch)
  await mkdir(batchDir, { recursive: true })
  // Keep exported bugs out of git without touching the repo's own .gitignore.
  await writeFile(join(root, '.gitignore'), '*\n')
  await Promise.all(downloads.map((d) => download(d.url, join(batchDir, d.file))))
  const promptFile = join(batchDir, 'prompt.md')
  await writeFile(promptFile, prompt)
  await launch(promptFile, batchDir)
  return { batchDir, screenshots: downloads.length }
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

  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true }, origin)
  if (req.method === 'POST' && path === '/claude') {
    try {
      const result = await handleClaude(await readBody(req))
      console.log(`→ Claude Code started on ${result.batchDir} (${result.screenshots} screenshots)`)
      return send(res, 200, { ok: true }, origin)
    } catch (err) {
      console.error('✗', err instanceof Error ? err.message : err)
      return send(res, 400, { error: err instanceof Error ? err.message : 'Failed' }, origin)
    }
  }
  return send(res, 404, { error: 'Not found' }, origin)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Squash → Claude bridge on http://127.0.0.1:${PORT}`)
  console.log(`  repo:    ${REPO}`)
  console.log(`  origins: ${[...ORIGINS].join(', ')}`)
  console.log('Leave this running, then press "Send to Claude" in Squash.')
})
