import { KIND_LABEL, SEVERITY_LABEL } from './types'
import type { BugWithMeta as BugWithAttachments } from './types'

function csvCell(value: string | number | null): string {
  const text = String(value ?? '')
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[,"\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export function bugsToCsv(bugs: BugWithAttachments[]): string {
  const header = 'number,kind,title,severity,status,filed_by,created_at,resolved_at,description'
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
    ]
      .map(csvCell)
      .join(','),
  )
  return [header, ...rows].join('\r\n') + '\r\n'
}

function markdownCell(text: string): string {
  return text
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
    lines.push(
      '',
      `## ${KIND_LABEL[bug.kind].one} #${bug.number}: ${markdownCell(bug.title)}`,
      '',
      bug.description,
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
