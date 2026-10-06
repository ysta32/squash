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
      `## Bug #${bug.number}: ${bug.title}`,
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

  const count = bugs.length === 1 ? 'this bug' : `these ${bugs.length} bugs`
  const intro = [`Fix ${count} from the Squash bug tracker (workspace "${workspaceName}").`, '']
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
  intro.push(
    bugs.length === 1
      ? 'Find the root cause in this codebase, fix it and verify the fix. When you are done, summarize what you changed.'
      : 'Work through the bugs one at a time: find the root cause in this codebase, fix it and verify the fix. When you are done, list each bug number with what you changed.',
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

/** Local bridge started with `npm run claude-bridge`; it opens Claude Code in a terminal. */
export const BRIDGE_URL = 'http://127.0.0.1:4317'

/** True when the local bridge answers. Never throws. */
export async function pingBridge(timeoutMs = 800): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(timeoutMs) })
    return res.ok
  } catch {
    return false
  }
}

/** Folder name for one export batch, e.g. `20261006-153012-12-14`. */
export function batchName(bugs: BugWithMeta[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const numbers = bugs.map((b) => b.number).slice(0, 5)
  return [stamp, ...numbers].join('-')
}

/** Hands the bugs to the local bridge, which downloads screenshots and launches Claude Code. */
export async function sendToBridge(
  input: Omit<ClaudeExportInput, 'urls' | 'comments' | 'localDir'>,
): Promise<void> {
  const batch = batchName(input.bugs)
  const { prompt, downloads } = await buildClaudeExport({
    ...input,
    localDir: `.squash/bugs/${batch}`,
  })
  const res = await fetch(`${BRIDGE_URL}/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch, prompt, downloads }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Claude bridge failed (${res.status})`)
  }
}
