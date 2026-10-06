import { supabase } from './supabase'
import type { BugWithMeta, Comment, WorkspaceMember } from './types'
import { SEVERITY_LABEL } from './types'

/** Signed screenshot links in an export stay valid this long. */
export const EXPORT_TTL_SECONDS = 3600

export interface ClaudeExportInput {
  bugs: BugWithMeta[]
  members: WorkspaceMember[]
  workspaceName: string
  /** App origin used to link back to each bug, e.g. `https://squash.example`. */
  origin: string
  /** Signed URL per attachment storage path. Missing paths are listed as unavailable. */
  urls: Record<string, string>
  comments: Comment[]
  /**
   * Repo-relative folder the local bridge downloads screenshots into. When set, the prompt points
   * at those files; otherwise it carries a curl script for Claude to run.
   */
  localDir?: string
}

export interface ScreenshotDownload {
  file: string
  url: string
}

export interface ClaudeExport {
  prompt: string
  downloads: ScreenshotDownload[]
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function extension(path: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(path)
  return match ? match[1].toLowerCase() : 'webp'
}

function indent(text: string): string {
  return text
    .trim()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
}

/** Builds a prompt Claude Code can act on directly: bug details plus a script that downloads the screenshots. */
export function formatClaudePrompt({
  bugs,
  members,
  workspaceName,
  origin,
  urls,
  comments,
  localDir,
}: ClaudeExportInput): ClaudeExport {
  const names = new Map(members.map((m) => [m.user_id, m.profile.display_name]))
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? 'Deleted user') : 'Unknown')
  const downloads: ScreenshotDownload[] = []
  const sections = bugs.map((bug) => {
    const lines = [
      `## ${bug.kind === 'feature' ? 'Feature request' : 'Bug'} #${bug.number}: ${bug.title}`,
      '',
      `- Severity: ${SEVERITY_LABEL[bug.severity]}`,
      `- Status: ${bug.status === 'open' ? 'Open' : 'Resolved'}`,
      `- Filed by ${nameOf(bug.filed_by)} on ${bug.created_at.slice(0, 10)}`,
      `- Link: ${origin}/app/${bug.workspace_id}/bug/${bug.number}`,
    ]
    if (bug.description.trim() && bug.description.trim() !== bug.title.trim()) {
      lines.push('', 'Description:', indent(bug.description))
    }
    if (bug.transcript?.trim()) lines.push('', 'Voice transcript:', indent(bug.transcript))
    if (bug.status === 'resolved' && bug.resolution_note?.trim()) {
      lines.push('', 'Resolution note:', indent(bug.resolution_note))
    }
    if (bug.attachments.length > 0) {
      lines.push('', 'Screenshots:')
      bug.attachments.forEach((a, i) => {
        const file = `bug-${bug.number}-${i + 1}.${extension(a.storage_path)}`
        const url = urls[a.storage_path]
        if (url) {
          downloads.push({ file, url })
          lines.push(`- ${localDir ? `${localDir}/${file}` : file} (${a.width}×${a.height})`)
        } else {
          lines.push(`- ${file}: unavailable, could not create a download link`)
        }
      })
    }
    const thread = comments.filter((c) => c.bug_id === bug.id)
    if (thread.length > 0) {
      lines.push('', 'Comments:')
      for (const c of thread) lines.push(`- ${nameOf(c.author_id)}: ${c.body.trim()}`)
    }
    return lines.join('\n')
  })

  const features = bugs.length > 0 && bugs.every((b) => b.kind === 'feature')
  const mixed = !features && bugs.some((b) => b.kind === 'feature')
  const noun = features ? 'feature request' : mixed ? 'item' : 'bug'
  const count = bugs.length === 1 ? `this ${noun}` : `these ${bugs.length} ${noun}s`
  const intro = [
    `${features ? 'Build' : mixed ? 'Work through' : 'Fix'} ${count} from the Squash bug tracker (workspace "${workspaceName}").`,
    '',
  ]
  if (downloads.length > 0 && localDir) {
    intro.push(
      'Before you start, view every screenshot listed below with the Read tool. They show what is wrong.',
      '',
    )
  } else if (downloads.length > 0) {
    intro.push(
      `First download the screenshots (the links expire ${EXPORT_TTL_SECONDS / 3600} hour after export), then view every image with the Read tool before you start. They show what is wrong.`,
      '',
      '```sh',
      'd="${TMPDIR:-/tmp}/squash-bugs" && mkdir -p "$d" && cd "$d" && \\',
      downloads.map((x) => `curl -sfo "$d/${x.file}" ${shellQuote(x.url)}`).join(' && \\\n') +
        ' && \\',
      'pwd && ls',
      '```',
      '',
    )
  }
  const task = features
    ? 'implement it in this codebase and verify it works'
    : mixed
      ? 'fix each bug at its root cause or implement each feature request, then verify it'
      : 'find the root cause in this codebase, fix it and verify the fix'
  intro.push(
    bugs.length === 1
      ? `${task[0].toUpperCase()}${task.slice(1)}. When you are done, summarize what you changed.`
      : `Work through the ${noun}s one at a time: ${task}. When you are done, list each number with what you changed.`,
  )
  return { prompt: [intro.join('\n'), ...sections].join('\n\n') + '\n', downloads }
}

