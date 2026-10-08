import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { FIX_EVIDENCE_LABEL, diffCells, prLabel, type FixRun } from '../lib/fixRuns'
import type { BugAttachment } from '../lib/types'
import type { UseFixRunsResult } from '../hooks/useFixRuns'
import type * as BeforeAfterModule from './BeforeAfter'
import type { BeforeAfterProps } from './BeforeAfter'
import { FixRecord } from './FixRecord'

const h = vi.hoisted(() => ({
  result: { runs: [], loading: false, available: true, error: null } as UseFixRunsResult,
  /** Paths whose signing gave up. */
  unsigned: new Set<string>(),
  /** When set, the comparison throws while rendering (as a failed chunk load would). */
  chunkFails: false,
}))

vi.mock('../hooks/useSignedUrl', () => ({
  useSignedUrlState: (path: string | null) =>
    !path
      ? { url: null, failed: false }
      : h.unsigned.has(path)
        ? { url: null, failed: true }
        : { url: `https://cdn.test/${path}`, failed: false },
}))
vi.mock('./BeforeAfter', async (load) => {
  const actual = await load<typeof BeforeAfterModule>()
  return {
    default: (props: BeforeAfterProps) => {
      if (h.chunkFails) throw new Error('Failed to fetch dynamically imported module')
      return <actual.default {...props} />
    },
  }
})

const NOW = Date.now()
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()
const SHA = 'e3f9a12c4b7d08e1f2a3b4c5d6e7f8091a2b3c4d'

function run(over: Partial<FixRun> = {}): FixRun {
  return {
    id: 'r1',
    bug_id: 'b1',
    workspace_id: 'w1',
    run_id: 'run-1',
    status: 'succeeded',
    branch: 'fix/avatar-srcset',
    commit_sha: SHA,
    pr_url: 'https://github.com/acme/app/pull/412',
    files_changed: 2,
    additions: 14,
    deletions: 3,
    summary: null,
    after_attachment_id: null,
    created_by: 'u1',
    started_at: ago(30),
    finished_at: ago(20),
    ...over,
  }
}

function attachment(id: string, width = 1600, height = 1000): BugAttachment {
  return {
    id,
    bug_id: 'b1',
    storage_path: `w1/b1/${id}.png`,
    width,
    height,
    size_bytes: 1,
    created_at: ago(60),
  }
}

function show(
  runs: FixRun[],
  over: Partial<UseFixRunsResult> = {},
  attachments: BugAttachment[] = [],
) {
  h.result = { runs, loading: false, available: true, error: null, ...over }
  return render(<FixRecord bugId="b1" fix={h.result} attachments={attachments} />)
}

const label = () => screen.getByRole('region', { name: 'Fix record' })

beforeEach(() => {
  h.unsigned = new Set()
  h.chunkFails = false
})
afterEach(cleanup)

