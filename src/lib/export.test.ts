import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BugFilters } from '../components/BugFilters'
import type { BugWithMeta } from './types'
import { bugsToCsv, bugsToMarkdown, downloadText, exportFilename } from './export'

function bug(overrides: Partial<BugWithMeta> = {}): BugWithMeta {
  return {
    id: 'b1',
    workspace_id: 'ws',
    number: 7,
    kind: 'bug',
    title: 'Login fails',
    description: 'Steps to reproduce',
    transcript: null,
    severity: 'high',
    status: 'open',
    filed_by: 'ada',
    created_at: '2026-10-01T10:00:00Z',
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    assignee_id: null,
    updated_at: '2026-10-01T10:00:00Z',
    attachments: [],
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('exportFilename', () => {
  it.each(['csv', 'md'] as const)('uses a sanitized workspace and UTC date for %s', (ext) => {
    expect(exportFilename(' / Acme & Team / ', ext, new Date('2026-10-07T23:00:00-04:00'))).toBe(
      `squash-acme-team-2026-10-08.${ext}`,
    )
  })

  it.each(['', ' / !!! '])('falls back for a workspace without slug characters: %s', (name) => {
    expect(exportFilename(name, 'csv', new Date('2026-10-07T12:00:00Z'))).toBe(
      'squash-workspace-2026-10-07.csv',
    )
  })

  it('defaults to the current date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
    expect(exportFilename('Acme Team', 'md')).toBe('squash-acme-team-2026-10-07.md')
  })
})

describe('bugsToCsv', () => {
  it('writes ordered columns and empty nullable values', () => {
    expect(bugsToCsv([bug()])).toBe(
      'number,kind,title,severity,status,filed_by,created_at,resolved_at,description\r\n' +
        '7,bug,Login fails,high,open,ada,2026-10-01T10:00:00Z,,Steps to reproduce\r\n',
    )
  })

  it('quotes commas, doubles quotes and preserves embedded line breaks', () => {
    expect(
      bugsToCsv([bug({ title: 'Login, "again"', description: 'First\r\nSecond\nThird\rFourth' })]),
    ).toContain(
      '7,bug,"Login, ""again""",high,open,ada,2026-10-01T10:00:00Z,,"First\r\nSecond\nThird\rFourth"\r\n',
    )
  })

  it.each(['=SUM(1,2)', '+123', '-123', '@SUM(A1)'])(
    'guards formula prefix in every text column: %s',
    (value) => {
      const csv = bugsToCsv([bug({ title: value, filed_by: value, description: value })])
      const guarded = value.includes(',') ? `"'${value}"` : `'${value}`
      expect(csv).toContain(
        `7,bug,${guarded},high,open,${guarded},2026-10-01T10:00:00Z,,${guarded}\r\n`,
      )
    },
  )

  it('preserves resolved dates and feature kinds', () => {
    expect(
      bugsToCsv([
        bug({ kind: 'feature', status: 'resolved', resolved_at: '2026-10-02T10:00:00Z' }),
      ]),
    ).toContain(
      '7,feature,Login fails,high,resolved,ada,2026-10-01T10:00:00Z,2026-10-02T10:00:00Z,Steps to reproduce',
    )
  })

  describe.each(['|', '＝', '＋', '－', '＠'])('guards the %s prefix', (prefix) => {
    it.each(['', '  ', '\t', '\r\n', '\u00a0'])('after whitespace %j', (whitespace) => {
      const value = `${whitespace}${prefix}SUM(1,2)`
      const guarded = `"'${value}"`
      expect(bugsToCsv([bug({ title: value, filed_by: value, description: value })])).toContain(
        `7,bug,${guarded},high,open,${guarded},2026-10-01T10:00:00Z,,${guarded}\r\n`,
      )
    })

    it('preserves the character inside ordinary text', () => {
      const value = `Text ${prefix} value`
      expect(bugsToCsv([bug({ title: value, filed_by: value, description: value })])).toContain(
        `7,bug,${value},high,open,${value},2026-10-01T10:00:00Z,,${value}\r\n`,
      )
    })
  })

  it.each([
    [' =cmd', "' =cmd"],
    ['\t=1+1', "'\t=1+1"],
    ['\r@x', '"\'\r@x"'],
    ['\tplain', "'\tplain"],
    ['\rplain', '"\'\rplain"'],
    ['  +123', "'  +123"],
  ])('guards whitespace-prefixed cells: %s', (value, guarded) => {
    expect(bugsToCsv([bug({ title: value, filed_by: value, description: value })])).toContain(
      `7,bug,${guarded},high,open,${guarded},2026-10-01T10:00:00Z,,${guarded}\r\n`,
    )
  })

  it('exports just the header for an empty list', () => {
    expect(bugsToCsv([])).toBe(
      'number,kind,title,severity,status,filed_by,created_at,resolved_at,description\r\n',
    )
  })
})

describe('bugsToMarkdown', () => {
  it('escapes HTML in titles in both the table and section heading', () => {
    const markdown = bugsToMarkdown([bug({ title: '<script>alert(1)</script>' })], 'Acme')
    expect(markdown).toContain('| 7 | &lt;script>alert(1)&lt;/script> | High | open | ada |')
    expect(markdown).toContain('## Bug #7: &lt;script>alert(1)&lt;/script>\n')
    expect(markdown).not.toContain('<')
  })

  it('escapes HTML in descriptions while preserving Markdown and line breaks', () => {
    const markdown = bugsToMarkdown(
      [
        bug({
          description: '# Steps\n<img src=x onerror=alert(1)>\r\n**Text** <script>x</script>',
        }),
      ],
      'Acme',
    )
    expect(markdown).toContain(
      '\\# Steps\n&lt;img src=x onerror=alert(1)>\r\n**Text** &lt;script>x&lt;/script>\n',
    )
    expect(markdown).not.toContain('<')
  })

  it('escapes description headings while preserving bug section headings', () => {
    const markdown = bugsToMarkdown(
      [
        bug({ description: '# Heading\n## Fake bug\r\n   ### Indented\r# Final' }),
        bug({ number: 8 }),
      ],
      'Acme',
    )
    expect(markdown).toContain('\\# Heading\n\\## Fake bug\r\n   \\### Indented\r\\# Final')
    expect(markdown.match(/^## /gm)).toHaveLength(2)
    expect(markdown).toContain('## Bug #8: Login fails')
  })

  it('escapes pipes and backslashes and keeps multiline titles within one table row', () => {
    const markdown = bugsToMarkdown([bug({ title: 'A\\|B\r\nC', filed_by: 'ada|dev' })], 'Acme')
    expect(markdown).toContain('| 7 | A\\\\\\|B C | High | open | ada\\|dev |')
    expect(markdown).toContain('## Bug #7: A\\\\\\|B C')
  })

  it('includes each bug description intact and in input order', () => {
    const markdown = bugsToMarkdown(
      [
        bug({ description: 'First paragraph\n\nSecond | paragraph' }),
        bug({
          number: 8,
          kind: 'feature',
          title: 'Add search',
          description: '**Search** everything',
        }),
      ],
      'Acme',
    )
    expect(markdown).toContain(
      '## Bug #7: Login fails\n\nFirst paragraph\n\nSecond | paragraph\n\n## Feature #8: Add search\n\n**Search** everything\n',
    )
  })

  it('exports a heading and table header for an empty list', () => {
    expect(bugsToMarkdown([], 'Acme')).toBe(
      '# Acme bugs\n\n| # | Title | Severity | Status | Filed |\n| --- | --- | --- | --- | --- |\n',
    )
  })
})

function mockDownload() {
  vi.useFakeTimers()
  const createObjectURL = vi.fn<typeof URL.createObjectURL>(() => 'blob:export')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return { createObjectURL, revokeObjectURL, click }
}

describe('downloadText', () => {
  it('downloads a typed blob with the supplied filename and releases resources', () => {
    const { createObjectURL, revokeObjectURL, click } = mockDownload()
    downloadText('bugs.csv', 'title\r\nLogin', 'text/csv;charset=utf-8')
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(blob.size).toBe('title\r\nLogin'.length)
    const anchor = click.mock.instances[0] as HTMLAnchorElement | undefined
    expect(anchor?.download).toBe('bugs.csv')
    expect(anchor?.getAttribute('href')).toBe('blob:export')
    expect(anchor?.isConnected).toBe(false)
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
  })

  it('cleans up even when clicking the link fails', () => {
    const { click, revokeObjectURL } = mockDownload()
    click.mockImplementation(() => {
      throw new Error('Download failed')
    })
    expect(() => downloadText('bugs.md', 'text', 'text/markdown')).toThrow('Download failed')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
  })
})

const filterProps = {
  filters: {
    kind: 'bug',
    tab: 'open',
    filedBy: null,
    resolvedBy: null,
    assignee: null,
    severity: null,
    query: '',
  } as const,
  onFilters: vi.fn(),
  members: [],
}

describe('export menu', () => {
  it.each([
    ['CSV', 'csv'],
    ['Markdown', 'md'],
  ] as const)('calls the export callback for %s', (label, format) => {
    const onExport = vi.fn()
    render(createElement(BugFilters, { ...filterProps, onExport }))
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('menuitem', { name: label }))
    expect(onExport).toHaveBeenCalledWith(format)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus()
  })

  it.each([
    ['CSV', 'csv', 'text/csv;charset=utf-8'],
    ['Markdown', 'md', 'text/markdown;charset=utf-8'],
  ] as const)('downloads %s using the workspace slug and date', (label, extension, mime) => {
    const { click, createObjectURL } = mockDownload()
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
    render(
      createElement(BugFilters, { ...filterProps, bugs: [bug()], workspaceName: 'Acme / Team' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('menuitem', { name: label }))
    const anchor = click.mock.instances[0] as HTMLAnchorElement | undefined
    expect(anchor?.download).toBe(`squash-acme-team-2026-10-07.${extension}`)
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe(mime)
    expect(blob.size).toBe(
      new Blob([extension === 'csv' ? bugsToCsv([bug()]) : bugsToMarkdown([bug()], 'Acme / Team')])
        .size,
    )
    vi.runAllTimers()
  })

  it('supports menu keyboard navigation, Escape and outside dismissal', () => {
    render(createElement(BugFilters, filterProps))
    const trigger = screen.getByRole('button', { name: 'Export' })
    fireEvent.click(trigger)
    const csv = screen.getByRole('menuitem', { name: 'CSV' })
    expect(csv).toHaveFocus()
    fireEvent.keyDown(csv, { key: 'ArrowDown' })
    const markdown = screen.getByRole('menuitem', { name: 'Markdown' })
    expect(markdown).toHaveFocus()
    fireEvent.keyDown(markdown, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
