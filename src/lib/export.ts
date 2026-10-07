import { formatContext } from './bugContext'
import { KIND_LABEL, SEVERITY_LABEL } from './types'
import type { BugWithMeta as BugWithAttachments } from './types'

export function exportFilename(
  workspaceName: string,
  ext: 'csv' | 'md',
  date: Date = new Date(),
): string {
  const slug =
    workspaceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workspace'
  return `squash-${slug}-${date.toISOString().slice(0, 10)}.${ext}`
}

function csvCell(value: string | number | null): string {
  const text = String(value ?? '')
  const guarded = /^\s*[=+\-@|＝＋－＠]|^[\t\r]/.test(text) ? `'${text}` : text
  return /[,"\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export function bugsToCsv(bugs: BugWithAttachments[]): string {
  const header =
    'number,kind,title,severity,status,filed_by,created_at,resolved_at,description,context'
  const rows = bugs.map((bug) =>
    [
      bug.number,
      bug.kind,
      bug.title,
      bug.severity,
      bug.status,
      bug.filed_by,
      bug.created_at,
      bug.resolved_at,
      bug.description,
      formatContext(bug.context),
    ]
      .map(csvCell)
      .join(','),
  )
  return [header, ...rows].join('\r\n') + '\r\n'
}

function markdownCell(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r\n|\r|\n/g, ' ')
}

export function bugsToMarkdown(bugs: BugWithAttachments[], workspaceName: string): string {
  const lines = [
    `# ${markdownCell(workspaceName)} bugs`,
    '',
    '| # | Title | Severity | Status | Filed |',
    '| --- | --- | --- | --- | --- |',
    ...bugs.map(
      (bug) =>
        `| ${bug.number} | ${markdownCell(bug.title)} | ${SEVERITY_LABEL[bug.severity]} | ${bug.status} | ${markdownCell(bug.filed_by)} |`,
    ),
  ]
  for (const bug of bugs) {
    const context = formatContext(bug.context)
    lines.push(
      '',
      `## ${KIND_LABEL[bug.kind].one} #${bug.number}: ${markdownCell(bug.title)}`,
      '',
      ...(context ? [`Context: ${markdownCell(context)}`, ''] : []),
      bug.description.replace(/</g, '&lt;').replace(/^( {0,3})#/gm, '$1\\#'),
    )
  }
  return lines.join('\n') + '\n'
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  try {
    anchor.href = url
    anchor.download = filename
    anchor.hidden = true
    document.body.append(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