describe('FixRecord', () => {
  it('renders nothing when the server has no fix_runs table', () => {
    const { container } = show([run()], { available: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing while there are no runs (loading or none recorded)', () => {
    const loading = show([], { loading: true })
    expect(loading.container).toBeEmptyDOMElement()
    loading.unmount()
    const none = show([])
    expect(none.container).toBeEmptyDOMElement()
  })

  it('shows the latest succeeded run as a specimen label with its evidence', () => {
    show([run({ summary: 'Added a srcset.' })])
    const region = label()
    expect(within(region).getByRole('heading', { name: 'Fix record' })).toBeInTheDocument()
    const sha = within(region).getByText('e3f9a12')
    expect(sha).toHaveAttribute('title', SHA)
    expect(within(region).getByText('fix/avatar-srcset')).toBeInTheDocument()
    expect(within(region).getByText('Succeeded')).toBeInTheDocument()
    expect(within(region).getByText('2 files, 14 additions, 3 deletions')).toBeInTheDocument()
    expect(within(region).getByText('+14')).toBeInTheDocument()
    expect(within(region).getByText('−3')).toBeInTheDocument()
    expect(within(region).getByText('20m ago')).toHaveAttribute('dateTime', ago(20))
    expect(within(region).getByText(/^Finished/)).toBeInTheDocument()
    expect(within(region).getByText('Added a srcset.')).toBeInTheDocument()
    // The evidence is self-reported, and the record says so.
    expect(within(region).getByText(FIX_EVIDENCE_LABEL)).toHaveClass('text-ink-3')
  })

  it('links the pull request in a new tab without exposing the opener', () => {
    show([run()])
    const link = screen.getByRole('link', { name: 'PR #412 (opens in a new tab)' })
    expect(link).toHaveAttribute('href', 'https://github.com/acme/app/pull/412')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')?.split(' ')).toContain('noopener')
  })

  it('shows a running run with its progress state and start time', () => {
    show([
      run({
        status: 'running',
        commit_sha: null,
        pr_url: null,
        files_changed: null,
        finished_at: null,
        started_at: ago(2),
      }),
    ])
    const region = label()
    expect(within(region).getByText('Running')).toBeInTheDocument()
    expect(within(region).getByText('No commit yet')).toBeInTheDocument()
    expect(within(region).getByText(/^Started/)).toBeInTheDocument()
    expect(within(region).getByText('2m ago')).toBeInTheDocument()
    expect(region.querySelector('.animate-indeterminate')).not.toBeNull()
    expect(within(region).queryByRole('link')).toBeNull()
  })

  it('says "No commit" for a finished run that left none', () => {
    show([run({ status: 'failed', commit_sha: null, pr_url: null, files_changed: null })])
    const region = label()
    expect(within(region).getByText('Failed')).toBeInTheDocument()
    expect(within(region).getByText('No commit')).toBeInTheDocument()
    expect(within(region).queryByText(/files/)).toBeNull()
    expect(region.querySelector('.animate-indeterminate')).toBeNull()
  })

  it('shows a cancelled run', () => {
    show([run({ status: 'cancelled', commit_sha: null, pr_url: null })])
    expect(within(label()).getByText('Cancelled')).toBeInTheDocument()
    expect(within(label()).getByText('No commit')).toBeInTheDocument()
  })

  it('folds earlier runs under a collapsed "N earlier runs" toggle', () => {
    show([
      run(),
      run({ id: 'r2', status: 'failed', commit_sha: null, pr_url: null, files_changed: null }),
      run({
        id: 'r3',
        status: 'succeeded',
        commit_sha: 'abcdef1234',
        pr_url: 'https://github.com/acme/app/pull/7',
      }),
    ])
    const toggle = screen.getByText('2 earlier runs')
    const details = toggle.closest('details')!
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(toggle)
    const list = screen.getByRole('list', { name: 'Earlier fix runs' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Failed')).toBeInTheDocument()
    expect(within(items[0]).getByText('No commit')).toBeInTheDocument()
    expect(within(items[1]).getByText('Succeeded')).toBeInTheDocument()
    expect(within(items[1]).getByText('abcdef1')).toBeInTheDocument()
    const link = within(items[1]).getByRole('link', { name: 'PR #7 (opens in a new tab)' })
    expect(link.getAttribute('rel')?.split(' ')).toContain('noopener')
  })

  it('says "1 earlier run" in the singular and nothing with a single run', () => {
    const one = show([run(), run({ id: 'r2' })])
    expect(screen.getByText('1 earlier run')).toBeInTheDocument()
    one.unmount()
    show([run()])
    expect(screen.queryByText(/earlier run/)).toBeNull()
  })

  it('shows a load error inline', () => {
    show([], { error: 'network down' })
    expect(screen.getByRole('alert')).toHaveTextContent('network down')
  })

  it('has no before/after comparison when no run has an after screenshot', () => {
    show([run()], {}, [attachment('a1')])
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.queryByText(/^Before/)).toBeNull()
  })

  it('has no comparison when the bug has no before screenshot', () => {
    show([run({ after_attachment_id: 'a2' })], {}, [attachment('a2')])
    expect(screen.queryByRole('slider')).toBeNull()
  })
})

describe('before/after slider', () => {
  function showComparison() {
    show([run({ after_attachment_id: 'a2' })], {}, [attachment('a1'), attachment('a2')])
  }

  /** Shows the comparison and lets both images finish loading. */
  async function slider() {
    showComparison()
    fireEvent.load(await screen.findByAltText('Before the fix'))
    fireEvent.load(screen.getByAltText('After the fix'))
    return screen.getByRole('slider', { name: 'Before and after fix e3f9a12' })
  }

  it('shows a skeleton, and no slider, until both images have loaded', async () => {
    showComparison()
    const before = await screen.findByAltText('Before the fix')
    expect(
      screen.getByRole('status', { name: /^Loading the before and after/ }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('slider')).toBeNull()
    fireEvent.load(before)
    expect(screen.queryByRole('slider')).toBeNull()
    fireEvent.load(screen.getByAltText('After the fix'))
    expect(screen.getByRole('slider')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /^Loading the before and after/ })).toBeNull()
  })

  it('replaces the skeleton with an inline error when an image fails to load', async () => {
    showComparison()
    fireEvent.load(await screen.findByAltText('Before the fix'))
    fireEvent.error(screen.getByAltText('After the fix'))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load the screenshots to compare.")
    expect(within(alert).getByRole('link', { name: 'Open before' })).toHaveAttribute(
      'href',
      'https://cdn.test/w1/b1/a1.png',
    )
    expect(within(alert).queryByRole('link', { name: 'Open after' })).toBeNull()
    expect(screen.queryByRole('status', { name: /^Loading the before and after/ })).toBeNull()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('shows the inline error when signing a screenshot gives up', async () => {
    h.unsigned.add('w1/b1/a1.png')
    showComparison()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load the screenshots to compare.")
    expect(within(alert).getByRole('link', { name: 'Open after' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
    expect(screen.queryByRole('status', { name: /^Loading the before and after/ })).toBeNull()
  })

  it('keeps a failed comparison chunk inside the fix record, with Retry', async () => {
    h.chunkFails = true
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    showComparison()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      "Couldn't load the comparison. Fig. 1 and Fig. 2 are in Screenshots above.",
    )
    // The rest of the record still renders.
    expect(screen.getByText('Succeeded')).toBeInTheDocument()
    h.chunkFails = false
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByAltText('Before the fix')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    quiet.mockRestore()
  })

  it('drags with one pointer, ignores others and stops when capture is lost', async () => {
    const s = await slider()
    const frame = s.closest<HTMLElement>('[aria-busy]')!
    frame.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect
    const clipped = () => screen.getByAltText('Before the fix').parentElement!
    fireEvent.pointerDown(frame, { pointerId: 1, button: 0, clientX: 50 })
    expect(s).toHaveAttribute('aria-valuenow', '25')
    expect(clipped().className).not.toContain('transition-[clip-path')
    // A second finger neither moves the slider nor takes over the drag.
    fireEvent.pointerDown(frame, { pointerId: 2, button: 0, clientX: 180 })
    fireEvent.pointerMove(frame, { pointerId: 2, clientX: 180 })
    expect(s).toHaveAttribute('aria-valuenow', '25')
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 100 })
    expect(s).toHaveAttribute('aria-valuenow', '50')
    fireEvent.pointerUp(frame, { pointerId: 2 })
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 120 })
    expect(s).toHaveAttribute('aria-valuenow', '60')
    fireEvent(
      frame,
      Object.assign(new Event('lostpointercapture', { bubbles: true }), { pointerId: 1 }),
    )
    expect(clipped().className).toContain('transition-[clip-path')
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 10 })
    expect(s).toHaveAttribute('aria-valuenow', '60')
    // pointercancel also ends a drag.
    fireEvent.pointerDown(frame, { pointerId: 3, button: 0, clientX: 20 })
    expect(s).toHaveAttribute('aria-valuenow', '10')
    fireEvent.pointerCancel(frame, { pointerId: 3 })
    fireEvent.pointerMove(frame, { pointerId: 3, clientX: 200 })
    expect(s).toHaveAttribute('aria-valuenow', '10')
  })

  it('compares the first screenshot with the run’s after screenshot', async () => {
    await slider()
    expect(screen.getByAltText('Before the fix')).toHaveAttribute(
      'src',
      'https://cdn.test/w1/b1/a1.png',
    )
    expect(screen.getByAltText('After the fix')).toHaveAttribute(
      'src',
      'https://cdn.test/w1/b1/a2.png',
    )
    expect(screen.getByText('Before · Fig. 1')).toBeInTheDocument()
  })

  it('is a focusable slider that starts at the middle', async () => {
    const s = await slider()
    expect(s).toHaveAttribute('tabIndex', '0')
    expect(s).toHaveAttribute('aria-valuemin', '0')
    expect(s).toHaveAttribute('aria-valuemax', '100')
    expect(s).toHaveAttribute('aria-valuenow', '50')
    expect(s).toHaveAttribute('aria-valuetext', '50% before, 50% after')
  })

  it('moves with the arrow, page, Home and End keys', async () => {
    const s = await slider()
    fireEvent.keyDown(s, { key: 'ArrowLeft' })
    expect(s).toHaveAttribute('aria-valuenow', '45')
    expect(s).toHaveAttribute('aria-valuetext', '45% before, 55% after')
    fireEvent.keyDown(s, { key: 'ArrowRight' })
    fireEvent.keyDown(s, { key: 'ArrowUp' })
    expect(s).toHaveAttribute('aria-valuenow', '55')
    fireEvent.keyDown(s, { key: 'ArrowDown' })
    expect(s).toHaveAttribute('aria-valuenow', '50')
    fireEvent.keyDown(s, { key: 'PageUp' })
    expect(s).toHaveAttribute('aria-valuenow', '75')
    fireEvent.keyDown(s, { key: 'PageDown' })
    expect(s).toHaveAttribute('aria-valuenow', '50')
    fireEvent.keyDown(s, { key: 'End' })
    expect(s).toHaveAttribute('aria-valuenow', '100')
    fireEvent.keyDown(s, { key: 'ArrowRight' })
    expect(s).toHaveAttribute('aria-valuenow', '100')
    fireEvent.keyDown(s, { key: 'Home' })
    expect(s).toHaveAttribute('aria-valuenow', '0')
    fireEvent.keyDown(s, { key: 'ArrowLeft' })
    expect(s).toHaveAttribute('aria-valuenow', '0')
  })

  it('reveals the before shot with clip-path and moves the handle with transform only', async () => {
    const s = await slider()
    fireEvent.keyDown(s, { key: 'Home' })
    const clipped = screen.getByAltText('Before the fix').parentElement!
    expect(clipped.style.clipPath).toBe('inset(0 100% 0 0)')
    const handleLayer = s.parentElement!
    expect(handleLayer.style.transform).toBe('translateX(0%)')
    expect(clipped.className).toContain('motion-reduce:transition-none')
  })

  it('leaves other keys alone', async () => {
    const s = await slider()
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    s.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(s).toHaveAttribute('aria-valuenow', '50')
  })
})

describe('helpers', () => {
  it('labels pull request URLs', () => {
    expect(prLabel('https://github.com/acme/app/pull/412')).toBe('PR #412')
    expect(prLabel('https://gitlab.com/acme/app/-/merge_requests/9')).toBe('PR #9')
    expect(prLabel('https://git.example.com/review/abc/')).toBe('git.example.com/review/abc')
  })

  it('splits the diff bar into five cells', () => {
    expect(diffCells(14, 3)).toEqual(['add', 'add', 'add', 'add', 'del'])
    expect(diffCells(0, 0)).toEqual(['none', 'none', 'none', 'none', 'none'])
    expect(diffCells(1, 0)).toEqual(['add', 'none', 'none', 'none', 'none'])
    expect(diffCells(100, 1)).toEqual(['add', 'add', 'add', 'add', 'del'])
    expect(diffCells(1, 100)).toEqual(['add', 'del', 'del', 'del', 'del'])
    expect(diffCells(0, 7)).toEqual(['del', 'del', 'del', 'del', 'del'])
  })
})
