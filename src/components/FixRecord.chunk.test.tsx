import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { FixRun } from '../lib/fixRuns'
import type { BugAttachment } from '../lib/types'
import { FixRecord } from './FixRecord'

// The comparison chunk's dynamic import rejects the first time (a deploy replaced it, or the
// network dropped), then succeeds.
const h = vi.hoisted(() => ({ imports: 0 }))
vi.mock('./BeforeAfter', async (load) => {
  h.imports++
  if (h.imports === 1) throw new Error('Failed to fetch dynamically imported module')
  return load()
})
vi.mock('../hooks/useSignedUrl', () => ({
  useSignedUrlState: (path: string | null) => ({
    url: path ? `https://cdn.test/${path}` : null,
    failed: false,
  }),
}))

afterEach(cleanup)

const NOW = new Date().toISOString()
const shot = (id: string): BugAttachment => ({
  id,
  bug_id: 'b1',
  storage_path: `w1/b1/${id}.png`,
  width: 1600,
  height: 1000,
  size_bytes: 1,
  created_at: NOW,
})
const run: FixRun = {
  id: 'r1',
  bug_id: 'b1',
  workspace_id: 'w1',
  run_id: 'run-1',
  status: 'succeeded',
  branch: 'fix/x',
  commit_sha: 'e3f9a12c4b',
  pr_url: null,
  files_changed: 1,
  additions: 1,
  deletions: 0,
  summary: null,
  after_attachment_id: 'a2',
  created_by: 'u1',
  started_at: NOW,
  finished_at: NOW,
}

it('catches a rejected comparison chunk inline and loads it on Retry', async () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <FixRecord
      bugId="b1"
      fix={{ runs: [run], loading: false, available: true, error: null }}
      attachments={[shot('a1'), shot('a2')]}
    />,
  )
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent("Couldn't load the comparison.")
  expect(screen.getByRole('region', { name: 'Fix record' })).toBeInTheDocument()
  fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
  expect(await screen.findByAltText('After the fix')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(h.imports).toBe(2)
  quiet.mockRestore()
})
