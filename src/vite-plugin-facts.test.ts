import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  computeFacts,
  countRlsChecks,
  countTests,
  parseBudgets,
  parseReleases,
  parseShortcuts,
} from '../vite-plugin-facts'

describe('build-time facts', () => {
  it('counts declared test cases, including it.each tables', () => {
    const source = [
      "describe('x', () => {",
      "  it('a', () => {})",
      "  test('b', () => {})",
      "  it.each([1, 2])('c %s', () => {})",
      "  // it('commented out') is not at a line start after code",
      "  const it2 = 'it('",
      '})',
    ].join('\n')
    expect(countTests(source)).toBe(3)
  })

  it('counts distinct numbered RLS assertions, not repeats or the header placeholder', () => {
    const sql = "raise 'FAIL[1]: a'; raise 'FAIL[1]: b'; raise 'FAIL[2]: c'; -- FAIL[n]: doc"
    expect(countRlsChecks(sql)).toBe(2)
  })

  it('reads released versions newest first and skips Unreleased', () => {
    const changelog = '## Unreleased\n\n## v1.1.0 — 2026-10-03\n\ntext\n\n## v1.0.0 — 2026-10-02\n'
    expect(parseReleases(changelog)).toEqual([
      { version: 'v1.1.0', date: '2026-10-03' },
      { version: 'v1.0.0', date: '2026-10-02' },
    ])
  })

  it('reads the size budgets and fails loudly when they move', () => {
    expect(
      parseBudgets('export const BUDGET_ENTRY_KB = 83\nexport const BUDGET_TOTAL_KB = 200'),
    ).toEqual({ entry: 83, total: 200 })
    expect(() => parseBudgets('const nothing = 1')).toThrow(/BUDGET_ENTRY_KB/)
  })

  it('parses the shortcut table with platform keys', () => {
    const source = `const SHORTCUTS = [
  { keys: [MOD, 'K'], label: 'Command palette' },
  { keys: [ALT, '1–4'], label: 'Set severity (low → critical) while capturing' },
  { keys: ['?'], label: 'Show keyboard shortcuts' },
]`
    expect(parseShortcuts(source)).toEqual([
      { keys: [{ kind: 'mod' }, { kind: 'key', label: 'K' }], label: 'Command palette' },
      {
        keys: [{ kind: 'alt' }, { kind: 'key', label: '1–4' }],
        label: 'Set severity (low → critical) while capturing',
      },
      { keys: [{ kind: 'key', label: '?' }], label: 'Show keyboard shortcuts' },
    ])
    expect(() => parseShortcuts('nothing here')).toThrow(/no shortcuts/)
  })

  it('maps named key constants to their caps', () => {
    const source = `[
  { keys: [SHIFT_KEY, ENTER_KEY], label: 'New line' },
  { keys: [MOD_KEY, ENTER], label: 'Resolve with note' },
]`
    expect(parseShortcuts(source)).toEqual([
      {
        keys: [
          { kind: 'key', label: 'Shift' },
          { kind: 'key', label: '↵' },
        ],
        label: 'New line',
      },
      { keys: [{ kind: 'mod' }, { kind: 'key', label: '↵' }], label: 'Resolve with note' },
    ])
  })

  it('computes facts from this repository', () => {
    const { facts, files } = computeFacts(process.cwd())
    const changelog = readFileSync('CHANGELOG.md', 'utf8')
    expect(facts.releases).toBe(changelog.match(/^## v\d/gm)?.length)
    expect(facts.latestRelease.version).toMatch(/^v\d+\.\d+\.\d+$/)
    expect(facts.tests).toBeGreaterThan(facts.testFiles)
    expect(facts.rlsChecks).toBeGreaterThan(0)
    expect(facts.license).toBe('MIT')
    expect(facts.shortcuts.map((s) => s.label)).toContain('Command palette')
    expect(files.every((file) => file.startsWith(process.cwd()))).toBe(true)
  })
})