/** Fetches signed screenshot URLs and comments, then formats the export prompt. */
export async function buildClaudeExport(
  input: Omit<ClaudeExportInput, 'urls' | 'comments'>,
): Promise<ClaudeExport> {
  const bugs = input.bugs.filter((b) => !b.optimistic)
  const paths = bugs.flatMap((b) => b.attachments.map((a) => a.storage_path))
  const [signed, comments] = await Promise.all([
    paths.length > 0
      ? supabase.storage.from('screenshots').createSignedUrls(paths, EXPORT_TTL_SECONDS)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('comments')
      .select('*')
      .in(
        'bug_id',
        bugs.map((b) => b.id),
      )
      .order('created_at', { ascending: true }),
  ])
  if (signed.error) throw new Error(signed.error.message)
  if (comments.error) throw new Error(comments.error.message)
  const urls: Record<string, string> = {}
  for (const item of signed.data ?? []) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl
  }
  return formatClaudePrompt({ ...input, bugs, urls, comments: comments.data ?? [] })
}

/**
 * Copies text that is still being built. Safari only allows clipboard writes inside the click,
 * so the pending text goes in as a promise via ClipboardItem when available.
 */
export async function copyPending(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = text.then((t) => new Blob([t], { type: 'text/plain' }))
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
    return
  }
  await navigator.clipboard.writeText(await text)
}

/** Local bridge installed from `/bridge/install.sh`; it opens Claude Code in a terminal. */
export const BRIDGE_URL = 'http://127.0.0.1:4317'
/** Oldest bridge that maps each workspace to its own project folder. */
export const BRIDGE_VERSION = 2

export interface BridgeStatus {
  version: number
  platform: string
}

/** The bridge's status, or null when it is not running. Never throws. */
export async function pingBridge(timeoutMs = 800): Promise<BridgeStatus | null> {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const body = (await res.json().catch(() => ({}))) as Partial<BridgeStatus>
    return { version: body.version ?? 1, platform: body.platform ?? 'unknown' }
  } catch {
    return null
  }
}

/** One-line terminal command that installs (or updates) the bridge for this Squash origin. */
export function installCommand(origin: string): string {
  return `curl -fsSL ${origin}/bridge/install.sh | sh -s -- ${origin}`
}

export class BridgeError extends Error {
  readonly code: string | undefined
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

async function bridgeRequest<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as
    (T & { error?: string; code?: string }) | null
  if (!res.ok || !json) {
    throw new BridgeError(json?.error ?? `Claude bridge failed (${res.status})`, json?.code)
  }
  return json
}

/** The project folder the bridge opens Claude in for this workspace, if one is set. */
export async function getBridgeFolder(workspaceId: string): Promise<string | null> {
  const { folder } = await bridgeRequest<{ folder: string | null }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/folder`,
  )
  return folder
}

/** Sets the workspace's project folder: a typed path, or the bridge's native picker when omitted. */
export async function setBridgeFolder(
  workspaceId: string,
  workspaceName: string,
  folder?: string,
): Promise<string> {
  const res = await bridgeRequest<{ folder: string }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/folder`,
    { workspaceName, folder },
  )
  return res.folder
}

/** Folder name for one export batch, e.g. `20261006-153012-12-14`. */
export function batchName(bugs: BugWithMeta[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const numbers = bugs.map((b) => b.number).slice(0, 5)
  return [stamp, ...numbers].join('-')
}

/** Hands the bugs to the local bridge, which downloads screenshots and launches Claude Code. */
export async function sendToBridge(
  input: Omit<ClaudeExportInput, 'urls' | 'comments' | 'localDir'> & { workspaceId: string },
): Promise<void> {
  const { workspaceId, ...rest } = input
  const batch = batchName(rest.bugs)
  const { prompt, downloads } = await buildClaudeExport({
    ...rest,
    localDir: `.squash/bugs/${batch}`,
  })
  await bridgeRequest('/claude', {
    workspaceId,
    workspaceName: rest.workspaceName,
    batch,
    prompt,
    downloads,
  })
}
